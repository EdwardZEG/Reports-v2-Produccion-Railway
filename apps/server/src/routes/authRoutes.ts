import { Router } from 'express';
import { register, login, verificarEstado, obtenerPerfil, actualizarPerfil } from '../controllers/authController';
import { loginColaborador } from '../controllers/colaboradoresController';

const router = Router();

router.post('/register', register);
router.post('/login', login,);
router.post('/login', loginColaborador);

// Nueva ruta para verificar el estado del usuario (si está activo o inactivo)
router.get('/verificar-estado', verificarEstado);

// Ruta para obtener el perfil del usuario autenticado
router.get('/perfil', obtenerPerfil);

// Ruta para actualizar el perfil del usuario autenticado
router.put('/perfil', actualizarPerfil);

export default router;
