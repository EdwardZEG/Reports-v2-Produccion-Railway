import express from 'express';
import {
  createDeviceReport,
  getDeviceReports,
  getDeviceReportById,
  updateDeviceReportStatus,
  deleteDeviceReport,
  updateDeviceReportJSON,
  findDeviceReportByDeviceAndColaborador,
  deleteDeviceReportByPeriodoAndDevice
} from '../controllers/deviceReportController';
import { proteger } from '../middlewares/auth';
import { upload } from '../middlewares/upload';

const router = express.Router();
router.use(proteger);

// CRUD de reportes de dispositivos
router.post('/', upload.fields([
  { name: 'WorkEvidence', maxCount: 1 },
  { name: 'DeviceEvidence', maxCount: 1 },
  { name: 'ViewEvidence', maxCount: 1 }
]), createDeviceReport);
router.get('/', getDeviceReports);

// Rutas específicas para búsqueda (deben ir antes de /:id)
router.get('/search', findDeviceReportByDeviceAndColaborador);

// Nueva ruta para eliminar reporte y revertir estado
router.delete('/periodo/:periodoId/device/:deviceId', deleteDeviceReportByPeriodoAndDevice);

// Rutas generales
router.get('/:id', getDeviceReportById);
router.patch('/:id', updateDeviceReportJSON); // Actualizar reporte completo con JSON
router.patch('/:id/status', updateDeviceReportStatus);
router.delete('/:id', deleteDeviceReport);

export default router;