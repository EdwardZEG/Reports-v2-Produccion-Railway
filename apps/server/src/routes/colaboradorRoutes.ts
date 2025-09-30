import { Router } from 'express';
import {
  crearColaborador,
  obtenerColaboradores,
  obtenerColaboradoresParaColaborativo,
  actualizarColaborador,
  eliminarColaborador,
  obtenerColaboradorPorId
} from '../controllers/colaboradoresController';
import { proteger } from '../middlewares/auth';

const router = Router();
router.use(proteger);

// Rutas específicas ANTES que las rutas con parámetros
router.get('/para-colaborativo', obtenerColaboradoresParaColaborativo);

router.post('/', crearColaborador);
router.get('/', obtenerColaboradores);
router.get('/:id', obtenerColaboradorPorId);
router.put('/:id', actualizarColaborador);
router.delete('/:id', eliminarColaborador);

export default router;