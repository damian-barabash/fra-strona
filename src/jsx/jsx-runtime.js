// The app's JSX runtime = React's, plus:
//  - Storage files swapped for their GitHub Pages copy (src/lib/media.js)
//  - responsive `srcset` on every <img> (src/lib/img.js)
import { jsx as rjsx, jsxs as rjsxs, Fragment } from "react/jsx-runtime";
import { withSrcset } from "../lib/img";
import { localProps } from "../lib/media";

export { Fragment };
const fix = (type, props) => {
  if (typeof type !== "string") return props;
  const p = localProps(type, props);
  return type === "img" ? withSrcset(p) : p;
};
export const jsx = (type, props, key) => rjsx(type, fix(type, props), key);
export const jsxs = (type, props, key) => rjsxs(type, fix(type, props), key);
