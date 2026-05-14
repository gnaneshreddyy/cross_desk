import type { RequestHandler } from "express";
import { verifyToken, type AuthUser } from "../modules/auth/auth.service.js";
import { HttpError } from "../shared/http-error.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const header = req.header("authorization");
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) {
      throw new HttpError(401, "Missing bearer token");
    }

    req.user = await verifyToken(token);
    next();
  } catch (error) {
    next(error);
  }
};

export function getCurrentUser(req: Express.Request): AuthUser {
  if (!req.user) {
    throw new HttpError(401, "Authentication required");
  }
  return req.user;
}
