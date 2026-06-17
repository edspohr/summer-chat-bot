import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home.js";
import Login from "./pages/Login.js";
import Register from "./pages/Register.js";
import ForgotPassword from "./pages/ForgotPassword.js";
import MentorChat from "./pages/MentorChat.js";
import ScenarioSelect from "./pages/ScenarioSelect.js";
import CoachSession from "./pages/CoachSession.js";
import SessionReport from "./pages/SessionReport.js";
import LabChat from "./pages/LabChat.js";
export default function App() {
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Home, {}) }), _jsx(Route, { path: "/login", element: _jsx(Login, {}) }), _jsx(Route, { path: "/register", element: _jsx(Register, {}) }), _jsx(Route, { path: "/forgot-password", element: _jsx(ForgotPassword, {}) }), _jsx(Route, { path: "/mentor", element: _jsx(MentorChat, {}) }), _jsx(Route, { path: "/scenarios", element: _jsx(ScenarioSelect, {}) }), _jsx(Route, { path: "/session/:sessionId", element: _jsx(CoachSession, {}) }), _jsx(Route, { path: "/report/:sessionId", element: _jsx(SessionReport, {}) }), _jsx(Route, { path: "/lab", element: _jsx(LabChat, {}) })] }) }));
}
