---
id: 0008
title: firstTokenLatencyMs is approximated via stream iterator timing
severity: low
status: open
---

## What was done

`firstTokenLatencyMs` in the Latency Lab metrics is measured as the elapsed time from
the start of `processGeminiStream` (which begins when `generateContentStream` resolves)
to the arrival of the first chunk with non-empty text from the async iterator.

This is NOT the same as network time-to-first-byte from Vertex AI. The measurement
includes: time for `generateContentStream` to resolve + internal SDK buffering +
async iterator scheduling overhead.

The Vertex AI Node.js SDK (`@google-cloud/vertexai`) does not expose a native
`firstTokenLatencyMs` field. The `usageMetadata` object contains token counts but
not timing.

## Why

The SDK does not provide a native first-token timestamp. The async iterator approach
is the only available signal without instrumenting the underlying HTTP connection.

## What should be done

Option A (acceptable): Keep the current approximation and document its meaning clearly
in the lab UI tooltip ("tiempo hasta primer fragmento del iterador asíncrono").

Option B (more accurate): Use the raw `fetch`/gRPC layer timestamps if the SDK exposes
them in a future version, or switch to the Vertex AI REST API with `streamGenerateContent`
and read the `Content-Type: text/event-stream` response timing directly.

Recommend Option A until the measurement proves insufficient for lab purposes.

## Estimated effort

Option A: 1 hour (UI tooltip + documentation).
Option B: 1–2 days (HTTP layer instrumentation).

## Context

The approximation is consistent across measurements within the same environment, so
it is useful for relative comparisons between modes (mentor vs coach_raw vs coach_context).
Absolute values will be slightly inflated compared to true TTFB from Vertex AI data centers.
