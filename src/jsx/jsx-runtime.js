// The app's JSX runtime = React's, plus responsive `srcset` on every <img> (see src/lib/img.js).
import { jsx as rjsx, jsxs as rjsxs, Fragment } from "react/jsx-runtime";
import { withSrcset } from "../lib/img";

export { Fragment };
export const jsx = (type, props, key) => rjsx(type, type === "img" ? withSrcset(props) : props, key);
export const jsxs = (type, props, key) => rjsxs(type, type === "img" ? withSrcset(props) : props, key);
