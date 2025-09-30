import { RequestHandler, NextFunction } from "express";
import Coordinador from "../models/Coordinador";
import Poliza from "../models/Poliza";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { AppError } from "../errors/customErrors";

interface CoordinadorBody {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  correo: string;
  contraseña: string;
  telefono: string;
  poliza?: string | null;
  estado?: "Activo" | "Inactivo";
}

export const loginCoordinador: RequestHandler = async (req, res, next: NextFunction) => {
  try {
    const { correo, contraseña } = req.body;

    const user = await Coordinador.findOne({ correo }).populate("poliza");

    if (!user) {
      return next(new AppError("Coordinador no encontrado", 400));
    }

    const isMatch = await bcrypt.compare(contraseña, user.contraseña);
    if (!isMatch) {
      return next(new AppError("Contraseña incorrecta", 400));
    }

    const token = jwt.sign(
      {
        userId: user._id,
        tipo: "coordinador",
        rol: "coordinador",
        polizaId: user.poliza
      },
      process.env.JWT_SECRET || "secret",
      { expiresIn: "1d" }
    );

    res.json({
      token,
      coordinador: {
        _id: user._id,
        nombre: user.nombre,
        correo: user.correo,
        telefono: user.telefono,
        estado: user.estado,
        poliza: user.poliza,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const crearCoordinadores: RequestHandler = async (req, res, next: NextFunction) => {
  try {
    const {
      nombre,
      apellido_paterno,
      apellido_materno,
      correo,
      contraseña,
      poliza,
      telefono,
      estado = "Activo",
    }: CoordinadorBody = req.body;

    const camposRequeridos = {
      nombre,
      apellido_paterno,
      apellido_materno,
      correo,
      contraseña,
      telefono,
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

    const existeCorreo = await Coordinador.findOne({ correo });
    if (existeCorreo) {
      return next(new AppError("El correo ya está registrado", 400));
    }

    if (poliza) {
      const polizaExistente = await Poliza.findById(poliza);
      if (!polizaExistente) {
        return next(new AppError("La póliza especificada no existe", 400));
      }

      if (polizaExistente.coordinador) {
        return next(
          new AppError("La póliza ya tiene un coordinador asignado", 400)
        );
      }
    }

    const hashedPassword = await bcrypt.hash(contraseña, 10);

    const nuevoCoordinador = await Coordinador.create({
      nombre,
      apellido_paterno,
      apellido_materno,
      correo,
      contraseña: hashedPassword,
      telefono,
      estado,
      poliza: poliza || undefined,
      rol: "coordinador",
    });

    if (poliza) {
      await Poliza.findByIdAndUpdate(poliza, {
        coordinador: nuevoCoordinador._id,
      });
    }

    res.status(201).json(nuevoCoordinador);
  } catch (error: any) {
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      return next(new AppError(`Error de validación: ${errors.join(", ")}`, 400));
    }

    next(new AppError("Error al iniciar sesion", 500, error));
  }
};
export const obtenerCoordinadores: RequestHandler = async (req, res, next: NextFunction) => {
  try {
    const search = req.query.search as string;

    const filtro: any = {};
    if (search) {
      const regex = new RegExp(search, 'i'); // insensitive
      filtro.$or = [
        { nombre: regex },
        { apellido_paterno: regex },
        { apellido_materno: regex }
      ];
    }

    const coordinadores = await Coordinador.find(filtro)
      .select('+correo')
      .populate({
        path: "poliza",
        select: "nombre ubicacion", // Solo campos necesarios
      })
      .lean(); // Mejor rendimiento

    res.json(coordinadores);
  } catch (error) {
    next(new AppError("Error del servidor", 500));
  }
};


export const actualizarCoordinador: RequestHandler = async (req, res, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { poliza: nuevaPolizaId, ...datosActualizados } =
      req.body as CoordinadorBody;

    const coordinadorActual = await Coordinador.findById(id);
    if (!coordinadorActual) {
      res.status(404).json({ message: "Coordinador no encontrado" });
      return;
    }

    const update: any = { ...datosActualizados };

    if (
      typeof nuevaPolizaId !== "undefined" &&
      nuevaPolizaId !== coordinadorActual.poliza?.toString()
    ) {
      if (nuevaPolizaId) {
        const nuevaPoliza = await Poliza.findById(nuevaPolizaId);
        if (!nuevaPoliza) {
          res.status(400).json({ message: "La póliza especificada no existe" });
          return;
        }
        if (
          nuevaPoliza.coordinador &&
          nuevaPoliza.coordinador.toString() !== id
        ) {
          res.status(400).json({
            message: "La póliza ya tiene un coordinador asignado",
            coordinadorActual: nuevaPoliza.coordinador,
          });
          return;
        }
        if (datosActualizados.contraseña) {
          const hashedPassword = await bcrypt.hash(
            datosActualizados.contraseña,
            10
          );
          update.contraseña = hashedPassword;
        }

        if (coordinadorActual.poliza) {
          await Poliza.findByIdAndUpdate(coordinadorActual.poliza, {
            $unset: { coordinador: "" },
          });
        }
        await Poliza.findByIdAndUpdate(nuevaPolizaId, { coordinador: id });

        update.poliza = nuevaPolizaId;
      }
    }

    if (
      (typeof nuevaPolizaId === "undefined" || nuevaPolizaId === null) &&
      coordinadorActual.poliza
    ) {
      await Poliza.findByIdAndUpdate(coordinadorActual.poliza, {
        $unset: { coordinador: "" },
      });
      update.poliza = null;
    }
    const coordinadorActualizado = await Coordinador.findByIdAndUpdate(
      id,
      update,
      {
        new: true,
      }
    ).populate("poliza");

    res.json(coordinadorActualizado);
    return;
  } catch (error) {
    next(new AppError("Error al actualizar coordinador", 500));
  }
};

export const eliminarCoordinador: RequestHandler = async (req, res, next: NextFunction) => {
  try {
    const { id } = req.params;

    const coordinador = await Coordinador.findById(id);
    if (!coordinador) {
      res.status(404).json({ message: "Coordinador no encontrado" });
      return;
    }

    if (coordinador.poliza) {
      await Poliza.findByIdAndUpdate(coordinador.poliza, {
        $unset: { coordinador: "" },
      });
    }

    await Coordinador.findByIdAndDelete(id);

    res.json({ message: "Coordinador eliminado correctamente" });
    return;
  } catch (error) {
    next(new AppError("Error al eliminar el coordinador", 500));
  }
};