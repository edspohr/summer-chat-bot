import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function TagProgress({ items }) {
    const completed = items.filter((i) => i.completed).length;
    return (_jsxs("div", { className: "flex flex-col gap-1", "aria-label": "Progreso de la sesi\u00F3n", children: [_jsx("div", { className: "flex gap-1", children: items.map((item) => (_jsx("div", { className: `h-1.5 flex-1 rounded-full transition-colors ${item.completed ? "bg-teal-500" : "bg-stone-200"}`, role: "progressbar", "aria-valuenow": item.completed ? 1 : 0, "aria-valuemin": 0, "aria-valuemax": 1 }, item.tagId))) }), _jsxs("p", { className: "text-xs text-stone-400 text-right", children: [completed, " / ", items.length] })] }));
}
