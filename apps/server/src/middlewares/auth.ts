// middlewares/auth.ts
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import Colaborador from '../models/Colaborador';
import Admin from '../models/Administrador';
import Coordinador from '../models/Coordinador';


export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token provisto' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;

    let usuario;

    switch (payload.tipo) {
      case 'admin':
        usuario = await Admin.findById(payload.userId);
        break;
      case 'colaborador':
        usuario = await Colaborador.findById(payload.userId).select('+contraseña').populate('poliza');
        break;
      case 'coordinador':
        usuario = await Coordinador.findById(payload.userId).select('+contraseña').populate('poliza');
        break;
      default:
        return res.status(401).json({ message: 'Tipo de usuario inválido' });
    }

    if (!usuario) {
      return res.status(401).json({ message: 'Usuario no encontrado' });
    }

    // Carga solo campos necesarios y sin contraseña
    req.user = {
      _id: usuario._id,
      userId: usuario._id.toString(), // ✅ Agregar userId como string para compatibilidad
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: (usuario as any).rol ?? undefined,
      tipo: payload.tipo,
      polizaId: (usuario as any).poliza ? (usuario as any).poliza._id?.toString() : null,
      // agrega más campos si necesitas
    };

    next();
  } catch (err: any) {
    // Manejar diferentes tipos de errores de JWT
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED',
        expiredAt: err.expiredAt
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Token inválido',
        code: 'TOKEN_INVALID'
      });
    } else {
      return res.status(401).json({
        message: 'Error de autenticación',
        code: 'AUTH_ERROR'
      });
    }
  }
};


export const proteger = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'No token proporcionado' });
    return;
  }
  const token = authHeader.split(' ')[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;

    // 🔍 DEBUG: Log del token decodificado
    console.log('🔍 [PROTEGER] Token decodificado:', {
      userId: payload.userId,
      rol: payload.rol,
      tipo: payload.tipo,
      polizaId: payload.polizaId
    });

    // 🔒 OBTENER PÓLIZA ACTUALIZADA DESDE BD PARA COORDINADORES Y COLABORADORES
    let polizaIdActualizada = payload.polizaId;

    if (payload.tipo === 'coordinador') {
      const Coordinador = require('../models/Coordinador').default;
      const coordinador = await Coordinador.findById(payload.userId).populate('poliza');

      if (coordinador && coordinador.poliza) {
        polizaIdActualizada = coordinador.poliza._id.toString();
        console.log('🔒 [PROTEGER] Póliza actualizada desde BD:', polizaIdActualizada);
      } else {
        console.log('⚠️ [PROTEGER] Coordinador sin póliza asignada en BD');
        polizaIdActualizada = null;
      }
    } else if (payload.rol === 'encargado' || payload.rol === 'auxiliar') {
      // Obtener póliza actualizada para colaboradores
      const Colaborador = require('../models/Colaborador').default;
      const colaborador = await Colaborador.findById(payload.userId).populate('poliza');

      if (colaborador && colaborador.poliza) {
        polizaIdActualizada = colaborador.poliza._id.toString();
        console.log('🔒 [PROTEGER] Póliza colaborador actualizada desde BD:', polizaIdActualizada);
      } else {
        console.log('⚠️ [PROTEGER] Colaborador sin póliza asignada en BD');
        polizaIdActualizada = null;
      }
    }

    (req as any).user = {
      id: payload.userId,
      rol: payload.rol,
      tipo: payload.tipo,
      polizaId: polizaIdActualizada
    };

    console.log('✅ [PROTEGER] Usuario final:', {
      id: payload.userId,
      rol: payload.rol,
      tipo: payload.tipo,
      polizaId: polizaIdActualizada
    });

    next();
  } catch (err: any) {
    // Manejar diferentes tipos de errores de JWT
    if (err.name === 'TokenExpiredError') {
      res.status(401).json({
        message: 'Tu sesión ha expirado por seguridad. Por favor, inicia sesión nuevamente.',
        code: 'TOKEN_EXPIRED',
        expiredAt: err.expiredAt
      });
    } else if (err.name === 'JsonWebTokenError') {
      res.status(401).json({
        message: 'Token inválido',
        code: 'TOKEN_INVALID'
      });
    } else {
      res.status(401).json({
        message: 'Error de autenticación',
        code: 'AUTH_ERROR'
      });
    }
    return;
  }
};