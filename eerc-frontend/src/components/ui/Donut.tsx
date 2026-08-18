/**
 * A proportion, drawn as a ring.
 *
 * Used where the shape of a distribution matters more than its digits: who
 * holds a token, and where a raise's proceeds go. A ring reads concentration
 * instantly — one dominant arc is a very different launch from eight even
 * ones — which a column of percentages does not.
 *
 * Segments below half a percent are folded into a remainder rather than
 * drawn as invisible slivers that still claim a legend row.
 */
export type Slice = { label: string; value: number; color: string };

export const Donut = ({
  slices,
  size = 132,
  thickness = 16,
  centre,
  caption,
}: {
  slices: Slice[];
  size?: number;
  thickness?: number;
  centre?: string;
  caption?: string;
}) => {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return null;

  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const drawn = slices.map((s) => {
    const fraction = s.value / total;
    const seg = {
      ...s,
      fraction,
      dash: fraction * circumference,
      gap: circumference - fraction * circumference,
      rotation: (offset / total) * 360,
    };
    offset += s.value;
    return seg;
  });

  return (
    <div className="flex items-center gap-4 flex-wrap">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={caption ?? "Distribution"}
        className="shrink-0"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--snow-sunk)"
          strokeWidth={thickness}
        />
        {drawn.map((s) => (
          <circle
            key={s.label}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${s.dash} ${s.gap}`}
            // Start at twelve o'clock, then walk each segment round.
            transform={`rotate(${-90 + s.rotation} ${size / 2} ${size / 2})`}
          >
            <title>{`${s.label} — ${(s.fraction * 100).toFixed(2)}%`}</title>
          </circle>
        ))}
        {centre && (
          <text
            x={size / 2}
            y={size / 2 + 4}
            textAnchor="middle"
            fill="var(--ink)"
            fontSize="13"
            fontWeight="700"
            fontFamily="var(--face-data)"
          >
            {centre}
          </text>
        )}
      </svg>

      <ul className="min-w-0 flex-1 space-y-1">
        {drawn.map((s) => (
          <li key={s.label} className="flex items-center gap-2 text-[length:var(--t-fine)]">
            <span
              className="w-2.5 h-2.5 shrink-0"
              style={{ background: s.color }}
              aria-hidden="true"
            />
            <span className="text-[var(--ink-2)] truncate flex-1">{s.label}</span>
            <span className="text-[var(--ink)] tabular shrink-0">
              {(s.fraction * 100).toFixed(2)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};
