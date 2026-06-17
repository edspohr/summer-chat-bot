const FRAME_BREAK_TAG = "[FRAME_BREAK_SUSPECTED]";

export interface StreamResult {
  content: string;
  frameBreakSuspected: boolean;
}

export function stripFrameBreakTag(rawContent: string): StreamResult {
  const index = rawContent.lastIndexOf(FRAME_BREAK_TAG);
  if (index === -1) {
    return { content: rawContent, frameBreakSuspected: false };
  }
  return {
    content: rawContent.slice(0, index).trimEnd(),
    frameBreakSuspected: true,
  };
}
