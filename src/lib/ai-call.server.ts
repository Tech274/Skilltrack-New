// Server-only helpers for AI SDK calls: timeout + usage extraction.

export const DEFAULT_LLM_TIMEOUT_MS = 60_000;

export type LlmUsage = {
  prompt_tokens: number | null;
  completion_tokens: number | null;
  total_tokens: number | null;
  finish_reason: string | null;
};

/**
 * Race a promise against a timeout. The caller is responsible for passing
 * `abortSignal` to the AI SDK call so the upstream HTTP request is cancelled.
 */
export async function withAiTimeout<T>(
  fn: (signal: AbortSignal) => Promise<T>,
  ms: number = DEFAULT_LLM_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`LLM call timed out after ${Math.round(ms / 1000)}s`));
    }, ms);
  });
  try {
    return await Promise.race([fn(controller.signal), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** Normalize AI SDK usage into a flat object safe to JSON-stringify into audit. */
export function extractUsage(result: any): LlmUsage {
  const u = (result?.usage ?? null) as any;
  return {
    prompt_tokens: u?.promptTokens ?? u?.inputTokens ?? null,
    completion_tokens: u?.completionTokens ?? u?.outputTokens ?? null,
    total_tokens: u?.totalTokens ?? null,
    finish_reason: (result?.finishReason ?? null) as string | null,
  };
}
