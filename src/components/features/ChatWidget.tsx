"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { MessageCircle, X, Send, Loader2, Sparkles } from "lucide-react";
import { SUGGESTED_QUESTIONS } from "@/lib/chatbot-knowledge";

type ChatRole = "user" | "assistant";
type ChatMessage = { id: string; role: ChatRole; content: string; pending?: boolean; error?: boolean; toolHint?: string };

type Copy = Record<string, string>;

const STORAGE_KEY = "wwf-chat-history";
const MAX_HISTORY = 40;

const COPY: Record<"it" | "en", Copy> = {
  it: {
    fabOpen: "Apri assistente",
    fabClose: "Chiudi assistente",
    headerTitle: "Assistente WWF Crotone",
    headerSub: "Online · risposta in pochi secondi",
    placeholder: "Scrivi una domanda…",
    send: "Invia",
    empty: "Ciao! Sono l'assistente virtuale di WWF Crotone. Chiedimi informazioni sui campi di volontariato, le date, i costi, la logistica o le attività.",
    thinking: "Sto scrivendo…",
    errorRate: "Troppe richieste. Riprova tra qualche minuto.",
    errorGeneric: "Si è verificato un errore. Riprova o scrivici a wwfcrotone26@gmail.com.",
    errorUnconfigured: "Il servizio chat non è ancora attivo. Per informazioni scrivi a wwfcrotone26@gmail.com.",
    disclaimer: "Le conversazioni non vengono salvate. Per informazioni ufficiali contatta info@wwfcrotone.it",
    clear: "Nuova conversazione",
    suggestedTitle: "Suggerimenti rapidi"
  },
  en: {
    fabOpen: "Open assistant",
    fabClose: "Close assistant",
    headerTitle: "WWF Crotone Assistant",
    headerSub: "Online · reply in seconds",
    placeholder: "Ask a question…",
    send: "Send",
    empty: "Hi! I'm the WWF Crotone virtual assistant. Ask me about the volunteer camps, dates, costs, logistics or activities.",
    thinking: "Typing…",
    errorRate: "Too many requests. Please try again in a few minutes.",
    errorGeneric: "Something went wrong. Try again or email us at wwfcrotone26@gmail.com.",
    errorUnconfigured: "The chat service is not configured yet. For information email wwfcrotone26@gmail.com.",
    disclaimer: "Conversations are not stored. For official information contact info@wwfcrotone.it",
    clear: "New conversation",
    suggestedTitle: "Quick questions"
  }
};

function uid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function loadHistory(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ChatMessage[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((m) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string");
  } catch {
    return [];
  }
}

function saveHistory(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    const trimmed = messages.slice(-MAX_HISTORY);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // ignore quota errors
  }
}

function clearHistory() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export default function ChatWidget() {
  const locale = useLocale();
  const isIt = locale === "it";
  const t: Copy = COPY[isIt ? "it" : "en"];

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Load stored history on mount
  useEffect(() => {
    setMessages(loadHistory());
    setHydrated(true);
  }, []);

  // Persist on every change
  useEffect(() => {
    if (!hydrated) return;
    saveHistory(messages);
  }, [messages, hydrated]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    const el = messagesRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // Focus management & focus trap when the panel opens/closes
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
      if (previouslyFocused.current && typeof previouslyFocused.current.focus === "function") {
        previouslyFocused.current.focus();
      }
      return;
    }

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const t = window.setTimeout(() => inputRef.current?.focus(), 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "Tab" && panelRef.current) {
        const focusables = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || streaming) return;

      const userMsg: ChatMessage = { id: uid(), role: "user", content: trimmed };
      const placeholderId = uid();
      const assistantMsg: ChatMessage = { id: placeholderId, role: "assistant", content: "", pending: true };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setInput("");
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      const historyForApi = [...messages, userMsg]
        .filter((m) => !m.pending && !m.error)
        .map((m) => ({ role: m.role, content: m.content }));

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: historyForApi, locale: isIt ? "it" : "en" }),
          signal: controller.signal
        });

        if (res.status === 429) {
          setMessages((prev) =>
            prev.map((m) => (m.id === placeholderId ? { ...m, content: t.errorRate, pending: false, error: true } : m))
          );
          setStreaming(false);
          return;
        }

        if (!res.ok || !res.body) {
          let message = t.errorGeneric;
          if (res.status === 503) message = t.errorUnconfigured;
          setMessages((prev) =>
            prev.map((m) => (m.id === placeholderId ? { ...m, content: message, pending: false, error: true } : m))
          );
          setStreaming(false);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let acc = "";
        let buffer = "";
        // Sub-status shown when the assistant invokes a tool (e.g. checking
        // live availability). Cleared as soon as regular tokens arrive.
        let toolHint = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx: number;
          while ((idx = buffer.indexOf("\n\n")) !== -1) {
            const rawEvent = buffer.slice(0, idx);
            buffer = buffer.slice(idx + 2);
            const lines = rawEvent.split("\n");
            let event = "message";
            let dataStr = "";
            for (const line of lines) {
              if (line.startsWith("event:")) event = line.slice(6).trim();
              else if (line.startsWith("data:")) dataStr += line.slice(5).trim();
            }
            if (!dataStr) continue;
            if (event === "token") {
              try {
                const parsed = JSON.parse(dataStr) as { delta?: string };
                if (parsed.delta) {
                  acc += parsed.delta;
                  if (toolHint) toolHint = "";
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === placeholderId
                        ? { ...m, content: acc, pending: false, toolHint }
                        : m
                    )
                  );
                }
              } catch {
                // ignore malformed
              }
            } else if (event === "tool") {
              // Server told us a tool was invoked. Show a small hint while
              // we wait for the streamed answer.
              try {
                const parsed = JSON.parse(dataStr) as { name?: string };
                if (parsed.name === "check_availability") {
                  toolHint = isIt
                    ? "Controllo la disponibilità in tempo reale…"
                    : "Checking live availability…";
                  setMessages((prev) =>
                    prev.map((m) =>
                      m.id === placeholderId ? { ...m, content: acc, pending: false, toolHint } : m
                    )
                  );
                }
              } catch {
                // ignore malformed
              }
            } else if (event === "error") {
              setMessages((prev) =>
                prev.map((m) => (m.id === placeholderId ? { ...m, content: t.errorGeneric, pending: false, error: true } : m))
              );
            }
          }
        }

        // If we exited without any content, surface a generic error
        setMessages((prev) =>
          prev.map((m) => (m.id === placeholderId && !acc ? { ...m, content: t.errorGeneric, pending: false, error: true } : m))
        );
      } catch (err) {
        if ((err as { name?: string })?.name === "AbortError") return;
        setMessages((prev) =>
          prev.map((m) => (m.id === placeholderId ? { ...m, content: t.errorGeneric, pending: false, error: true } : m))
        );
      } finally {
        setStreaming(false);
        abortRef.current = null;
      }
    },
    [messages, streaming, isIt, t.errorGeneric, t.errorRate, t.errorUnconfigured]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const startNew = () => {
    if (streaming) {
      abortRef.current?.abort();
      abortRef.current = null;
    }
    setMessages([]);
    clearHistory();
    setStreaming(false);
  };

  const showSuggestions = messages.length === 0;
  const suggestions = SUGGESTED_QUESTIONS[isIt ? "it" : "en"];

  return (
    <>
      {/* Floating Action Button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="chat-fab"
        aria-label={open ? t.fabClose : t.fabOpen}
        aria-expanded={open}
        aria-controls="wwf-chat-panel"
      >
        {open ? <X size={24} /> : <MessageCircle size={26} />}
      </button>

      {/* Panel */}
      {open && (
        <div
          ref={panelRef}
          id="wwf-chat-panel"
          role="dialog"
          aria-modal="false"
          aria-labelledby="wwf-chat-title"
          className="chat-panel"
        >
          <header className="chat-header">
            <div className="flex items-center gap-3 min-w-0">
              <span className="chat-avatar" aria-hidden="true">
                <Sparkles size={16} />
              </span>
              <div className="min-w-0">
                <h2 id="wwf-chat-title" className="chat-title">
                  {t.headerTitle}
                </h2>
                <p className="chat-sub">
                  <span className="chat-dot" aria-hidden="true" />
                  {t.headerSub}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={startNew}
                className="chat-iconbtn"
                aria-label={t.clear}
                title={t.clear}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M3 12a9 9 0 1 0 3-6.7" />
                  <path d="M3 4v5h5" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="chat-iconbtn"
                aria-label={t.fabClose}
                title={t.fabClose}
              >
                <X size={18} />
              </button>
            </div>
          </header>

          <div ref={messagesRef} className="chat-messages" role="log" aria-live="polite" aria-relevant="additions text">
            {showSuggestions && (
              <div className="chat-empty">
                <p className="chat-empty-text">{t.empty}</p>
                <p className="chat-suggested-label">{t.suggestedTitle}</p>
                <ul className="chat-suggestions">
                  {suggestions.map((q) => (
                    <li key={q}>
                      <button
                        type="button"
                        className="chat-suggestion"
                        onClick={() => void send(q)}
                        disabled={streaming}
                      >
                        {q}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`chat-bubble-row ${m.role === "user" ? "is-user" : "is-bot"}`}>
                <div
                  className={`chat-bubble ${m.role === "user" ? "chat-bubble-user" : "chat-bubble-bot"}${m.error ? " chat-bubble-error" : ""}`}
                >
                  {m.content || (m.pending ? <span className="chat-typing" aria-label={t.thinking}><span /><span /><span /></span> : "")}
                  {!m.content && m.toolHint && (
                    <span className="chat-tool-hint" aria-live="polite">{m.toolHint}</span>
                  )}
                  {m.content && m.toolHint && (
                    <span className="chat-tool-hint chat-tool-hint-inline" aria-live="polite">{m.toolHint}</span>
                  )}
                </div>
              </div>
            ))}
            {streaming && messages[messages.length - 1]?.content && (
              <div className="chat-bubble-row is-bot">
                <div className="chat-bubble chat-bubble-bot chat-typing-line" aria-hidden="true">
                  <span className="chat-typing"><span /><span /><span /></span>
                </div>
              </div>
            )}
          </div>

          <form
            className="chat-inputbar"
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
          >
            <label htmlFor="wwf-chat-input" className="sr-only">
              {t.placeholder}
            </label>
            <textarea
              id="wwf-chat-input"
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={t.placeholder}
              rows={1}
              maxLength={500}
              disabled={streaming}
              className="chat-input"
            />
            <button
              type="submit"
              className="chat-send"
              disabled={streaming || !input.trim()}
              aria-label={t.send}
              title={t.send}
            >
              {streaming ? <Loader2 size={18} className="chat-spin" /> : <Send size={18} />}
            </button>
          </form>

          <p className="chat-disclaimer">{t.disclaimer}</p>
        </div>
      )}
    </>
  );
}
