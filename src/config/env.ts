import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(24),
  JWT_EXPIRES_IN: z.string().default("7d"),
  CORS_ORIGIN: z.string().default("*"),
  SNAPSHOT_INTERVAL_MS: z.coerce.number().int().positive().default(300000),
  AUTOSAVE_DEBOUNCE_MS: z.coerce.number().int().positive().default(1500)
});

export const env = envSchema.parse(process.env);

export const corsOrigins =
  env.CORS_ORIGIN === "*"
    ? "*"
    : env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);
