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
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido' });
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

    // 🔒 OBTENER PÓLIZA ACTUALIZADA DESDE BD PARA COORDINADORES
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
  } catch (err) {
    res.status(401).json({ message: 'Token inválido' });
    return;
  }
};