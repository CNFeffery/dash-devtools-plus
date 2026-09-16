// Dash exposes React as a browser global. This tiny automatic-runtime bridge
// keeps third-party packages on that exact React instance and prevents their
// CommonJS jsx-runtime shim from leaving a browser-side `require()` behind.
import React from "react";

export const Fragment = React.Fragment;

export function jsx(type, props, key) {
  return React.createElement(type, key == null ? props : {...props, key});
}

export function jsxs(type, props = {}, key) {
  const {children, ...rest} = props;
  const config = key == null ? rest : {...rest, key};
  return Array.isArray(children)
    ? React.createElement(type, config, ...children)
    : React.createElement(type, config, children);
}

export const jsxDEV = jsx;
