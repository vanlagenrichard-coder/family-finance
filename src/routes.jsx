import { Routes, Route, Navigate } from "react-router-dom";
import Home from "./screens/Home.jsx";
import History from "./screens/History.jsx";
import Dashboard from "./screens/Dashboard.jsx";
import Settings from "./screens/Settings.jsx";

export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/history" element={<History />} />
      <Route path="/balances" element={<Dashboard />} />
      <Route path="/setup" element={<Settings />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}