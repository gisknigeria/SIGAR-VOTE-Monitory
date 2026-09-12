import { useEffect, useState } from "react";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import { API } from "../../config.js";
import { getInstallState, requestAppInstall, subscribeToInstallState } from "../../pwaInstall.js";

const safeApiErrorMessage = (status, body, contentType = "") => {
  const message = typeof body === "object" && body
    ? body?.message
    : typeof body === "string"
      ? body.trim()
      : "";
  const isHtml = contentType.toLowerCase().includes("text/html")
    || /<!doctype\s+html|<html[\s>]|<style[\s>]|data:font\//i.test(message);

  if (status === 429) return "Too many requests. Please wait a moment and try again.";
  if (!isHtml && message && message.length <= 300) return message;
  if (status >= 500) return "Service temporarily unavailable. Please try again shortly.";
  return `Request failed (${status})`;
};

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

  const contentType = response.headers.get("content-type") || "";
  if (!response.ok) {
    const body = contentType.includes("application/json")
      ? await response.json().catch(() => ({}))
      : await response.text().catch(() => "");
    throw new Error(safeApiErrorMessage(response.status, body, contentType));
  }

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
  const [installState, setInstallState] = useState(getInstallState);
  const [installMessage, setInstallMessage] = useState("");

  useEffect(() => subscribeToInstallState(setInstallState), []);

  const installApp = async () => {
    setInstallMessage("");
    const result = await requestAppInstall();

    if (result.status === "accepted")
      setInstallMessage("Installation started. The app will appear on your device shortly.");
    else if (result.status === "installed")
      setInstallMessage("The app is already installed on this device.");
    else if (result.status === "dismissed")
      setInstallMessage("Installation was cancelled. Reload the page when ready, then press Install again.");
    else if (result.status === "ios-help")
      setInstallMessage("On iPhone or iPad: tap Share, then choose Add to Home Screen.");
    else
      setInstallMessage("Install is not available yet. Use a secure HTTPS page in Chrome or Edge, then try again.");
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
      </section>

      <form className="login-card" onSubmit={submit}>
        <img className="login-card-logo" src="/bsa-logo.png" alt="BSA Oyo Ahead logo" />
        <div className="eyebrow">SECURE ACCESS</div>
        <h2>Welcome back</h2>
        <p className="muted">Sign in with your authorized election operations credentials.</p>

        <label>
          Email, phone number or agent login ID
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="text"
            autoComplete="username"
            required
          />
        </label>

        <label>
          Password
          <div className="password-wrap">
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPassword ? "text" : "password"}
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
          {installState.installed ? "App installed" : installState.canPrompt ? "Install command center app" : "Install app"}
        </button>

        {installMessage && <div className="install-status" role="status">{installMessage}</div>}

        <p className="powered-by">SIGAR Vote Oyo</p>
      </form>
    </main>
  );
}
