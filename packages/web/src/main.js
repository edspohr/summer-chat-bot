import { jsx as _jsx } from "react/jsx-runtime";
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import "./index.css";
const rootEl = document.getElementById("root");
if (rootEl === null)
    throw new Error("Root element not found");
ReactDOM.createRoot(rootEl).render(_jsx(React.StrictMode, { children: _jsx(App, {}) }));
