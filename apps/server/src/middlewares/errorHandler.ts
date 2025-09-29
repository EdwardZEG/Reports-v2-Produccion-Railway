// middlewares/errorHandler.ts
import { Request, Response, NextFunction } from "express";
import { logError } from "../services/logger";
import { AppError } from '../errors/customErrors';

export const errorHandler = async (
  err: AppError | Error,
  req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500;

  try {
    // Aseguramos que el log se complete antes de responder
    await logError({
      message: err.message,
      route: req.originalUrl,
      method: req.method,
      statusCode
    });
  } catch (logErr) {
    console.error('Error al guardar el log:', logErr);
  }

  res.status(statusCode).json({
    status: 'error',
    message: err.message
  });
};