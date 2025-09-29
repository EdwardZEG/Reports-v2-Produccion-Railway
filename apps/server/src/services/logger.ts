// utils/logger.ts
import Log from "../models/Log";

interface LogData {
  message: string;
  route: string;
  method: string;
  statusCode: number;
}

export const logError = async (data: LogData) => {
  try {
    const log = new Log({
      message: data.message,
      route: data.route,
      method: data.method,
      statusCode: data.statusCode,
      timestamp: new Date()
    });
    
    await log.save();
    console.log('Log registrado en DB:', log._id); // Para depuración
  } catch (err) {
    console.error("Error al guardar log:", {
      error: err,
      originalData: data // Para saber qué log falló
    });
  }
};