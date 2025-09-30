import fs from 'fs';
import path from 'path';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import ImageModule from 'docxtemplater-image-module-free';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

import Reporte from '../models/Reporte';
import Device from '../models/Device';
import DeviceReport from '../models/DeviceReport';
import ImagesDevice from '../models/DeviceImages';
import Especialidad from '../models/Especialidad';
import PeriodoMP from '../models/PeriodoMP';
import { AppError } from '../errors/customErrors';

// Función auxiliar para extraer userId del token JWT
const getUserIdFromToken = (req: Request): string | null => {
  // Sección: Validación del header de autorización
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  try {
    // Sección: Extracción y verificación del token
    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    return payload.userId;
  } catch (error) {
    return null;
  }
};

export const uploadReporte = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const { name, idEspecialidad, idDevice } = req.body;
    const file = req.file;

    if (!file) {
      return next(new AppError('Archivo no encontrado', 400));
    }

    const especialidad = await Especialidad.findById(idEspecialidad);
    if (!especialidad) {
      return next(new AppError('Especialidad no encontrada', 404));
    }

    // Buscar reporte existente con misma especialidad y nombre
    let reporteExistente = await Reporte.findOne({ idEspecialidad, name });

    if (reporteExistente) {
      // Actualizar archivo y device
      reporteExistente.Device = idDevice;
      reporteExistente.file = {
        data: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
      };
      // If timestamps are enabled in the schema, updatedAt will be set automatically.
      await reporteExistente.save();
      return res.status(200).json(reporteExistente);
    }

    // Si no existe, crear nuevo
    const nuevo = await Reporte.create({
      name,
      idEspecialidad,
      Device: idDevice,
      file: {
        data: file.buffer,
        mimetype: file.mimetype,
        originalname: file.originalname,
      },
    });

    res.status(201).json(nuevo);
  } catch (error) {
    console.error(error);
    next(new AppError("Error inesperado al subir el reporte", 500));
  }
};


// Generación de un solo reporte por dispositivo (legacy)
export const generarReporte = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log("Body recibido:", req.body);
    const { idReporte } = req.params;

    const reporte = await Reporte.findById(idReporte);
    if (!reporte) return next(new AppError('Reporte no encontrado', 404));

    const device = await Device.findById(reporte.Device);
    if (!device) return next(new AppError('Dispositivo no encontrado', 404));

    const images = await ImagesDevice.findOne({ IdDevice: device._id });
    if (!images) return next(new AppError('Imágenes no encontradas', 404));

    const templatePath = path.resolve('templates', reporte.file.originalname);
    if (!fs.existsSync(templatePath)) {
      return next(new AppError('Plantilla de documento no encontrada', 404));
    }

    const content = fs.readFileSync(templatePath, 'binary');
    const zip = new PizZip(content);

    const imageOpts = {
      centered: false,
      getImage: (tagValue: string) => {
        const base64 = tagValue.split(';base64,').pop();
        return Buffer.from(base64!, 'base64');
      },
      getSize: () => [150, 180],
    };

    const imageModuleInstance = new ImageModule(imageOpts);

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: [imageModuleInstance],
    });

    await doc.renderAsync({
      type: device.type,
      ubication: device.ubication,
      identifier: device.identifier || '',
      building: device.building || '',
      level: device.level || '',
      note: device.note || '',
      workEvidence: images.WorkEvidence,
      deviceEvidence: images.DeviceEvidence,
      viewEvidence: images.ViewEvidence,
    });

    const buffer = doc.getZip().generate({ type: 'nodebuffer' });
    const fileName = `reporte-${Date.now()}.docx`;
    const filePath = path.resolve('temp', fileName);

    fs.writeFileSync(filePath, buffer);
    res.download(filePath, fileName, (err) => {
      if (err) return next(new AppError('Error al descargar el reporte', 500));
      setTimeout(() => fs.unlinkSync(filePath), 5000);
    });
  } catch (err) {
    console.error(err);
    next(new AppError('Error generando el reporte', 500));
  }
};

// Función auxiliar para enviar eventos SSE
const sendSSEEvent = (res: Response, event: string, data: any) => {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
};

// Nuevo endpoint con progreso en tiempo real usando Server-Sent Events
export const generarReporteConProgreso = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { idEspecialidad, idDevices } = req.body;
    const userId = getUserIdFromToken(req); // Obtener userId del JWT token

    if (!idEspecialidad || !Array.isArray(idDevices) || idDevices.length === 0) {
      return next(new AppError("Se requieren idEspecialidad e idDevices[]", 400));
    }

    if (!userId) {
      return next(new AppError("Usuario no autenticado", 401));
    }

    // Configurar SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    });

    // Enviar evento de inicio
    sendSSEEvent(res, 'progress', { step: 'iniciando', progress: 0, message: 'Iniciando generación del reporte...' });

    // 1. Buscar plantilla correspondiente a la especialidad
    sendSSEEvent(res, 'progress', { step: 'plantilla', progress: 10, message: 'Cargando plantilla de documento...' });
    const plantilla = await Reporte.findOne({ idEspecialidad });
    if (!plantilla || !Buffer.isBuffer(plantilla.file.data)) {
      sendSSEEvent(res, 'error', { message: "Plantilla no válida o no encontrada" });
      res.end();
      return;
    }

    // 2. Obtener datos de DeviceReports directamente
    sendSSEEvent(res, 'progress', { step: 'dispositivos', progress: 25, message: 'Obteniendo datos de reportes...' });

    console.log('🔍 Buscando DeviceReports con IDs:', idDevices);

    const deviceReports = await DeviceReport.find({
      _id: { $in: idDevices }
    })
      .populate({
        path: 'deviceCatalog',
        select: 'type ubication identifier building level note'
      })
      .populate('colaborador', 'nombre correo')
      .populate('especialidad', 'nombre');

    console.log('📊 DeviceReports encontrados:', deviceReports.length);

    sendSSEEvent(res, 'progress', { step: 'procesando', progress: 40, message: 'Procesando datos de reportes...' });

    const validDevices = deviceReports
      .filter(report => report.deviceCatalog)
      .map((report, index) => {
        // Actualizar progreso por cada reporte procesado
        const currentProgress = 40 + (index / deviceReports.length) * 25; // 40% a 65%
        sendSSEEvent(res, 'progress', {
          step: 'procesando_dispositivo',
          progress: Math.round(currentProgress),
          message: `Procesando reporte ${index + 1} de ${deviceReports.length}...`
        });

        const device = report.deviceCatalog as any;

        console.log(`📝 Procesando reporte ${index + 1}:`, {
          identifier: device.identifier,
          type: device.type,
          hasWorkEvidence: !!report.WorkEvidence,
          hasDeviceEvidence: !!report.DeviceEvidence,
          hasViewEvidence: !!report.ViewEvidence
        });

        return {
          type: device.type || 'Sin tipo',
          ubication: device.ubication || 'Sin ubicación',
          identifier: device.identifier || 'Sin identificador',
          building: device.building || 'Sin edificio',
          level: device.level || 'Sin nivel',
          note: device.note || report.note || '',
          workEvidence: report.WorkEvidence || '',
          deviceEvidence: report.DeviceEvidence || '',
          viewEvidence: report.ViewEvidence || '',
          fechaMP: report.fechaReporte
            ? new Date(report.fechaReporte).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
            : "Fecha no disponible",
        };
      });

    console.log('✅ Dispositivos válidos procesados:', validDevices.length);

    if (validDevices.length === 0) {
      sendSSEEvent(res, 'error', { message: 'No se encontraron reportes válidos para generar el documento' });
      res.end();
      return;
    }

    // 3. Preparar plantilla
    sendSSEEvent(res, 'progress', { step: 'preparando_plantilla', progress: 70, message: 'Preparando plantilla de documento...' });
    const zip = new PizZip(plantilla.file.data);

    const imageMod = new ImageModule({
      centered: false,
      getImage: (tagValue: string) => {
        if (typeof tagValue !== "string" || !tagValue.includes("base64,")) {
          throw new Error("Etiqueta de imagen inválida");
        }
        const base64 = tagValue.split(';base64,').pop();
        if (!base64) throw new Error("Base64 inválido");
        return Buffer.from(base64, 'base64');
      },
      getSize: () => [150, 180],
    });

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: [imageMod],
    });

    // 4. Inyectar datos
    sendSSEEvent(res, 'progress', { step: 'inyectando_datos', progress: 80, message: 'Inyectando datos en la plantilla...' });

    console.log('📋 Datos que se van a inyectar en Word:', JSON.stringify({
      totalDevices: validDevices.length,
      firstDevice: validDevices[0] ? {
        identifier: validDevices[0].identifier,
        type: validDevices[0].type,
        ubication: validDevices[0].ubication,
        hasWorkEvidence: !!validDevices[0].workEvidence,
        hasDeviceEvidence: !!validDevices[0].deviceEvidence,
        hasViewEvidence: !!validDevices[0].viewEvidence
      } : null
    }, null, 2));

    // 5. Renderizar documento
    sendSSEEvent(res, 'progress', { step: 'renderizando', progress: 90, message: 'Generando documento final...' });
    try {
      await doc.renderAsync({ devices: validDevices });
    } catch (e: any) {
      console.error("Docxtemplater error:", e.properties?.errors);
      sendSSEEvent(res, 'error', { message: "Error al renderizar el documento" });
      res.end();
      return;
    }

    // 6. Generar archivo final y guardarlo temporalmente por usuario
    sendSSEEvent(res, 'progress', { step: 'finalizando', progress: 95, message: 'Finalizando generación...' });
    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    const fileName = `reporte_${Date.now()}.docx`;

    // Crear estructura de carpetas por usuario: temp/user_${userId}/
    const userTempDir = path.resolve('temp', `user_${userId}`);
    const filePath = path.join(userTempDir, fileName);

    // Crear directorio del usuario si no existe
    if (!fs.existsSync(userTempDir)) {
      fs.mkdirSync(userTempDir, { recursive: true });
    }

    // Guardar archivo temporal
    fs.writeFileSync(filePath, buffer);

    // Enviar evento de completado con URL de descarga
    sendSSEEvent(res, 'completed', {
      progress: 100,
      message: 'Reporte generado exitosamente',
      fileName: fileName,
      fileSize: buffer.length,
      downloadUrl: `/api/reportes/descargar-archivo-temporal/${userId}/${fileName}`
    });

    res.end();

  } catch (err) {
    console.error("Error inesperado al generar el reporte:", err);
    sendSSEEvent(res, 'error', { message: "Error generando el reporte" });
    res.end();
  }
};

// Función para descargar archivo temporal por usuario
export const descargarArchivoTemporal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, fileName } = req.params;
    const currentUserId = getUserIdFromToken(req); // Usuario autenticado

    // Verificar que el usuario esté autenticado
    if (!currentUserId) {
      next(new AppError('Usuario no autenticado', 401));
      return;
    }

    // Usar el userId del token autenticado para buscar el archivo
    const userTempDir = path.resolve('temp', `user_${currentUserId}`);
    const filePath = path.join(userTempDir, fileName);

    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      next(new AppError('Archivo no encontrado', 404));
      return;
    }

    // Configurar headers para descarga
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    // Enviar archivo y eliminarlo inmediatamente después de la descarga
    res.sendFile(filePath, (err) => {
      if (err) {
        console.error('Error al enviar archivo:', err);
        next(new AppError('Error al descargar el archivo', 500));
        return;
      }

      // Eliminar archivo inmediatamente después de la descarga
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(`Archivo temporal eliminado: ${fileName}`);
        }
      } catch (deleteErr) {
        console.error('Error al eliminar archivo temporal:', deleteErr);
      }
    });

  } catch (err) {
    console.error('Error en descarga de archivo temporal:', err);
    next(new AppError('Error al procesar la descarga', 500));
  }
};

export const generarPlantillaPorEspecialidad = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idEspecialidad, idDevices } = req.body;

    if (!idEspecialidad || !Array.isArray(idDevices) || idDevices.length === 0) {
      return next(new AppError("Se requieren idEspecialidad e idDevices[]", 400));
    }

    // 1. Buscar plantilla correspondiente a la especialidad
    const plantilla = await Reporte.findOne({ idEspecialidad });
    if (!plantilla || !Buffer.isBuffer(plantilla.file.data)) {
      return next(new AppError("Plantilla no válida o no encontrada", 404));
    }

    // 2. Obtener datos de DeviceReports directamente
    console.log('🔍 [generarPlantillaPorEspecialidad] Buscando DeviceReports con IDs:', idDevices);

    const deviceReports = await DeviceReport.find({
      _id: { $in: idDevices }
    })
      .populate({
        path: 'deviceCatalog',
        select: 'type ubication identifier building level note'
      })
      .populate('colaborador', 'nombre correo')
      .populate('especialidad', 'nombre');

    console.log('📊 [generarPlantillaPorEspecialidad] DeviceReports encontrados:', deviceReports.length);

    const validDevices = deviceReports
      .filter(report => report.deviceCatalog)
      .map(report => {
        const device = report.deviceCatalog as any;

        console.log(`📝 [generarPlantillaPorEspecialidad] Procesando reporte:`, {
          identifier: device.identifier,
          type: device.type,
          hasWorkEvidence: !!report.WorkEvidence,
          hasDeviceEvidence: !!report.DeviceEvidence,
          hasViewEvidence: !!report.ViewEvidence
        });

        return {
          type: device.type || 'Sin tipo',
          ubication: device.ubication || 'Sin ubicación',
          identifier: device.identifier || 'Sin identificador',
          building: device.building || 'Sin edificio',
          level: device.level || 'Sin nivel',
          note: device.note || report.note || '',
          workEvidence: report.WorkEvidence || '',
          deviceEvidence: report.DeviceEvidence || '',
          viewEvidence: report.ViewEvidence || '',
          fechaMP: report.fechaReporte
            ? new Date(report.fechaReporte).toLocaleDateString("es-ES", {
              day: "2-digit",
              month: "long",
              year: "numeric",
            })
            : "Fecha no disponible",
        };
      });

    console.log('✅ [generarPlantillaPorEspecialidad] Dispositivos válidos procesados:', validDevices.length);

    if (validDevices.length === 0) {
      return next(new AppError("No se encontraron reportes válidos para generar el documento", 404));
    }



    // 3. Preparar plantilla
    const zip = new PizZip(plantilla.file.data);

    const imageMod = new ImageModule({
      centered: false,
      getImage: (tagValue: string) => {
        if (typeof tagValue !== "string" || !tagValue.includes("base64,")) {
          throw new Error("Etiqueta de imagen inválida");
        }
        const base64 = tagValue.split(';base64,').pop();
        if (!base64) throw new Error("Base64 inválido");
        return Buffer.from(base64, 'base64');
      },
      getSize: () => [150, 180],
    });

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      modules: [imageMod],
    });

    // 4. Inyectar datos (incluye fechaMP)
    console.log("Datos enviados a la plantilla:", JSON.stringify({ devices: validDevices }, null, 2));

    try {
      await doc.renderAsync({ devices: validDevices });
    } catch (e: any) {
      console.error("Docxtemplater error:", e.properties?.errors);
      e.properties?.errors?.forEach((err: any) => console.error(err.properties.explanation));
      return next(new AppError("Error al renderizar el documento", 500));
    }

    // 5. Enviar archivo generado
    const buffer = doc.getZip().generate({ type: "nodebuffer" });
    res.set({
      "Content-Disposition": `attachment; filename="reporte_${Date.now()}.docx"`,
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    res.send(buffer);

  } catch (err) {
    console.error("Error inesperado al generar el reporte:", err);
    return next(new AppError("Error generando el reporte", 500));
  }
};

// Función para limpiar todos los archivos temporales de un usuario al cerrar sesión
// Controlador para limpieza automática de archivos temporales del usuario
export const limpiarArchivosUsuario = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // Sección: Autenticación del usuario
    const userId = getUserIdFromToken(req);

    if (!userId) {
      next(new AppError('Usuario no autenticado', 401));
      return;
    }

    console.log(`Iniciando limpieza de archivos para usuario: ${userId}`);
    const userTempDir = path.resolve('temp', `user_${userId}`);

    // Sección: Verificación de existencia del directorio temporal
    if (!fs.existsSync(userTempDir)) {
      console.log(`No existe directorio temporal para usuario: ${userId}`);
      res.status(200).json({
        message: 'No hay archivos temporales para limpiar',
        filesDeleted: 0
      });
      return;
    }

    // Sección: Lectura y eliminación de archivos DOCX
    const files = fs.readdirSync(userTempDir);
    let deletedCount = 0;

    console.log(`Archivos encontrados en directorio ${userTempDir}:`, files);

    // Eliminar todos los archivos .docx del usuario
    for (const file of files) {
      if (file.endsWith('.docx')) {
        const filePath = path.join(userTempDir, file);
        try {
          fs.unlinkSync(filePath);
          deletedCount++;
          console.log(`Archivo eliminado en logout: ${file} del usuario ${userId}`);
        } catch (deleteErr) {
          console.error(`Error eliminando ${file}:`, deleteErr);
        }
      }
    }

    // Sección: Limpieza del directorio temporal vacío
    try {
      const remainingFiles = fs.readdirSync(userTempDir);
      const remainingDocxFiles = remainingFiles.filter(file => file.endsWith('.docx'));

      if (remainingDocxFiles.length === 0) {
        // Eliminar archivos restantes que no sean .docx
        for (const file of remainingFiles) {
          const filePath = path.join(userTempDir, file);
          try {
            fs.unlinkSync(filePath);
            console.log(`Archivo no-docx eliminado: ${file}`);
          } catch (err) {
            console.error(`Error eliminando archivo ${file}:`, err);
          }
        }

        // Eliminar directorio vacío
        fs.rmdirSync(userTempDir);
        console.log(`Directorio temporal eliminado para usuario ${userId}`);
      }
    } catch (dirErr) {
      console.error('Error eliminando directorio:', dirErr);
    }

    // Sección: Respuesta de confirmación de limpieza
    const response = {
      message: `Archivos temporales eliminados exitosamente`,
      filesDeleted: deletedCount,
      userId: userId
    };

    console.log('Resultado limpieza:', response);
    res.status(200).json(response);

  } catch (err) {
    console.error('Error limpiando archivos de usuario:', err);
    next(new AppError('Error al limpiar archivos temporales', 500));
  }
};

/**
 * Obtener estadísticas completas de colaboradores y sus devices/reportes
 * GET /api/reportes/estadisticas
 */
export const obtenerEstadisticas = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {

    // 1. Obtener TODOS los colaboradores sin filtros para estadísticas
    const todosColaboradores = await require('../models/Colaborador').default.find({})
      .populate('poliza', 'nombre')
      .populate('especialidad', 'nombre')
      .select('nombre apellido_paterno correo poliza especialidad');

    // 2. Obtener todos los devices (esto es lo que se ve en la vista previa)
    const todosDevices = await Device.find({})
      .populate('colaborador', 'nombre apellido_paterno correo')
      .populate('especialidad', 'nombre')
      .populate('report', 'name createdAt')
      .populate('images')
      .select('colaborador especialidad report images createdAt type ubication identifier');

    // 3. Contar devices por colaborador (esto coincide con lo que se ve en vista previa)
    const devicesPorColaborador: { [key: string]: number } = {};
    const devicesDetalle: any[] = [];

    todosDevices.forEach(device => {
      if (device.colaborador) {
        const colaboradorId = (device.colaborador as any)._id.toString();
        const colaboradorNombre = (device.colaborador as any).nombre;

        // Contar devices, no reportes
        devicesPorColaborador[colaboradorId] = (devicesPorColaborador[colaboradorId] || 0) + 1;

        devicesDetalle.push({
          _id: device._id,
          type: device.type,
          ubication: device.ubication,
          identifier: device.identifier,
          colaboradorId: colaboradorId,
          colaboradorNombre: colaboradorNombre,
          especialidad: device.especialidad,
          createdAt: (device as any).createdAt,
          hasImages: device.images && device.images.length > 0,
          reportId: device.report ? (device.report as any)._id : null
        });
      }
    });

    // 4. Crear estadísticas completas basadas en devices
    const estadisticas = {
      colaboradores: todosColaboradores.map((colaborador: any) => {
        const colaboradorId = colaborador._id.toString();
        const devices = devicesPorColaborador[colaboradorId] || 0;

        return {
          id: colaborador._id,
          nombre: colaborador.nombre,
          email: colaborador.correo,
          poliza: colaborador.poliza?.nombre || 'Sin póliza',
          reportes: devices, // Cambio: ahora reportes = devices para coincidir con vista previa
          especialidades: colaborador.especialidad?.map((e: any) => e.nombre).join(', ') || 'Sin especialidad'
        };
      }),
      devicesDetalle,
      resumen: {
        totalColaboradores: todosColaboradores.length,
        totalReportes: devicesDetalle.length, // Total de devices, no reportes
        colaboradoresActivos: Object.keys(devicesPorColaborador).length
      }
    };

    res.status(200).json(estadisticas);
  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    next(new AppError('Error al obtener estadísticas', 500));
  }
};

/**
 * Obtener todos los reportes para estadísticas con información de colaboradores
 * GET /api/reportes
 */
export const obtenerReportes = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    // Obtener devices que tienen reportes asociados con colaborador
    const devicesConReporte = await Device.find({ report: { $exists: true, $ne: null } })
      .populate('report', 'name createdAt updatedAt')
      .populate('colaborador', 'nombre apellido_paterno apellido_materno correo')
      .populate('especialidad', 'nombre')
      .select('report colaborador especialidad createdAt updatedAt');

    // Transformar los datos para incluir información del colaborador en cada reporte
    const reportesConColaborador = devicesConReporte
      .filter(device => device.report && device.colaborador)
      .map(device => ({
        _id: (device.report as any)._id,
        name: (device.report as any).name,
        colaboradorId: (device.colaborador as any)._id,
        colaboradorNombre: (device.colaborador as any).nombre,
        colaboradorCompleto: device.colaborador,
        especialidad: device.especialidad,
        createdAt: (device.report as any).createdAt,
        updatedAt: (device.report as any).updatedAt,
        deviceId: device._id
      }));

    res.status(200).json(reportesConColaborador);
  } catch (error) {
    console.error('Error obteniendo reportes:', error);
    next(new AppError('Error al obtener reportes', 500));
  }
};

/**
 * DEBUG: Dump de reportes para análisis
 * GET /api/reportes/debug-dump/:colaboradorId
 */
export const debugDumpReportesColaborador = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const colaboradorId = req.params.colaboradorId;
    console.log('🔍 DUMP: Analizando reportes para colaborador:', colaboradorId);

    // 1. Todos los reportes donde aparece como colaborador principal (campo directo)
    const reportesPrincipales = await DeviceReport.find({ colaborador: colaboradorId })
      .populate('deviceCatalog', 'identifier type ubication')
      .select('_id deviceCatalog colaborador fechaReporte esColaborativo');

    console.log('📊 Reportes como colaborador principal (campo directo):', reportesPrincipales.length);

    // 2. Todos los reportes donde aparece en tipoParticipacion con rol principal
    const reportesRolPrincipal = await DeviceReport.find({
      'tipoParticipacion.colaborador': colaboradorId,
      'tipoParticipacion.rol': 'principal'
    })
      .populate('deviceCatalog', 'identifier type ubication')
      .select('_id deviceCatalog colaborador fechaReporte esColaborativo tipoParticipacion');

    console.log('📊 Reportes con rol principal en tipoParticipacion:', reportesRolPrincipal.length);

    // 3. Todos los reportes donde aparece (cualquier rol)
    const todosLosReportes = await DeviceReport.find({
      $or: [
        { colaborador: colaboradorId },
        { colaboradores: colaboradorId },
        { 'tipoParticipacion.colaborador': colaboradorId }
      ]
    })
      .populate('deviceCatalog', 'identifier type ubication')
      .select('_id deviceCatalog colaborador colaboradores fechaReporte esColaborativo tipoParticipacion');

    console.log('📊 Todos los reportes donde aparece:', todosLosReportes.length);

    // 4. Análisis detallado
    const analisis = {
      colaboradorId,
      reportesPrincipales: reportesPrincipales.map(r => ({
        _id: r._id,
        deviceIdentifier: (r.deviceCatalog as any)?.identifier,
        fechaReporte: r.fechaReporte,
        esColaborativo: r.esColaborativo
      })),
      reportesRolPrincipal: reportesRolPrincipal.map(r => ({
        _id: r._id,
        deviceIdentifier: (r.deviceCatalog as any)?.identifier,
        fechaReporte: r.fechaReporte,
        esColaborativo: r.esColaborativo,
        tipoParticipacion: r.tipoParticipacion
      })),
      resumen: {
        principalesDirectos: reportesPrincipales.length,
        principalesEnTipoParticipacion: reportesRolPrincipal.length,
        totalDondeAparece: todosLosReportes.length
      }
    };

    console.log('📋 ANÁLISIS COMPLETO:', JSON.stringify(analisis, null, 2));

    res.status(200).json(analisis);
  } catch (error) {
    console.error('Error en dump de reportes:', error);
    next(new AppError('Error en dump de reportes', 500));
  }
};

/**
 * Obtener reportes de un colaborador específico desde DeviceReport
 * GET /api/reportes/colaborador/:colaboradorId
 */
export const obtenerReportesColaborador = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const colaboradorId = req.params.colaboradorId;
    console.log('🔍 === DIAGNÓSTICO COMPLETO COLABORADOR ===');
    console.log('🔍 Buscando reportes de DeviceReport para colaborador:', colaboradorId);

    // DIAGNÓSTICO: Verificar si existen DeviceReports en general
    const totalReportes = await DeviceReport.countDocuments();
    console.log('📊 Total DeviceReports en BD:', totalReportes);

    // DIAGNÓSTICO: Verificar si el colaborador existe
    const Colaborador = require('../models/Colaborador').default;
    const colaboradorExiste = await Colaborador.findById(colaboradorId);
    console.log('👤 Colaborador existe:', colaboradorExiste ? 'SÍ' : 'NO');
    if (colaboradorExiste) {
      console.log('👤 Datos del colaborador:', {
        nombre: colaboradorExiste.nombre,
        correo: colaboradorExiste.correo,
        especialidades: colaboradorExiste.especialidad?.length || 0
      });
    }

    // DIAGNÓSTICO: Buscar reportes SIN filtros primero
    const reportesSinFiltro = await DeviceReport.find({}).limit(5);
    console.log('📊 Primeros 5 DeviceReports (muestra):', reportesSinFiltro.map(r => ({
      id: r._id,
      colaborador: r.colaborador,
      esColaborativo: r.esColaborativo,
      tieneParticipacion: (r.tipoParticipacion && r.tipoParticipacion.length > 0) || false
    })));

    // Buscar reportes en la colección DeviceReport donde el colaborador participó
    // ❌ CORREGIDO: El campo 'colaboradores' no existe en DeviceReport
    const todosLosReportes = await DeviceReport.find({
      $or: [
        // Colaborador principal (campo directo)
        { colaborador: colaboradorId },
        // En tipoParticipacion (colaborativo)
        { 'tipoParticipacion.colaborador': colaboradorId }
      ]
    })
      .populate({
        path: 'deviceCatalog',
        select: 'type ubication identifier building level note especialidad'
      })
      .populate({
        path: 'colaborador',
        select: 'nombre apellido_paterno apellido_materno correo'
      })
      .populate({
        path: 'especialidad',
        select: 'nombre'
      })
      .populate({
        path: 'tipoParticipacion.colaborador',
        select: 'nombre apellido_paterno'
      })
      .sort({ fechaReporte: -1 }); // Ordenar por fecha más reciente primero

    console.log('📊 Todos los DeviceReports encontrados:', todosLosReportes.length);

    // Filtrar reportes donde el colaborador es responsable (individual o principal en colaborativo)
    const reportesDevices = todosLosReportes.filter((reporte: any) => {
      console.log(`🔍 Analizando reporte ${reporte.deviceCatalog?.identifier}:`);
      console.log(`   📝 esColaborativo:`, reporte.esColaborativo);
      console.log(`   👤 Buscando colaboradorId:`, colaboradorId);

      if (reporte.esColaborativo) {
        // Para reportes colaborativos: verificar rol principal en tipoParticipacion
        console.log(`   📝 tipoParticipacion:`, JSON.stringify(reporte.tipoParticipacion, null, 2));

        const participacion = reporte.tipoParticipacion?.find((tp: any) => {
          const tpColaboradorId = tp.colaborador?._id?.toString() || tp.colaborador?.toString();
          console.log(`     🔍 Comparando: ${tpColaboradorId} === ${colaboradorId}, rol: ${tp.rol}`);
          return tpColaboradorId === colaboradorId && tp.rol === 'principal';
        });

        const esPrincipal = participacion !== undefined;
        console.log(`${esPrincipal ? '✅' : '❌'} Reporte colaborativo ${reporte.deviceCatalog?.identifier}: Principal = ${esPrincipal ? 'SÍ' : 'NO'}`);
        return esPrincipal;
      } else {
        // Para reportes individuales: verificar campo colaborador directo
        const colaboradorReporteId = reporte.colaborador?._id?.toString() || reporte.colaborador?.toString();
        const esCreador = colaboradorReporteId === colaboradorId;
        console.log(`${esCreador ? '✅' : '❌'} Reporte individual ${reporte.deviceCatalog?.identifier}: Creador = ${esCreador ? 'SÍ' : 'NO'} (${colaboradorReporteId} === ${colaboradorId})`);
        return esCreador;
      }
    });

    console.log('📊 DeviceReports con rol principal:', reportesDevices.length);

    // Debug: Mostrar IDs únicos de los reportes encontrados
    const reporteIds = reportesDevices.map((r: any) => r._id.toString());
    const uniqueIds = [...new Set(reporteIds)];
    console.log('🔍 IDs únicos:', uniqueIds.length, 'vs Total:', reporteIds.length);
    if (reporteIds.length !== uniqueIds.length) {
      console.log('⚠️ ¡HAY DUPLICADOS! IDs duplicados:', reporteIds.filter((id, index) => reporteIds.indexOf(id) !== index));
    }

    // Obtener períodos MP activos para validar editabilidad
    const periodosActivos = await PeriodoMP.find({
      activo: true
    }).select('fechaInicio fechaFin nombre');

    console.log('📅 Períodos activos encontrados:', periodosActivos.length);

    // Eliminar duplicados por deviceCatalog (quedarse con el más reciente)
    const reportesUnicos = reportesDevices.reduce((acc: any[], reporte: any) => {
      const deviceId = reporte.deviceCatalog?._id?.toString() || reporte.deviceCatalog?.toString();
      const existente = acc.find(r => {
        const existenteDeviceId = r.deviceCatalog?._id?.toString() || r.deviceCatalog?.toString();
        return existenteDeviceId === deviceId;
      });

      if (!existente) {
        acc.push(reporte);
      } else {
        // Mantener el más reciente
        const fechaReporte = new Date(reporte.fechaReporte || reporte.createdAt);
        const fechaExistente = new Date(existente.fechaReporte || existente.createdAt);
        if (fechaReporte > fechaExistente) {
          const index = acc.indexOf(existente);
          acc[index] = reporte;
        }
      }
      return acc;
    }, []);

    console.log('🔧 Después de eliminar duplicados:', reportesUnicos.length, 'reportes únicos');

    // Transformar DeviceReports a formato compatible con frontend
    const reportesColaborador = reportesUnicos.map((reporte: any) => {
      console.log('🔍 Procesando DeviceReport:', (reporte.deviceCatalog as any)?.identifier);

      // Debug: Mostrar campos de evidencia
      console.log('   🖼️ WorkEvidence:', reporte.WorkEvidence ? 'SÍ' : 'NO');
      console.log('   🖼️ DeviceEvidence:', reporte.DeviceEvidence ? 'SÍ' : 'NO');
      console.log('   🖼️ ViewEvidence:', reporte.ViewEvidence ? 'SÍ' : 'NO');

      // Crear objeto de imágenes en el formato esperado por el frontend
      const images = [{
        _id: reporte._id,
        WorkEvidence: reporte.WorkEvidence || '',
        DeviceEvidence: reporte.DeviceEvidence || '',
        ViewEvidence: reporte.ViewEvidence || ''
      }];

      const deviceCatalog = reporte.deviceCatalog || {};
      const colaboradorData = reporte.colaborador || {};
      const especialidadData = reporte.especialidad || {};

      // Verificar si puede editar basado en períodos activos
      const fechaActual = new Date();
      const puedeEditar = periodosActivos.some(periodo => {
        const fechaInicio = new Date(periodo.fechaInicio);
        const fechaFin = new Date(periodo.fechaFin);
        return fechaActual >= fechaInicio && fechaActual <= fechaFin;
      });

      console.log('   📸 Imágenes encontradas para dispositivo', deviceCatalog.identifier, ':', images.length);

      // Debug: Log de datos colaborativos que se envían al frontend
      if (reporte.esColaborativo) {
        console.log('   🤝 Datos colaborativos a enviar:', {
          esColaborativo: reporte.esColaborativo,
          tipoParticipacion: reporte.tipoParticipacion?.length || 0,
          colaboradores: reporte.tipoParticipacion?.map((tp: any) => ({
            nombre: tp.colaborador?.nombre,
            apellido: tp.colaborador?.apellido_paterno,
            rol: tp.rol
          }))
        });
      }

      return {
        _id: reporte._id,
        type: deviceCatalog.type || 'Sin tipo',
        ubication: deviceCatalog.ubication || 'Sin ubicación',
        identifier: deviceCatalog.identifier || 'Sin identificador',
        building: deviceCatalog.building || 'Sin edificio',
        level: deviceCatalog.level || 'Sin nivel',
        note: deviceCatalog.note || '',
        images: images,
        colaborador: {
          _id: colaboradorData._id || null,
          nombre: colaboradorData.nombre || 'Sin nombre',
          apellido_paterno: colaboradorData.apellido_paterno || 'Sin apellido',
          apellido_materno: colaboradorData.apellido_materno || '',
          correo: colaboradorData.correo || 'Sin correo'
        },
        especialidad: {
          _id: especialidadData._id || null,
          nombre: especialidadData.nombre || 'Sin especialidad'
        },
        createdAt: reporte.fechaReporte || reporte.createdAt,
        updatedAt: reporte.updatedAt,
        puedeEditar,
        periodoEditable: 'Período activo',
        estado: reporte.estado || 'Completado',
        asignacionMultiple: false,
        esColaborativo: reporte.esColaborativo || false,
        tipoParticipacion: reporte.tipoParticipacion || [],
        colaboradores: reporte.colaboradores || []
      };
    });

    console.log('✅ Enviando respuesta con', reportesColaborador.length, 'reportes');

    res.status(200).json({
      reportes: reportesColaborador,
      total: reportesColaborador.length,
      periodosActivos: periodosActivos.map((p: any) => ({
        nombre: p.nombre,
        fechaInicio: p.fechaInicio,
        fechaFin: p.fechaFin
      }))
    });
  } catch (error) {
    console.error('Error obteniendo reportes del colaborador:', error);
    next(new AppError('Error al obtener reportes del colaborador', 500));
  }
};