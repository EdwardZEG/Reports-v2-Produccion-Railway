import { RequestHandler } from "express";
import Colaborador from "../models/Colaborador";
import Poliza from "../models/Poliza";
import Coordinador from "../models/Coordinador";
import Especialidad from "../models/Especialidad";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { AppError } from "../errors/customErrors";

interface ColaboradorBody {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  correo: string;
  contraseña: string;
  telefono: string;
  poliza?: string | null;
  coordinador?: string | null;
  especialidad?: string[] | string | null;
  estado?: "Activo" | "Inactivo";
  rol: "Encargado" | "Auxiliar";
}

export const loginColaborador: RequestHandler = async (req, res, next) => {
  try {
    const { correo, contraseña } = req.body;

    const user = await Colaborador.findOne({ correo }).populate("poliza coordinador especialidad");
    if (!user) {
      return next(new AppError('Colaborador no encontrado', 400));
    }

    const isMatch = await bcrypt.compare(contraseña, user.contraseña);
    if (!isMatch) {
      return next(new AppError('Contraseña incorrecta', 400));
    }

    const token = jwt.sign(
      { userId: user._id, rol: user.rol },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    res.json({
      token,
      colaborador: {
        _id: user._id,
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol,
        telefono: user.telefono,
        estado: user.estado,
        poliza: user.poliza,
        coordinador: user.coordinador,
        especialidad: user.especialidad
      }
    });
  } catch (err) {
    next(err);
  }
};

export const crearColaborador: RequestHandler = async (req, res, next) => {
  try {
    const user = (req as any).user;
    let { poliza, coordinador, especialidad, ...datos }: ColaboradorBody = req.body;

    if (user.rol === 'coordinador' && (!poliza || poliza !== user.polizaId)) {
      return next(new AppError("No tienes permiso para asignar colaboradores a esta póliza", 403));
    }

    const especialidadesArray = Array.isArray(especialidad)
      ? especialidad
      : especialidad
        ? [especialidad]
        : [];

    const camposRequeridos = {
      nombre: datos.nombre,
      apellido_paterno: datos.apellido_paterno,
      apellido_materno: datos.apellido_materno,
      correo: datos.correo,
      contraseña: datos.contraseña,
      telefono: datos.telefono,
      rol: datos.rol,
    };

    const camposFaltantes = Object.entries(camposRequeridos)
      .filter(([_, value]) => !value)
      .map(([key]) => key);

    if (camposFaltantes.length > 0) {
      return next(
        new AppError(
          `Faltan campos obligatorios: ${camposFaltantes.join(", ")}`,
          400
        )
      );
    }

    if (await Colaborador.findOne({ correo: datos.correo })) {
      return next(new AppError("El correo ya está registrado", 400));

    }

    if (poliza) {
      const polizaExistente = await Poliza.findById(poliza);
      if (!polizaExistente) {
        return next(new AppError("La póliza especificada no existe", 400));
      }
      if (!coordinador) {
        coordinador = polizaExistente.coordinador?.toString() || null;
      }
    }

    if (coordinador) {
      const coordinadorExistente = await Coordinador.findById(coordinador);
      if (!coordinadorExistente) {
        return next(new AppError("El coordinador especificado no existe", 400));
      }
      if (poliza && coordinadorExistente.poliza?.toString() !== poliza) {
        return next(new AppError("El coordinador no está asignado a esta póliza", 400));
      }
    }

    for (const espId of especialidadesArray) {
      const espExist = await Especialidad.findById(espId);
      if (!espExist || (poliza && !espExist.poliza.map(p => p.toString()).includes(poliza))) {
        return next(new AppError(`Especialidad inválida o no pertenece a la póliza: ${espId}`, 400));
      }
    }

    const salt = await bcrypt.genSalt(10);
    const contraseñaEncriptada = await bcrypt.hash(datos.contraseña, salt);

    const nuevo = await Colaborador.create({
      ...datos,
      contraseña: contraseñaEncriptada,
      poliza: poliza || null,
      coordinador: coordinador || null,
      especialidad: especialidadesArray,
    });

    if (poliza) {
      await Poliza.findByIdAndUpdate(poliza, { $addToSet: { colaboradores: nuevo._id } });
    }
    if (coordinador) {
      await Coordinador.findByIdAndUpdate(coordinador, { $addToSet: { colaboradores: nuevo._id } });
    }

    if (especialidadesArray.length > 0) {
      await Especialidad.updateMany(
        { _id: { $in: especialidadesArray } },
        { $addToSet: { colaborador: nuevo._id } }
      );
    }
    res.status(201).json(nuevo);
    return;
  } catch (error: any) {
    next(new AppError("Error del servidor", 500));
  }
};

export const actualizarColaborador: RequestHandler = async (req, res, next) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    let {
      poliza: nuevaPolizaId,
      coordinador: nuevoCoordinadorId,
      especialidad: nuevasEsp,
      contraseña,
      ...datos
    } = req.body as ColaboradorBody;

    const nuevasEspArray = Array.isArray(nuevasEsp)
      ? nuevasEsp
      : nuevasEsp
        ? [nuevasEsp]
        : [];

    const colaboradorActual = await Colaborador.findById(id);
    if (!colaboradorActual) {
      return next(new AppError("Colaborador no encontrado", 404));
    }

    if (user.rol === "coordinador") {
      const polizaColab = colaboradorActual.poliza?.toString();
      if (!polizaColab || polizaColab !== user.polizaId) {
        return next(new AppError("No tienes permiso para actualizar este colaborador", 403));
      }

      if (nuevaPolizaId && nuevaPolizaId !== user.polizaId) {
        return next(new AppError("No tienes permiso para asignar otra póliza al colaborador", 403));
      }
    }

    const viejasEspIds = colaboradorActual.especialidad.map(e => e.toString());

    if (nuevaPolizaId && nuevaPolizaId !== colaboradorActual.poliza?.toString()) {
      const nuevaPoliza = await Poliza.findById(nuevaPolizaId);
      if (!nuevaPoliza) {
        return next(new AppError("La póliza especificada no existe", 400));
      }
      if (!nuevoCoordinadorId) {
        nuevoCoordinadorId = nuevaPoliza.coordinador?.toString() || null;
      }
    }

    if (
      nuevoCoordinadorId &&
      nuevoCoordinadorId !== colaboradorActual.coordinador?.toString()
    ) {
      const existeCoordinador = await Coordinador.findById(nuevoCoordinadorId);
      if (!existeCoordinador) {
        return next(new AppError("El coordinador especificado no existe", 400));
      }
      if (
        nuevaPolizaId &&
        existeCoordinador.poliza?.toString() !== nuevaPolizaId
      ) {
        return next(new AppError("El coordinador no está asignado a esta póliza", 400));
      }
    }

    for (const espId of nuevasEspArray) {
      const existeEspecialidad = await Especialidad.findById(espId);
      if (
        !existeEspecialidad ||
        (nuevaPolizaId &&
          !existeEspecialidad.poliza.map(p => p.toString()).includes(nuevaPolizaId))
      ) {
        return next(new AppError(`Especialidad inválida o no pertenece a la póliza: ${espId}`, 400));
      }
    }

    const datosActualizados: any = { ...datos };
    if (contraseña) {
      const salt = await bcrypt.genSalt(10);
      datosActualizados.contraseña = await bcrypt.hash(contraseña, salt);
    }
    // Solo actualizar póliza si se proporciona explícitamente en el request
    if (nuevaPolizaId !== undefined) {
      datosActualizados.poliza = nuevaPolizaId === "" ? null : nuevaPolizaId;
    }
    if (nuevoCoordinadorId !== undefined) datosActualizados.coordinador = nuevoCoordinadorId || null;
    datosActualizados.especialidad = nuevasEspArray;

    const colaboradorActualizado = await Colaborador.findByIdAndUpdate(
      id,
      datosActualizados,
      { new: true }
    ).populate("poliza coordinador especialidad");

    for (const oldId of viejasEspIds) {
      if (!nuevasEspArray.includes(oldId)) {
        await Especialidad.findByIdAndUpdate(oldId, {
          $pull: { colaborador: colaboradorActual._id }
        });
      }
    }
    for (const newId of nuevasEspArray) {
      if (!viejasEspIds.includes(newId)) {
        await Especialidad.findByIdAndUpdate(newId, {
          $addToSet: { colaborador: colaboradorActual._id }
        });
      }
    }

    res.json(colaboradorActualizado);
  } catch (error) {
    next(new AppError("Error al actulizar colaborador", 500));
  }
};

export const obtenerColaboradores: RequestHandler = async (req, res, next) => {
  try {
    const inicioTiempo = Date.now();
    console.log('⏱️ [RENDIMIENTO] Iniciando obtenerColaboradores...');

    const user = (req as any).user;
    const filtro: any = {};

    // Solo filtrar por póliza si es coordinador Y se especifica explícitamente
    // Para estadísticas, los administradores deben ver todos los colaboradores
    if (user.rol === "coordinador" && user.polizaId && req.query.filtrarPoliza !== 'false') {
      filtro.poliza = user.polizaId;
    }

    const tiempoFiltro = Date.now();
    console.log('⏱️ [RENDIMIENTO] Filtro preparado en:', tiempoFiltro - inicioTiempo, 'ms');

    const { limit = 100, page = 1 } = req.query; // Agregar paginación para mejorar rendimiento

    const colaboradores = await Colaborador.find(filtro)
      .select('nombre apellido_paterno apellido_materno correo telefono estado rol poliza coordinador especialidad') // Agregado telefono
      .populate("poliza", "nombre ubicacion") // Solo campos necesarios
      .populate("coordinador", "nombre apellido_paterno apellido_materno") // Solo campos necesarios
      .populate("especialidad", "nombre") // Solo campo necesario
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string))
      .lean(); // Usar lean() para mejor rendimiento

    const tiempoConsulta = Date.now();
    console.log('⏱️ [RENDIMIENTO] Consulta completada en:', tiempoConsulta - tiempoFiltro, 'ms');
    console.log('⏱️ [RENDIMIENTO] Total colaboradores encontrados:', colaboradores.length);
    console.log('⏱️ [RENDIMIENTO] Tiempo total:', tiempoConsulta - inicioTiempo, 'ms');

    res.json(colaboradores);
  } catch (error) {
    console.error('Error obteniendo colaboradores:', error);
    next(new AppError("Error al obtener colaboradores", 500));
  }
};

/**
 * Obtener colaboradores para trabajo colaborativo - SIEMPRE filtrado por póliza para coordinadores
 * GET /api/colaboradores/para-colaborativo
 */
export const obtenerColaboradoresParaColaborativo: RequestHandler = async (req, res, next) => {
  try {
    const user = (req as any).user;
    const filtro: any = {};

    console.log('🤝 === OBTENIENDO COLABORADORES PARA TRABAJO COLABORATIVO ===');
    console.log('👤 Usuario solicitante completo:', JSON.stringify(user, null, 2));
    console.log('🔍 Datos específicos:', {
      rol: user?.rol,
      polizaId: user?.polizaId,
      tipo: user?.tipo,
      id: user?.id,
      userId: user?.userId
    });

    // 🔒 FILTRADO OBLIGATORIO POR PÓLIZA PARA COORDINADORES Y COLABORADORES
    if ((user?.rol === 'coordinador' || user?.tipo === 'colaborador') && user?.polizaId) {
      filtro.poliza = user.polizaId;
      console.log('🔒 Filtro aplicado: solo colaboradores de póliza', user.polizaId);
      console.log('🔒 Tipo de usuario:', user?.tipo, '| Rol:', user?.rol);
    } else if ((user?.rol === 'coordinador' || user?.tipo === 'colaborador') && !user?.polizaId) {
      console.error('❌ Usuario sin póliza asignada');
      console.error('❌ Datos del usuario problemático:', JSON.stringify(user, null, 2));
      return next(new AppError('Usuario sin póliza asignada', 403));
    }

    // Para administradores, mostrar todos (sin filtro)
    if (user?.rol === 'admin') {
      console.log('👑 Usuario admin: mostrando todos los colaboradores');
    }

    console.log('🔍 Filtro MongoDB que se aplicará:', JSON.stringify(filtro, null, 2));

    const colaboradores = await Colaborador.find(filtro)
      .populate("poliza coordinador especialidad")
      .select('nombre apellido_paterno apellido_materno correo telefono poliza especialidad rol estado');

    console.log('📊 Colaboradores encontrados:', colaboradores.length);
    console.log('📋 Resumen completo:', colaboradores.map(c => ({
      _id: c._id,
      nombre: c.nombre,
      apellido_paterno: c.apellido_paterno,
      correo: c.correo,
      poliza: (c.poliza as any)?.nombre || 'Sin póliza',
      polizaId: (c.poliza as any)?._id || 'Sin ID póliza'
    })));

    res.json(colaboradores);
  } catch (error) {
    console.error('Error obteniendo colaboradores para colaborativo:', error);
    next(new AppError("Error al obtener colaboradores para trabajo colaborativo", 500));
  }
};

export const obtenerColaboradorPorId: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    const colaborador = await Colaborador.findById(id)
      .populate("poliza coordinador especialidad");

    if (!colaborador) {
      return next(new AppError("Colaborador no encontrado", 404));
    }

    if (user?.rol === "coordinador") {
      if (!user.polizaId || colaborador.poliza?.toString() !== user.polizaId) {
        return next(new AppError("No tienes permisos para ver este colaborador", 403));
      }
    }

    res.json(colaborador);
  } catch (error) {
    next(new AppError("Error al obtener colaboradores", 500));
  }
};

export const eliminarColaborador: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    const colaborador = await Colaborador.findById(id);
    if (!colaborador) {
      return next(new AppError("Colaborador no encontrado", 404));
    }

    if (colaborador.poliza) {
      await Poliza.findByIdAndUpdate(
        colaborador.poliza,
        { $pull: { colaboradores: colaborador._id } }
      );
    }

    if (colaborador.coordinador) {
      await Coordinador.findByIdAndUpdate(
        colaborador.coordinador,
        { $pull: { colaboradores: colaborador._id } }
      );
    }

    if (colaborador.especialidad && colaborador.especialidad.length > 0) {
      for (const espId of colaborador.especialidad) {
        await Especialidad.findByIdAndUpdate(
          espId,
          { $pull: { colaborador: colaborador._id } }
        );
      }
    }
    await Colaborador.findByIdAndDelete(id);
    res.json({ message: "Colaborador eliminado exitosamente" });
  } catch (error) {
    next(new AppError("Error al eliminar colaborador", 500));
  }
};