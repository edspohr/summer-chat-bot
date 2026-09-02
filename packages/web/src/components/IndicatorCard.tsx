// Shared indicator card used on the analytics dashboard. Enforces the
// MED-02 contract: every card carries a subtitle explaining *what* it
// measures and a visible `n =` so no percentage floats without its
// denominator.
//
// Styling follows docs/design_guidelines.md — rounded-2xl, soft shadow,
// font-title on the value, font-secondary body copy, stone-500 for n.

interface IndicatorCardProps {
  title: string;
  value: string;
  subtitle: string;
  n?: number | undefined;
  note?: string | undefined;
}

export function IndicatorCard({ title, value, subtitle, n, note }: IndicatorCardProps) {
  return (
    <article className="bg-white rounded-2xl border border-stone-200 p-4 shadow-sm space-y-2">
      <header className="space-y-0.5">
        <h4 className="font-secondary text-[11px] uppercase tracking-wider text-stone-500">
          {title}
        </h4>
        <p className="font-title text-stone-800 text-2xl md:text-3xl tabular-nums leading-tight">
          {value}
        </p>
      </header>
      <p className="font-secondary text-[11px] text-stone-500 leading-snug">{subtitle}</p>
      <div className="flex items-baseline justify-between gap-2 pt-1 border-t border-stone-100">
        {n !== undefined ? (
          <span className="font-secondary text-[10px] text-stone-500 tabular-nums">
            n = {n}
          </span>
        ) : (
          <span />
        )}
        {note !== undefined && (
          <span className="font-secondary text-[10px] text-stone-400 italic text-right">
            {note}
          </span>
        )}
      </div>
    </article>
  );
}
