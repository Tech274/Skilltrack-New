import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import ReactMarkdown from "react-markdown";
import { Sparkles, Send, Loader2, X, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

/**
 * Floating AI Invoice Assistant. Calls /api/chat/invoice-assistant, which
 * defines tool calls server-side (search/aggregate/markPaid/draft/send).
 * The bearer token is attached manually because the AI SDK transport bypasses
 * the server-fn middleware that normally injects it.
 */
export function InvoiceAssistantPanel() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (!cancelled) setToken(data.session?.access_token ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setToken(s?.access_token ?? null);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat/invoice-assistant",
      headers: (): Record<string, string> =>
        token ? { Authorization: `Bearer ${token}` } : {},
    }),
  });

  const isLoading = status === "submitted" || status === "streaming";

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, status]);

  async function submit() {
    const text = input.trim();
    if (!text || isLoading || !token) return;
    setInput("");
    await sendMessage({ text });
  }

  if (!open) {
    return (
      <Button
        onClick={() => setOpen(true)}
        size="sm"
        className="fixed bottom-6 right-6 z-40 gap-2 shadow-lg"
      >
        <Sparkles className="h-4 w-4" />
        AI Invoice Assistant
      </Button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-40 flex h-[600px] w-[400px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Invoice Assistant</span>
        </div>
        <button
          aria-label="Close assistant"
          onClick={() => setOpen(false)}
          className="rounded-md p-1 text-muted-foreground hover:bg-surface hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </header>

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && (
          <div className="rounded-lg border border-dashed border-border bg-surface/40 p-3 text-xs text-muted-foreground">
            Try asking:
            <ul className="mt-2 space-y-1">
              <li>• "Show unpaid invoices over 500 from this quarter"</li>
              <li>• "Summarize revenue by status this month"</li>
              <li>• "Draft a friendly reminder for invoice INV-..."</li>
            </ul>
          </div>
        )}
        {messages.map((m) => {
          const text = m.parts
            .map((p) => (p.type === "text" ? p.text : ""))
            .join("");
          const toolParts = m.parts.filter((p) =>
            String(p.type).startsWith("tool-"),
          );
          const isUser = m.role === "user";
          return (
            <div
              key={m.id}
              className={`flex flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
            >
              {toolParts.length > 0 && !isUser && (
                <div className="flex flex-wrap gap-1">
                  {toolParts.map((p, i) => (
                    <span
                      key={i}
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-surface/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                    >
                      <Wrench className="h-3 w-3" />
                      {String(p.type).replace(/^tool-/, "")}
                    </span>
                  ))}
                </div>
              )}
              {text && (
                <div
                  className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    isUser
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface text-foreground"
                  }`}
                >
                  {isUser ? (
                    <span className="whitespace-pre-wrap">{text}</span>
                  ) : (
                    <div className="prose prose-sm max-w-none dark:prose-invert">
                      <ReactMarkdown>{text}</ReactMarkdown>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        {isLoading && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Thinking…
          </div>
        )}
        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error.message}
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="border-t border-border p-3"
      >
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void submit();
              }
            }}
            placeholder={token ? "Ask about invoices…" : "Signing in…"}
            disabled={!token || isLoading}
            rows={2}
            className="min-h-[44px] resize-none text-sm"
          />
          <Button
            type="submit"
            size="icon"
            disabled={!token || isLoading || !input.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
