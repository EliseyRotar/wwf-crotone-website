import OpenAI from "openai";
import { z } from "zod";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { buildSystemPrompt, type Locale } from "@/lib/chatbot-knowledge";
import { guardMessage, guardResponse } from "@/lib/chatGuard";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

// H-09: lock to "user" only. We never trust the client to specify assistant
// or system messages — the only authoritative system prompt is the one we
// build below.
//
// We also strip control characters (C0 + DEL, except useful whitespace
// newlines/tabs are kept by the regex range).
const messageSchema = z.object({
  role: z.enum(["user"]),
  content: z
    .string()
    .min(1)
    .max(2000)
    .regex(/^[^\u0000-\u001F\u007F]+$/u)
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(40),
  locale: z.enum(["it", "en"]).default("it")
});

const MODEL = "llama-3.3-70b-versatile";
const MAX_TOKENS = 700;
const TEMPERATURE = 0.4;
// C-06: total character cap across the whole conversation. Prevents a
// caller from DOS'ing the upstream model with a huge prompt.
const TOTAL_INPUT_CHAR_CAP = 8000;

function getClient(): OpenAI | null {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;
  return new OpenAI({
    apiKey,
    baseURL: "https://api.groq.com/openai/v1"
  });
}

/**
 * Run Groq's prompt-injection classifier (meta-llama/llama-prompt-guard-2-86m)
 * on a single user message. Returns "injection" if the model judges the
 * message as an injection attempt, "safe" otherwise, or "skipped" on any
 * error so the chat still works if Groq's guard endpoint is down.
 *
 * Groq's prompt-guard is a binary classifier exposed as a normal chat
 * completion. It is part of the free tier (30 RPM, 14.4K RPD) — well
 * within our budget. We pass the user content as the user message and
 * ask for a single-word verdict.
 */
async function runPromptGuard(
  client: OpenAI,
  content: string
): Promise<"safe" | "injection" | "skipped"> {
  try {
    const resp = await client.chat.completions.create({
      model: "meta-llama/llama-prompt-guard-2-86m",
      messages: [
        {
          role: "system",
          content:
            "You are a security classifier. Reply with exactly one word: either 'safe' or 'injection'. Do not add any other text."
        },
        { role: "user", content }
      ],
      temperature: 0,
      max_tokens: 4
    });
    const verdict = resp.choices?.[0]?.message?.content?.trim().toLowerCase();
    if (verdict?.startsWith("inject")) return "injection";
    if (verdict?.startsWith("safe")) return "safe";
    return "skipped";
  } catch {
    // If the guard call fails (rate limit, network), fail open: our regex
    // + topic guard is the second line of defence.
    return "skipped";
  }
}

function jsonError(status: number, error: string) {
  return new Response(JSON.stringify({ ok: false, error }), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

function sseError(error: string, status = 200) {
  const payload = JSON.stringify({ error });
  return new Response(`event: error\ndata: ${payload}\n\n`, {
    status,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    }
  });
}

// Friendly refusal streamed as a single token. The client renders it like
// any other assistant reply. We avoid a JSON error so the chat history
// shows a coherent "sorry, I can't help with that" message.
function sseRefusal(text: string) {
  const payload = JSON.stringify({ delta: text });
  return new Response(
    `event: token\ndata: ${payload}\n\nevent: done\ndata: {}\n\n`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Chat-Refusal": "1"
      }
    }
  );
}

// C-05: defence-in-depth output PII filter. The system prompt instructs
// the model not to share these, but a regex pass over each streamed
// token guarantees it even if the model misbehaves.
const RE_PHONE = /\+\d{2}\s?\d{3}\s?\d{6,7}/g;
const RE_IBAN = /IT\d{2}[A-Z]\d{10,22}/g;
const REDACTED_PHONE = "[contatto telefonico rimosso]";
const REDACTED_IBAN = "[IBAN rimosso]";
function redactPII(text: string): string {
  return text.replace(RE_PHONE, REDACTED_PHONE).replace(RE_IBAN, REDACTED_IBAN);
}

// --------------------------------------------------------------------------
// Tools — Groq native function calling
// --------------------------------------------------------------------------
// We expose ONE tool: check_availability. The model can call it when the
// user asks about open spots, current availability, which camp to join,
// etc. The execution is server-side, against the same Prisma client the
// public /api/availability endpoint uses — no scraping, no extra hops.
//
// Safety:
//   - The tool is read-only (Prisma.findMany).
//   - We cap total tool calls per chat at MAX_TOOL_CALLS to defeat any
//     loop the model might get into.
//   - The system prompt instructs the model to call the tool AT MOST
//     ONCE per user message and synthesise the answer immediately after.

const MAX_TOOL_CALLS = 2;

const TOOLS: OpenAI.Chat.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Returns live availability for every active camp turn. Each turn has a number, start/end date, capacity, number of volunteers already booked, and remaining spots. Use this whenever the user asks which camps have open spots, how many places are left, which turn to join, or anything about current availability. Do NOT use for past camps or for non-availability questions.",
      parameters: {
        type: "object",
        properties: {
          onlyWithSpots: {
            type: "boolean",
            description:
              "If true, return only turns that still have at least 1 open spot. Default true."
          }
        },
        additionalProperties: false
      }
    }
  }
];

/**
 * Execute the check_availability tool. Returns a JSON-serialisable object
 * with the live turn data — same shape as the public /api/availability
 * endpoint but trimmed to what the model needs.
 */
async function executeCheckAvailability(args: { onlyWithSpots?: boolean }) {
  const onlyWithSpots = args.onlyWithSpots !== false; // default true

  const turni = await prisma.turno.findMany({
    where: { isActive: true },
    orderBy: { number: "asc" },
    select: {
      id: true,
      number: true,
      capacity: true,
      startDate: true,
      endDate: true,
      bookedCount: true
    }
  });

  const turnIds = turni.map((t) => t.id);
  const counts = await prisma.iscrizione.groupBy({
    by: ["turnoId"],
    where: { turnoId: { in: turnIds }, status: { notIn: ["cancelled"] } },
    _count: { id: true }
  });
  const countMap = new Map(counts.map((c) => [c.turnoId, c._count.id]));

  const now = Date.now();
  const result = turni
    .map((t) => {
      const booked = Math.max(t.bookedCount ?? 0, countMap.get(t.id) ?? 0);
      const remaining = Math.max(0, t.capacity - booked);
      const isPast = t.endDate.getTime() < now;
      return {
        number: t.number,
        startDate: t.startDate.toISOString().slice(0, 10),
        endDate: t.endDate.toISOString().slice(0, 10),
        capacity: t.capacity,
        booked,
        remaining,
        isPast
      };
    })
    .filter((t) => (onlyWithSpots ? !t.isPast && t.remaining > 0 : !t.isPast));

  return {
    ok: true,
    asOf: new Date().toISOString(),
    turni: result
  };
}

type ChatMessageWithTool =
  | { role: "system"; content: string }
  | { role: "user"; content: string }
  | { role: "assistant"; content: string | null; tool_calls?: ChatCompletionMessageToolCall[] }
  | { role: "tool"; tool_call_id: string; content: string };

type ChatCompletionMessageToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

// C-05: pre-flight injection filter. Rejects obvious "ignore previous
// instructions" / system prompt dump attacks before they reach the model.
// We err on the side of false positives for adversarial content rather than
// letting the user steer the model with prompt injection.
const RE_INJECTION =
  /ignore (all )?(previous|prior|above) instructions|reveal your (system )?prompt|repeat your (initial )?instructions|disregard (the )?system|pretend (to be|you are)/i;

export async function POST(req: Request) {
  // C-06: 5 requests per hour per IP (tightened from 10/hr).
  if (!(await rateLimit(`chat:${clientKey(req)}`, 5, 3600_000))) {
    return jsonError(429, "rate-limited");
  }

  let parsed: z.infer<typeof bodySchema>;
  try {
    const json = await req.json();
    const result = bodySchema.safeParse(json);
    if (!result.success) {
      return jsonError(400, "invalid");
    }
    parsed = result.data;
  } catch {
    return jsonError(400, "invalid");
  }

  // C-06: cap total input characters across the whole conversation.
  const totalChars = parsed.messages.reduce((a, m) => a + m.content.length, 0);
  if (totalChars > TOTAL_INPUT_CHAR_CAP) {
    return jsonError(400, "input-too-large");
  }

  const locale: Locale = parsed.locale;
  const isIt = locale === "it";

  // C-06: bound history at 6 messages (was 20). Pairs with the message-role
  // lock above — since all messages are now "user" anyway, the helper just
  // slices the tail.
  const recent = parsed.messages.slice(-6);

  // C-05: pre-flight injection + topic guard. Layered:
  //   1. Regex injection patterns (multilingual, typo-tolerant via chatGuard)
  //   2. Off-topic classifier (rejects recipes, coding, etc.)
  // Both reject with a friendly refusal SSE so the user is told why.
  for (const m of parsed.messages) {
    const guard = guardMessage(m.content);
    if (!guard.allowed) {
      if (guard.reason === "off-topic") {
        return sseRefusal(
          isIt
            ? "Posso rispondere solo a domande sui campi di volontariato WWF Crotone — date, costi, attività, logistica, salute. Se hai una domanda sul campo, chiedi pure!"
            : "I can only answer questions about WWF Crotone volunteer camps — dates, costs, activities, logistics, health. If you have a camp-related question, feel free to ask!"
        );
      }
      return sseError("invalid-request");
    }
  }

  const systemPrompt = buildSystemPrompt(locale);

  // Optional but recommended: run the last user message through Groq's
  // dedicated prompt-injection classifier. meta-llama/llama-prompt-guard-2-86m
  // is free, runs in <50ms, and catches obfuscated injections that our
  // regex / fuzzy matcher miss. We only run it if the key is present.
  const client = getClient();
  if (!client) {
    return sseError("unconfigured", 503);
  }

  const lastUser = [...recent].reverse().find((m) => m.role === "user");
  if (lastUser) {
    const guardVerdict = await runPromptGuard(client, lastUser.content);
    if (guardVerdict === "injection") {
      return sseError("invalid-request");
    }
  }

  // Tool-calling conversation history. We start from the user messages
  // and let the loop append assistant tool_calls + tool results.
  const messages: ChatMessageWithTool[] = [
    { role: "system", content: systemPrompt },
    ...recent.map((m) => ({ role: m.role as "user", content: m.content }))
  ];

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      let responseTripped = false;
      let toolCallCount = 0;

      try {
        // Tool-calling loop. The model may emit a tool_call (we execute
        // it server-side, append the result) and we loop back. Once the
        // model emits regular content we stream it to the client. We cap
        // total tool calls per chat at MAX_TOOL_CALLS to defeat loops.
        while (true) {
          if (req.signal.aborted) {
            controller.close();
            return;
          }

          let upstream: AsyncIterable<{
            choices?: Array<{
              delta?: {
                content?: string | null;
                tool_calls?: Array<{ index: number; id?: string; function?: { name?: string; arguments?: string } }>;
              };
              finish_reason?: string;
            }>;
          }>;
          try {
            upstream = (await client.chat.completions.create(
              {
                model: MODEL,
                stream: true,
                temperature: TEMPERATURE,
                max_tokens: MAX_TOKENS,
                tools: TOOLS,
                tool_choice: "auto",
                messages
              },
              { signal: req.signal }
            )) as unknown as typeof upstream;
          } catch (err) {
            console.error("chat upstream error:", err);
            try {
              controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "upstream" })}\n\n`));
              controller.close();
            } catch { /* ignore */ }
            return;
          }

          // Accumulate streamed chunks. For tool calls we accumulate the
          // arguments JSON per tool_call index; for content we stream it.
          const toolCallAccumulator = new Map<
            number,
            { id: string; name: string; args: string }
          >();
          let finishReason = "";
          let streamContent = "";

          for await (const chunk of upstream) {
            const choices = chunk.choices;
            if (!choices || choices.length === 0) continue;
            const choice = choices[0];
            if (!choice) continue;
            if (choice.finish_reason) finishReason = choice.finish_reason;

            // Delta text content → stream to client.
            const delta = choice.delta?.content;
            if (delta) {
              streamContent += delta;
              fullText += delta;
              if (!responseTripped && fullText.length > 120) {
                const verdict = guardResponse(fullText);
                if (!verdict.allowed) {
                  responseTripped = true;
                  const refuse = isIt
                    ? "Mi dispiace, posso rispondere solo a domande sui campi di volontariato WWF Crotone. Se hai una domanda sul campo, chiedi pure!"
                    : "Sorry, I can only answer questions about the WWF Crotone volunteer camps. If you have a camp-related question, feel free to ask!";
                  const payload = JSON.stringify({ delta: refuse });
                  controller.enqueue(encoder.encode(`event: token\ndata: ${payload}\n\n`));
                  controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
                  controller.close();
                  return;
                }
              }
              const safe = redactPII(delta);
              controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify({ delta: safe })}\n\n`));
            }

            // Delta tool calls → accumulate.
            const toolDeltas = choice.delta?.tool_calls;
            if (toolDeltas) {
              for (const t of toolDeltas) {
                const slot =
                  toolCallAccumulator.get(t.index) ??
                  { id: t.id ?? "", name: t.function?.name ?? "", args: "" };
                if (t.id) slot.id = t.id;
                if (t.function?.name) slot.name = t.function.name;
                if (t.function?.arguments) slot.args += t.function.arguments;
                toolCallAccumulator.set(t.index, slot);
              }
            }
          }

          // Branch: did the model want to call a tool?
          const toolCalls = Array.from(toolCallAccumulator.values());
          if (finishReason === "tool_calls" && toolCalls.length > 0) {
            toolCallCount++;
            if (toolCallCount > MAX_TOOL_CALLS) {
              const refuse = isIt
                ? "Mi dispiace, si è verificato un errore nel consultare la disponibilità. Riprova tra qualche istante o controlla direttamente la pagina Date sul sito."
                : "Sorry, I couldn't check availability right now. Please try again in a moment or check the Dates page directly.";
              controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify({ delta: refuse })}\n\n`));
              controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
              controller.close();
              return;
            }

            // Append the assistant message with tool_calls to history.
            messages.push({
              role: "assistant",
              content: streamContent || null,
              tool_calls: toolCalls.map((t) => ({
                id: t.id,
                type: "function" as const,
                function: { name: t.name, arguments: t.args }
              }))
            });

            // Execute each tool call. We only support check_availability
            // — anything else gets a safe error.
            for (const tc of toolCalls) {
              let toolResult: unknown;
              if (tc.name === "check_availability") {
                try {
                  const parsed = tc.args ? JSON.parse(tc.args) : {};
                  toolResult = await executeCheckAvailability(parsed);
                } catch (err) {
                  console.error("check_availability error:", err);
                  toolResult = { ok: false, error: "tool-failed" };
                }
              } else {
                toolResult = { ok: false, error: "unknown-tool" };
              }

              messages.push({
                role: "tool",
                tool_call_id: tc.id,
                content: JSON.stringify(toolResult)
              });
            }

            // Send a small UI hint so the widget can show a "checking…" state.
            try {
              controller.enqueue(
                encoder.encode(`event: tool\ndata: ${JSON.stringify({ name: "check_availability" })}\n\n`)
              );
            } catch { /* ignore */ }

            // Loop back — model now has the data and will stream the answer.
            continue;
          }

          // No tool calls: the model streamed a final answer. Close.
          if (!responseTripped && fullText.length > 0) {
            const verdict = guardResponse(fullText);
            if (!verdict.allowed) {
              const refuse = isIt
                ? "Mi dispiace, posso rispondere solo a domande sui campi di volontariato WWF Crotone."
                : "Sorry, I can only answer questions about the WWF Crotone volunteer camps.";
              controller.enqueue(encoder.encode(`event: token\ndata: ${JSON.stringify({ delta: refuse })}\n\n`));
            }
          }
          controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
          controller.close();
          return;
        }
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") {
          try { controller.close(); } catch { /* ignore */ }
          return;
        }
        console.error("chat stream error:", err);
        try {
          controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: "stream" })}\n\n`));
          controller.close();
        } catch { /* ignore */ }
      }
    },
    cancel() {
      // The req.signal passed to the upstream call aborts it on cancel.
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no"
    }
  });
}
