import { Router } from 'express';
import { uploadReporte, generarReporte, generarPlantillaPorEspecialidad, generarReporteConProgreso, descargarArchivoTemporal, limpiarArchivosUsuario, limpiarArchivosLogout, obtenerReportes, obtenerEstadisticas, obtenerReportesColaborador, debugDumpReportesColaborador, validarPlantillaEspecialidad } from '../controllers/ReporteController';
import { upload } from '../middlewares/upload';

const router = Router();

// Función auxiliar para manejo de async/await en las rutas
function asyncHandler(fn: any) {
  return function (req: any, res: any, next: any) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

// Sección: Endpoints de consulta de reportes
router.get('/estadisticas', asyncHandler(obtenerEstadisticas));
router.get('/debug-dump/:colaboradorId', asyncHandler(debugDumpReportesColaborador)); // DEBUG: Para análisis
router.get('/colaborador/:colaboradorId', asyncHandler(obtenerReportesColaborador));
router.get('/validar-plantilla/:idEspecialidad', asyncHandler(validarPlantillaEspecialidad)); // Validar si existe plantilla para especialidad
router.get('/', asyncHandler(obtenerReportes));

// Sección: Endpoints de subida y procesamiento de reportes
router.post('/', upload.single('archivo'), uploadReporte);

// Sección: Endpoints de generación de reportes
router.post("/generar-por-especialidad", generarPlantillaPorEspecialidad);

// Endpoint con progreso en tiempo real usando Server-Sent Events
router.post("/generar-con-progreso", asyncHandler(generarReporteConProgreso));

// Sección: Endpoints de gestión de archivos temporales
// Descarga de archivos temporales específicos por usuario
router.get("/descargar-archivo-temporal/:userId/:fileName", asyncHandler(descargarArchivoTemporal));

// Limpieza automática de archivos temporales del usuario (ejecutado en logout)
router.delete("/limpiar-archivos-usuario", asyncHandler(limpiarArchivosUsuario));

// Limpieza especial para logout/sesión expirada (no requiere token válido)
router.delete("/limpiar-archivos-logout", asyncHandler(limpiarArchivosLogout));

// Sección: Endpoints legacy mantenidos para compatibilidad
router.get('/:idReporte/docx', generarReporte);

export default router;
