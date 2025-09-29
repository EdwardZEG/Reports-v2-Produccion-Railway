import { Request, Response, NextFunction, RequestHandler } from 'express';
import DeviceReport from '../models/DeviceReport';
import DeviceCatalog from '../models/DeviceCatalog';
import PeriodoMP from '../models/PeriodoMP';
import { AppError } from '../errors/customErrors';
import mongoose from 'mongoose';

/**
 * Crear un nuevo reporte de dispositivo
 */
export const createDeviceReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      deviceCatalogId,
      colaborador,
      especialidad,
      WorkEvidence,
      DeviceEvidence,
      ViewEvidence,
      manualUploadReason,
      note,
      // Campos para trabajo colaborativo
      esColaborativo,
      colaboradores,
      tipoParticipacion
    } = req.body;

    if (!deviceCatalogId || !colaborador || !especialidad) {
      return next(new AppError('deviceCatalogId, colaborador y especialidad son requeridos', 400));
    }

    // Verificar que el dispositivo existe en el catálogo
    const catalogDevice = await DeviceCatalog.findById(deviceCatalogId);
    if (!catalogDevice) {
      return next(new AppError('Dispositivo no encontrado en catálogo', 404));
    }

    // Preparar datos del reporte
    const reportData: any = {
      deviceCatalog: deviceCatalogId,
      colaborador: new mongoose.Types.ObjectId(colaborador),
      especialidad: new mongoose.Types.ObjectId(especialidad),
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
    };

    // Agregar información colaborativa si aplica
    if (esColaborativo && colaboradores && colaboradores.length > 0) {
      reportData.esColaborativo = true;
      reportData.colaboradores = colaboradores.map((colId: string) => new mongoose.Types.ObjectId(colId));

      if (tipoParticipacion && Array.isArray(tipoParticipacion)) {
        reportData.tipoParticipacion = tipoParticipacion.map((participacion: any) => ({
          colaborador: new mongoose.Types.ObjectId(participacion.colaborador),
          rol: participacion.rol,
          descripcion: participacion.descripcion
        }));
      }

      console.log('👥 Creando reporte colaborativo con:', colaboradores.length, 'colaboradores');
    }

    // Crear el reporte
    const deviceReport = await DeviceReport.create(reportData);

    // Hacer populate para devolver datos completos
    await deviceReport.populate([
      { path: 'deviceCatalog' },
      { path: 'colaborador', select: 'name email' },
      { path: 'especialidad', select: 'name' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Reporte de dispositivo creado exitosamente',
      data: deviceReport
    });

  } catch (error: any) {
    console.error('Error creando reporte de dispositivo:', error);
    return next(new AppError('Error creando reporte de dispositivo', 500));
  }
};

/**
 * Obtener reportes con filtros y paginación
 */
export const getDeviceReports = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = 1,
      limit = 20,
      colaborador,
      especialidad,
      fechaInicio,
      fechaFinal,
      estado,
      identifier,
      ubication,
      asignado,
      completado
    } = req.query;

    const filter: any = {};

    // Filtros de colaborador y especialidad
    if (colaborador) {
      const mongoose = require('mongoose');
      const ids = (colaborador as string).split(',');
      const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));
      filter.colaborador = { $in: objectIds };
    }

    if (especialidad) {
      filter.especialidad = new mongoose.Types.ObjectId(especialidad as string);
    }

    // Filtros de fecha
    if (fechaInicio || fechaFinal) {
      filter.fechaReporte = {};
      if (fechaInicio) {
        filter.fechaReporte.$gte = new Date(fechaInicio as string);
      }
      if (fechaFinal) {
        filter.fechaReporte.$lte = new Date(fechaFinal as string);
      }
    }

    // Filtros de estado
    if (estado) {
      filter.estado = estado;
    }

    if (asignado !== undefined) {
      filter.asignado = asignado === 'true';
    }

    if (completado !== undefined) {
      filter.completado = completado === 'true';
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    // Pipeline de agregación para filtrar por datos del dispositivo
    const pipeline: any[] = [
      {
        $lookup: {
          from: 'devicecatalogs',
          localField: 'deviceCatalog',
          foreignField: '_id',
          as: 'device'
        }
      },
      { $unwind: '$device' }
    ];

    // Agregar filtros de dispositivo si están presentes
    if (identifier || ubication) {
      const deviceFilter: any = {};
      if (identifier) {
        deviceFilter['device.identifier'] = { $regex: identifier as string, $options: 'i' };
      }
      if (ubication) {
        deviceFilter['device.ubication'] = { $regex: ubication as string, $options: 'i' };
      }
      pipeline.push({ $match: deviceFilter });
    }

    // Agregar filtros generales
    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }

    // Agregar lookup para colaborador y especialidad
    pipeline.push(
      {
        $lookup: {
          from: 'colaboradors',
          localField: 'colaborador',
          foreignField: '_id',
          as: 'colaboradorInfo'
        }
      },
      {
        $lookup: {
          from: 'especialidads',
          localField: 'especialidad',
          foreignField: '_id',
          as: 'especialidadInfo'
        }
      },
      { $unwind: '$colaboradorInfo' },
      { $unwind: '$especialidadInfo' }
    );

    // Paginación y ordenamiento
    pipeline.push(
      { $sort: { fechaReporte: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit as string) }
    );

    const [reports, totalPipeline] = await Promise.all([
      DeviceReport.aggregate(pipeline),
      DeviceReport.aggregate([
        ...pipeline.slice(0, -3), // Excluir sort, skip, limit
        { $count: 'total' }
      ])
    ]);

    const total = totalPipeline[0]?.total || 0;

    res.status(200).json({
      success: true,
      data: reports,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });

  } catch (error: any) {
    console.error('Error obteniendo reportes:', error);
    return next(new AppError('Error obteniendo reportes de dispositivos', 500));
  }
};

/**
 * Obtener un reporte específico por ID
 */
export const getDeviceReportById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const report = await DeviceReport.findById(id)
      .populate('deviceCatalog')
      .populate('colaborador', 'name email')
      .populate('especialidad', 'name')
      .populate('periodoMP', 'nombre fechaInicio fechaFin');

    if (!report) {
      return next(new AppError('Reporte no encontrado', 404));
    }

    res.status(200).json({
      success: true,
      data: report
    });

  } catch (error: any) {
    console.error('Error obteniendo reporte:', error);
    return next(new AppError('Error obteniendo reporte', 500));
  }
};

/**
 * Actualizar estado de un reporte
 */
export const updateDeviceReportStatus = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { estado, note } = req.body;

    const validStates = ['pendiente', 'en_progreso', 'completado', 'rechazado'];
    if (!validStates.includes(estado)) {
      return next(new AppError('Estado no válido', 400));
    }

    const updateData: any = { estado };
    if (note) updateData.note = note;

    if (estado === 'completado') {
      updateData.completado = true;
      updateData.fechaCompletado = new Date();
    }

    const report = await DeviceReport.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).populate('deviceCatalog');

    if (!report) {
      return next(new AppError('Reporte no encontrado', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Estado del reporte actualizado',
      data: report
    });

  } catch (error: any) {
    console.error('Error actualizando reporte:', error);
    return next(new AppError('Error actualizando reporte', 500));
  }
};

/**
 * Eliminar un reporte y revertir estado del dispositivo
 */
export const deleteDeviceReport = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    // Primero obtener el reporte para saber qué dispositivo revertir
    const report = await DeviceReport.findById(id);

    if (!report) {
      return next(new AppError('Reporte no encontrado', 404));
    }

    console.log('🗑️ Eliminando reporte y revirtiendo estado del dispositivo:', {
      reportId: id,
      deviceId: report.deviceCatalog,
      colaboradorId: report.colaborador
    });

    // PASO 1: Eliminar el reporte
    await DeviceReport.findByIdAndDelete(id);

    // PASO 2: Revertir estado del dispositivo en período MP
    if (report.deviceCatalog && report.colaborador) {
      try {
        // Buscar el período MP que contiene este dispositivo asignado
        const periodo = await PeriodoMP.findOne({
          'dispositivos': {
            $elemMatch: {
              'deviceCatalog': report.deviceCatalog,
              'colaboradorAsignado': report.colaborador,
              'estado': 'completado'
            }
          }
        });

        if (periodo) {
          console.log('📍 Período MP encontrado:', periodo._id);

          // Encontrar el índice del dispositivo específico
          const deviceIndex = periodo.dispositivos.findIndex((d: any) =>
            d.deviceCatalog.toString() === report.deviceCatalog.toString() &&
            d.colaboradorAsignado?.toString() === report.colaborador.toString()
          );

          if (deviceIndex !== -1) {
            // Revertir el estado a pendiente
            periodo.dispositivos[deviceIndex].estado = 'pendiente';
            periodo.dispositivos[deviceIndex].fechaCompletado = undefined;
            periodo.dispositivos[deviceIndex].completadoPor = undefined;

            await periodo.save();
            console.log('✅ Estado del dispositivo revertido a pendiente');
          }
        } else {
          console.log('⚠️ No se encontró período MP para revertir estado');
        }
      } catch (revertError) {
        console.error('Error revirtiendo estado del dispositivo:', revertError);
        // No fallar la eliminación del reporte por esto
      }
    }

    res.status(200).json({
      success: true,
      message: 'Reporte eliminado y dispositivo revertido a pendiente exitosamente'
    });

  } catch (error: any) {
    console.error('Error eliminando reporte:', error);
    return next(new AppError('Error eliminando reporte', 500));
  }
};

/**
 * Función para actualizar reporte con datos JSON (para PATCH /:id)
 */
export const updateDeviceReportJSON = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const {
      type,
      ubication,
      identifier,
      building,
      level,
      WorkEvidence,
      DeviceEvidence,
      ViewEvidence,
      note,
      esColaborativo,
      colaboradores,
      tipoParticipacion,
      especialidad
    } = req.body;

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('ID de reporte inválido', 400));
    }

    console.log('🔄 Actualizando reporte con datos JSON:', id);

    // Buscar el reporte existente
    const reporteExistente = await DeviceReport.findById(id);
    if (!reporteExistente) {
      return next(new AppError('Reporte no encontrado', 404));
    }

    // Preparar datos de actualización (preservando datos de creación)
    const updateData: any = {};

    // Solo actualizar campos que se proporcionan (preservar los originales)
    if (type !== undefined) updateData.type = type;
    if (ubication !== undefined) updateData.ubication = ubication;
    if (identifier !== undefined) updateData.identifier = identifier;
    if (building !== undefined) updateData.building = building;
    if (level !== undefined) updateData.level = level;
    if (note !== undefined) updateData.note = note;
    if (WorkEvidence !== undefined) updateData.WorkEvidence = WorkEvidence;
    if (DeviceEvidence !== undefined) updateData.DeviceEvidence = DeviceEvidence;
    if (ViewEvidence !== undefined) updateData.ViewEvidence = ViewEvidence;

    // Siempre actualizar la fecha de modificación
    updateData.fechaActualizacion = new Date();

    // Actualizar especialidad si se proporciona
    if (especialidad) {
      updateData.especialidad = new mongoose.Types.ObjectId(especialidad);
    }

    // Agregar información colaborativa si aplica
    if (esColaborativo && colaboradores && colaboradores.length > 0) {
      updateData.esColaborativo = true;
      updateData.colaboradores = colaboradores.map((colId: string) => new mongoose.Types.ObjectId(colId));

      if (tipoParticipacion && Array.isArray(tipoParticipacion)) {
        updateData.tipoParticipacion = tipoParticipacion.map((participacion: any) => ({
          colaborador: new mongoose.Types.ObjectId(participacion.colaborador),
          rol: participacion.rol,
          descripcion: participacion.descripcion
        }));
      }

      console.log('👥 Actualizando reporte colaborativo con:', colaboradores.length, 'colaboradores');
    } else {
      updateData.esColaborativo = false;
      updateData.colaboradores = [];
      updateData.tipoParticipacion = [];
    }

    // Actualizar el reporte
    const reporteActualizado = await DeviceReport.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate([
      { path: 'deviceCatalog' },
      { path: 'colaborador', select: 'name email' },
      { path: 'especialidad', select: 'name' }
    ]);

    console.log('✅ Reporte actualizado exitosamente');

    res.status(200).json({
      success: true,
      message: 'Reporte de dispositivo actualizado exitosamente',
      data: reporteActualizado
    });

  } catch (error: any) {
    console.error('Error actualizando reporte de dispositivo:', error);
    return next(new AppError('Error actualizando reporte de dispositivo', 500));
  }
};

/**
 * Buscar reportes por deviceCatalogId y colaboradorId
 * GET /api/device-reports/search
 */
export const findDeviceReportByDeviceAndColaborador: RequestHandler = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { deviceCatalogId, colaboradorId } = req.query;

    if (!deviceCatalogId || !colaboradorId) {
      return next(new AppError('deviceCatalogId y colaboradorId son requeridos', 400));
    }

    console.log('🔍 Buscando reporte completado:', { deviceCatalogId, colaboradorId });

    const reporte = await DeviceReport.findOne({
      deviceCatalog: deviceCatalogId,
      colaborador: colaboradorId,
      completado: true
    })
      .populate('deviceCatalog', 'identifier type ubication building level')
      .populate('colaborador', 'nombre apellido_paterno correo')
      .sort({ fechaCompletado: -1 }) // Más reciente primero
      .lean();

    if (!reporte) {
      res.status(404).json({
        success: false,
        message: 'No se encontró reporte completado para este dispositivo y colaborador'
      });
      return;
    }

    console.log('✅ Reporte encontrado:', reporte._id);

    res.status(200).json({
      success: true,
      data: reporte
    });

  } catch (error: any) {
    console.error('Error buscando reporte:', error);
    return next(new AppError('Error buscando reporte', 500));
  }
};

/**
 * Eliminar reporte por período y dispositivo - para el botón de eliminar/revertir
 * DELETE /api/device-reports/periodo/:periodoId/device/:deviceId
 */
export const deleteDeviceReportByPeriodoAndDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { periodoId, deviceId } = req.params;

    console.log('🗑️ Eliminando reporte por período y dispositivo:', { periodoId, deviceId });

    // Buscar el reporte completado para este dispositivo y período
    const report = await DeviceReport.findOne({
      deviceCatalog: deviceId,
      completado: true
    }).populate('deviceCatalog', 'identifier');

    if (!report) {
      return next(new AppError('No se encontró reporte completado para este dispositivo', 404));
    }

    console.log('📋 Reporte encontrado para eliminar:', report._id);

    // PASO 1: Eliminar el reporte
    await DeviceReport.findByIdAndDelete(report._id);

    // PASO 2: Revertir estado del dispositivo en período MP
    try {
      const periodo = await PeriodoMP.findById(periodoId);

      if (periodo) {
        // Encontrar el dispositivo y revertir su estado
        const deviceIndex = periodo.dispositivos.findIndex((d: any) =>
          d.deviceCatalog.toString() === deviceId
        );

        if (deviceIndex !== -1) {
          periodo.dispositivos[deviceIndex].estado = 'pendiente';
          periodo.dispositivos[deviceIndex].fechaCompletado = undefined;
          periodo.dispositivos[deviceIndex].completadoPor = undefined;

          await periodo.save();
          console.log('✅ Estado del dispositivo revertido a pendiente');
        }
      }
    } catch (revertError) {
      console.error('Error revirtiendo estado:', revertError);
    }

    res.status(200).json({
      success: true,
      message: 'Reporte eliminado y dispositivo revertido a pendiente exitosamente'
    });

  } catch (error: any) {
    console.error('Error eliminando reporte:', error);
    return next(new AppError('Error eliminando reporte', 500));
  }
};