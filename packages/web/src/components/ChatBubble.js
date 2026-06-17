import { jsx as _jsx } from "react/jsx-runtime";
export function ChatBubble({ role, content }) {
    const isUser = role === "user";
    return (_jsx("div", { className: `flex ${isUser ? "justify-end" : "justify-start"} mb-3`, children: _jsx("div", { className: `max-w-[85%] rounded-2xl px-5 py-3 text-sm leading-relaxed font-secondary shadow-sm ${isUser
                ? "bg-summer-blue text-white rounded-br-none"
                : "bg-white border border-stone-100 text-stone-800 rounded-bl-none"}`, children: content }) }));
}
