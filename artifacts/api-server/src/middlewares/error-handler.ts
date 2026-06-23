import type { Request, Response, NextFunction } from "express";
import { AppError } from "../lib/errors";
import { logger } from "../lib/logger";

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (err.httpStatus >= 500) {
      logger.error({ err: err.message, code: err.code, url: req.url }, "AppError 5xx");
    }
    res.status(err.httpStatus).json(err.toJSON());
    return;
  }

  const e = err as any;
  const msg: string = e?.message ?? "Unknown error";

  if (e?.code === "23505") {
    res.status(409).json({ error: "Duplicate record", code: "DB_DUPLICATE", solution: "The record already exists." });
    return;
  }
  if (e?.code === "23503") {
    res.status(409).json({ error: "Foreign key violation", code: "DB_ERROR", solution: "Referenced record does not exist." });
    return;
  }

  logger.error({ err: msg, url: req.url, method: req.method }, "Unhandled error");
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL",
    solution: "Check server logs. If the issue persists, contact support@ayzen.tech",
    ...(process.env.NODE_ENV === "development" ? { details: msg } : {}),
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: "Endpoint not found",
    code: "NOT_FOUND",
    path: req.path,
    method: req.method,
    solution: "See GET /api/functions for all available endpoints",
  });
}
