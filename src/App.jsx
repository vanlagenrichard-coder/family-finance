import { BrowserRouter } from "react-router-dom";
import AppRoutes from "./routes.jsx";
import Login from "./pages/Login.jsx";
import { useAuth } from "./context/AuthContext.jsx";

export default function App() {
  const { currentUser, authLoading } = useAuth();

  if (authLoading) {
    return <div className="page">Loading...</div>;
  }

  if (!currentUser) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}