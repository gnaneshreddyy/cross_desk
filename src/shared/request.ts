import type { Request } from "express";
import { HttpError } from "./http-error.js";

export function routeParam(req: Request, name: string) {
  const value = req.params[name];
  if (typeof value !== "string") {
    throw new HttpError(400, `Invalid route parameter: ${name}`);
  }
  return value;
}
