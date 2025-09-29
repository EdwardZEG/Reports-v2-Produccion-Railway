import { Router, Request, Response, NextFunction } from 'express';
import {
  createPeriodoMP,
  getPeriodosMP,
  getPeriodoMPById,
  assignDevicesToPeriodo,
  completeDeviceInPeriodo,
  getDevicesPendingForColaborador,
  finalizePeriodoMP,
  searchAssignedDevicesForColaborador,
  getAllDevicesForColaborador,
  eliminarPeriodoMP,
  forzarEliminacionPeriodoMP,
  validarFechaActiva,
  actualizarFechasPeriodoMP,
  actualizarPeriodoMP,
  eliminarDispositivoAsignado,
  eliminarDispositivoAsignacionMultiple,
  editarAsignacionDispositivo
} from '../controllers/periodoMPController';

const router = Router();

// CRUD básico
router.post('/', createPeriodoMP);
router.get('/', getPeriodosMP);

// Validación de fechas para colaboradores (DEBE IR ANTES DE /:id)
router.get('/validar-fecha-activa', validarFechaActiva);

// Rutas con parámetros (DEBEN IR DESPUÉS DE LAS RUTAS ESPECÍFICAS)
router.get('/:id', getPeriodoMPById);
router.patch('/:id', actualizarPeriodoMP); // Actualizar período completo
router.patch('/:id/finalize', finalizePeriodoMP);

// Actualización de fechas
router.patch('/:id/fechas', actualizarFechasPeriodoMP);

// Gestión de dispositivos en períodos
router.post('/:id/assign-devices', assignDevicesToPeriodo);
router.patch('/:periodoId/complete-device/:deviceCatalogId/:colaboradorId', (req: Request, res: Response, next: NextFunction) => {
  console.log('🎯 === REQUEST LLEGÓ AL ENDPOINT DE COMPLETION ===');
  console.log('   Method:', req.method);
  console.log('   URL:', req.url);
  console.log('   Params:', req.params);
  console.log('   Body:', req.body);
  next();
}, completeDeviceInPeriodo);

// Editar asignación de dispositivo (cambiar colaborador asignado)
router.patch('/:periodoId/devices/:deviceId/collaborator', (req: Request, res: Response, next: NextFunction) => {
  console.log('🎯 === REQUEST LLEGÓ AL ENDPOINT DE EDITAR ASIGNACIÓN ===');
  console.log('   Method:', req.method);
  console.log('   URL:', req.url);
  console.log('   Params:', req.params);
  console.log('   Body:', req.body);
  next();
}, editarAsignacionDispositivo);

// Eliminar dispositivo con asignación múltiple (DEBE IR ANTES de la ruta genérica)
router.delete('/:periodoId/dispositivos/:deviceCatalogId/multiple', eliminarDispositivoAsignacionMultiple);
// Eliminar dispositivo asignado específico
router.delete('/:periodoId/dispositivos/:deviceCatalogId/:colaboradorId', eliminarDispositivoAsignado);

// Para colaboradores
router.get('/colaborador/:colaboradorId/pending-devices', getDevicesPendingForColaborador);
router.get('/colaborador/:colaboradorId/assigned-devices-search', searchAssignedDevicesForColaborador);
router.get('/colaborador/:colaboradorId/all-devices', getAllDevicesForColaborador);

// Eliminación de períodos MP
router.delete('/:id', eliminarPeriodoMP);
router.delete('/:id/force', forzarEliminacionPeriodoMP);

export default router;