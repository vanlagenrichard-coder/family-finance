import { useEffect, useState } from "react";
import {
  createFamily,
  getUserFamilyId,
  joinFamily,
} from "../firebase/familyService";
import { useAuth } from "../context/AuthContext";

export default function FamilySetup({ onFamilyReady }) {
  const { currentUser, logout } = useAuth();

  const [joinCode, setJoinCode] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function checkFamily() {
      if (!currentUser) return;

      try {
        const savedFamilyId = localStorage.getItem("familyId");

        if (savedFamilyId) {
          onFamilyReady(savedFamilyId);
          return;
        }

        const existingFamilyId = await getUserFamilyId(currentUser.uid);

        if (existingFamilyId) {
          localStorage.setItem("familyId", existingFamilyId);
          onFamilyReady(existingFamilyId);
          return;
        }

        setLoading(false);
      } catch (err) {
        setError(err.message);
        setLoading(false);
      }
    }

    checkFamily();
  }, [currentUser, onFamilyReady]);

  async function handleCreateFamily() {
    setError("");
    setWorking(true);

    try {
      const newFamilyId = await createFamily(currentUser);

      localStorage.setItem("familyId", newFamilyId);

      onFamilyReady(newFamilyId);
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function handleJoinFamily(e) {
    e.preventDefault();

    const trimmedCode = joinCode.trim();

    if (!trimmedCode) return;

    setError("");
    setWorking(true);

    try {
      await joinFamily(currentUser, trimmedCode);

      localStorage.setItem("familyId", trimmedCode);

      onFamilyReady(trimmedCode);
    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function handleLogout() {
    localStorage.removeItem("familyId");
    await logout();
  }

  if (loading) {
    return <div className="page">Checking family budget...</div>;
  }

  return (
    <div className="page">
      <h1>Family Budget</h1>

      <p>Use one shared family budget for both phones.</p>

      {error && <p style={{ color: "red" }}>{error}</p>}

      <button type="button" onClick={handleCreateFamily} disabled={working}>
        Create Family Budget
      </button>

      <form onSubmit={handleJoinFamily}>
        <input
          type="text"
          placeholder="Enter family code"
          value={joinCode}
          onChange={(e) => setJoinCode(e.target.value)}
        />

        <button type="submit" disabled={working || !joinCode.trim()}>
          Join Family Budget
        </button>
      </form>

      <button type="button" onClick={handleLogout}>
        Logout
      </button>
    </div>
  );
}