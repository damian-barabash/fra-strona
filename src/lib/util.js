export function hexToRgb(hex) {
  const h = (hex || "#888888").replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const int = parseInt(n, 16);
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
}
// very light tint of a color over white — used for the fleet section background
export function tint(hex, amt = 0.08) {
  const { r, g, b } = hexToRgb(hex);
  const mix = (c) => Math.round(c * amt + 255 * (1 - amt));
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
export function isLight(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) > 150;
}
