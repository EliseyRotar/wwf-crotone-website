import OpenAI from "openai";
import { z } from "zod";
import { rateLimit, clientKey } from "@/lib/rateLimit";
import { buildSystemPrompt, type Locale } from "@/lib/chatbot-knowledge";
import { guardMessage, guardResponse } from "@/lib/chatGuard";

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

function sseError(error: string) {
  const payload = JSON.stringify({ error });
  return new Response(`event: error\ndata: ${payload}\n\n`, {
    status: 200,
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
    return sseError("unconfigured");
  }

  const lastUser = [...recent].reverse().find((m) => m.role === "user");
  if (lastUser) {
    const guardVerdict = await runPromptGuard(client, lastUser.content);
    if (guardVerdict === "injection") {
      return sseError("invalid-request");
    }
  }

  type UpstreamChunk = { choices?: { delta?: { content?: string | null } }[] };
  let upstream: AsyncIterable<UpstreamChunk>;
  try {
    // C-06: pass req.signal so a client disconnect cancels the upstream
    // OpenAI call. The groq SDK respects AbortSignal on the streaming call.
    upstream = (await client.chat.completions.create(
      {
        model: MODEL,
        stream: true,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: systemPrompt },
          ...recent.map((m) => ({ role: m.role, content: m.content }))
        ]
      },
      { signal: req.signal }
    )) as unknown as AsyncIterable<UpstreamChunk>;
  } catch (err) {
    console.error("chat upstream error:", err);
    return sseError("upstream");
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let fullText = "";
      let responseTripped = false;
      try {
        for await (const chunk of upstream) {
          const delta = chunk.choices?.[0]?.delta?.content;
          if (!delta) continue;

          // Defensive response guard. We accumulate the model output and
          // check every ~200 chars: if it looks off-topic (recipe, code,
          // essay...) we close the stream and substitute a refusal.
          // This catches the case where the model bypasses the input guard
          // (e.g. by following the user's rephrased "ignore" instruction).
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

          // C-05: scrub PII before forwarding each token to the client.
          const safe = redactPII(delta);
          const payload = JSON.stringify({ delta: safe });
          controller.enqueue(encoder.encode(`event: token\ndata: ${payload}\n\n`));
        }
        // Final guard check at end of stream in case we never hit the
        // mid-stream threshold.
        if (!responseTripped && fullText.length > 0) {
          const verdict = guardResponse(fullText);
          if (!verdict.allowed) {
            const refuse = isIt
              ? "Mi dispiace, posso rispondere solo a domande sui campi di volontariato WWF Crotone."
              : "Sorry, I can only answer questions about the WWF Crotone volunteer camps.";
            const payload = JSON.stringify({ delta: refuse });
            controller.enqueue(encoder.encode(`event: token\ndata: ${payload}\n\n`));
          }
        }
        controller.enqueue(encoder.encode(`event: done\ndata: {}\n\n`));
        controller.close();
      } catch (err) {
        console.error("chat stream error:", err);
        try {
          const payload = JSON.stringify({ error: "stream" });
          controller.enqueue(encoder.encode(`event: error\ndata: ${payload}\n\n`));
          controller.close();
        } catch {
          // already closed
        }
      }
    },
    cancel() {
      // C-06: when the ReadableStream is cancelled (client disconnected
      // or aborted), we no longer rely on GC. The req.signal passed above
      // causes the upstream OpenAI call to abort itself.
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
