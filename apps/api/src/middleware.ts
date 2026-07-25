import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { createLogger } from "@grailwatch/shared/logger";

const log = createLogger("api");

/**
 * Consistent error envelope for every failure path:
 *   { "error": { "code": "...", "message": "...", "details": ... } }
 */
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  res.on("finish", () => {
    log.info(`${req.method} ${req.originalUrl} → ${res.statusCode} (${Date.now() - start}ms)`);
  });
  next();
}

export function notFound(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "not_found", message: `No route for ${req.method} ${req.path}` },
  });
}

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "validation_error",
        message: "Invalid request",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
    return;
  }
  log.error(`unhandled error on ${req.method} ${req.path}`, err);
  res.status(500).json({ error: { code: "internal_error", message: "Internal server error" } });
}
