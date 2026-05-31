import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Navbar } from "./components/Navbar";
import { AnimatedBackground } from "./components/AnimatedBackground";
import HomePage from "../pages/HomePage";
import AppDashboard from "../pages/AppDashboard";

export default function App() {
  return (
    <div className="min-h-screen w-full overflow-x-hidden relative">
      {/* Continuous animated background across entire page */}
      <AnimatedBackground />

      {/* All content sits on top of the animated background */}
      <BrowserRouter>
        <div className="relative z-10">
          <Navbar />
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/app" element={<AppDashboard />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </BrowserRouter>
    </div>
  );
}
