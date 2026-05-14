import compression from "compression";
import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import morgan from "morgan";
import { Redis } from "ioredis";
import { corsOrigins } from "./config/env.js";
import { env } from "./config/env.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { roomsRouter } from "./modules/rooms/rooms.routes.js";
import { documentsRouter } from "./modules/documents/documents.routes.js";
import { versionsRouter } from "./modules/versions/versions.routes.js";
import { errorHandler } from "./middleware/error-handler.js";
import { mountSwagger } from "./swagger.js";
import { prisma } from "./shared/prisma.js";

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(morgan("dev"));
  app.use(rateLimit({ windowMs: 60_000, limit: 180 }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", service: "collaborative-code-editor-backend" });
  });

  app.get("/health/ready", async (_req, res) => {
    const checks: Record<string, "ok" | "error" | "skipped"> = {
      database: "error",
      redis: env.REDIS_URL ? "error" : "skipped"
    };

    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = "ok";
    } catch {
      checks.database = "error";
    }

    if (env.REDIS_URL) {
      const redis = new Redis(env.REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
      try {
        await redis.connect();
        await redis.ping();
        checks.redis = "ok";
      } catch {
        checks.redis = "error";
      } finally {
        redis.disconnect();
      }
    }

    const ready = Object.values(checks).every((value) => value === "ok" || value === "skipped");
    res.status(ready ? 200 : 503).json({ status: ready ? "ready" : "not_ready", checks });
  });

  mountSwagger(app);
  app.use("/auth", authRouter);
  app.use("/rooms", roomsRouter);
  app.use(documentsRouter);
  app.use(versionsRouter);

  app.use(errorHandler);

  return app;
}
