import express, { Request, Response } from 'express';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import http from 'http';
import connectDB from './config/db';
import authRoutes from './routes/authRoutes';
import polizaRoutes from './routes/polizaRoutes';
import coordinadoresRoutes from './routes/coordinadoresRoutests';
import ColaboradoresRoutes from './routes/colaboradorRoutes';
import EspecialidadRoutes from './routes/especialidadRoutes';
import ReporteRoutes from './routes/ReporteRoutes';
import { errorHandler } from './middlewares/errorHandler';
import { imageHandler, documentHandler } from './middlewares/imageHandler';
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

// Configurar límites para manejar imágenes grandes y evitar error 431
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? true  // Permite todos los orígenes en producción
    : ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
}));

// Aumentar límite para imágenes base64 y datos grandes
app.use(express.json({
  limit: '100mb',
  type: ['application/json', 'text/plain']
}));
app.use(express.urlencoded({
  limit: '100mb',
  extended: true,
  parameterLimit: 100000
}));

// Middleware para manejar headers grandes (soluciona error 431)
app.use((req, res, next) => {
  // Configurar límites específicos para requests con imágenes
  req.socket.setMaxListeners(0);
  next();
});

// Middleware para manejo de imágenes grandes
app.use(imageHandler);

// Middleware específico para rutas de documentos
app.use('/api/reportes/generar', documentHandler);
app.use('/api/reportes/generate', documentHandler);

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
    console.log('   🎯 PATH BREAKDOWN:');
    const pathParts = req.url.split('/');
    pathParts.forEach((part, index) => {
      console.log(`     [${index}]: "${part}"`);
    });
  }
  next();
});

// Ruta de prueba para verificar que el servidor funciona
app.get('/api/health', (req, res) => {
  console.log('🏥 Health check endpoint called');
  res.json({ status: 'OK', message: 'Servidor funcionando correctamente', timestamp: new Date().toISOString() });
});

// Ruta para optimizar base de datos (crear índices)
app.get('/api/optimize-database', async (req, res) => {
  try {
    const { optimizeDatabase } = await import('./scripts/optimizeDatabase');

    console.log('🚀 Iniciando optimización de base de datos...');
    await optimizeDatabase();

    res.json({
      success: true,
      message: 'Base de datos optimizada correctamente',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    console.error('❌ Error optimizando base de datos:', error);
    res.status(500).json({
      success: false,
      message: 'Error optimizando base de datos',
      error: error.message
    });
  }
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
    const allDevices = await DeviceCatalog.find({}).populate(['especialidad', 'poliza']).lean();

    res.json({
      success: true,
      data: allDevices,
      count: allDevices.length
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// RUTA PARA OBTENER UN DISPOSITIVO ESPECÍFICO POR ID
app.get('/api/all-catalog-devices/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const device = await DeviceCatalog.findById(id).populate(['especialidad', 'poliza']).lean();

    if (!device) {
      return res.status(404).json({
        success: false,
        error: 'Dispositivo no encontrado'
      });
    }

    res.json({
      success: true,
      data: device
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

// NUEVO: ASIGNAR SORTORDER A DISPOSITIVOS EXISTENTES
app.get('/api/assign-sort-order', async (req: Request, res: Response) => {
  try {
    console.log('🔄 Iniciando asignación de sortOrder...');

    // Obtener todos los dispositivos ordenados por identifier
    const devices = await DeviceCatalog.find({})
      .sort({ identifier: 1 })
      .lean();

    console.log(`📋 Encontrados ${devices.length} dispositivos`);

    let updateCount = 0;

    // Asignar sortOrder basado en el número extraído del identifier
    for (const device of devices) {
      // Extraer número del identifier (ej: N01L01D001 -> 1)
      const match = device.identifier.match(/D(\d+)$/);
      const sortOrder = match ? parseInt(match[1], 10) : (updateCount + 1);

      await DeviceCatalog.findByIdAndUpdate(
        device._id,
        { $set: { sortOrder } }
      );

      updateCount++;
    }

    res.json({
      success: true,
      message: `SortOrder asignado exitosamente a ${updateCount} dispositivos`,
      updatedCount: updateCount
    });

  } catch (error: any) {
    console.error('❌ Error asignando sortOrder:', error);
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
      .sort({ insertOrder: 1 }) // Ordenar por orden de inserción
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
} connectDB();

app.use(errorHandler);

// Crear servidor HTTP con configuraciones personalizadas para manejar headers grandes
const server = http.createServer(app);

// Configurar límites del servidor para evitar error 431
server.maxHeadersCount = 0; // Sin límite de headers
server.headersTimeout = 120000; // 2 minutos timeout para headers
server.requestTimeout = 300000; // 5 minutos timeout para requests

server.listen(PORT, () => {
  console.log(`Servidor HTTP corriendo en http://localhost:${PORT}`);
  console.log(`NODE_ENV: ${process.env.NODE_ENV}`);
  console.log(`🔧 Configuraciones para imágenes grandes activadas:`);
  console.log(`   - Límite JSON/URL: 100MB`);
  console.log(`   - Headers ilimitados`);
  console.log(`   - Timeout extendido: 5min`);
  if (process.env.NODE_ENV === 'production') {
    console.log('✅ Sirviendo archivos estáticos del cliente React');
  }
});