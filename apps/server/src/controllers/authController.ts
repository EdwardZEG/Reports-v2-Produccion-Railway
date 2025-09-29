import { Request, Response, NextFunction, RequestHandler } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import Admin from '../models/Administrador';
import Colaborador from '../models/Colaborador';
import Coordinador from '../models/Coordinador';
import { AppError } from '../errors/customErrors';

export const register: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { nombre, correo, contraseña, rol } = req.body;

    const exists = await Admin.findOne({ correo });
    if (exists) {
      return next(new AppError('Usuario ya registrado', 400));
    }

    const validRoles = ['administrador', 'coordinador', 'encargado_tecnico', 'auxiliar_tecnico'];
    const assignedRole = validRoles.includes(rol) ? rol : 'auxiliar_tecnico';

    const hashedPassword = await bcrypt.hash(contraseña, 10);
    const user = new Admin({
      nombre,
      correo,
      contraseña: hashedPassword,
      rol: assignedRole
    });

    await user.save();

    const token = jwt.sign(
      { userId: user._id, rol: user.rol },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '1d' }
    );

    res.status(201).json({
      message: 'Usuario registrado correctamente',
      token,
      user: {
        _id: user._id,
        nombre: user.nombre,
        correo: user.correo,
        rol: user.rol
      }
    });
  } catch (err) {
    next(err);
  }
};

export const login: RequestHandler = async (req, res, next: NextFunction) => {
  const { correo, contraseña } = req.body;
  if (!correo || !contraseña) {
    return next(new AppError('Faltan correo o contraseña', 400));
  }
  try {
    let user: any = null;
    let tipo: 'admin' | 'colaborador' | 'coordinador' = 'admin';
    let polizaId: string | null = null;

    user = await Admin.findOne({ correo }).select('+contraseña');
    if (user) {
      tipo = 'admin';
    } else {
      user = await Colaborador.findOne({ correo })
        .select('+contraseña')
        .populate('poliza');
      if (user) {
        tipo = 'colaborador';
        if (user.poliza) {
          polizaId = user.poliza._id.toString();
        }
      } else {
        user = await Coordinador.findOne({ correo })
          .select('+contraseña')
          .populate('poliza');
        if (user) {
          tipo = 'coordinador';
          if (user.poliza) {
            polizaId = user.poliza._id.toString();
          }
        }
      }
    }

    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }

    const isMatch = await bcrypt.compare(contraseña, user.contraseña);
    if (!isMatch) {
      return next(new AppError('Contraseña incorrecta', 401));
    }

    const secret: jwt.Secret = process.env.JWT_SECRET || 'secret';
    const expiresIn: string = process.env.JWT_EXPIRES_IN || '1d';

    const payload: Record<string, any> = {
      userId: user._id,
      rol: user.rol,
      tipo
    };
    if (polizaId) {
      payload.polizaId = polizaId;
    }

    const token = jwt.sign(payload, secret, { expiresIn } as jwt.SignOptions);

    const respUser: any = {
      _id: user._id,
      nombre: user.nombre,
      correo: user.correo,
      rol: user.rol,
      tipo
    };
    if (polizaId) {
      respUser.polizaId = polizaId;
    }

    res.json({ token, user: respUser });
  } catch (err) {
    next(err);
  }
};
