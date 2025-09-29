// En tu archivo de rutas
import { Router } from 'express';
import { AppError } from '../errors/customErrors';

const router = Router();

// Ruta de prueba simple
router.get('/test-error', (req, res, next) => {
  const error = new AppError('Error de prueba controlado', 400);
  next(error); // Debe llegar al errorHandler y guardar en DB
});

export default router;