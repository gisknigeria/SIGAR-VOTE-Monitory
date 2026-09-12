import bcrypt from "bcryptjs";
import { findLoginUser } from "../../agent-login.js";
import { sanitizeString, validatePassword, validateEmail } from "../../security.js";
export function registerAuthRoutes({ app, auth, rateLimit, loginRateLimit, asyncRoute, store, agent1Email, agent2Email, publicUser, issueToken, sessionCookie, clearSessionCookie, revokeTokenFromRequest }) {
  app.post(
    "/api/auth/login",
    loginRateLimit,
    asyncRoute(async (req, res) => {
      const loginValue = sanitizeString(req.body.email || "").toLowerCase();
      const password = String(req.body.password || "");
      if (!loginValue || loginValue.length > 254 || !password || password.length > 1024)
        return res
          .status(400)
          .json({ message: "An email, phone number or login ID and password are required." });
      const user = await findLoginUser(store, loginValue, { agent1: agent1Email, agent2: agent2Email });
      if (!user || !(await bcrypt.compare(password, user.password)))
        return res.status(401).json({ message: "Invalid login or password. For shared phone numbers, use your login ID." });
      if (!user.active)
        return res.status(403).json({ message: "This account is disabled." });
      const safe = publicUser(user);
      const token = issueToken(user);
      res.setHeader("Set-Cookie", sessionCookie(token));
      res.json({ token, user: safe });
    }),
  );
  app.post("/api/auth/logout", (req, res) => {
    revokeTokenFromRequest(req);
    res.setHeader("Set-Cookie", clearSessionCookie);
    res.status(204).end();
  });
  app.put(
    "/api/profile",
    auth,
    rateLimit,
    asyncRoute(async (req, res) => {
      const current = await store.userByEmail(req.user.email);
      if (!current) return res.status(404).json({ message: "Account not found" });
      const password = String(req.body.password || "");
      const nextName = sanitizeString(req.body.name || current.name).trim();
      const nextEmail = sanitizeString(req.body.email || current.email)
        .trim()
        .toLowerCase();
      const nextStation = sanitizeString(
        req.body.station || current.station || "",
      ).trim();
      if (!validateEmail(nextEmail))
        return res.status(400).json({ message: "A valid email is required." });
      if (password && !validatePassword(password))
        return res
          .status(400)
          .json({
            message:
              "Password must be at least 12 characters and include upper, lower, number, and special characters.",
          });
      if (
        password &&
        !(await bcrypt.compare(
          String(req.body.currentPassword || ""),
          current.password,
        ))
      )
        return res
          .status(403)
          .json({ message: "Current password is incorrect." });
      const existing = (await store.users()).find(
        (user) =>
          user.id !== current.id && user.email.toLowerCase() === nextEmail,
      );
      if (existing)
        return res.status(409).json({ message: "Email is already in use" });
      const updated = await store.updateUserProfile(current.id, {
        name: nextName,
        email: nextEmail,
        station: nextStation,
        password: password ? await bcrypt.hash(password, 10) : null,
      });
      const safe = publicUser(updated);
      const token = issueToken(updated);
      res.setHeader("Set-Cookie", sessionCookie(token));
      res.json({ user: safe, token });
    }),
  );

}
