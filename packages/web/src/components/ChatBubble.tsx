interface ChatBubbleProps {
  role: "user" | "assistant";
  content: string;
  avatarUrl?: string;
  speakerName?: string;
}

type Segment = { kind: "speech" | "direction"; text: string };

// Split a message into interleaved speech and stage-direction segments.
// Stage directions are anything inside square brackets [ ... ] OR inside
// parentheses ( ... ) when the parenthetical is 3+ words long (short parens
// like "(sí)" are treated as spoken dialogue, longer ones are narration).
const DIRECTION_RE = /\[([^\]]+)\]|\(([^()]{3,})\)/g;

function isNarration(text: string): boolean {
  // 3+ words → treat as narration/stage direction, not spoken parenthetical.
  return text.trim().split(/\s+/).length >= 3;
}

function segmentContent(content: string): Segment[] {
  const parts: Segment[] = [];

  // When speech follows a direction, the model sometimes leaves the sentence
  // terminator that would have preceded the bracket right at the start of the
  // next chunk (". Ahí, nomás."). Strip a SINGLE lone leading terminator when
  // it directly follows a direction segment. Do NOT touch ellipses ("...",
  // "..") nor "…" (U+2026) — those are part of Martina's hesitation and
  // deliberately preserved.
  function pushSpeech(text: string): void {
    let cleaned = text.trim();
    if (cleaned.length === 0) return;
    const prev = parts[parts.length - 1];
    if (prev?.kind === "direction") {
      // `.(?!\.)` ensures the leading char is a single period, not the head of
      // an ellipsis; the class covers `. , ; :` — all valid sentence enders.
      cleaned = cleaned.replace(/^(?:\.(?!\.)|[,;:])\s+/, "");
    }
    if (cleaned.length > 0) parts.push({ kind: "speech", text: cleaned });
  }

  let last = 0;
  let match: RegExpExecArray | null;
  DIRECTION_RE.lastIndex = 0;
  while ((match = DIRECTION_RE.exec(content)) !== null) {
    const inner = (match[1] ?? match[2] ?? "").trim();
    const isParen = match[1] === undefined;
    if (isParen && !isNarration(inner)) continue;
    if (match.index > last) {
      pushSpeech(content.slice(last, match.index));
    }
    parts.push({ kind: "direction", text: inner });
    last = DIRECTION_RE.lastIndex;
  }
  if (last < content.length) {
    pushSpeech(content.slice(last));
  }
  return parts.length > 0 ? parts : [{ kind: "speech", text: content }];
}

export function ChatBubble({ role, content, avatarUrl, speakerName }: ChatBubbleProps) {
  const isUser = role === "user";
  const segments = segmentContent(content);

  const bubble = (
    <div
      className={`max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed font-secondary shadow-sm ${
        isUser
          ? "bg-summer-blue text-white rounded-br-none"
          : "bg-white border border-stone-100 text-stone-800 rounded-bl-none"
      }`}
    >
      {segments.map((seg, i) =>
        seg.kind === "speech" ? (
          <p key={i} className={i > 0 ? "mt-1" : undefined}>
            {seg.text}
          </p>
        ) : (
          <p
            key={i}
            className={`mt-1.5 text-[11px] italic ${
              isUser ? "text-white/70" : "text-stone-400"
            }`}
          >
            {seg.text}
          </p>
        )
      )}
    </div>
  );

  if (isUser || avatarUrl === undefined) {
    return <div className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>{bubble}</div>;
  }

  // Assistant with avatar — image sits on the left, aligned to bubble bottom.
  // The inner img is scaled up (140%) inside a fixed circle so Martina's face
  // fills the frame instead of getting lost in the wide illustration.
  return (
    <div className="flex justify-start mb-3 gap-2 items-end">
      <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 shadow-sm bg-summer-peach/20">
        <img
          src={avatarUrl}
          alt={speakerName ?? "Martina"}
          className="w-full h-full object-cover"
          style={{ objectPosition: "50% 24%", transform: "scale(1.75)", transformOrigin: "50% 30%" }}
        />
      </div>
      {bubble}
    </div>
  );
}
