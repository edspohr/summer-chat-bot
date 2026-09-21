import { useCallback } from "react";

interface ComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled: boolean;
  placeholder: string;
  /** Label for the send button. Coach uses "Enviar", Mentor uses an arrow. */
  sendLabel?: string;
  variant?: "coach" | "mentor";
}

// Shared chat composer. Enter sends; Shift+Enter inserts a newline; keys
// during IME composition (writing á, é, ó, etc.) are ignored — that fixed a
// bug where Enter was eaten by the composition commit and never fired the
// send handler on macOS with dead-key input. Same handler in Mentor and Coach.
export function Composer({
  value,
  onChange,
  onSend,
  disabled,
  placeholder,
  sendLabel = "Enviar",
  variant = "coach",
}: ComposerProps) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter" || e.shiftKey) return;
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      onSend();
    },
    [onSend]
  );

  const buttonClass =
    variant === "mentor"
      ? "bg-summer-teal hover:bg-teal-400 text-white rounded-2xl p-3 w-12 h-12 flex items-center justify-center shadow-md disabled:opacity-40 transition-all hover:scale-105 active:scale-95"
      : "bg-summer-blue hover:bg-blue-400 text-white rounded-2xl px-5 py-3 text-sm font-bold font-secondary tracking-wide disabled:opacity-40 transition-colors shadow-sm";

  const buttonContent = variant === "mentor" ? <span className="text-xl">→</span> : sendLabel;

  const inputBg = variant === "mentor" ? "bg-stone-50" : "bg-warm-bg";
  const focusRing = variant === "mentor" ? "focus:ring-summer-teal/50" : "focus:ring-summer-blue/50";

  return (
    <div className="flex gap-3 items-end">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={1}
        disabled={disabled}
        className={`flex-1 resize-none rounded-2xl border border-stone-200 ${inputBg} px-4 py-3 font-secondary text-sm focus:outline-none focus:ring-2 ${focusRing} disabled:opacity-50 transition-all`}
      />
      <button
        onClick={onSend}
        disabled={disabled || !value.trim()}
        className={buttonClass}
      >
        {buttonContent}
      </button>
    </div>
  );
}
