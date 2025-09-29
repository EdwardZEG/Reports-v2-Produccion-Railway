import { Router } from 'express';
import {
  crearPoliza,
  obtenerPolizas,
  actualizarPoliza,
  eliminarPoliza,
  limpiarAsignacionesInconsistentes
} from '../controllers/polizaController';

const router = Router();

router.post('/', crearPoliza);
router.get('/', obtenerPolizas);
router.put('/:id', actualizarPoliza);
router.delete('/:id', eliminarPoliza);

// Ruta temporal para limpiar asignaciones inconsistentes
router.post('/limpiar-asignaciones', limpiarAsignacionesInconsistentes);

export default router;