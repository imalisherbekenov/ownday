export type HeatPoint = { date: string; intensity: 0 | 1 | 2 | 3 | 4 };
export function intensityStyle(level: HeatPoint["intensity"]) {
  return level === 0
    ? "var(--color-surface-2)"
    : level === 4
      ? "var(--color-done)"
      : `color-mix(in srgb, var(--color-done) ${[0, 28, 55, 80][level]}%, var(--color-surface-2))`;
}
const cellStyle = (level: HeatPoint["intensity"]) => ({
  width: "var(--layout-heat-cell-size)",
  height: "var(--layout-heat-cell-size)",
  borderRadius: "calc(var(--layout-heat-cell-size) * 0.2273)",
  backgroundColor: intensityStyle(level),
});
export function Heatmap({ points }: { points: HeatPoint[] }) {
  return (
    <div>
      <div
        className="grid w-max grid-flow-col grid-rows-7"
        style={{ gap: "var(--layout-heat-cell-gap)" }}
        aria-label="Yearly completion heatmap"
      >
        {points.map((point, index) => (
          <span
            key={`${point.date}-${index}`}
            title={`${point.date}: level ${point.intensity}`}
            data-intensity={point.intensity}
            className="block"
            style={cellStyle(point.intensity)}
          />
        ))}
      </div>
      <div className="mt-2 flex items-center justify-end gap-1 text-[10px] font-bold uppercase tracking-wider text-ink-3">
        <span>Less</span>
        {([0, 1, 2, 3, 4] as const).map((level) => (
          <span key={level} className="block" style={cellStyle(level)} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
