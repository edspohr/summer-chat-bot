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
import MartinaDemo from "./pages/MartinaDemo.js";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/mentor" element={<MentorChat />} />
        <Route path="/scenarios" element={<ScenarioSelect />} />
        <Route path="/session/:sessionId" element={<CoachSession />} />
        <Route path="/report/:sessionId" element={<SessionReport />} />
        {/* /martina — QR demo entry: anonymous auth + direct Martina session */}
        <Route path="/martina" element={<MartinaDemo />} />
        {/* /lab is admin-only — not linked in any participant-visible navigation */}
        <Route path="/lab" element={<LabChat />} />
      </Routes>
    </BrowserRouter>
  );
}
