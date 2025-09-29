import express from 'express';
import {
  executeMigration,
  revertMigration,
  validateMigrationStatus
} from '../controllers/migrationController';

const router = express.Router();

// Rutas de migración
router.post('/execute', executeMigration);
router.post('/rollback', revertMigration);
router.get('/validate', validateMigrationStatus);

export default router;