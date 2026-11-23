/** NVIDIA NIM chat helper (free, OpenAI-compatible). Shared by the AI routes. */
export const NIM_BASE = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
export const NIM_MODEL = process.env.NVIDIA_MODEL || "nvidia/nemotron-3.5-super-vl-120b-a12b";
export const NIM_FALLBACK = process.env.NVIDIA_FALLBACK_MODEL || "nvidia/nemotron-3.5-lightning-30b-a3b";

export type Msg = { role: string; content: string | ({ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } })[] };

export async function chat(messages: Msg[], maxTokens: number, timeouts: [number, number] = [75000, 35000]) {
  try {
    return await chatWith(NIM_MODEL, messages, maxTokens, timeouts[0]);
  } catch (e) {
    if (!NIM_FALLBACK || NIM_FALLBACK === NIM_MODEL) throw e;
    // Fallback model is text-only: drop images.
    const textOnly = messages.map((m) => (typeof m.content === "string" ? m : { ...m, content: m.content.filter((c) => c.type === "text") }));
    return chatWith(NIM_FALLBACK, textOnly, maxTokens, timeouts[1]);
  }
}

export async function chatWith(model: string, messages: Msg[], maxTokens: number, timeoutMs: number) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${NIM_BASE}/chat/completions`, {
      method: "POST",
      signal: ctrl.signal,
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.NVIDIA_API_KEY}` },
      // Thinking off: faster, and the whole token budget goes to the answer (Nemotron/Qwen-style models).
      body: JSON.stringify({ model, messages, temperature: 0.3, max_tokens: maxTokens, chat_template_kwargs: { enable_thinking: false } }),
    });
    if (!r.ok) throw new Error(`NVIDIA API ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    // Reasoning models may include a <think>…</think> block; drop it.
    const out = ((j.choices?.[0]?.message?.content as string) || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    if (!out) throw new Error(`${model} returned an empty answer (finish: ${j.choices?.[0]?.finish_reason})`);
    return out;
  } finally {
    clearTimeout(t);
  }
}

/** Pulls the first JSON object/array out of a model answer. */
export function parseJson<T>(text: string, kind: "object" | "array" = "object"): T | null {
  const m = text.match(kind === "array" ? /\[[\s\S]*\]/ : /\{[\s\S]*\}/);
  if (!m) return null;
  try { return JSON.parse(m[0]) as T; } catch { return null; }
}
