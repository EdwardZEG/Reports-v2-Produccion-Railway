import { Router } from 'express';
import { register, login } from '../controllers/authController';
import { loginColaborador } from '../controllers/colaboradoresController';

const router = Router();

router.post('/register', register);
router.post('/login', login,);  
router.post('/login', loginColaborador); 

export default router;
