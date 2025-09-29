import { Router } from "express";
import {
    crearEspecialidad,
    actualizarEspecialidad,
    eliminarEspecialidad,
    obtenerEspecialidades,
    obtenerEspecialidadesPorColaborador
    
} from "../controllers/especialidadController";
import { proteger } from '../middlewares/auth';
const router = Router();
router.use(proteger);
router.post("/", crearEspecialidad);
router.get("/", obtenerEspecialidades);
router.get('/colaboradores/:id/especialidades', obtenerEspecialidadesPorColaborador);
router.put("/:id", actualizarEspecialidad);
router.delete("/:id", eliminarEspecialidad);

export default router;