import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => {
  res.send('Hola desde Express + TypeScript + MongoDB');
});

export default router;
