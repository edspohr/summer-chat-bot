// Internal types for Gemini stream processing.
// Deliberate architecture: processGeminiStream is delivery-agnostic so the same
// stream consumer can be reused for HTTP responses, WhatsApp/Twilio webhooks, etc.
// Debt: docs/debt/0008-first-token-latency.md — firstTokenLatencyMs approximation

export interface GenerationUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface StreamCallbacks {
  onFirstChunk: (chunk: string, latencyMs: number) => void;
  onChunk: (chunk: string) => void;
  onComplete: (usage: GenerationUsage, totalLatencyMs: number) => void;
  onError: (error: Error) => void;
}

// Structural type matching Vertex AI GenerateContentResponse stream chunks.
// Using structural typing rather than SDK import to avoid version coupling.
type StreamChunk = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string }> };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
  };
};

export async function processGeminiStream(
  stream: AsyncIterable<StreamChunk>,
  startTime: number,
  callbacks: StreamCallbacks,
): Promise<void> {
  let firstChunkReceived = false;
  let lastUsage: GenerationUsage = { inputTokens: 0, outputTokens: 0 };

  try {
    for await (const chunk of stream) {
      const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

      if (text.length > 0) {
        if (!firstChunkReceived) {
          firstChunkReceived = true;
          callbacks.onFirstChunk(text, Date.now() - startTime);
        } else {
          callbacks.onChunk(text);
        }
      }

      // usageMetadata appears on the final chunk — track the last seen value
      if (chunk.usageMetadata !== undefined) {
        lastUsage = {
          inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
          outputTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
        };
      }
    }

    callbacks.onComplete(lastUsage, Date.now() - startTime);
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
}
