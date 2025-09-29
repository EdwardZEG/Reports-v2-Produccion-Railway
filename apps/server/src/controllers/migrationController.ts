import { Request, Response, NextFunction } from 'express';
import { migrateToNewStructure, rollbackMigration, validateMigration } from '../services/migrationService';
import { AppError } from '../errors/customErrors';

/**
 * Ejecutar migración completa a nueva estructura
 */
export const executeMigration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    console.log('🚀 Iniciando migración desde controlador...');

    const result = await migrateToNewStructure();

    res.status(200).json({
      success: true,
      message: 'Migración completada',
      data: result
    });

  } catch (error: any) {
    console.error('❌ Error en migración:', error);
    return next(new AppError(`Error en migración: ${error.message}`, 500));
  }
};

/**
 * Revertir migración (solo para desarrollo)
 */
export const revertMigration = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return next(new AppError('Rollback no permitido en producción', 403));
    }

    await rollbackMigration();

    res.status(200).json({
      success: true,
      message: 'Migración revertida exitosamente'
    });

  } catch (error: any) {
    console.error('❌ Error revirtiendo migración:', error);
    return next(new AppError(`Error revirtiendo migración: ${error.message}`, 500));
  }
};

/**
 * Validar que la migración fue exitosa
 */
export const validateMigrationStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const isValid = await validateMigration();

    res.status(200).json({
      success: true,
      isValid,
      message: isValid ? 'Migración válida' : 'Migración con problemas'
    });

  } catch (error: any) {
    console.error('❌ Error validando migración:', error);
    return next(new AppError(`Error validando migración: ${error.message}`, 500));
  }
};