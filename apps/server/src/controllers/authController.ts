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

export const verificarEstado: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Obtener userId del token ya validado por el middleware de autenticación
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return next(new AppError('Token no proporcionado', 401));
    }

    const token = authHeader.split(' ')[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    const { userId, tipo } = payload;

    console.log('🔍 Verificando estado del usuario:', { userId, tipo });

    let user: any = null;
    let isActive = false;

    // Buscar el usuario según su tipo y verificar su estado
    switch (tipo) {
      case 'admin':
        user = await Admin.findById(userId);
        // Los administradores siempre están activos (no tienen campo "activo")
        isActive = !!user;
        break;

      case 'colaborador':
        user = await Colaborador.findById(userId);
        // Verificar si el colaborador existe y está activo (campo "estado" como string)
        isActive = user && user.estado === 'Activo';
        break;

      case 'coordinador':
        user = await Coordinador.findById(userId);
        // Verificar si el coordinador existe y está activo (campo "estado" como string)
        isActive = user && user.estado === 'Activo';
        break;

      default:
        return next(new AppError('Tipo de usuario inválido', 400));
    }

    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }

    console.log('✅ Estado del usuario verificado:', {
      userId,
      tipo,
      isActive,
      userEstado: user.estado || 'N/A'
    });

    res.json({
      isActive,
      userId,
      tipo,
      message: isActive ? 'Usuario activo' : 'Usuario inactivo'
    });

  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Token inválido',
        code: 'TOKEN_INVALID'
      });
    } else {
      next(err);
    }
  }
};

export const obtenerPerfil: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    console.log('🔍 [PERFIL] Iniciando obtenerPerfil...');

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('❌ [PERFIL] Token de autorización faltante');
      return next(new AppError('Token de autorización requerido', 401));
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    const { userId, tipo } = decoded;

    console.log('🔍 [PERFIL] Token decodificado:', { userId, tipo });

    let user: any = null;

    switch (tipo) {
      case 'admin': // Cambiar 'administrador' por 'admin' para consistencia
        console.log('👤 [PERFIL] Buscando administrador con ID:', userId);
        user = await Admin.findById(userId).select('+correo');
        if (user) {
          console.log('✅ [PERFIL] Administrador encontrado:', user.nombre);
          return res.json({
            _id: user._id,
            nombre: user.nombre,
            apellido_paterno: user.apellido_paterno || '',
            apellido_materno: user.apellido_materno || '',
            correo: user.correo,
            telefono: user.telefono || '',
            estado: user.estado || 'Activo',
            rol: user.rol,
            tipo: 'admin',
            createdAt: user.createdAt || user.fecha_creacion,
            poliza: null,
            especialidades: []
          });
        }
        console.log('❌ [PERFIL] Administrador no encontrado');
        break;

      case 'colaborador':
        console.log('👤 [PERFIL] Buscando colaborador con ID:', userId);
        user = await Colaborador.findById(userId)
          .select('+correo')
          .populate('poliza', 'nombre ubicacion')
          .populate('especialidad', 'nombre');

        if (user) {
          console.log('✅ [PERFIL] Colaborador encontrado:', user.nombre);
          console.log('🏢 [PERFIL] Póliza del colaborador:', user.poliza);
          console.log('🎯 [PERFIL] Especialidades del colaborador:', user.especialidad);

          const profileData = {
            _id: user._id,
            nombre: user.nombre,
            apellido_paterno: user.apellido_paterno || '',
            apellido_materno: user.apellido_materno || '',
            correo: user.correo,
            telefono: user.telefono || '',
            estado: user.estado || 'Activo',
            rol: user.rol,
            tipo: 'colaborador',
            createdAt: user.createdAt || user.fecha_creacion,
            poliza: user.poliza || null,
            especialidades: user.especialidad || []
          };

          console.log('📤 [PERFIL] Enviando respuesta:', JSON.stringify(profileData, null, 2));
          return res.json(profileData);
        }
        console.log('❌ [PERFIL] Colaborador no encontrado');
        break;

      case 'coordinador':
        console.log('👤 [PERFIL] Buscando coordinador con ID:', userId);
        user = await Coordinador.findById(userId)
          .select('+correo')
          .populate('poliza', 'nombre ubicacion');

        if (user) {
          console.log('✅ [PERFIL] Coordinador encontrado:', user.nombre);
          console.log('🏢 [PERFIL] Póliza del coordinador:', user.poliza);
          console.log('🔍 [PERFIL] Tipo de póliza:', typeof user.poliza);

          const profileData = {
            _id: user._id,
            nombre: user.nombre,
            apellido_paterno: user.apellido_paterno || '',
            apellido_materno: user.apellido_materno || '',
            correo: user.correo,
            telefono: user.telefono || '',
            estado: user.estado || 'Activo',
            rol: user.rol || 'coordinador',
            tipo: 'coordinador',
            createdAt: user.createdAt || user.fecha_creacion,
            poliza: user.poliza || null,
            especialidades: []
          };

          console.log('📤 [PERFIL] Enviando respuesta:', JSON.stringify(profileData, null, 2));
          return res.json(profileData);
        }
        console.log('❌ [PERFIL] Coordinador no encontrado');
        break;

      default:
        console.log('❌ [PERFIL] Tipo de usuario inválido:', tipo);
        return next(new AppError('Tipo de usuario inválido', 400));
    }

    console.log('❌ [PERFIL] Usuario no encontrado después del switch');
    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }

  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Token inválido',
        code: 'TOKEN_INVALID'
      });
    } else {
      next(err);
    }
  }
};

export const actualizarPerfil: RequestHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Token de autorización requerido', 401));
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret') as any;
    const { userId, tipo } = decoded;

    const { telefono } = req.body;

    if (!telefono) {
      return next(new AppError('Teléfono es requerido', 400));
    }

    let user: any = null;

    switch (tipo) {
      case 'admin': // Cambiar 'administrador' por 'admin' para consistencia
        user = await Admin.findByIdAndUpdate(
          userId,
          { telefono },
          { new: true }
        ).select('+correo');
        break;

      case 'colaborador':
        user = await Colaborador.findByIdAndUpdate(
          userId,
          { telefono },
          { new: true }
        ).select('+correo');
        break;

      case 'coordinador':
        user = await Coordinador.findByIdAndUpdate(
          userId,
          { telefono },
          { new: true }
        ).select('+correo');
        break;

      default:
        return next(new AppError('Tipo de usuario inválido', 400));
    }

    if (!user) {
      return next(new AppError('Usuario no encontrado', 404));
    }

    res.json({
      message: 'Perfil actualizado correctamente',
      telefono: user.telefono
    });

  } catch (err: any) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        message: 'Token expirado',
        code: 'TOKEN_EXPIRED'
      });
    } else if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({
        message: 'Token inválido',
        code: 'TOKEN_INVALID'
      });
    } else {
      next(err);
    }
  }
};

