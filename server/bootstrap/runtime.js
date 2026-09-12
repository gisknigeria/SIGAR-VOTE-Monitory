import bcrypt from 'bcryptjs';
import pg from 'pg';
import sharp from 'sharp';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { validatePassword } from '../security.js';
import { normalizeCloudflareTurnKeyId, normalizeCloudflareTurnTtl, sanitizeIceServers } from '../turn.js';
import { createStore } from '../store.js';
import { createMappers } from '../infrastructure/persistence/mappers.js';
import { initPostgres } from '../infrastructure/persistence/bootstrap.js';

export function resolveSecurityPolicy(env = process.env) {
  const nodeEnv = String(env?.NODE_ENV || 'development').toLowerCase();
  const production = nodeEnv === 'production';
  const requiredKeys = ['JWT_SECRET', 'SUPER_ADMIN_PASSWORD', 'ADMIN_PASSWORD'];
  const missing = requiredKeys.filter((key) => !String(env?.[key] || '').trim());

  if (production && missing.length) {
    throw new Error(`Missing required production configuration: ${missing.join(', ')}`);
  }

  const jwtSecret = String(env?.JWT_SECRET || '').trim();
  if (production && jwtSecret && Buffer.byteLength(jwtSecret, 'utf8') < 32) {
    throw new Error('JWT_SECRET must contain at least 32 bytes');
  }

  const superAdminPassword = String(env?.SUPER_ADMIN_PASSWORD || '').trim();
  const adminPassword = String(env?.ADMIN_PASSWORD || '').trim();
  if (production && (!validatePassword(superAdminPassword) || !validatePassword(adminPassword))) {
    throw new Error('Seed administrator passwords do not meet the password policy');
  }

  const accessReviewDays = Number(env?.ACCESS_REVIEW_DAYS || 90);
  const evidenceRetentionDays = Number(env?.EVIDENCE_RETENTION_DAYS || 365);
  const auditRetentionDays = Number(env?.AUDIT_RETENTION_DAYS || 2555);

  return {
    environment: nodeEnv,
    secretManagement: {
      enforceProductionEnv: production,
      requiredKeys,
      productionConfigured: production
        ? requiredKeys.every((key) => Boolean(String(env?.[key] || '').trim()))
        : true,
      jwtSecretLength: jwtSecret ? Buffer.byteLength(jwtSecret, 'utf8') : 0,
    },
    accessReview: {
      enabled: true,
      cadenceDays: Number.isFinite(accessReviewDays) && accessReviewDays > 0 ? accessReviewDays : 90,
      requiredForAdminChanges: true,
    },
    retention: {
      evidenceDays: Number.isFinite(evidenceRetentionDays) && evidenceRetentionDays > 0 ? evidenceRetentionDays : 365,
      auditLogsDays: Number.isFinite(auditRetentionDays) && auditRetentionDays > 0 ? auditRetentionDays : 2555,
      deletionPolicy: 'retain-only-with-approved-archive-and-legal-hold',
    },
    roleScope: {
      'Super Admin': {
        geographies: ['Oyo State'],
        responsibilities: ['system-configuration', 'identity-admin', 'secret-management', 'access-review', 'audit-review'],
        maxScope: 'state-wide',
      },
      Admin: {
        geographies: ['Oyo State'],
        responsibilities: ['command-center', 'result-oversight', 'incident-authorization', 'access-review'],
        maxScope: 'state-wide',
      },
      Supervisor: {
        geographies: ['LGA', 'Ward'],
        responsibilities: ['lga-ward-operations', 'field-assignment', 'escalation-approval'],
        maxScope: 'local',
      },
      Agent: {
        geographies: ['Polling Unit'],
        responsibilities: ['field-capture', 'incident-reporting', 'evidence-upload'],
        maxScope: 'unit-level',
      },
    },
  };
}

export async function createRuntime({ serverDirectory }) {
  const { Pool } = pg;
  const runtimePolicy = resolveSecurityPolicy(process.env);
  sharp.cache({ memory: 16, files: 0, items: 10 });
  sharp.concurrency(1);
  const __dirname = serverDirectory;
  const dataFile = process.env.DATA_FILE || join(__dirname, "data.json");
  const bundledOsunIrevArchiveFile = join(
    __dirname,
    "data",
    "osunIrevArchive.json",
  );
  const bundledOsunIrevArchive = (() => {
    if (!existsSync(bundledOsunIrevArchiveFile)) return null;
    try {
      const archive = JSON.parse(
        readFileSync(bundledOsunIrevArchiveFile, "utf8"),
      );
      return archive?.electionId && Array.isArray(archive.uploads)
        ? archive
        : null;
    } catch (error) {
      console.warn(
        "[irev] Bundled Osun archive could not be read:",
        error.message,
      );
      return null;
    }
  })();
  const secret = process.env.JWT_SECRET || randomBytes(32).toString("hex");
  if (!process.env.JWT_SECRET) {
    console.warn(
      "JWT_SECRET is not set. Using a generated ephemeral secret for this process.",
    );
  }
  if (runtimePolicy.secretManagement.enforceProductionEnv && !process.env.JWT_SECRET) {
    throw new Error('Missing required production configuration: JWT_SECRET');
  }
  const databaseUrl = process.env.DATABASE_URL;
  const superAdminEmail =
    process.env.SUPER_ADMIN_EMAIL || "superadmin@command.local";
  const superAdminPassword =
    process.env.SUPER_ADMIN_PASSWORD || randomBytes(24).toString("hex");
  const adminEmail = process.env.ADMIN_EMAIL || "admin@command.local";
  const adminPassword =
    process.env.ADMIN_PASSWORD || randomBytes(24).toString("hex");
  const agent1Email = process.env.AGENT1_EMAIL || "agent1@command.local";
  const agent1Password = process.env.AGENT1_PASSWORD || "AgentOne!2026Secure";
  const agent2Email = process.env.AGENT2_EMAIL || "agent2@command.local";
  const agent2Password = process.env.AGENT2_PASSWORD || "AgentTwo!2026Secure";
  const cloudflareTurnKeyId = normalizeCloudflareTurnKeyId(
    process.env.CLOUDFLARE_TURN_KEY_ID,
  );
  const cloudflareTurnApiToken = String(
    process.env.CLOUDFLARE_TURN_API_TOKEN || "",
  ).trim();
  const cloudflareTurnTtl = normalizeCloudflareTurnTtl(
    process.env.CLOUDFLARE_TURN_TTL,
  );
  const hasCloudflareTurn = Boolean(
    cloudflareTurnKeyId && cloudflareTurnApiToken,
  );
  const expressTurnUrls = String(process.env.EXPRESSTURN_URLS || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  const expressTurnServers = sanitizeIceServers(
    expressTurnUrls.length
      ? [
          {
            urls: expressTurnUrls,
            username: String(process.env.EXPRESSTURN_USERNAME || "").trim(),
            credential: String(process.env.EXPRESSTURN_PASSWORD || "").trim(),
          },
        ]
      : [],
  );
  const hasExpressTurn = expressTurnServers.some((server) => {
    const urls = Array.isArray(server.urls) ? server.urls : [server.urls];
    return Boolean(
      server.username &&
      server.credential &&
      urls.some((url) => /^turns?:/i.test(url)),
    );
  });
  if (
    (process.env.CLOUDFLARE_TURN_KEY_ID ||
      process.env.CLOUDFLARE_TURN_API_TOKEN) &&
    !hasCloudflareTurn
  ) {
    console.warn(
      "Cloudflare TURN is not fully configured. Live video will use ExpressTURN or the STUN fallback.",
    );
  }
  if (!hasCloudflareTurn && !hasExpressTurn)
    console.warn(
      "No TURN provider is configured. Live video will use the STUN fallback.",
    );
  if (!process.env.SUPER_ADMIN_PASSWORD || !process.env.ADMIN_PASSWORD) {
    console.warn(
      "SUPER_ADMIN_PASSWORD and ADMIN_PASSWORD were not set. Generated secure random passwords for the seeded admin accounts.",
    );
  }
  if (process.env.NODE_ENV === "production") {
    const missing = [
      "JWT_SECRET",
      "SUPER_ADMIN_PASSWORD",
      "ADMIN_PASSWORD",
    ].filter((name) => !process.env[name]);
    if (missing.length)
      throw new Error(
        `Missing required production configuration: ${missing.join(", ")}`,
      );
    if (!databaseUrl && !process.env.DATA_FILE)
      throw new Error(
        "Production requires DATABASE_URL or an explicit persistent DATA_FILE path",
      );
    if (!process.env.EVIDENCE_STORAGE_DIR)
      throw new Error(
        "Production requires an explicit EVIDENCE_STORAGE_DIR pointing at a persistent disk -- the default path is lost on every redeploy.",
      );
    if (Buffer.byteLength(process.env.JWT_SECRET, "utf8") < 32)
      throw new Error("JWT_SECRET must contain at least 32 bytes");
    if (
      !validatePassword(process.env.SUPER_ADMIN_PASSWORD) ||
      !validatePassword(process.env.ADMIN_PASSWORD)
    )
      throw new Error(
        "Seed administrator passwords do not meet the password policy",
      );
  }
  const seed = {
    users: [
      {
        id: "u0",
        name: "System Administrator",
        email: superAdminEmail,
        password: bcrypt.hashSync(superAdminPassword, 10),
        role: "Super Admin",
        rank: "Super Admin",
        active: true,
        unit: "System Control",
        command: "Oyo State Command",
        division: "",
        state: "Oyo",
        lga: "",
        lat: 7.3775,
        lng: 3.947,
      },
      {
        id: "u1",
        name: "Election Operations Admin",
        email: adminEmail,
        password: bcrypt.hashSync(adminPassword, 10),
        role: "Admin",
        rank: "Admin",
        active: true,
        unit: "Command Center",
        command: "Oyo State Command",
        division: "",
        state: "Oyo",
        lga: "",
        lat: 7.3775,
        lng: 3.947,
      },
      {
        id: "u2",
        name: "Field Agent One",
        email: agent1Email,
        password: bcrypt.hashSync(agent1Password, 10),
        role: "Agent",
        rank: "Agent",
        active: true,
        unit: "Field Unit 1",
        command: "Oyo State Command",
        division: "",
        state: "Oyo",
        lga: "",
        lat: 7.3775,
        lng: 3.947,
      },
      {
        id: "u3",
        name: "Field Agent Two",
        email: agent2Email,
        password: bcrypt.hashSync(agent2Password, 10),
        role: "Agent",
        rank: "Agent",
        active: true,
        unit: "Field Unit 2",
        command: "Oyo State Command",
        division: "",
        state: "Oyo",
        lga: "",
        lat: 7.3775,
        lng: 3.947,
      },
    ],
    incidents: [],
    cameras: [],
    mapLayers: [],
    chatRooms: [],
    chatMembers: [],
    chatMessages: [],
    notifications: [],
    parties: [],
  };

  let jsonDb = existsSync(dataFile)
    ? JSON.parse(readFileSync(dataFile, "utf8"))
    : JSON.parse(JSON.stringify(seed));
  jsonDb.cameras ||= [];
  jsonDb.mapLayers ||= [];
  jsonDb.chatRooms ||= [];
  jsonDb.notifications ||= [];
  jsonDb.chatMembers ||= [];
  jsonDb.chatMessages ||= [];
  jsonDb.parties ||= [];
  jsonDb.resultRecords ||= [];
  const existingSeedUsers = new Map(
    jsonDb.users
      .filter((user) => ["u0", "u1", "u2", "u3"].includes(user.id))
      .map((user) => [user.id, user]),
  );
  jsonDb.users = jsonDb.users.filter(
    (user) => !["u0", "u1", "u2", "u3"].includes(user.id),
  );
  jsonDb.users.unshift(
    ...seed.users.map((user) => {
      const existing = existingSeedUsers.get(user.id);
      return existing
        ? { ...user, ...existing, password: existing.password }
        : user;
    }),
  );
  jsonDb.users = jsonDb.users.map((user) => {
    if (user.role === "Officer") return { ...user, role: "Agent", rank: "Agent" };
    if (user.role === "Admin")
      return {
        ...user,
        rank: "Admin",
        command: user.command || "Oyo State Command",
      };
    return user;
  });
  jsonDb.incidents = jsonDb.incidents.filter(
    (incident) =>
      !["i1", "i2", "i3"].includes(incident.id) && incident.createdBy !== "seed",
  );
  const saveJson = () => {
    try {
      writeFileSync(dataFile, JSON.stringify(jsonDb, null, 2));
    } catch (error) {
      console.warn(
        `[data] Could not persist JSON data at ${dataFile}: ${error.message}`,
      );
    }
  };
  if (!databaseUrl) saveJson();

  let pool = databaseUrl
    ? new Pool({
        connectionString: databaseUrl,
        ssl:
          process.env.DATABASE_SSL === "disable"
            ? false
            : { rejectUnauthorized: true },
        max: Math.max(
          1,
          Math.min(Number(process.env.DATABASE_POOL_SIZE) || 10, 20),
        ),
        connectionTimeoutMillis: 10_000,
        idleTimeoutMillis: 30_000,
        statement_timeout: 15_000,
      })
    : null;
  // A pooled connection can be dropped by the server (e.g. a serverless
  // database recycling idle connections) between queries. pg emits this as an
  // 'error' event on the pool; without a listener, Node treats it as an
  // uncaught exception and crashes the whole process on the next occurrence.
  pool?.on("error", (error) => {
    console.error(`[database] Idle connection error (pool remains available): ${error.message}`);
  });
  const publicUser = ({ password, ...user }) => user;
  const asyncRoute = (fn) => (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);
  const { toUser, toIncident, toResultRecord, toNotification, toCamera, toMapLayer, toChatRoom, toChatMessage } = createMappers({});

  const connectWithRetry = async (fn, { attempts = 3, baseDelayMs = 3000 } = {}) => {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === attempts) throw error;
        const delay = baseDelayMs * attempt;
        console.warn(
          `[database] Connection attempt ${attempt} failed (${error.message}); retrying in ${delay}ms. A serverless database that auto-suspends when idle can take a few seconds to wake up.`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  };

  try {
    if (databaseUrl) await connectWithRetry(() => initPostgres({ pool, seed }));
    else await initPostgres({ pool, seed });
  } catch (error) {
    await pool?.end().catch(() => {});
    if (process.env.NODE_ENV === "production" && databaseUrl) {
      console.error(`[database] PostgreSQL unavailable: ${error.message}`);
      throw error;
    }
    console.error(
      `[database] PostgreSQL unavailable; using JSON fallback: ${error.message}`,
    );
    pool = null;
    if (process.env.SUPER_ADMIN_PASSWORD) {
      const user = jsonDb.users.find((item) => item.id === "u0");
      if (user) {
        user.email = superAdminEmail;
        if (!bcrypt.compareSync(superAdminPassword, user.password))
          user.password = bcrypt.hashSync(superAdminPassword, 10);
      }
    }
    if (process.env.ADMIN_PASSWORD) {
      const user = jsonDb.users.find((item) => item.id === "u1");
      if (user) {
        user.email = adminEmail;
        if (!bcrypt.compareSync(adminPassword, user.password))
          user.password = bcrypt.hashSync(adminPassword, 10);
      }
    }
    for (const [id, email, password] of [
      ["u2", agent1Email, agent1Password],
      ["u3", agent2Email, agent2Password],
    ]) {
      const user = jsonDb.users.find((item) => item.id === id);
      if (user) {
        user.email = email;
        if (!bcrypt.compareSync(password, user.password))
          user.password = bcrypt.hashSync(password, 10);
      }
    }
    saveJson();
  }

  const store = createStore({
    pool,
    jsonDb,
    saveJson,
    mappers: {
      toUser,
      toIncident,
      toResultRecord,
      toNotification,
      toCamera,
      toMapLayer,
      toChatRoom,
      toChatMessage,
    },
  });

  return { store, pool, secret, agent1Email, agent2Email, hasCloudflareTurn, hasExpressTurn, expressTurnServers, cloudflareTurnKeyId, cloudflareTurnApiToken, cloudflareTurnTtl, bundledOsunIrevArchive, runtimePolicy };
}
