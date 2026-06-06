import { useState } from "react";
import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes.jsx";
import Login from "./pages/Login.jsx";
import FamilySetup from "./pages/FamilySetup.jsx";
import { useAuth } from "./context/AuthContext.jsx";

export default function App() {
  const { currentUser, authLoading } = useAuth();
  const [familyId, setFamilyId] = useState(null);

  if (authLoading) {
    return <div className="page">Loading...</div>;
  }

  if (!currentUser) {
    return <Login />;
  }

  if (!familyId) {
    return <FamilySetup onFamilyReady={setFamilyId} />;
  }

  return (
    <BrowserRouter>
      <AppRoutes familyId={familyId} />
    </BrowserRouter>
  );
}