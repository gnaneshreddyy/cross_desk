import type { ErrorRequestHandler } from "express";
import { Prisma } from "@prisma/client";
import { HttpError } from "../shared/http-error.js";

export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ message: error.message, details: error.details });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      res.status(409).json({ message: "Unique constraint failed", details: error.meta });
      return;
    }
    if (error.code === "P2025") {
      res.status(404).json({ message: "Record not found" });
      return;
    }
  }

  console.error(error);
  res.status(500).json({ message: "Internal server error" });
};
