import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import connectDB from './config/db';
import authRoutes from './routes/authRoutes';
import polizaRoutes from './routes/polizaRoutes';
import coordinadoresRoutes from './routes/coordinadoresRoutests';
import ColaboradoresRoutes from './routes/colaboradorRoutes';
import EspecialidadRoutes from './routes/especialidadRoutes';
import ReporteRoutes from './routes/ReporteRoutes';
import { errorHandler } from './middlewares/errorHandler';
import TestRoutes from './routes/TestRoutes';
import { authenticate } from './middlewares/auth';
import deviceRoutes from './routes/deviceRoutes';
import deviceCatalogRoutes from './routes/deviceCatalog';
import deviceReportRoutes from './routes/deviceReport';
import periodoMPRoutes from './routes/periodoMP';
import migrationRoutes from './routes/migration';
import DeviceCatalog from './models/DeviceCatalog';
import DeviceReport from './models/DeviceReport';

// Solo cargar dotenv en desarrollo (Railway maneja variables automáticamente)
if (process.env.NODE_ENV !== 'production') {
  try {
    const dotenv = require('dotenv');
    dotenv.config();
  } catch (error) {
    console.log('⚠️ dotenv no disponible, usando variables de entorno del sistema');
  }
}

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? true  // Permite todos los orígenes en producción
    : ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));

// Aumentar límite para imágenes base64
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Middleware de debugging para endpoint de completado de dispositivos
app.use((req, res, next) => {
  if (req.url.includes('/complete-device/')) {
    console.log('🔍 === DEBUG MIDDLEWARE COMPLETADO ===');
    console.log('   🌐 METHOD:', req.method);
    console.log('   🔗 URL:', req.url);
    console.log('   📦 PARAMS:', req.params);
    console.log('   📋 BODY:', req.body);
    console.log('   🔑 HEADERS AUTH:', req.headers.authorization ? 'SI' : 'NO');
    console.log('   ⏰ TIMESTAMP:', new Date().toISOString());
  }
  next();
});

// Ruta de prueba para verificar que el servidor funciona
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check endpoint called');
  res.json({ status: 'OK', message: 'Servidor funcionando correctamente', timestamp: new Date().toISOString() });
});

// Ruta directa para ejecutar migración
app.get('/api/execute-migration', async (req, res) => {
  try {
    // Importar el servicio de migración
    const { migrateToNewStructure } = await import('./services/migrationService');

    console.log('🚀 Iniciando migración...');
    const result = await migrateToNewStructure();

    res.json({
      success: true,
      message: 'Migración completada',
      data: result
    });
  } catch (error: any) {
    console.error('❌ Error en migración:', error);
    res.status(500).json({
      success: false,
      message: 'Error en migración',
      error: error.message
    });
  }
});

// Ruta para ver datos migrados
app.get('/api/view-migrated-data', async (req: Request, res: Response) => {
  try {

    const [catalogDevices, deviceReports] = await Promise.all([
      DeviceCatalog.find({}).lean(),
      DeviceReport.find({})
        .populate('deviceCatalog')
        .populate('colaborador', 'name')
        .populate('especialidad', 'name')
        .lean()
    ]);

    res.json({
      success: true,
      data: {
        catalogDevices,
        deviceReports,
        summary: {
          totalCatalogDevices: catalogDevices.length,
          totalReports: deviceReports.length
        }
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// RUTA PARA VER TODOS LOS DISPOSITIVOS EN CATÁLOGO
app.get('/api/all-catalog-devices', async (req: Request, res: Response) => {
  try {
    const allDevices = await DeviceCatalog.find({}).lean();

    res.json({
      success: true,
      data: allDevices,
      count: allDevices.length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ARREGLAR DISPOSITIVOS SIN CAMPO ACTIVE
app.get('/api/fix-active-field', async (req: Request, res: Response) => {
  try {

    // Actualizar todos los dispositivos para que tengan active: true
    const result = await DeviceCatalog.updateMany(
      { active: { $exists: false } }, // Dispositivos sin campo active
      { $set: { active: true } }      // Establecer active: true
    );

    res.json({
      success: true,
      message: 'Campo active actualizado',
      modifiedCount: result.modifiedCount
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// RUTA TEMPORAL PARA CREAR REPORTES - SIN AUTENTICACIÓN (TEMPORALMENTE DESHABILITADA)
/* app.post('/api/create-device-report-temp', async (req, res) => {
  try {
    const {
      deviceCatalogId,
      colaborador,
      especialidad,
      WorkEvidence,
      DeviceEvidence,
      ViewEvidence,
      manualUploadReason,
      note
    } = req.body;

    console.log('📝 Creando reporte con datos:', {
      deviceCatalogId,
      colaborador,
      especialidad,
      hasWorkEvidence: !!WorkEvidence,
      hasDeviceEvidence: !!DeviceEvidence,
      hasViewEvidence: !!ViewEvidence
    });

    if (!deviceCatalogId || !colaborador || !especialidad) {
      return res.status(400).json({
        success: false,
        message: 'deviceCatalogId, colaborador y especialidad son requeridos'
      });
    }

    // Verificar que el dispositivo existe en el catálogo
    const catalogDevice = await DeviceCatalog.findById(deviceCatalogId);
    if (!catalogDevice) {
      return res.status(404).json({
        success: false,
        message: 'Dispositivo no encontrado en catálogo'
      });
    }

    // Crear el reporte
    const deviceReport = await DeviceReport.create({
      deviceCatalog: deviceCatalogId,
      colaborador,
      especialidad,
      fechaReporte: new Date(),
      WorkEvidence,
      DeviceEvidence,
      ViewEvidence,
      manualUploadReason,
      note,
      estado: 'completado',
      asignado: false,
      completado: true,
      fechaCompletado: new Date()
    });

    console.log('✅ Reporte creado exitosamente:', deviceReport._id);

    res.status(201).json({
      success: true,
      message: 'Reporte de dispositivo creado exitosamente',
      data: deviceReport
    });

  } catch (error: any) {
    console.error('❌ Error creando reporte:', error);
    res.status(500).json({
      success: false,
      message: 'Error creando reporte de dispositivo',
      error: error.message
    });
  }
}); */

// RUTA TEMPORAL PARA AUTOCOMPLETADO - FUNCIONAL
app.get('/api/device-catalog-search', async (req: Request, res: Response) => {
  try {

    const {
      identifier,
      ubication,
      type,
      limit = 10
    } = req.query;

    const filter: any = { active: true };

    // Construir filtros de búsqueda con regex para autocompletado
    if (identifier) {
      filter.identifier = {
        $regex: identifier as string,
        $options: 'i'
      };
    }

    if (ubication) {
      filter.ubication = {
        $regex: ubication as string,
        $options: 'i'
      };
    }

    if (type) {
      filter.type = {
        $regex: type as string,
        $options: 'i'
      };
    }

    console.log('🔍 Buscando en DeviceCatalog con filtro:', filter);

    const devices = await DeviceCatalog.find(filter)
      .limit(parseInt(limit as string))
      .sort({ identifier: 1 })
      .select('type ubication identifier building level')
      .lean();

    console.log('📦 Dispositivos encontrados:', devices.length);
    console.log('📋 Dispositivos:', devices);

    res.json({
      success: true,
      data: devices,
      count: devices.length
    });

  } catch (error: any) {
    console.error('❌ Error en búsqueda de autocompletado:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.use('/api/polizas', polizaRoutes);
app.use('/api/coordinadores', coordinadoresRoutes);
app.use('/api/colaboradores', ColaboradoresRoutes);
app.use('/api', deviceRoutes);
app.use('/api/especialidades', EspecialidadRoutes);
app.use('/api/reportes', ReporteRoutes);
app.use('/api/test', TestRoutes);
app.use('/api/auth', authRoutes);

// Nuevas rutas para la estructura mejorada
app.use('/api/device-catalog', deviceCatalogRoutes);
app.use('/api/device-reports', deviceReportRoutes);
app.use('/api/periodos-mp', periodoMPRoutes);
app.use('/api/migration', migrationRoutes);

// Servir archivos estáticos del cliente React en producción
if (process.env.NODE_ENV === 'production') {
  // Servir archivos estáticos del build del cliente (desde la estructura del monorepo)
  app.use(express.static(path.join(__dirname, '../../client/dist')));
  
  // Catch all handler: enviar el index.html para todas las rutas no-API
  app.get('*', (req: Request, res: Response) => {
    // Si la ruta no es una API, servir el index.html para React Router
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
    } else {
      res.status(404).json({ message: 'API endpoint not found' });
    }
  });
}connectDB();

app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Servidor HTTP corriendo en http://localhost:${PORT}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  if (process.env.NODE_ENV === 'production') {
    console.log('✅ Sirviendo archivos estáticos del cliente React');
  }
});