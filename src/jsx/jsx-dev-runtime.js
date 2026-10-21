// dev build of src/jsx/jsx-runtime.js
import { jsxDEV as rjsxDEV, Fragment } from "react/jsx-dev-runtime";
import { withSrcset } from "../lib/img";

export { Fragment };
export const jsxDEV = (type, props, key, isStatic, source, self) => rjsxDEV(type, type === "img" ? withSrcset(props) : props, key, isStatic, source, self);
