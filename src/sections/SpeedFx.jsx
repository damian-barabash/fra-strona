/** Subtle diagonal racing speed-streaks — decorative, low opacity. */
export default function SpeedFx({ count = 5 }) {
  const lines = Array.from({ length: count }, (_, i) => ({
    top: `${8 + i * 17 + (i % 2) * 7}%`,
    width: `${130 + (i % 3) * 90}px`,
    delay: `${i * 0.8}s`,
    dur: `${2.8 + (i % 3) * 0.7}s`,
  }));
  return (
    <div className="speedfx" aria-hidden="true">
      {lines.map((l, i) => (
        <span key={i} style={{ top: l.top, width: l.width, animationDelay: l.delay, animationDuration: l.dur }} />
      ))}
    </div>
  );
}
