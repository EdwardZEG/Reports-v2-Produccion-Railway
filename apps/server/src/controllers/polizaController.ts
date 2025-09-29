import Poliza from "../models/Poliza";
import { RequestHandler } from "express";
import Coordinador from "../models/Coordinador";
import Colaborador from "../models/Colaborador";
import { AppError } from "../errors/customErrors";

interface PolizaBody {
  nombre?: string;
  ubicacion?: string;
  coordinador?: string;
}

export const crearPoliza: RequestHandler = async (req, res, next) => {
  try {
    const { nombre, ubicacion, coordinador } = req.body;

    console.log('➕ Creando nueva póliza:', {
      nombre,
      ubicacion,
      coordinadorId: coordinador
    });

    if (coordinador) {
      const coordExistente = await Coordinador.findById(coordinador);
      if (!coordExistente) {
        return next(new AppError("El coordinador especificado no existe", 400));
      }

      if (coordExistente.poliza) {
        // Verificar si la póliza asignada realmente existe
        const polizaAsignada = await Poliza.findById(coordExistente.poliza);
        if (!polizaAsignada) {
          console.log('🧹 Auto-limpieza: Coordinador tiene póliza inexistente, limpiando...', {
            coordinadorId: coordinador,
            polizaInexistente: coordExistente.poliza.toString()
          });

          // Limpiar la referencia a póliza inexistente
          await Coordinador.findByIdAndUpdate(coordinador, { $unset: { poliza: "" } });
          console.log('✅ Coordinador limpiado automáticamente');
        } else {
          console.log('🚫 Coordinador ya asignado en creación:', {
            coordinadorId: coordinador,
            polizaAsignada: coordExistente.poliza.toString()
          });
          return next(
            new AppError("El coordinador ya está asignado a otra póliza", 400)
          );
        }
      }

      console.log('✅ Coordinador disponible para crear nueva póliza:', {
        coordinadorId: coordinador
      });
    }

    const nuevaPoliza = await Poliza.create({ nombre, ubicacion, coordinador });

    if (coordinador) {
      await Coordinador.findByIdAndUpdate(
        coordinador,
        { poliza: nuevaPoliza._id },
        { new: true }
      );
    }

    res.status(201).json(nuevaPoliza);
  } catch (error) {
    next(new AppError("Error al crear la póliza", 500));
  }
};

export const obtenerPolizas: RequestHandler = async (req, res, next) => {
  try {
    const polizas = await Poliza.find().populate({
      path: "coordinador",
      select: "nombre apellido_paterno apellido_materno",
    });
    res.json(polizas);
  } catch (error) {
    next(new AppError("Error al obtener las pólizas", 500));
  }
};

export const actualizarPoliza: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { nombre, ubicacion, coordinador } = req.body;

    console.log('🔄 Actualizando póliza:', {
      polizaId: id,
      nombre,
      ubicacion,
      coordinadorId: coordinador
    });

    const polizaActual = await Poliza.findById(id);
    if (!polizaActual) {
      return next(new AppError("Póliza no encontrada", 404));
    }

    if (coordinador) {
      const nuevoCoordinador = await Coordinador.findById(coordinador);
      if (!nuevoCoordinador) {
        return next(new AppError("El coordinador especificado no existe", 400));
      }

      // Solo verificar si el coordinador está asignado a OTRA póliza (no a la misma que estamos actualizando)
      if (
        nuevoCoordinador.poliza &&
        nuevoCoordinador.poliza.toString() !== id.toString()
      ) {
        // Verificar si la póliza asignada realmente existe
        const polizaAsignada = await Poliza.findById(nuevoCoordinador.poliza);
        if (!polizaAsignada) {
          console.log('🧹 Auto-limpieza en actualización: Coordinador tiene póliza inexistente, limpiando...', {
            coordinadorId: coordinador,
            polizaInexistente: nuevoCoordinador.poliza.toString()
          });

          // Limpiar la referencia a póliza inexistente
          await Coordinador.findByIdAndUpdate(coordinador, { $unset: { poliza: "" } });
          console.log('✅ Coordinador limpiado automáticamente en actualización');
        } else {
          console.log('🚫 Coordinador ya asignado a otra póliza:', {
            coordinadorId: coordinador,
            polizaActual: nuevoCoordinador.poliza.toString(),
            polizaQueSeIntentaActualizar: id.toString()
          });
          return next(
            new AppError("El coordinador ya está asignado a otra póliza", 400)
          );
        }
      }

      console.log('✅ Coordinador disponible para asignar:', {
        coordinadorId: coordinador,
        polizaActual: nuevoCoordinador.poliza?.toString() || 'ninguna',
        polizaQueSeActualiza: id.toString()
      });
    }

    if (
      polizaActual.coordinador &&
      polizaActual.coordinador.toString() !== (coordinador || "")
    ) {
      await Coordinador.findByIdAndUpdate(polizaActual.coordinador, {
        $unset: { poliza: "" },
      });
    }

    const polizaActualizada = await Poliza.findByIdAndUpdate(
      id,
      { nombre, ubicacion, coordinador: coordinador || null },
      { new: true }
    );

    if (coordinador) {
      await Coordinador.findByIdAndUpdate(coordinador, { poliza: id });
    }

    res.json(polizaActualizada);
  } catch (error) {
    next(new AppError("Error al actualizar la póliza", 500));
  }
};


// Función temporal para limpiar asignaciones inconsistentes
export const limpiarAsignacionesInconsistentes: RequestHandler = async (req, res, next) => {
  try {
    console.log('🧹 Iniciando limpieza de asignaciones inconsistentes...');

    // Obtener todos los coordinadores
    const coordinadores = await Coordinador.find({});
    let coordinadoresSinPoliza = 0;
    let coordinadoresConPolizaInexistente = 0;

    for (const coord of coordinadores) {
      if (coord.poliza) {
        // Verificar si la póliza realmente existe
        const polizaExiste = await Poliza.findById(coord.poliza);
        if (!polizaExiste) {
          console.log(`❌ Coordinador ${coord._id} tiene póliza ${coord.poliza} que no existe`);
          await Coordinador.findByIdAndUpdate(coord._id, { $unset: { poliza: "" } });
          coordinadoresConPolizaInexistente++;
        }
      } else {
        coordinadoresSinPoliza++;
      }
    }

    console.log('📊 Resultado de limpieza:', {
      totalCoordinadores: coordinadores.length,
      coordinadoresSinPoliza,
      coordinadoresConPolizaInexistente,
      coordinadoresLimpiados: coordinadoresConPolizaInexistente
    });

    res.json({
      message: 'Limpieza completada',
      stats: {
        totalCoordinadores: coordinadores.length,
        coordinadoresSinPoliza,
        coordinadoresConPolizaInexistente,
        coordinadoresLimpiados: coordinadoresConPolizaInexistente
      }
    });
  } catch (error) {
    console.error('Error en limpieza:', error);
    next(new AppError("Error en limpieza de asignaciones", 500));
  }
};

export const eliminarPoliza: RequestHandler = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('🗑️ Eliminando póliza:', id);

    const poliza = await Poliza.findById(id);
    if (!poliza) {
      return next(new AppError("Póliza no encontrada", 404));
    }

    console.log('📋 Póliza encontrada:', {
      polizaId: poliza._id,
      coordinadorId: poliza.coordinador,
      colaboradoresCount: poliza.colaboradores?.length || 0
    });

    // Limpiar colaboradores
    if (poliza.colaboradores && poliza.colaboradores.length) {
      console.log('👥 Limpiando', poliza.colaboradores.length, 'colaboradores...');
      const colaboradoresResult = await Colaborador.updateMany(
        { _id: { $in: poliza.colaboradores } },
        { $unset: { poliza: "" } }
      );
      console.log('✅ Colaboradores limpiados:', colaboradoresResult.modifiedCount);
    }

    // Limpiar coordinador
    if (poliza.coordinador) {
      console.log('👤 Limpiando coordinador:', poliza.coordinador);
      const coordinadorResult = await Coordinador.findByIdAndUpdate(poliza.coordinador, {
        $unset: { poliza: "" },
      });
      console.log('✅ Coordinador limpiado:', coordinadorResult ? 'Sí' : 'No encontrado');

      // Verificar que se limpió correctamente
      const coordinadorVerificacion = await Coordinador.findById(poliza.coordinador);
      console.log('🔍 Verificación coordinador después de limpiar:', {
        coordinadorId: poliza.coordinador,
        tienePoliza: coordinadorVerificacion?.poliza ? 'Sí' : 'No',
        polizaAsignada: coordinadorVerificacion?.poliza
      });
    }

    // Eliminar la póliza
    console.log('🗑️ Eliminando póliza de la base de datos...');
    await Poliza.findByIdAndDelete(id);
    console.log('✅ Póliza eliminada exitosamente');

    res.json({ message: "Póliza eliminada con éxito" });
  } catch (error) {
    console.error('❌ Error eliminando póliza:', error);
    next(new AppError("Error al eliminar la póliza", 500));
  }
};

