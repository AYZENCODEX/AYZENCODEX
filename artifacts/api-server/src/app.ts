import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { fileURLToPath } from "url";
import router from "./routes";
import { logger } from "./lib/logger";
import { logBus } from "./lib/log-bus";
import { globalErrorHandler, notFoundHandler } from "./middlewares/error-handler";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return { id: req.id, method: req.method, url: req.url?.split("?")[0] };
      },
      res(res) {
        return { statusCode: res.statusCode };
      },
    },
  }),
);

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const durationMs = Date.now() - start;
    const code = res.statusCode;
    const level = code >= 500 ? "ERROR" : code >= 400 ? "WARN" : "INFO";
    const route = req.url?.split("?")[0] ?? "/";
    logBus.push({
      time: Date.now(),
      level,
      msg: `${req.method} ${route} → ${code}`,
      method: req.method,
      url: route,
      statusCode: code,
      ms: durationMs,
    });
    // Write to request_metrics table (fire-and-forget, only for /api/* routes)
    if (route.startsWith("/api/")) {
      db.execute(sql.raw(
        `INSERT INTO request_metrics (route, method, status_code, duration_ms)
         VALUES ('${route.replace(/'/g, "''")}', '${req.method}', ${code}, ${durationMs})`
      )).catch(() => { /* ignore until table exists after migration */ });
    }
  });
  next();
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

app.use("/api/{*splat}", notFoundHandler);
app.use(globalErrorHandler as any);

// ── Serve built frontend in production ───────────────────────────────────────
if (process.env.NODE_ENV === "production") {
  const distPath = path.resolve(__dirname, "../../ayzen/dist/public");
  app.use(express.static(distPath));
  app.get("/{*splat}", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

export default app;
