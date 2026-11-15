export class GeminiError extends Error {
  constructor(message: string, public status = 502) {
    super(message);
  }
}

// Tried in order. A model that is retired (404) or too slow is skipped for the next one.
const DEFAULT_MODELS = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];
const TIMEOUT_MS = 40_000;

type Part = { text?: string; thought?: boolean };

export async function geminiJSON<T>(parts: unknown[], schema: object): Promise<T> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set on the server.", 500);

  const custom = process.env.GEMINI_MODEL?.trim();
  const models = custom ? [custom, ...DEFAULT_MODELS.filter((m) => m !== custom)] : DEFAULT_MODELS;

  let lastError: GeminiError = new GeminiError("Gemini request failed.");
  for (const model of models) {
    let res: Response;
    try {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 },
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      console.error(`Gemini ${model} timed out or was unreachable`);
      lastError = new GeminiError("Gemini took too long to answer. Try again.", 504);
      continue;
    }

    if (res.status === 429) {
      throw new GeminiError("Gemini's free-tier rate limit was hit. Wait a minute and try again.", 429);
    }
    if (res.status === 404 || res.status >= 500) {
      console.error(`Gemini ${model} failed`, res.status, await res.text());
      lastError = new GeminiError(`Gemini request failed (${res.status}).`);
      continue;
    }
    if (!res.ok) {
      console.error(`Gemini ${model} error`, res.status, await res.text());
      throw new GeminiError(`Gemini request failed (${res.status}).`);
    }

    const json = await res.json();
    const outParts: Part[] = json?.candidates?.[0]?.content?.parts ?? [];
    const text = outParts.filter((p) => !p.thought && p.text).map((p) => p.text).join("");
    try {
      return JSON.parse(text) as T;
    } catch {
      throw new GeminiError("Gemini returned an unreadable response. Try again.");
    }
  }
  throw lastError;
}
