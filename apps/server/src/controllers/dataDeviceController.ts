import { NextFunction, Request, Response } from "express";
import Device from "../models/Device";
import DeviceReport from "../models/DeviceReport";
import { AppError } from "../errors/customErrors";
import Colaborador from "../models/Colaborador";

/**
 * Función auxiliar para formatear imágenes base64
 * Agrega el prefijo data:image/jpeg;base64, si no lo tiene
 */
const formatImageBase64 = (base64Data: string | null | undefined): string => {
  if (!base64Data || base64Data.trim() === '') {
    return '';
  }

  // Si ya tiene el prefijo, devolverlo tal como está
  if (base64Data.startsWith('data:image/')) {
    return base64Data;
  }

  // Si es solo base64 crudo, agregar el prefijo
  if (base64Data.match(/^[A-Za-z0-9+/=]+$/)) {
    return `data:image/jpeg;base64,${base64Data}`;
  }

  // Si no es un formato reconocido, devolver vacío
  return '';
};

export const createOrGetDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const data = req.body;
  const {
    type,
    ubication,
    identifier,
    building,
    level,
    note,
    colaborador: colaboradorId,
    especialidad,
  } = data;

  if (!colaboradorId) {
    return next(new AppError("Debe proporcionar el ID de colaborador", 400));
  }

  if (!especialidad) {
    return next(new AppError("Debe proporcionar la especialidad", 400));
  }

  try {
    const mongoose = require('mongoose');

    const colaborador = await Colaborador.findById(colaboradorId).populate(
      "poliza especialidad"
    );
    if (!colaborador) {
      return next(new AppError("Colaborador no encontrado", 400));
    }

    // Convertir IDs a ObjectId para la búsqueda
    const colaboradorObjectId = new mongoose.Types.ObjectId(colaboradorId);
    const especialidadObjectId = new mongoose.Types.ObjectId(especialidad);

    const existing = await Device.findOne({
      type,
      ubication,
      identifier,
      colaborador: colaboradorObjectId,
      especialidad: especialidadObjectId,
    });

    if (existing) {
      return res
        .status(200)
        .json({ message: "Dispositivo ya existe", device: existing });
    }

    const device = await Device.create({
      type,
      ubication,
      identifier,
      building,
      level,
      note,
      images: data.images || [],
      report: data.report,
      colaborador: colaboradorObjectId,
      especialidad: especialidadObjectId,
    });

    res.status(201).json({ message: "Dispositivo creado", device });
  } catch (error) {
    console.error(error);
    return next(
      new AppError("Error del servidor al crear o buscar dispositivo", 500)
    );
  }
};

export const getDevices = async (req: Request, res: Response) => {
  try {
    const {
      colaboradores,
      especialidad,
      fechaInicio,
      fechaFinal,
      identifier,
      ubication,
    } = req.query;

    console.log('🔍 === INICIO getDevices ===');
    console.log('📋 Parámetros recibidos:', {
      colaboradores,
      especialidad,
      fechaInicio,
      fechaFinal,
      identifier,
      ubication
    });

    // 🔒 VALIDACIÓN DE PÓLIZA PARA COORDINADORES
    const user = (req as any).user;
    console.log('👤 Usuario autenticado:', { rol: user?.rol, polizaId: user?.polizaId });

    // CAMBIO PRINCIPAL: Usar DeviceReport en lugar de Device
    const mongoose = require('mongoose');

    const filtro: any = {};

    // Filtrar por colaboradores CON VALIDACIÓN DE PÓLIZA
    if (colaboradores) {
      const ids = (colaboradores as string).split(",");
      const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));

      // 🔒 SI ES COORDINADOR: Validar que los colaboradores pertenecen a su póliza
      if (user?.rol === 'coordinador' && user?.polizaId) {
        console.log('🔒 Validando que los colaboradores pertenecen a la póliza del coordinador...');

        const Colaborador = require('../models/Colaborador').default;
        const colaboradoresValidos = await Colaborador.find({
          _id: { $in: objectIds },
          poliza: user.polizaId // Solo colaboradores de la misma póliza
        }).select('_id');

        const idsValidos = colaboradoresValidos.map((c: any) => c._id);
        console.log('✅ Colaboradores válidos para la póliza:', idsValidos.length, 'de', objectIds.length, 'solicitados');

        if (idsValidos.length === 0) {
          console.log('❌ Ningún colaborador válido encontrado para la póliza del coordinador');
          res.status(200).json([]);
          return;
        }

        // Usar solo los IDs válidos
        filtro.$or = [
          { colaborador: { $in: idsValidos } },
          { 'tipoParticipacion.colaborador': { $in: idsValidos } }
        ];
      } else {
        // Para administradores o sin restricciones de póliza
        filtro.$or = [
          { colaborador: { $in: objectIds } },
          { 'tipoParticipacion.colaborador': { $in: objectIds } }
        ];
      }
    }

    // Filtrar por especialidad
    if (especialidad) {
      filtro.especialidad = new mongoose.Types.ObjectId(especialidad as string);
    }

    // Filtrar por rango de fechas (usando fechaReporte)
    if (fechaInicio && fechaFinal) {
      const startDate = new Date(fechaInicio as string);
      const endDate = new Date(fechaFinal as string);
      endDate.setHours(23, 59, 59, 999);

      filtro.fechaReporte = {
        $gte: startDate,
        $lte: endDate,
      };
    }

    console.log('🔍 Filtro de búsqueda:', JSON.stringify(filtro, null, 2));

    // Buscar en DeviceReports con populate de deviceCatalog
    const deviceReports = await DeviceReport.find(filtro)
      .populate({
        path: 'deviceCatalog',
        select: 'type ubication identifier building level note'
      })
      .populate('colaborador', 'nombre apellido_paterno apellido_materno correo rol')
      .populate('colaboradores', 'nombre apellido_paterno apellido_materno correo rol') // AGREGAR POPULATE PARA COLABORADORES
      .populate('especialidad', 'nombre')
      .populate({
        path: 'tipoParticipacion.colaborador',
        select: 'nombre apellido_paterno'
      })
      .sort({ fechaReporte: -1 });

    console.log('📊 DeviceReports encontrados:', deviceReports.length);

    // Filtrar por identifier/ubication si se especificaron (buscar en deviceCatalog)
    let filteredReports = deviceReports;

    if (identifier && typeof identifier === "string") {
      const escaped = identifier.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filteredReports = filteredReports.filter(report =>
        report.deviceCatalog && regex.test((report.deviceCatalog as any).identifier)
      );
    }

    if (ubication && typeof ubication === "string") {
      const escaped = ubication.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
      const regex = new RegExp(escaped, "i");
      filteredReports = filteredReports.filter(report =>
        report.deviceCatalog && regex.test((report.deviceCatalog as any).ubication)
      );
    }

    console.log('📊 Después del filtro adicional:', filteredReports.length);

    // Transformar DeviceReports al formato esperado por el frontend (Device interface)
    const devicesFormatted = filteredReports.map((report: any) => {
      const deviceCatalog = report.deviceCatalog || {};

      // Crear formato de imagen esperado por el frontend con prefijos correctos
      const images = [{
        _id: report._id,
        WorkEvidence: formatImageBase64(report.WorkEvidence),
        DeviceEvidence: formatImageBase64(report.DeviceEvidence),
        ViewEvidence: formatImageBase64(report.ViewEvidence)
      }];

      console.log(`📸 Imágenes formateadas para ${deviceCatalog.identifier}:`, {
        hasWorkEvidence: !!images[0].WorkEvidence,
        hasDeviceEvidence: !!images[0].DeviceEvidence,
        hasViewEvidence: !!images[0].ViewEvidence,
        workEvidenceLength: images[0].WorkEvidence.length,
        deviceEvidenceLength: images[0].DeviceEvidence.length,
        viewEvidenceLength: images[0].ViewEvidence.length
      });

      return {
        _id: report._id,
        type: deviceCatalog.type || 'Sin tipo',
        ubication: deviceCatalog.ubication || 'Sin ubicación',
        identifier: deviceCatalog.identifier || 'Sin identificador',
        building: deviceCatalog.building || 'Sin edificio',
        level: deviceCatalog.level || 'Sin nivel',
        note: deviceCatalog.note || report.note || '',
        images: images,
        createdAt: report.fechaReporte || report.createdAt,
        colaborador: report.colaborador,
        especialidad: report.especialidad,
        // Campos para trabajo colaborativo
        esColaborativo: report.esColaborativo || false,
        colaboradores: report.colaboradores || [], // AGREGAR ESTE CAMPO
        tipoParticipacion: report.tipoParticipacion || []
      };
    });

    console.log('✅ Dispositivos formateados enviados:', devicesFormatted.length);
    console.log('🔍 === FIN getDevices ===');

    res.status(200).json(devicesFormatted);
  } catch (error) {
    console.error('💥 Error en getDevices:', error);
    res.status(500).json({ message: "Error del servidor" });
  }
};

export const getDeviceById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;

  try {
    const device = await Device.findById(id)
      .populate("colaborador", "nombre correo rol")
      .populate("images")
      .populate("report")
      .populate("especialidad", "nombre");

    if (!device) {
      return next(new AppError("Dispositivo no encontrado", 404));
    }

    res.status(200).json({ device });
  } catch (error) {
    return next(new AppError("Error al obtener dispositivo por ID", 500));
  }
};

export const updateDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const { id } = req.params;
  const { type, ubication, identifier, building, level, note, colaborador, especialidad } = req.body;

  try {
    const mongoose = require('mongoose');

    const existingDevice = await Device.findById(id);
    if (!existingDevice) {
      return next(new AppError("Dispositivo no encontrado", 404));
    }

    // Preparar datos de actualización - CONVERTIR STRINGS A OBJECTID
    const updateData: any = {
      type,
      ubication,
      identifier,
      building,
      level,
      note,
      // Convertir colaborador y especialidad a ObjectId si son strings
      colaborador: typeof colaborador === 'string' ? new mongoose.Types.ObjectId(colaborador) : colaborador,
      especialidad: typeof especialidad === 'string' ? new mongoose.Types.ObjectId(especialidad) : especialidad,
    };

    const deviceCreatedAt = (existingDevice as any).createdAt;
    const now = new Date();

    if (!deviceCreatedAt) {
      const mongoose = require('mongoose');
      const db = mongoose.connection.db;

      await db.collection('devices').updateOne(
        { _id: new mongoose.Types.ObjectId(id) },
        {
          $set: {
            ...updateData,
            createdAt: now,
            updatedAt: now
          }
        }
      );

      const updatedDevice = await Device.findById(id);

      res.status(200).json({
        success: true,
        message: "Dispositivo actualizado exitosamente",
        device: updatedDevice,
      });
      return;
    }

    // Si ya tiene createdAt, actualización normal
    const updatedDevice = await Device.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      message: "Dispositivo actualizado exitosamente",
      device: updatedDevice,
    });
  } catch (error) {
    return next(new AppError("Error al actualizar dispositivo", 500));
  }
};

/**
 * Migrar IDs de string a ObjectId para dispositivos existentes
 * Endpoint temporal para arreglar datos existentes
 */
export const migrateDeviceIds = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const mongoose = require('mongoose');

    // Buscar todos los dispositivos
    const devices = await Device.find({}).lean();

    let migratedCount = 0;
    const errors: string[] = [];

    for (const device of devices) {
      const updates: any = {};
      let needsUpdate = false;

      // Verificar si colaborador es string y convertir a ObjectId
      if (device.colaborador && typeof device.colaborador === 'string') {
        try {
          updates.colaborador = new mongoose.Types.ObjectId(device.colaborador);
          needsUpdate = true;
        } catch (error) {
          errors.push(`Error converting colaborador ID ${device.colaborador} for device ${device._id}`);
        }
      }

      // Verificar si especialidad es string y convertir a ObjectId  
      if (device.especialidad && typeof device.especialidad === 'string') {
        try {
          updates.especialidad = new mongoose.Types.ObjectId(device.especialidad);
          needsUpdate = true;
        } catch (error) {
          errors.push(`Error converting especialidad ID ${device.especialidad} for device ${device._id}`);
        }
      }

      // Actualizar el dispositivo si es necesario
      if (needsUpdate) {
        await Device.updateOne(
          { _id: device._id },
          { $set: updates }
        );
        migratedCount++;
      }
    }

    res.status(200).json({
      success: true,
      message: `Migración completada. ${migratedCount} dispositivos actualizados de ${devices.length} total.`,
      migratedCount,
      totalDevices: devices.length,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    return next(new AppError("Error en migración de dispositivos", 500));
  }
};
