import { Request, Response, NextFunction, RequestHandler } from 'express';
import PeriodoMP from '../models/PeriodoMP';
import DeviceCatalog from '../models/DeviceCatalog';
import DeviceReport from '../models/DeviceReport';
import Colaborador from '../models/Colaborador';
import { AppError } from '../errors/customErrors';
import mongoose, { Types } from 'mongoose';

/**
 * Crear un nuevo período MP
 */
export const createPeriodoMP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const {
      nombre,
      coordinador,
      fechaInicio,
      fechaFin,
      descripcion,
      dispositivos = []
    } = req.body;

    if (!nombre || !coordinador || !fechaInicio || !fechaFin) {
      return next(new AppError('nombre, coordinador, fechaInicio y fechaFin son requeridos', 400));
    }

    // Validar fechas
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    if (fin <= inicio) {
      return next(new AppError('La fecha de fin debe ser posterior a la fecha de inicio', 400));
    }

    // Procesar dispositivos asignados
    const dispositivosAsignados = dispositivos.map((disp: any) => ({
      deviceCatalog: disp.deviceCatalogId,
      colaboradorAsignado: disp.colaboradorId,
      estado: 'pendiente' as const,
      fechaAsignacion: new Date(),
      notas: disp.notas || ''
    }));

    // Determinar estado activo basado en las fechas
    const estadoActivo = determinarEstadoActivo(inicio, fin);

    console.log('🆕 === CREANDO NUEVO PERÍODO MP ===');
    console.log(`📅 Fecha inicio: ${inicio.toISOString()}`);
    console.log(`📅 Fecha fin: ${fin.toISOString()}`);
    console.log(`📅 Fecha actual: ${new Date().toISOString()}`);
    console.log(`🔄 Estado calculado: ${estadoActivo ? 'ACTIVO' : 'INACTIVO'}`);

    const periodoMP = await PeriodoMP.create({
      nombre,
      coordinador: new mongoose.Types.ObjectId(coordinador),
      fechaInicio: inicio,
      fechaFin: fin,
      descripcion,
      dispositivos: dispositivosAsignados,
      activo: estadoActivo
    });

    // Marcar dispositivos como asignados en DeviceReport (si existen)
    for (const disp of dispositivosAsignados) {
      await DeviceReport.updateMany(
        {
          deviceCatalog: disp.deviceCatalog,
          colaborador: disp.colaboradorAsignado,
          completado: false
        },
        {
          asignado: true,
          periodoMP: periodoMP._id,
          fechaAsignacion: new Date()
        }
      );
    }

    await periodoMP.populate([
      { path: 'coordinador', select: 'name email' },
      { path: 'dispositivos.deviceCatalog' },
      { path: 'dispositivos.colaboradorAsignado', select: 'name email' }
    ]);

    res.status(201).json({
      success: true,
      message: 'Período MP creado exitosamente',
      data: periodoMP
    });

  } catch (error: any) {
    console.error('Error creando período MP:', error);
    return next(new AppError('Error creando período MP', 500));
  }
};

/**
 * Obtener períodos MP con filtros
 */
export const getPeriodosMP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    // Auto-desactivar períodos vencidos antes de obtener la lista
    await desactivarPeriodosVencidos();

    const {
      page = 1,
      limit = 10,
      coordinador,
      activo,
      fechaInicio,
      fechaFin
    } = req.query;

    const filter: any = {};

    if (coordinador) {
      filter.coordinador = new mongoose.Types.ObjectId(coordinador as string);
    }

    if (activo !== undefined) {
      filter.activo = activo === 'true';
    }

    if (fechaInicio || fechaFin) {
      filter.fechaInicio = {};
      if (fechaInicio) {
        filter.fechaInicio.$gte = new Date(fechaInicio as string);
      }
      if (fechaFin) {
        filter.fechaInicio.$lte = new Date(fechaFin as string);
      }
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);

    const [periodos, total] = await Promise.all([
      PeriodoMP.find(filter)
        .populate('coordinador', 'nombre correo')
        .populate('dispositivos.deviceCatalog')
        .populate('dispositivos.colaboradorAsignado', 'nombre apellido_paterno correo')
        .populate('dispositivos.completadoPor', 'nombre apellido_paterno correo')
        .populate('dispositivos.colaboradores', 'nombre apellido_paterno correo')
        .populate('dispositivos.colaboradoresElegibles', 'nombre apellido_paterno correo')
        .skip(skip)
        .limit(parseInt(limit as string))
        .sort({ createdAt: -1 }),
      PeriodoMP.countDocuments(filter)
    ]);

    res.status(200).json({
      success: true,
      data: periodos,
      pagination: {
        page: parseInt(page as string),
        limit: parseInt(limit as string),
        total,
        pages: Math.ceil(total / parseInt(limit as string))
      }
    });

  } catch (error: any) {
    console.error('Error obteniendo períodos MP:', error);
    return next(new AppError('Error obteniendo períodos MP', 500));
  }
};

/**
 * Obtener un período MP específico
 */
export const getPeriodoMPById = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const periodo = await PeriodoMP.findById(id)
      .populate('coordinador', 'nombre correo')
      .populate('dispositivos.deviceCatalog')
      .populate('dispositivos.colaboradorAsignado', 'nombre apellido_paterno correo')
      .populate('dispositivos.deviceReport');

    if (!periodo) {
      return next(new AppError('Período MP no encontrado', 404));
    }

    res.status(200).json({
      success: true,
      data: periodo
    });

  } catch (error: any) {
    console.error('Error obteniendo período MP:', error);
    return next(new AppError('Error obteniendo período MP', 500));
  }
};

/**
 * Asignar dispositivos adicionales a un período MP
 */
export const assignDevicesToPeriodo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;
    const { dispositivos, assignToAll, colaboradores } = req.body;

    if (!Array.isArray(dispositivos) || dispositivos.length === 0) {
      return next(new AppError('Se requiere un array de dispositivos', 400));
    }

    // Si assignToAll es true, necesitamos la lista de colaboradores
    if (assignToAll && (!Array.isArray(colaboradores) || colaboradores.length === 0)) {
      return next(new AppError('Se requiere un array de colaboradores para asignación múltiple', 400));
    }

    const periodo = await PeriodoMP.findById(id);
    if (!periodo) {
      return next(new AppError('Período MP no encontrado', 404));
    }

    // Validar que el período esté activo
    if (!periodo.activo) {
      return next(new AppError('No se pueden asignar dispositivos a un período inactivo', 400));
    }

    // Preparar nuevas asignaciones
    const nuevasAsignaciones: any[] = [];

    dispositivos.forEach((disp: any) => {
      if (disp.assignToAll && colaboradores) {
        // Crear UNA SOLA asignación múltiple con la lista de colaboradores
        console.log('📝 Asignando dispositivo:', disp.deviceCatalogId, 'para TODOS los colaboradores (', colaboradores.length, 'personas)');
        nuevasAsignaciones.push({
          deviceCatalog: disp.deviceCatalogId,
          colaboradorAsignado: null, // Sin colaborador específico asignado
          estado: 'pendiente' as const,
          fechaAsignacion: new Date(),
          notas: disp.notas || '',
          asignacionMultiple: true,
          completadoPor: null,
          esColaborativo: false,
          colaboradores: colaboradores, // Lista de todos los colaboradores elegibles
          colaboradoresElegibles: colaboradores // Para referencia futura
        });
      } else {
        // Asignación individual normal
        console.log('📝 Asignando dispositivo:', disp.deviceCatalogId, 'a colaborador:', disp.colaboradorId);
        nuevasAsignaciones.push({
          deviceCatalog: disp.deviceCatalogId,
          colaboradorAsignado: disp.colaboradorId,
          estado: 'pendiente' as const,
          fechaAsignacion: new Date(),
          notas: disp.notas || '',
          asignacionMultiple: false,
          completadoPor: null,
          esColaborativo: false
        });
      }
    });

    // Agregar a la lista existente
    periodo.dispositivos.push(...nuevasAsignaciones);
    await periodo.save();

    // Marcar dispositivos como asignados en DeviceReport
    for (const disp of nuevasAsignaciones) {
      await DeviceReport.updateMany(
        {
          deviceCatalog: disp.deviceCatalog,
          colaborador: disp.colaboradorAsignado,
          completado: false
        },
        {
          asignado: true,
          periodoMP: periodo._id,
          fechaAsignacion: new Date()
        }
      );
    }

    await periodo.populate([
      { path: 'dispositivos.deviceCatalog' },
      { path: 'dispositivos.colaboradorAsignado', select: 'nombre apellido_paterno correo' },
      { path: 'dispositivos.completadoPor', select: 'nombre apellido_paterno correo' },
      { path: 'dispositivos.colaboradores', select: 'nombre apellido_paterno correo' },
      { path: 'dispositivos.colaboradoresElegibles', select: 'nombre apellido_paterno correo' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Dispositivos asignados exitosamente',
      data: periodo
    });

  } catch (error: any) {
    console.error('Error asignando dispositivos:', error);
    return next(new AppError('Error asignando dispositivos', 500));
  }
};

/**
 * Marcar dispositivo como completado en período MP
 */
export const completeDeviceInPeriodo = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { periodoId, deviceCatalogId, colaboradorId } = req.params;
    const { deviceReportId, notas, esColaborativo, colaboradores, tipoParticipacion } = req.body;

    console.log('🎯 === COMPLETANDO DISPOSITIVO ===');
    console.log('📋 Parámetros recibidos:');
    console.log('   periodoId:', periodoId);
    console.log('   deviceCatalogId:', deviceCatalogId);
    console.log('   colaboradorId:', colaboradorId);
    console.log('   deviceReportId:', deviceReportId);
    console.log('   esColaborativo:', esColaborativo);
    console.log('   colaboradores:', colaboradores);
    console.log('   notas:', notas);

    const periodo = await PeriodoMP.findById(periodoId);
    if (!periodo) {
      return next(new AppError('Período MP no encontrado', 404));
    }

    // Encontrar el dispositivo en la lista
    console.log('🔍 BÚSQUEDA DE DISPOSITIVO EN PERÍODO:');
    console.log('   Dispositivos en período:', periodo.dispositivos.length);

    const dispositivoIndex = periodo.dispositivos.findIndex(
      (disp: any) => {
        if (disp.deviceCatalog.toString() !== deviceCatalogId) {
          return false;
        }

        // Si es asignación múltiple, verificar que el colaborador esté en la lista de elegibles
        if (disp.asignacionMultiple && disp.colaboradoresElegibles) {
          return disp.colaboradoresElegibles.some((colId: any) => colId.toString() === colaboradorId);
        }

        // Si es asignación individual, verificar colaboradorAsignado
        return disp.colaboradorAsignado && disp.colaboradorAsignado.toString() === colaboradorId;
      }
    );

    if (dispositivoIndex === -1) {
      return next(new AppError('Dispositivo no encontrado en el período o colaborador no autorizado', 404));
    }

    // Actualizar estado en PeriodoMP
    console.log('✅ Dispositivo encontrado en posición:', dispositivoIndex);
    periodo.dispositivos[dispositivoIndex].estado = 'completado';
    periodo.dispositivos[dispositivoIndex].fechaCompletado = new Date();
    periodo.dispositivos[dispositivoIndex].deviceReport = deviceReportId || undefined;
    periodo.dispositivos[dispositivoIndex].completadoPor = colaboradorId as any;

    // Si es trabajo colaborativo, marcarlo
    if (esColaborativo && colaboradores && colaboradores.length > 0) {
      periodo.dispositivos[dispositivoIndex].esColaborativo = true;
      periodo.dispositivos[dispositivoIndex].colaboradores = colaboradores;
      console.log('👥 Marcando como trabajo colaborativo con:', colaboradores.length, 'colaboradores');
    }

    if (notas) {
      periodo.dispositivos[dispositivoIndex].notas = notas;
    }

    await periodo.save();
    console.log('💾 Período guardado exitosamente');

    // Actualizar DeviceReport correspondiente
    if (deviceReportId) {
      const updateData: any = {
        completado: true,
        fechaCompletado: new Date(),
        estado: 'completado'
      };

      // Si es trabajo colaborativo, agregar información adicional
      if (esColaborativo && colaboradores && colaboradores.length > 0) {
        updateData.esColaborativo = true;
        updateData.colaboradores = colaboradores;

        // Si se proporcionó información de participación
        if (tipoParticipacion && Array.isArray(tipoParticipacion)) {
          updateData.tipoParticipacion = tipoParticipacion;
        }
      }

      await DeviceReport.findByIdAndUpdate(deviceReportId, updateData);
      console.log('📄 DeviceReport actualizado con datos colaborativos');
    }

    // Si es asignación múltiple, marcar todos los dispositivos relacionados como completados
    if (periodo.dispositivos[dispositivoIndex].asignacionMultiple) {
      console.log('🔄 Procesando asignación múltiple...');

      // Buscar todos los dispositivos con el mismo deviceCatalog que estén pendientes
      const dispositivosRelacionados = periodo.dispositivos.filter((disp: any, index: number) =>
        index !== dispositivoIndex && // No incluir el que acabamos de completar
        disp.deviceCatalog.toString() === deviceCatalogId &&
        disp.estado === 'pendiente' &&
        disp.asignacionMultiple === true
      );

      console.log(`📊 Encontrados ${dispositivosRelacionados.length} dispositivos relacionados para completar`);

      // Marcar todos como completados
      for (let i = 0; i < periodo.dispositivos.length; i++) {
        const disp = periodo.dispositivos[i];
        if (i !== dispositivoIndex &&
          disp.deviceCatalog.toString() === deviceCatalogId &&
          disp.estado === 'pendiente' &&
          disp.asignacionMultiple === true) {

          periodo.dispositivos[i].estado = 'completado';
          periodo.dispositivos[i].fechaCompletado = new Date();
          periodo.dispositivos[i].completadoPor = colaboradorId as any;
          periodo.dispositivos[i].deviceReport = deviceReportId;

          if (esColaborativo) {
            periodo.dispositivos[i].esColaborativo = true;
            periodo.dispositivos[i].colaboradores = colaboradores;
          }

          console.log(`✅ Completado dispositivo para colaborador: ${disp.colaboradorAsignado}`);
        }
      }

      await periodo.save();
      console.log('💾 Todos los dispositivos de asignación múltiple completados');
    }

    res.status(200).json({
      success: true,
      message: esColaborativo ? 'Dispositivo completado colaborativamente' : 'Dispositivo marcado como completado',
      data: {
        dispositivo: periodo.dispositivos[dispositivoIndex],
        esColaborativo,
        colaboradores: colaboradores || []
      }
    });

  } catch (error: any) {
    console.error('Error completando dispositivo:', error);
    return next(new AppError('Error completando dispositivo', 500));
  }
};

/**
 * Obtener dispositivos pendientes para un colaborador
 */
export const getDevicesPendingForColaborador = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { colaboradorId } = req.params;
    console.log('🔍 Buscando dispositivos para colaborador:', colaboradorId);

    // Primero, buscar todos los períodos activos para debug
    const todosLosPeriodos = await PeriodoMP.find({ activo: true })
      .populate('dispositivos.deviceCatalog')
      .populate('dispositivos.colaboradorAsignado', 'nombre apellido_paterno correo')
      .select('nombre fechaInicio fechaFin dispositivos');

    console.log('🔍 Total períodos activos:', todosLosPeriodos.length);
    todosLosPeriodos.forEach(periodo => {
      console.log(`📋 Período "${periodo.nombre}" tiene ${periodo.dispositivos.length} dispositivos:`);
      periodo.dispositivos.forEach((disp: any, index: number) => {
        console.log(`  - Dispositivo ${index + 1}: ${disp.deviceCatalog?.identifier}, Colaborador: ${disp.colaboradorAsignado?._id || 'SIN ASIGNAR'}, Estado: ${disp.estado}`);
      });
    });

    const periodos = await PeriodoMP.find({
      activo: true,
      'dispositivos.colaboradorAsignado': new mongoose.Types.ObjectId(colaboradorId),
      'dispositivos.estado': { $in: ['pendiente', 'en_progreso'] }
    })
      .populate('dispositivos.deviceCatalog')
      .populate('dispositivos.colaboradorAsignado', 'nombre apellido_paterno correo')
      .select('nombre fechaInicio fechaFin dispositivos');

    console.log('📊 Períodos encontrados:', periodos.length);
    console.log('📊 Primer período:', periodos.length > 0 ? periodos[0] : 'Ninguno');

    // Filtrar solo los dispositivos del colaborador que están pendientes
    const dispositivosPendientes = periodos.flatMap(periodo => {
      console.log('🔍 Procesando período:', periodo.nombre, 'con', periodo.dispositivos.length, 'dispositivos');

      const dispositivosFiltrados = periodo.dispositivos
        .filter((disp: any) => {
          // Manejar colaboradorAsignado tanto si es objeto populado como si es solo ObjectId
          let colaboradorId_BD: string;

          if (typeof disp.colaboradorAsignado === 'object' && disp.colaboradorAsignado._id) {
            // Está populado - acceder al _id
            colaboradorId_BD = disp.colaboradorAsignado._id.toString();
          } else {
            // Es solo el ObjectId - convertir directamente
            colaboradorId_BD = disp.colaboradorAsignado?.toString() || '';
          }

          const esDelColaborador = colaboradorId_BD === colaboradorId;
          const estadoValido = ['pendiente', 'en_progreso'].includes(disp.estado);

          console.log('📱 Dispositivo:', disp.deviceCatalog?.identifier);
          console.log('   👤 Colaborador buscado:', colaboradorId);
          console.log('   👤 Colaborador en BD:', colaboradorId_BD);
          console.log('   🔍 Tipo colaboradorAsignado:', typeof disp.colaboradorAsignado);
          console.log('   ✅ Colaborador coincide:', esDelColaborador);
          console.log('   📊 Estado válido:', estadoValido, '(Estado:', disp.estado + ')');

          return esDelColaborador && estadoValido;
        })
        .map((disp: any) => ({
          ...disp.toObject(),
          periodoMP: {
            _id: periodo._id,
            nombre: periodo.nombre,
            fechaInicio: periodo.fechaInicio,
            fechaFin: periodo.fechaFin
          }
        }));

      console.log('✅ Dispositivos filtrados para este período:', dispositivosFiltrados.length);
      return dispositivosFiltrados;
    });

    console.log('📋 Total dispositivos pendientes:', dispositivosPendientes.length);
    console.log('📋 Dispositivos a enviar:', dispositivosPendientes);

    res.status(200).json({
      success: true,
      data: dispositivosPendientes,
      count: dispositivosPendientes.length
    });

  } catch (error: any) {
    console.error('Error obteniendo dispositivos pendientes:', error);
    return next(new AppError('Error obteniendo dispositivos pendientes', 500));
  }
};

/**
 * Obtener TODOS los dispositivos asignados a un colaborador (pendientes, en progreso Y completados)
 */
export const getAllDevicesForColaborador = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { colaboradorId } = req.params;
    console.log('🔍 Obteniendo TODOS los dispositivos para colaborador:', colaboradorId);

    const periodos = await PeriodoMP.find({
      activo: true,
      $or: [
        // Asignaciones individuales
        { 'dispositivos.colaboradorAsignado': new mongoose.Types.ObjectId(colaboradorId) },
        // Asignaciones múltiples donde el colaborador está en la lista de elegibles
        { 'dispositivos.colaboradoresElegibles': new mongoose.Types.ObjectId(colaboradorId) }
      ]
    })
      .populate('dispositivos.deviceCatalog')
      .populate('dispositivos.colaboradorAsignado', 'nombre apellido_paterno correo')
      .populate('dispositivos.completadoPor', 'nombre apellido_paterno correo')
      .populate('dispositivos.colaboradores', 'nombre apellido_paterno correo')
      .populate('dispositivos.colaboradoresElegibles', 'nombre apellido_paterno correo')
      .select('nombre fechaInicio fechaFin dispositivos');

    console.log('📊 Períodos encontrados:', periodos.length);

    // Incluir TODOS los dispositivos del colaborador (sin filtrar por estado)
    const todosLosDispositivos = periodos.flatMap(periodo => {
      console.log('🔍 Procesando período:', periodo.nombre, 'con', periodo.dispositivos.length, 'dispositivos');

      const dispositivosDelColaborador = periodo.dispositivos
        .filter((disp: any) => {
          // Verificar si es asignación múltiple
          if (disp.asignacionMultiple && disp.colaboradoresElegibles) {
            // Para asignaciones múltiples, verificar si está en colaboradoresElegibles
            const estaEnElegibles = disp.colaboradoresElegibles.some((col: any) => {
              const colId = typeof col === 'object' && col._id ? col._id.toString() : col.toString();
              return colId === colaboradorId;
            });

            console.log('📱 Dispositivo (múltiple):', disp.deviceCatalog?.identifier);
            console.log('   👥 Es asignación múltiple:', true);
            console.log('   ✅ Colaborador elegible:', estaEnElegibles);
            console.log('   📊 Estado:', disp.estado);

            return estaEnElegibles;
          } else {
            // Asignación individual normal
            let colaboradorId_BD: string;

            if (typeof disp.colaboradorAsignado === 'object' && disp.colaboradorAsignado._id) {
              colaboradorId_BD = disp.colaboradorAsignado._id.toString();
            } else {
              colaboradorId_BD = disp.colaboradorAsignado?.toString() || '';
            }

            const esDelColaborador = colaboradorId_BD === colaboradorId;

            console.log('📱 Dispositivo (individual):', disp.deviceCatalog?.identifier);
            console.log('   👤 Colaborador coincide:', esDelColaborador);
            console.log('   📊 Estado:', disp.estado);

            return esDelColaborador;
          }
        })
        .map((disp: any) => ({
          ...disp.toObject(),
          periodoMP: {
            _id: periodo._id,
            nombre: periodo.nombre,
            fechaInicio: periodo.fechaInicio,
            fechaFin: periodo.fechaFin
          }
        }));

      console.log('✅ Dispositivos del colaborador en este período:', dispositivosDelColaborador.length);
      return dispositivosDelColaborador;
    });

    console.log('📋 Total dispositivos del colaborador:', todosLosDispositivos.length);

    res.status(200).json({
      success: true,
      data: todosLosDispositivos,
      count: todosLosDispositivos.length
    });

  } catch (error: any) {
    console.error('Error obteniendo TODOS los dispositivos:', error);
    return next(new AppError('Error obteniendo dispositivos del colaborador', 500));
  }
};

/**
 * Finalizar un período MP
 */
export const finalizePeriodoMP = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { id } = req.params;

    const periodo = await PeriodoMP.findByIdAndUpdate(
      id,
      { activo: false },
      { new: true }
    );

    if (!periodo) {
      return next(new AppError('Período MP no encontrado', 404));
    }

    res.status(200).json({
      success: true,
      message: 'Período MP finalizado',
      data: periodo
    });

  } catch (error: any) {
    console.error('Error finalizando período MP:', error);
    return next(new AppError('Error finalizando período MP', 500));
  }
};

/**
 * Buscar dispositivos asignados a un colaborador para autocompletado
 */
export const searchAssignedDevicesForColaborador = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const { colaboradorId } = req.params;
    const { identifier, ubication, limit = 10 } = req.query;

    // Buscar períodos activos donde el colaborador tiene dispositivos asignados
    const periodos = await PeriodoMP.find({
      activo: true,
      'dispositivos.colaboradorAsignado': new mongoose.Types.ObjectId(colaboradorId)
    })
      .populate('dispositivos.deviceCatalog')
      .sort({ createdAt: -1 });

    // Extraer dispositivos del catálogo asignados al colaborador
    const dispositivosAsignados: any[] = [];

    periodos.forEach(periodo => {
      periodo.dispositivos.forEach((dispositivo: any) => {
        if (dispositivo.colaboradorAsignado.toString() === colaboradorId &&
          dispositivo.estado !== 'completado') { // Solo dispositivos no completados
          dispositivosAsignados.push(dispositivo.deviceCatalog);
        }
      });
    });

    // Filtrar por los criterios de búsqueda
    let filteredDevices = dispositivosAsignados;

    if (identifier) {
      const identifierLower = (identifier as string).toLowerCase();
      filteredDevices = filteredDevices.filter((device: any) =>
        device.identifier?.toLowerCase().includes(identifierLower)
      );
    }

    if (ubication) {
      const ubicationLower = (ubication as string).toLowerCase();
      filteredDevices = filteredDevices.filter((device: any) =>
        device.ubication?.toLowerCase().includes(ubicationLower)
      );
    }

    // Eliminar duplicados y limitar resultados
    const uniqueDevices = filteredDevices
      .filter((device, index, self) =>
        index === self.findIndex(d => d._id.toString() === device._id.toString())
      )
      .slice(0, parseInt(limit as string));

    res.status(200).json({
      success: true,
      data: uniqueDevices
    });

  } catch (error: any) {
    console.error('Error buscando dispositivos asignados:', error);
    return next(new AppError('Error buscando dispositivos asignados', 500));
  }
};

// Función para eliminar un período MP de forma segura
export const eliminarPeriodoMP: RequestHandler = async (req, res, next) => {
  try {
    console.log('🗑️ === ELIMINANDO PERÍODO MP ===');
    const { id } = req.params;
    console.log('📝 ID recibido:', id);

    if (!id) {
      return next(new AppError('ID del período es requerido', 400));
    }

    // Verificar si el período existe
    console.log('🔍 Buscando período con ID:', id);
    const periodo = await PeriodoMP.findById(id);
    console.log('📅 Período encontrado:', periodo ? 'SÍ' : 'NO');
    if (!periodo) {
      return next(new AppError('Período MP no encontrado', 404));
    }

    // Verificar si hay reportes asociados a este período
    console.log('📊 Verificando reportes asociados...');
    const reportesAsociados = await DeviceReport.countDocuments({
      periodoMP: id
    });
    console.log('📊 Reportes encontrados:', reportesAsociados);

    if (reportesAsociados > 0) {
      res.status(409).json({
        success: false,
        message: `No se puede eliminar el período. Hay ${reportesAsociados} reporte(s) asociado(s) a este período.`,
        reportCount: reportesAsociados
      });
      return;
    }

    // Si no hay reportes asociados, proceder con la eliminación
    await PeriodoMP.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Período MP eliminado exitosamente'
    });

  } catch (error: any) {
    console.error('💥 Error eliminando período MP:', error);
    console.error('💥 Stack:', error.stack);
    return next(new AppError('Error interno del servidor', 500));
  }
};

// Función para forzar eliminación de un período MP (limpia reportes primero)
export const forzarEliminacionPeriodoMP: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!id) {
      return next(new AppError('ID del período es requerido', 400));
    }

    // Verificar si el período existe
    const periodo = await PeriodoMP.findById(id);
    if (!periodo) {
      return next(new AppError('Período MP no encontrado', 404));
    }

    // Eliminar todos los reportes asociados a este período
    const resultadoReportes = await DeviceReport.deleteMany({
      periodoMP: id
    });

    // Eliminar el período
    await PeriodoMP.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Período MP y reportes asociados eliminados exitosamente',
      reportesEliminados: resultadoReportes.deletedCount
    });

  } catch (error: any) {
    console.error('Error forzando eliminación de período MP:', error);
    return next(new AppError('Error interno del servidor', 500));
  }
};

/**
 * Función helper para determinar si un período debe estar activo
 */
const determinarEstadoActivo = (fechaInicio: Date, fechaFin: Date): boolean => {
  const fechaActual = new Date();

  // Si la fecha de fin ya pasó, debe estar inactivo
  if (fechaFin < fechaActual) {
    return false;
  }

  // Si el período incluye el presente o es futuro, debe estar activo
  return true;
};

/**
 * Función helper para auto-desactivar períodos vencidos
 */
const desactivarPeriodosVencidos = async () => {
  try {
    const fechaActual = new Date();

    // Buscar períodos activos que ya hayan vencido (fechaFin < fechaActual)
    const periodosVencidos = await PeriodoMP.updateMany(
      {
        activo: true,
        fechaFin: { $lt: fechaActual }
      },
      {
        $set: {
          activo: false,
          updatedAt: fechaActual
        }
      }
    );

    if (periodosVencidos.modifiedCount > 0) {
      console.log(`🔄 Auto-desactivados ${periodosVencidos.modifiedCount} períodos vencidos`);
    }

    return periodosVencidos.modifiedCount;
  } catch (error) {
    console.error('Error auto-desactivando períodos vencidos:', error);
    return 0;
  }
};

/**
 * Validar si la fecha actual está dentro de un período MP activo
 * GET /api/periodos-mp/validar-fecha-activa
 */
export const validarFechaActiva: RequestHandler = async (req, res, next) => {
  try {
    const fechaActual = new Date();

    // 1. Primero auto-desactivar períodos vencidos
    const periodosDesactivados = await desactivarPeriodosVencidos();

    // 2. Buscar períodos activos donde la fecha actual esté en el rango
    const periodosActivos = await PeriodoMP.find({
      activo: true,
      fechaInicio: { $lte: fechaActual },
      fechaFin: { $gte: fechaActual }
    }).select('nombre fechaInicio fechaFin coordinador');

    const puedeSubirReporte = periodosActivos.length > 0;

    res.status(200).json({
      success: true,
      puedeSubirReporte,
      periodosActivos: periodosActivos.map(periodo => ({
        _id: periodo._id,
        nombre: periodo.nombre,
        fechaInicio: periodo.fechaInicio,
        fechaFin: periodo.fechaFin,
        coordinador: periodo.coordinador
      })),
      periodosDesactivados,
      fechaActual: fechaActual.toISOString(),
      mensaje: puedeSubirReporte
        ? 'Hay períodos activos disponibles para subir reportes'
        : 'No hay períodos activos. Los reportes solo pueden subirse dentro de las fechas establecidas por el coordinador.'
    });

  } catch (error: any) {
    console.error('Error validando fecha activa:', error);
    return next(new AppError('Error interno del servidor', 500));
  }
};

/**
 * Actualizar fechas de un período MP existente
 * PATCH /api/periodos-mp/:id/fechas
 */
export const actualizarFechasPeriodoMP: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { fechaInicio, fechaFin } = req.body;

    if (!id) {
      return next(new AppError('ID del período es requerido', 400));
    }

    if (!fechaInicio || !fechaFin) {
      return next(new AppError('fechaInicio y fechaFin son requeridas', 400));
    }

    // Validar fechas
    const inicio = new Date(fechaInicio);
    const fin = new Date(fechaFin);

    if (fin <= inicio) {
      return next(new AppError('La fecha de fin debe ser posterior a la fecha de inicio', 400));
    }

    // Verificar que el período existe
    const periodo = await PeriodoMP.findById(id);
    if (!periodo) {
      return next(new AppError('Período MP no encontrado', 404));
    }

    // Determinar el estado activo basado en las nuevas fechas
    const nuevoEstadoActivo = determinarEstadoActivo(inicio, fin);

    console.log('🔄 === ACTUALIZANDO FECHAS Y ESTADO ===');
    console.log(`📅 Fecha actual: ${new Date().toISOString()}`);
    console.log(`📅 Nueva fecha inicio: ${inicio.toISOString()}`);
    console.log(`📅 Nueva fecha fin: ${fin.toISOString()}`);
    console.log(`🔄 Estado anterior: ${periodo.activo}`);
    console.log(`🔄 Nuevo estado calculado: ${nuevoEstadoActivo}`);

    // Actualizar fechas y estado
    const periodoActualizado = await PeriodoMP.findByIdAndUpdate(
      id,
      {
        fechaInicio: inicio,
        fechaFin: fin,
        activo: nuevoEstadoActivo,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).populate('coordinador', 'nombre correo');

    const estadoMessage = nuevoEstadoActivo
      ? '✅ Período activo (fechas válidas para el presente/futuro)'
      : '⚠️ Período inactivo (fechas en el pasado)';

    console.log(estadoMessage);

    res.status(200).json({
      success: true,
      message: `Fechas del período MP actualizadas exitosamente. ${estadoMessage}`,
      data: periodoActualizado
    });

  } catch (error: any) {
    console.error('Error actualizando fechas del período MP:', error);
    return next(new AppError('Error interno del servidor', 500));
  }
};

/**
 * Eliminar dispositivo específico de un período MP
 * DELETE /api/periodos-mp/:periodoId/dispositivos/:deviceCatalogId/:colaboradorId
 */
export const eliminarDispositivoAsignado: RequestHandler = async (req, res, next) => {
  try {
    const { periodoId, deviceCatalogId, colaboradorId } = req.params;

    if (!periodoId || !deviceCatalogId || !colaboradorId) {
      return next(new AppError('Se requieren periodoId, deviceCatalogId y colaboradorId', 400));
    }

    console.log('🗑️ Eliminando asignación:', { periodoId, deviceCatalogId, colaboradorId });

    // Buscar el período
    const periodo = await PeriodoMP.findById(periodoId);
    if (!periodo) {
      return next(new AppError('Período MP no encontrado', 404));
    }

    // Encontrar el dispositivo a eliminar
    const dispositivoIndex = periodo.dispositivos.findIndex((d: any) =>
      d.deviceCatalog.toString() === deviceCatalogId &&
      d.colaboradorAsignado.toString() === colaboradorId
    );

    if (dispositivoIndex === -1) {
      return next(new AppError('Asignación de dispositivo no encontrada', 404));
    }

    const dispositivoEliminado = periodo.dispositivos[dispositivoIndex];

    // Permitir eliminar dispositivos completados
    // Si está completado, también eliminaremos el reporte asociado si existe
    let reporteEliminado = null;
    if (dispositivoEliminado.estado === 'completado') {
      console.log('⚠️ Eliminando dispositivo completado - se buscará el reporte asociado');

      // Buscar y eliminar reporte asociado
      reporteEliminado = await DeviceReport.findOneAndDelete({
        deviceCatalog: deviceCatalogId,
        colaborador: dispositivoEliminado.colaboradorAsignado || dispositivoEliminado.completadoPor,
        completado: true
      });

      if (reporteEliminado) {
        console.log('📄 Reporte asociado eliminado:', reporteEliminado._id);
      }
    }

    // Eliminar el dispositivo del array
    periodo.dispositivos.splice(dispositivoIndex, 1);

    // Guardar cambios
    await periodo.save();

    console.log('✅ Dispositivo eliminado exitosamente');

    // Repoblar datos para respuesta
    await periodo.populate([
      { path: 'dispositivos.deviceCatalog', select: 'type ubication identifier' },
      { path: 'dispositivos.colaboradorAsignado', select: 'nombre apellido_paterno correo' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Dispositivo desasignado exitosamente',
      data: periodo
    });

  } catch (error: any) {
    console.error('Error eliminando dispositivo asignado:', error);
    return next(new AppError('Error interno del servidor', 500));
  }
};

/**
 * Eliminar dispositivo con asignación múltiple de un período MP
 * DELETE /api/periodos-mp/:periodoId/dispositivos/:deviceCatalogId/multiple
 */
export const eliminarDispositivoAsignacionMultiple: RequestHandler = async (req, res, next) => {
  try {
    const { periodoId, deviceCatalogId } = req.params;

    if (!periodoId || !deviceCatalogId) {
      return next(new AppError('Se requieren periodoId y deviceCatalogId', 400));
    }

    console.log('🗑️ Eliminando asignación múltiple:', { periodoId, deviceCatalogId });

    // Buscar el período
    const periodo = await PeriodoMP.findById(periodoId);
    if (!periodo) {
      return next(new AppError('Período MP no encontrado', 404));
    }

    // Encontrar el dispositivo con asignación múltiple a eliminar
    const dispositivoIndex = periodo.dispositivos.findIndex((d: any) =>
      d.deviceCatalog.toString() === deviceCatalogId &&
      d.asignacionMultiple === true
    );

    if (dispositivoIndex === -1) {
      return next(new AppError('Asignación múltiple de dispositivo no encontrada', 404));
    }

    const dispositivoEliminado = periodo.dispositivos[dispositivoIndex];

    // Permitir eliminar dispositivos completados
    // Si está completado, también eliminaremos reportes asociados si existen
    let reportesEliminados = [];
    if (dispositivoEliminado.estado === 'completado') {
      console.log('⚠️ Eliminando dispositivo con asignación múltiple completado - se buscarán reportes asociados');

      // Para asignaciones múltiples, buscar reportes de múltiples colaboradores
      // Buscar reportes de todos los colaboradores que participaron
      if (dispositivoEliminado.colaboradores && dispositivoEliminado.colaboradores.length > 0) {
        for (const colaborador of dispositivoEliminado.colaboradores) {
          const colaboradorId = (colaborador as any)._id || colaborador;
          const reporte = await DeviceReport.findOneAndDelete({
            deviceCatalog: deviceCatalogId,
            colaborador: colaboradorId,
            completado: true
          });
          if (reporte) {
            reportesEliminados.push(reporte._id);
          }
        }
      } else if (dispositivoEliminado.completadoPor) {
        // Si solo hay un completadoPor
        const reporte = await DeviceReport.findOneAndDelete({
          deviceCatalog: deviceCatalogId,
          colaborador: dispositivoEliminado.completadoPor,
          completado: true
        });
        if (reporte) {
          reportesEliminados.push(reporte._id);
        }
      }

      if (reportesEliminados.length > 0) {
        console.log('📄 Reportes asociados eliminados:', reportesEliminados);
      }
    }

    // Eliminar el dispositivo del array
    periodo.dispositivos.splice(dispositivoIndex, 1);

    // Guardar cambios
    await periodo.save();

    console.log('✅ Dispositivo con asignación múltiple eliminado exitosamente');

    // Repoblar datos para respuesta
    await periodo.populate([
      { path: 'dispositivos.deviceCatalog', select: 'type ubication identifier' },
      { path: 'dispositivos.colaboradorAsignado', select: 'nombre apellido_paterno correo' }
    ]);

    res.status(200).json({
      success: true,
      message: 'Dispositivo con asignación múltiple desasignado exitosamente',
      data: periodo
    });

  } catch (error: any) {
    console.error('Error eliminando dispositivo con asignación múltiple:', error);
    return next(new AppError('Error interno del servidor', 500));
  }
};

// Función para actualizar período MP completo
export const actualizarPeriodoMP: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, fechaInicio, fechaFin, descripcion } = req.body;

    console.log('🔄 Actualizando período MP:', { id, nombre, fechaInicio, fechaFin, descripcion });

    // Validar que el período existe
    const periodo = await PeriodoMP.findById(id);
    if (!periodo) {
      return next(new AppError('Período MP no encontrado', 404));
    }

    // Actualizar campos
    const updateData: any = {};
    if (nombre !== undefined) updateData.nombre = nombre;
    if (fechaInicio !== undefined) updateData.fechaInicio = fechaInicio;
    if (fechaFin !== undefined) updateData.fechaFin = fechaFin;
    if (descripcion !== undefined) updateData.descripcion = descripcion;

    // Determinar si el período debe estar activo basado en las nuevas fechas
    if (fechaInicio && fechaFin) {
      const ahora = new Date();
      const inicioDate = new Date(fechaInicio);
      const finDate = new Date(fechaFin);
      updateData.activo = ahora >= inicioDate && ahora <= finDate;
    }

    const periodoActualizado = await PeriodoMP.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    ).populate('coordinador', 'nombre correo');

    console.log('✅ Período MP actualizado exitosamente:', periodoActualizado?.nombre);

    res.status(200).json({
      success: true,
      message: 'Período MP actualizado exitosamente',
      data: periodoActualizado
    });

  } catch (error: any) {
    console.error('Error actualizando período MP:', error);
    return next(new AppError('Error interno del servidor', 500));
  }
};

// Función para editar asignación de dispositivo (cambiar colaborador)
export const editarAsignacionDispositivo: RequestHandler = async (req, res, next) => {
  try {
    const { periodoId, deviceId } = req.params;
    const { oldColaboradorId, newColaboradorId, notas } = req.body;

    console.log('🔄 Editando asignación de dispositivo:', {
      periodoId,
      deviceId,
      oldColaboradorId,
      newColaboradorId,
      notas
    });

    // Validar que el período existe
    const periodo = await PeriodoMP.findById(periodoId).populate('dispositivos.deviceCatalog');
    if (!periodo) {
      return next(new AppError('Período MP no encontrado', 404));
    }

    // Encontrar el dispositivo específico en el período
    const dispositivoIndex = periodo.dispositivos.findIndex(d =>
      (d.deviceCatalog as any)._id.toString() === deviceId &&
      d.colaboradorAsignado?.toString() === oldColaboradorId
    );

    if (dispositivoIndex === -1) {
      return next(new AppError('Asignación de dispositivo no encontrada', 404));
    }

    // Validar que el nuevo colaborador existe
    const nuevoColaborador = await Colaborador.findById(newColaboradorId);
    if (!nuevoColaborador) {
      return next(new AppError('Colaborador no encontrado', 404));
    }

    // Actualizar la asignación
    periodo.dispositivos[dispositivoIndex].colaboradorAsignado = newColaboradorId;
    if (notas !== undefined) {
      periodo.dispositivos[dispositivoIndex].notas = notas;
    }

    // Guardar cambios
    await periodo.save();

    console.log('✅ Asignación de dispositivo actualizada exitosamente');

    res.status(200).json({
      success: true,
      message: 'Asignación de dispositivo actualizada exitosamente',
      data: periodo
    });

  } catch (error: any) {
    console.error('Error editando asignación de dispositivo:', error);
    return next(new AppError('Error interno del servidor', 500));
  }
};