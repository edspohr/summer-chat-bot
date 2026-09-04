import { BrowserRouter, Routes, Route } from "react-router-dom";
import Landing from "./pages/Landing.js";
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
import AdminAnalytics from "./pages/AdminAnalytics.js";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Public landing — project front door, no auth required. */}
        <Route path="/" element={<Landing />} />
        {/* Authenticated dashboard — post-login target. */}
        <Route path="/inicio" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/mentor" element={<MentorChat />} />
        <Route path="/scenarios" element={<ScenarioSelect />} />
        <Route path="/session/:sessionId" element={<CoachSession />} />
        <Route path="/report/:sessionId" element={<SessionReport />} />
        {/* /martina — QR demo entry: anonymous auth + direct Martina session */}
        <Route path="/martina" element={<MartinaDemo />} />
        {/* /lab — facilitator-only tool; open (anon sign-in). Not linked in any participant-visible navigation. */}
        <Route path="/lab" element={<LabChat />} />
        {/* /admin/analytics — aggregate dashboard; open (anon sign-in). Data is aggregated/non-personal by design. */}
        <Route path="/admin/analytics" element={<AdminAnalytics />} />
      </Routes>
    </BrowserRouter>
  );
}
