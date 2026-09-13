import express from 'express';
import cors from 'cors';
import { validateContentLength, MAX_REQUEST_BODY_BYTES } from '../security.js';
export function configureHttp({ app, isAllowedOrigin }) {
  app.disable("x-powered-by");
  app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
  app.use(
    cors({
      origin: isAllowedOrigin,
      credentials: true,
      allowedHeaders: ["Content-Type", "Authorization"],
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      maxAge: 600,
    }),
  );
  // Keep the parser limit aligned with the attachment policy.  This prevents
  // oversized JSON from consuming memory before endpoint-level validation runs.
  app.use(express.json({ limit: MAX_REQUEST_BODY_BYTES }));
  app.use(express.urlencoded({ extended: false, limit: "1mb" }));
  app.use((req, res, next) => {
    const bodySize = Number(req.headers["content-length"] || 0);
    if (!validateContentLength(bodySize))
      return res.status(413).json({ message: "Request body is too large." });
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Referrer-Policy", "no-referrer");
    // These capabilities are core application features; scope them to this
    // origin rather than disabling them or allowing cross-origin use.
    res.setHeader(
      "Permissions-Policy",
      "geolocation=(self), camera=(self), microphone=(self)",
    );
    if (req.secure || process.env.NODE_ENV === "production")
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    res.setHeader(
      "Content-Security-Policy",
      "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https:; connect-src 'self' https://nominatim.openstreetmap.org https://router.project-osrm.org ws: wss:; font-src 'self' data: https://fonts.gstatic.com; media-src 'self' data: https:; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
    );
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
    res.setHeader(
      "Cache-Control",
      req.path.startsWith("/api") ? "no-store" : "no-cache",
    );
    next();
  });

}
