import { useState } from "react";
import { FaEye, FaEyeSlash, FaShieldAlt } from "react-icons/fa";

const API = "/api";

async function request(path, token, options = {}) {
  const response = await fetch(`${API}${path}`, {
    ...options,
    cache: "no-store",
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    const message = error.message || `Request failed (${response.status})`;
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) return response.json();
  return null;
}

export default function Login({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const installApp = () => {
    setError("Use your browser menu and choose Install app / Add to Home screen.");
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      onLogin(
        await request("/auth/login", "", {
          method: "POST",
          body: JSON.stringify({ email, password }),
        }),
        rememberMe,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="login-shell">
      <section className="login-brand">
        <img className="campaign-logo" src="/bsa-logo.png" alt="BSA Oyo Ahead logo" />
        <p className="command-kicker">Election Intelligence Platform</p>
        <h1 className="command-title">Election Monitoring Command Center</h1>
        <p className="command-copy">
          Real-time monitoring, coordinated field operations and location-based election intelligence.
        </p>
        <div className="security-line">
          <FaShieldAlt size={12} />
          <span>Secure operations access</span>
        </div>
      </section>

      <form className="login-card" onSubmit={submit}>
        <img className="login-card-logo" src="/bsa-logo.png" alt="BSA Oyo Ahead logo" />
        <div className="eyebrow">SECURE ACCESS</div>
        <h2>Welcome back</h2>
        <p className="muted">Sign in with your authorized election operations credentials.</p>

        <label>
          Email address
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <div className="password-wrap">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              title={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <FaEyeSlash size={14} /> : <FaEye size={14} />}
            </button>
          </div>
        </label>

        <div className="remember-row">
          <label className="remember-label">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
            />
            <span>Remember me</span>
          </label>
        </div>

        {error && <div className="error">{error}</div>}

        <button className="primary" disabled={loading}>
          {loading ? "Authenticating..." : "Enter command center →"}
        </button>

        <button type="button" className="install-login" onClick={installApp}>
          Install command center app
        </button>

        <p className="powered-by">SIGAR Vote Oyo</p>
      </form>
    </main>
  );
}
