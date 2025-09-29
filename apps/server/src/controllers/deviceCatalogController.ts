import { Request, Response, NextFunction } from 'express';
import DeviceCatalog from '../models/DeviceCatalog';
import { AppError } from '../errors/customErrors';

/**
 * Buscar dispositivos en el catálogo para autocompletado
 * Esta función es MUY rápida porque solo consulta el catálogo sin joins
 */
export const searchDevicesForAutocomplete = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
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

    const devices = await DeviceCatalog.find(filter)
      .limit(parseInt(limit as string))
      .sort({ identifier: 1 })
      .select('type ubication identifier building level')
      .lean();

    res.status(200).json({
      success: true,
      data: devices,
      count: devices.length
    });

  } catch (error: any) {
    console.error('Error en búsqueda de autocompletado:', error);
    return next(new AppError('Error buscando dispositivos', 500));
  }
};

/**
 * Obtener todos los dispositivos del catálogo con paginación
 */
export const getCatalogDevices = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      page = 1,
      limit = 50,
      type,
      ubication,
      identifier,
      active = 'true'
    } = req.query;

    const filter: any = {};

    if (active !== 'all') {
      filter.active = active === 'true';
    }

    if (type) {
      filter.type = { $regex: type as string, $options: 'i' };
    }

    if (ubication) {
      filter.ubication = { $regex: ubication as string, $options: 'i' };
    }

    if (identifier) {
      filter.identifier = { $regex: identifier as string, $options: 'i' };
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [devices, total] = await Promise.all([
      DeviceCatalog.find(filter)
        .skip(skip)
        .limit(parseInt(limit as string))
        .sort({ createdAt: -1 })
        .lean(),
      DeviceCatalog.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: devices,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });

  } catch (error: any) {
    console.error('Error obteniendo catálogo:', error);
    return next(new AppError('Error obteniendo dispositivos del catálogo', 500));
  }
};

/**
 * Crear o obtener dispositivo en el catálogo
 */
export const createOrGetCatalogDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { type, ubication, identifier, building, level } = req.body;

    if (!type || !ubication || !identifier) {
      return next(new AppError('type, ubication e identifier son requeridos', 400));
    }

    // Buscar si ya existe
    let device = await DeviceCatalog.findOne({
      type,
      ubication,
      identifier
    });

    if (device) {
      return res.status(200).json({
        success: true,
        message: 'Dispositivo ya existe en catálogo',
        data: device,
        created: false
      });
    }

    // Crear nuevo dispositivo en catálogo
    device = await DeviceCatalog.create({
      type,
      ubication,
      identifier,
      building,
      level,
      active: true
    });

    res.status(201).json({
      success: true,
      message: 'Dispositivo agregado al catálogo',
      data: device,
      created: true
    });

  } catch (error: any) {
    console.error('Error creando dispositivo en catálogo:', error);
    return next(new AppError('Error procesando dispositivo del catálogo', 500));
  }
};

/**
 * Actualizar dispositivo del catálogo
 */
export const updateCatalogDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const device = await DeviceCatalog.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );

    if (!device) {
      return next(new AppError('Dispositivo no encontrado', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Dispositivo actualizado',
      data: device
    });

  } catch (error: any) {
    console.error('Error actualizando dispositivo:', error);
    return next(new AppError('Error actualizando dispositivo', 500));
  }
};

/**
 * Desactivar dispositivo (no eliminar)
 */
export const deactivateCatalogDevice = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const device = await DeviceCatalog.findByIdAndUpdate(
      id,
      { active: false },
      { new: true }
    );

    if (!device) {
      return next(new AppError('Dispositivo no encontrado', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Dispositivo desactivado',
      data: device
    });

  } catch (error: any) {
    console.error('Error desactivando dispositivo:', error);
    return next(new AppError('Error desactivando dispositivo', 500));
  }
};

/**
 * Obtener un dispositivo por su ID
 */
export const getDeviceById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const device = await DeviceCatalog.findOne({
      _id: id,
      active: true
    }).select('type ubication identifier building level note').lean();

    if (!device) {
      return next(new AppError('Dispositivo no encontrado', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Dispositivo obtenido exitosamente',
      data: device
    });

  } catch (error: any) {
    console.error('Error obteniendo dispositivo por ID:', error);
    return next(new AppError('Error obteniendo dispositivo', 500));
  }
};