import { RequestHandler } from "express";
import Especialidad from "../models/Especialidad";
import Poliza from "../models/Poliza";
import Colaborador from "../models/Colaborador";
import mongoose from "mongoose";
import Reporte from "../models/Reporte";
import { AppError } from "../errors/customErrors";

interface EspecialidadBody {
  nombre: string;
  descripcion: string;
  reporte?: string;
  poliza?: string[] | string;
  colaborador?: string[] | null;
}

export const crearEspecialidad: RequestHandler = async (req, res, next) => {
  try {
    const user = (req as any).user;
    const { nombre, descripcion, reporte, poliza, colaborador } = req.body as EspecialidadBody;

    if (!nombre || !descripcion || !poliza) {
      return next(new AppError("Campos requeridos: nombre, descripcion, poliza", 400));
    }

    if (reporte) {
      if (!mongoose.Types.ObjectId.isValid(reporte)) {
        return next(new AppError("ID de reporte no válido", 400));
      }
      const repDoc = await Reporte.findById(reporte);
      if (!repDoc) {
        return next(new AppError("Reporte no encontrado", 404));
      }
    }

    const polizaArray = Array.isArray(poliza) ? poliza : [poliza];

    if (user.rol === 'coordinador') {
      if (!user.polizaId) {
        return next(new AppError("Coordinador sin póliza asignada", 403));
      }
      if (polizaArray.some(pid => pid !== user.polizaId)) {
        return next(new AppError("No puedes crear especialidad para otra póliza", 403));
      }
    }

    for (const polId of polizaArray) {
      if (!mongoose.Types.ObjectId.isValid(polId)) {
        return next(new AppError(`ID de póliza inválido: ${polId}`, 400));
      }
    }

    const polDocs = await Poliza.find({ _id: { $in: polizaArray } });
    if (polDocs.length !== polizaArray.length) {
      return next(new AppError("Una o más pólizas no existen", 404));
    }

    let colaboradoresArray: string[] = [];
    if (colaborador) {
      if (!Array.isArray(colaborador)) {
        return next(new AppError("colaborador debe ser array de IDs", 400));
      }

      if (user.rol === 'coordinador' && user.polizaId) {
        const invalid = await Colaborador.find({
          _id: { $in: colaborador },
          poliza: { $ne: user.polizaId }
        }).select('_id');
        if (invalid.length > 0) {
          return next(new AppError("Uno o más colaboradores no pertenecen a tu póliza", 403));
        }
      }

      const colaboradoresValidos = await Colaborador.find({
        _id: { $in: colaborador },
        poliza: { $in: polizaArray }
      }).select('_id');

      if (colaboradoresValidos.length !== colaborador.length) {
        return next(new AppError("Uno o más colaboradores no existen o no pertenecen a la(s) póliza(s) indicadas", 400));
      }

      colaboradoresArray = colaborador;
    }

    const especialidadExistente = await Especialidad.findOne({
      nombre: { $regex: new RegExp(`^${nombre.trim()}$`, 'i') }
    });

    if (especialidadExistente) {
      return next(new AppError("Ya existe una especialidad con ese nombre.", 409));
    }

    const nuevaEspecialidad = await Especialidad.create({
      nombre: nombre.trim(),
      descripcion,
      reporte: reporte || undefined,
      poliza: polizaArray,
      colaborador: colaboradoresArray
    });

    if (reporte) {
      await Reporte.findByIdAndUpdate(reporte, {
        idEspecialidad: nuevaEspecialidad._id
      });
    }

    for (const polId of polizaArray) {
      await Poliza.findByIdAndUpdate(polId, {
        $addToSet: { especialidades: nuevaEspecialidad._id }
      });
    }

    if (colaboradoresArray.length > 0) {
      await Colaborador.updateMany(
        { _id: { $in: colaboradoresArray } },
        { $addToSet: { especialidad: nuevaEspecialidad._id } }
      );
    }

    res.status(201).json(nuevaEspecialidad);
  } catch (error) {
    next(new AppError("Error inesperado al crear especialidad", 500));
  }
};


export const obtenerEspecialidades: RequestHandler = async (req, res, next) => {
  try {
    const user = (req as any).user;
    const { polizaId, colaboradorId, sinColaborador } = req.query;
    const filtro: any = {};

    if (polizaId) {
      const pid = String(polizaId);
      if (!mongoose.Types.ObjectId.isValid(pid)) {
        return next(new AppError("polizaId inválido", 400));
      }

      if (user.rol === 'coordinador') {
        if (!user.polizaId) {
          return next(new AppError("Coordinador sin póliza asignada", 403));
        }
        if (pid !== user.polizaId) {
          return next(new AppError("No tienes permiso para ver especialidades de otra póliza", 403));
        }
      }

      filtro.poliza = pid;
    } else {
      if (user.rol === 'coordinador') {
        if (!user.polizaId) {
          return next(new AppError("Coordinador sin póliza asignada", 403));
        }
        filtro.poliza = user.polizaId;
      }
    }

    if (colaboradorId) {
      const cid = String(colaboradorId);
      if (!mongoose.Types.ObjectId.isValid(cid)) {
        return next(new AppError("colaboradorId inválido", 400));
      }

      if (user.rol === 'coordinador') {
        const colDoc = await Colaborador.findById(cid).select('poliza');
        if (!colDoc) {
          return next(new AppError("Colaborador no encontrado", 404));
        }
        if (!colDoc.poliza || colDoc.poliza.toString() !== user.polizaId) {
          return next(new AppError("No tienes permiso para filtrar por este colaborador", 403));
        }
      }

      filtro.colaborador = cid;
    }

    if (sinColaborador === 'true') {
      filtro.$or = [
        { colaborador: { $exists: false } },
        { colaborador: { $size: 0 } }
      ];
    }

    const especialidades = await Especialidad.find(filtro)
      .populate({
        path: 'colaborador',
        select: 'nombre apellido_paterno apellido_materno rol',
        options: { retainNullValues: true }
      })
      .populate('poliza', 'nombre ubicacion')
      .populate('reporte', 'name file');

    res.json(especialidades);
  } catch (error) {
    next(new AppError("Error inesperado al obtener especialidades", 500));
  }
};

export const obtenerEspecialidadesPorColaborador: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const user = (req as any).user;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("ID de colaborador inválido", 400));
    }

    if (user.rol === 'coordinador') {
      const col = await Colaborador.findById(id).select("poliza");
      if (!col || col.poliza?.toString() !== user.polizaId) {
        return next(new AppError("No tienes acceso a este colaborador", 403));
      }
    }

    const especialidades = await Especialidad.find({ colaborador: id })
      .populate("poliza", "nombre ubicacion")
      .populate("reporte", "name file");

    res.json(especialidades);
  } catch (error) {
    next(new AppError("Error al obtener especialidades del colaborador", 500));
  }
};

export const actualizarEspecialidad: RequestHandler = async (req, res, next) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    let { nombre, descripcion, poliza, colaborador, reporte } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("ID de especialidad no válido", 400));
    }

    const especialidadActual = await Especialidad.findById(id);
    if (!especialidadActual) {
      return next(new AppError("Especialidad no encontrada", 404));
    }

    // Permisos del coordinador
    if (user.rol === 'coordinador') {
      const actualPolizas = Array.isArray(especialidadActual.poliza)
        ? especialidadActual.poliza.map(p => p.toString())
        : [];

      if (!actualPolizas.includes(user.polizaId)) {
        return next(new AppError("No tienes permiso para actualizar esta especialidad", 403));
      }
    }

    // Validación de reporte
    if (reporte !== undefined) {
      if (reporte && !mongoose.Types.ObjectId.isValid(reporte)) {
        return next(new AppError("ID de reporte inválido", 400));
      }
      if (reporte) {
        const reporteDoc = await Reporte.findById(reporte);
        if (!reporteDoc) return next(new AppError("Reporte no encontrado", 404));
      }
    }

    // Validación de polizas
    let nuevasPolizas: string[] = [];
    if (poliza !== undefined) {
      nuevasPolizas = Array.isArray(poliza) ? poliza : [poliza];
      for (const polId of nuevasPolizas) {
        if (!mongoose.Types.ObjectId.isValid(polId)) {
          return next(new AppError(`Póliza inválida: ${polId}`, 400));
        }
        const pol = await Poliza.findById(polId);
        if (!pol) return next(new AppError(`Póliza ${polId} no encontrada`, 404));
      }

      if (user.rol === 'coordinador' && nuevasPolizas.some(p => p !== user.polizaId)) {
        return next(new AppError("No puedes asignar otra póliza", 403));
      }
    } else {
      nuevasPolizas = especialidadActual.poliza.map(p => p.toString());
    }

    // Validación de colaboradores
    let nuevosCols: string[] = [];
    if (colaborador !== undefined) {
      if (!Array.isArray(colaborador)) {
        return next(new AppError("Colaborador debe ser array de IDs", 400));
      }

      nuevosCols = colaborador;

      const colaboradoresValidos = await Colaborador.find({
        _id: { $in: nuevosCols },
        poliza: { $in: nuevasPolizas }
      });

      if (colaboradoresValidos.length !== nuevosCols.length) {
        return next(new AppError("Uno o más colaboradores no existen o no pertenecen a la(s) póliza(s)", 400));
      }
    } else {
      nuevosCols = especialidadActual.colaborador.map(c => c.toString());
    }

    // Actualización del documento de especialidad
    const espActualizada = await Especialidad.findByIdAndUpdate(
      id,
      {
        ...(nombre && { nombre }),
        ...(descripcion && { descripcion }),
        poliza: nuevasPolizas,
        colaborador: nuevosCols,
        reporte: reporte ?? especialidadActual.reporte ?? null
      },
      { new: true }
    ).populate(["poliza", "colaborador", "reporte"]);

    if (!espActualizada) return next(new AppError("Error al actualizar especialidad", 500));

    // Sincronización con el reporte
    if (reporte && reporte !== especialidadActual.reporte?.toString()) {
      if (especialidadActual.reporte) {
        await Reporte.findByIdAndUpdate(especialidadActual.reporte, { $unset: { idEspecialidad: "" } });
      }
      await Reporte.findByIdAndUpdate(reporte, { idEspecialidad: espActualizada._id });
    }

    // 🧠 ACTUALIZAR RELACIONES EN POLIZAS
    const viejasPolizas = especialidadActual.poliza.map(p => p.toString());
    for (const oldId of viejasPolizas) {
      if (!nuevasPolizas.includes(oldId)) {
        await Poliza.findByIdAndUpdate(oldId, { $pull: { especialidades: id } });
      }
    }
    for (const newId of nuevasPolizas) {
      if (!viejasPolizas.includes(newId)) {
        await Poliza.findByIdAndUpdate(newId, { $addToSet: { especialidades: id } });
      }
    }

    // 🧠 ACTUALIZAR RELACIONES EN COLABORADORES
    const viejosCols = especialidadActual.colaborador.map(c => c.toString());
    const removidos = viejosCols.filter(c => !nuevosCols.includes(c));
    const agregados = nuevosCols.filter(c => !viejosCols.includes(c));

    if (removidos.length > 0) {
      await Colaborador.updateMany(
        { _id: { $in: removidos } },
        { $pull: { especialidad: id } }
      );
    }

    if (agregados.length > 0) {
      await Colaborador.updateMany(
        { _id: { $in: agregados } },
        { $addToSet: { especialidad: id } }
      );
    }

    res.json(espActualizada);
  } catch (error) {
    console.error(error);
    next(new AppError("Error inesperado al actualizar especialidad", 500));
  }
};


export const eliminarEspecialidad: RequestHandler = async (req, res, next) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError("ID de especialidad no válido", 400));
    }

    const especialidad = await Especialidad.findById(id);
    if (!especialidad) {
      return next(new AppError("Especialidad no encontrada", 404));
    }

    if (user.rol === 'coordinador') {
      if (!user.polizaId) {
        return next(new AppError("Coordinador sin póliza asignada", 403));
      }
      const polArray: string[] = Array.isArray(especialidad.poliza)
        ? especialidad.poliza.map(p => p.toString())
        : [];
      if (!polArray.includes(user.polizaId)) {
        return next(new AppError("No tienes permiso para eliminar esta especialidad", 403));
      }
    }

    if (especialidad.reporte) {
      // Eliminar completamente el reporte/plantilla de la base de datos
      await Reporte.findByIdAndDelete(especialidad.reporte);
    }

    const polArray: string[] = Array.isArray(especialidad.poliza)
      ? especialidad.poliza.map(p => p.toString())
      : [];

    for (const polId of polArray) {
      if (mongoose.Types.ObjectId.isValid(polId)) {
        await Poliza.findByIdAndUpdate(polId, {
          $pull: { especialidades: especialidad._id }
        });
      }
    }

    const colArray: string[] = Array.isArray(especialidad.colaborador)
      ? especialidad.colaborador.map(c => c.toString())
      : [];

    for (const colId of colArray) {
      if (mongoose.Types.ObjectId.isValid(colId)) {
        await Colaborador.findByIdAndUpdate(colId, {
          $pull: { especialidad: especialidad._id }
        });
      }
    }

    await Especialidad.findByIdAndDelete(id);
    res.json({ message: "Especialidad eliminada correctamente" });
  } catch (error) {
    next(new AppError("Error inesperado al eliminar la especialidad", 500));
  }
};