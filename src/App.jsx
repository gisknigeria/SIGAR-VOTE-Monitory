import { useState } from "react";
import Login from "./components/auth/Login.jsx";
import { lazy, Suspense } from "react";

const Dashboard = lazy(() => import("./components/dashboard/Dashboard.jsx"));

const API = "/api";

export default function App() {
  const [session, setSession] = useState(() => {
    try {
      const stored = localStorage.getItem("command-session");
      if (stored) return JSON.parse(stored);
      const sessionStored = sessionStorage.getItem("command-session");
      return sessionStored ? JSON.parse(sessionStored) : null;
    } catch {
      return null;
    }
  });

  const login = (value, rememberMe = true) => {
    const sessionValue = JSON.stringify(value);
    const storage = rememberMe ? localStorage : sessionStorage;
    const staleStorage = rememberMe ? sessionStorage : localStorage;
    storage.setItem("command-session", sessionValue);
    staleStorage.removeItem("command-session");
    setSession(value);
  };

  const logout = () => {
    fetch(`${API}/auth/logout`, { method: "POST", credentials: "same-origin" }).catch(() => {});
    localStorage.removeItem("command-session");
    sessionStorage.removeItem("command-session");
    setSession(null);
  };

  const updateSession = (value) => {
    const next = { token: value.token, user: value.user };
    if (localStorage.getItem("command-session")) {
      localStorage.setItem("command-session", JSON.stringify(next));
    } else {
      sessionStorage.setItem("command-session", JSON.stringify(next));
    }
    setSession(next);
  };

  return session ? (
    <Suspense fallback={<div className="app-loading" role="status"><span></span><b>Loading command center…</b></div>}>
      <Dashboard session={session} onLogout={logout} onSessionUpdate={updateSession} />
    </Suspense>
  ) : (
    <Login onLogin={login} />
  );
}
