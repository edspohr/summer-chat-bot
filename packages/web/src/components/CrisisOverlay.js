import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// Shown when safety layer activates. Covers chat completely, disables input.
// The "resume" button is only enabled after explicit user confirmation.
export function CrisisOverlay({ template, onConfirmResume, canResume, }) {
    return (_jsx("div", { className: "fixed inset-0 bg-warm-bg z-50 flex flex-col items-center justify-center p-6", children: _jsxs("div", { className: "max-w-md w-full space-y-6", children: [_jsx("div", { className: "w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center", children: _jsx("span", { className: "text-teal-600 text-lg", children: "\u2661" }) }), _jsx("p", { className: "text-stone-800 whitespace-pre-wrap text-sm leading-relaxed", children: template }), canResume && (_jsx("button", { onClick: onConfirmResume, className: "w-full bg-stone-800 hover:bg-stone-900 text-white rounded-xl py-3 text-sm font-medium transition-colors", children: "Estoy listo/a para retomar el entrenamiento" }))] }) }));
}
