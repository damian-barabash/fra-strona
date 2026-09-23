// SVG fuel graphics (no emoji): a realistic gauge (E→F needle), a pump-nozzle
// glyph and a vertical filling tank. Used by the fleet slider and the booking page.
import { useEffect, useRef, useState } from "react";

const TAU = Math.PI / 180;
const A_E = 214;  // needle angle at Empty (lower-left)
const A_F = -34;  // needle angle at Full (lower-right)
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const polar = (cx, cy, r, a) => [cx + r * Math.cos(a * TAU), cy - r * Math.sin(a * TAU)];
const arc = (cx, cy, r, a0, a1) => {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  const sweep = a1 < a0 ? 1 : 0;
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} ${sweep} ${x1.toFixed(2)} ${y1.toFixed(2)}`;
};

/** Fuel-pump / nozzle glyph, drawn from paths. Inherits `currentColor`. */
export function FuelPumpGlyph({ className = "" }) {
  return (
    <g className={className}>
      {/* dispenser body */}
      <path d="M0 3.2c0-1 .8-1.8 1.8-1.8h5.9c1 0 1.8.8 1.8 1.8V18H0z" />
      {/* display window */}
      <rect x="1.7" y="4.7" width="6.1" height="4.2" rx="1" className="fuel__pumpwin" />
      {/* base */}
      <rect x="-1.1" y="17.4" width="11.7" height="2.4" rx="1" />
      {/* hose arm + nozzle */}
      <path d="M9.5 6.4h2c1 0 1.8.8 1.8 1.8v4.9a1.55 1.55 0 0 0 3.1 0V9.3l-2-2"
        fill="none" strokeWidth="1.5" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
    </g>
  );
}

/** Round fuel gauge with a needle sweeping Empty→Full. value 0..1.
 *  The needle EASES toward the target value (rAF) so it animates smoothly
 *  when the booking advances a step instead of snapping. */
export function FuelGauge({ value = 0.5, big = false, className = "" }) {
  const target = clamp01(value);
  const [disp, setDisp] = useState(target);
  const cur = useRef(target);
  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const from = cur.current, t0 = performance.now(), dur = 750;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      cur.current = from + (target - from) * eased;
      setDisp(cur.current);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);

  const v = clamp01(disp);
  const cx = 100, cy = 104, R = 78;
  const ang = A_E + (A_F - A_E) * v;
  const [nx, ny] = polar(cx, cy, R * 0.78, ang);
  const ticks = [];
  for (let i = 0; i <= 8; i++) {
    const a = A_E + (A_F - A_E) * (i / 8);
    const major = i % 4 === 0;
    const [x0, y0] = polar(cx, cy, R, a);
    const [x1, y1] = polar(cx, cy, R - (major ? 13 : 7), a);
    ticks.push([x0, y0, x1, y1, major, i]);
  }
  const [ex, ey] = polar(cx, cy, R + 15, A_E);
  const [fx, fy] = polar(cx, cy, R + 15, A_F);
  return (
    <div className={`fuel ${big ? "fuel--big" : ""} ${className}`} aria-hidden="true">
      <svg viewBox="0 0 200 134" className="fuel__svg">
        <path d={arc(cx, cy, R, A_E, A_F)} className="fuel__track" />
        <path d={arc(cx, cy, R, 26, A_F)} className="fuel__red" />
        {ticks.map((t, i) => (
          <line key={i} x1={t[0].toFixed(2)} y1={t[1].toFixed(2)} x2={t[2].toFixed(2)} y2={t[3].toFixed(2)}
            className={t[4] ? "fuel__tick fuel__tick--major" : "fuel__tick"} />
        ))}
        <line x1={cx} y1={cy} x2={nx.toFixed(2)} y2={ny.toFixed(2)} className="fuel__needle" />
        <circle cx={cx} cy={cy} r="8" className="fuel__hub" />
        <circle cx={cx} cy={cy} r="3.4" className="fuel__hub2" />
        <text x={ex.toFixed(1)} y={(ey + 5).toFixed(1)} className="fuel__lbl">E</text>
        <text x={fx.toFixed(1)} y={(fy + 5).toFixed(1)} className="fuel__lbl fuel__lbl--f">F</text>
        <g transform={`translate(${cx - 8.5} ${cy + 12})`} className="fuel__pump"><FuelPumpGlyph /></g>
      </svg>
    </div>
  );
}

/** Vertical filling tank for the payment step. fill 0..100. */
export function FuelTank({ fill = 0, done = false }) {
  return (
    <div className="fl-tank">
      <div className="fl-tank__glass">
        <div className="fl-tank__fuel" style={{ height: `${fill}%` }}><span className="fl-tank__wave" /></div>
        <span className="fl-tank__pct"><b>{done ? 100 : Math.round(fill)}</b><i>%</i></span>
      </div>
      <div className="fl-tank__nozzle">
        <svg viewBox="0 0 18 22" width="30" height="36" className="fuel__pump fl-tank__pumpsvg"><FuelPumpGlyph /></svg>
      </div>
    </div>
  );
}

/** Speedometer — the configurator's progress dial: 0 → 300 km/h as the steps advance, red zone
 *  at the top end, eased needle, digital readout. Same props as FuelGauge (value 0..1, big). */
export function Speedo({ value = 0, big = false, className = "" }) {
  const target = clamp01(value);
  const [disp, setDisp] = useState(target);
  const cur = useRef(target);
  const raf = useRef(0);
  useEffect(() => {
    cancelAnimationFrame(raf.current);
    const from = cur.current, t0 = performance.now(), dur = 850;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      cur.current = from + (target - from) * eased;
      setDisp(cur.current);
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);

  const v = clamp01(disp);
  const cx = 100, cy = 100, R = 80;
  const A0 = 220, A1 = -40;                   // sweep: lower-left → lower-right
  const ang = A0 + (A1 - A0) * v;
  const [nx, ny] = polar(cx, cy, R * 0.74, ang);
  const [tx, ty] = polar(cx, cy, -14, ang);   // short tail behind the hub
  const kmh = Math.round(v * 300);
  const ticks = [];
  for (let i = 0; i <= 30; i++) {
    const a = A0 + (A1 - A0) * (i / 30);
    const major = i % 5 === 0;
    const [x1, y1] = polar(cx, cy, R - (major ? 12 : 6), a);
    const [x2, y2] = polar(cx, cy, R + 1, a);
    ticks.push(<line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className={`spd__tick ${major ? "spd__tick--major" : ""} ${i >= 24 ? "spd__tick--red" : ""}`} />);
    if (major) { const [lx, ly] = polar(cx, cy, R - 24, a); ticks.push(<text key={`l${i}`} x={lx} y={ly + 3.5} className="spd__num">{i * 10}</text>); }
  }
  return (
    <div className={`spd ${big ? "spd--big" : ""} ${className}`} role="img" aria-label={`${kmh} km/h`}>
      <svg viewBox="0 0 200 150" className="spd__svg">
        <path d={arc(cx, cy, R, A0, A1)} className="spd__track" />
        <path d={arc(cx, cy, R, A0 + (A1 - A0) * 0.8, A1)} className="spd__redzone" />
        <path d={arc(cx, cy, R, A0, ang)} className="spd__fill" />
        {ticks}
        <line x1={tx} y1={ty} x2={nx} y2={ny} className="spd__needle" />
        <circle cx={cx} cy={cy} r="7" className="spd__hub" /><circle cx={cx} cy={cy} r="2.6" className="spd__hub2" />
        <text x={cx} y={cy + 30} className="spd__kmh">{kmh}</text>
        <text x={cx} y={cy + 42} className="spd__unit">KM/H</text>
      </svg>
    </div>
  );
}
