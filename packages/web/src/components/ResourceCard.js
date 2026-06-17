import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ResourceCard({ name, contact, hours, description, }) {
    return (_jsxs("div", { className: "border border-gray-200 rounded-lg p-4", children: [_jsx("p", { className: "font-semibold text-sm", children: name }), _jsx("p", { className: "text-blue-600 font-mono text-sm mt-1", children: contact }), _jsx("p", { className: "text-xs text-gray-500 mt-1", children: hours }), _jsx("p", { className: "text-xs text-gray-700 mt-2", children: description })] }));
}
