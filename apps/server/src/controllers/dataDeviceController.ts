import { NextFunction, Request, Response } from "express";
import Device from "../models/Device";
import DeviceReport from "../models/DeviceReport";
import { AppError } from "../errors/customErrors";
import Colaborador from "../models/Colaborador";

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

    // CAMBIO PRINCIPAL: Usar DeviceReport en lugar de Device
    const mongoose = require('mongoose');

    const filtro: any = {};

    // Filtrar por colaboradores
    if (colaboradores) {
      const ids = (colaboradores as string).split(",");
      const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));

      // Para DeviceReport: filtrar por colaborador directo O en tipoParticipacion
      filtro.$or = [
        { colaborador: { $in: objectIds } },
        { 'tipoParticipacion.colaborador': { $in: objectIds } }
      ];
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
      .populate('colaborador', 'nombre correo rol')
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

      // Crear formato de imagen esperado por el frontend
      const images = [{
        _id: report._id,
        WorkEvidence: report.WorkEvidence || '',
        DeviceEvidence: report.DeviceEvidence || '',
        ViewEvidence: report.ViewEvidence || ''
      }];

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
        // Agregar campos adicionales para compatibilidad
        esColaborativo: report.esColaborativo || false,
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
