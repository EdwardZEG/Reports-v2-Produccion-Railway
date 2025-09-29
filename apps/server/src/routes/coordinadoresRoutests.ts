import { Router } from 'express';
import {
  crearCoordinadores,
  obtenerCoordinadores,
  actualizarCoordinador,
  eliminarCoordinador
} from '../controllers/coordinadoresController';

const router = Router();

router.post('/', crearCoordinadores);
router.get('/', obtenerCoordinadores);
router.put('/:id', actualizarCoordinador);
router.delete('/:id', eliminarCoordinador);

export default router;
