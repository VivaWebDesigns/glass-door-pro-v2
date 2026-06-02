import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import fs from "fs";
import path from "path";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { ensureDatabaseSchema, pool } from "./db";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);
const PgSessionStore = connectPgSimple(session);
const sessionTableName = "admin_sessions";
const sessionStore = pool
  ? new PgSessionStore({
      pool,
      tableName: sessionTableName,
      createTableIfMissing: false,
    })
  : undefined;

async function ensureAdminSessionTable() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS "${sessionTableName}" (
      "sid" varchar NOT NULL COLLATE "default",
      "sess" json NOT NULL,
      "expire" timestamp(6) NOT NULL,
      CONSTRAINT "${sessionTableName}_pkey" PRIMARY KEY ("sid") NOT DEFERRABLE INITIALLY IMMEDIATE
    )
    WITH (OIDS=FALSE);
  `);
  await pool.query(`CREATE INDEX IF NOT EXISTS "IDX_${sessionTableName}_expire" ON "${sessionTableName}" ("expire");`);
}

app.set("trust proxy", 1);

app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.headers.host === "www.glassanddoorpro.com") {
    return res.redirect(301, "https://glassanddoorpro.com" + req.url);
  }
  next();
});

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    limit: "12mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

const cmsAssetsPath = path.resolve(process.cwd(), "client", "src", "assets");
if (fs.existsSync(cmsAssetsPath)) {
  app.use("/cms-assets", express.static(cmsAssetsPath, {
    immutable: process.env.NODE_ENV === "production",
    maxAge: process.env.NODE_ENV === "production" ? "30d" : 0,
  }));
}

app.use(
  session({
    name: "gdp_admin.sid",
    store: sessionStore,
    secret:
      process.env.ADMIN_SESSION_SECRET ||
      "local-dev-admin-session-secret-change-before-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production" ? "auto" : false,
      maxAge: 1000 * 60 * 60 * 8,
    },
  }),
);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  await ensureDatabaseSchema();
  await ensureAdminSessionTable();
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
