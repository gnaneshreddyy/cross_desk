import type { RequestHandler } from "express";
import type { ZodTypeAny } from "zod";
import { HttpError } from "./http-error.js";

export const validate =
  (schema: ZodTypeAny): RequestHandler =>
  (req, _res, next) => {
    const result = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query
    });

    if (!result.success) {
      next(new HttpError(400, "Validation failed", result.error.flatten()));
      return;
    }

    req.body = result.data.body ?? req.body;
    req.params = result.data.params ?? req.params;
    req.query = result.data.query ?? req.query;
    next();
  };
