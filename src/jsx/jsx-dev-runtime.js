// dev build of src/jsx/jsx-runtime.js
import { jsxDEV as rjsxDEV, Fragment } from "react/jsx-dev-runtime";
import { withSrcset } from "../lib/img";
import { localProps } from "../lib/media";

export { Fragment };
const fix = (type, props) => {
  if (typeof type !== "string") return props;
  const p = localProps(type, props);
  return type === "img" ? withSrcset(p) : p;
};
export const jsxDEV = (type, props, key, isStatic, source, self) => rjsxDEV(type, fix(type, props), key, isStatic, source, self);
