import { Schema, model, Document } from 'mongoose';

interface IDispositivoAsignado {
  deviceCatalog: Schema.Types.ObjectId;
  colaboradorAsignado?: Schema.Types.ObjectId; // Opcional para asignaciones múltiples
  estado: 'pendiente' | 'en_progreso' | 'completado';
  fechaAsignacion: Date;
  fechaCompletado?: Date;
  deviceReport?: Schema.Types.ObjectId; // Se llena cuando se completa
  notas?: string;

  // Nuevos campos para trabajo colaborativo y asignación múltiple
  asignacionMultiple?: boolean; // true si se asignó a múltiples colaboradores
  completadoPor?: Schema.Types.ObjectId; // ID del colaborador que completó (para asignaciones múltiples)
  esColaborativo?: boolean; // true si el reporte fue hecho por múltiples colaboradores
  colaboradores?: Schema.Types.ObjectId[]; // IDs de todos los colaboradores que participaron (trabajo colaborativo)
  colaboradoresElegibles?: Schema.Types.ObjectId[]; // Para asignaciones múltiples: colaboradores que pueden completar la tarea
}

export interface IPeriodoMP extends Document {
  especialidad: Schema.Types.ObjectId; // Especialidad a la que pertenece este período
  poliza: Schema.Types.ObjectId; // Póliza a la que pertenece este período
  coordinador: Schema.Types.ObjectId; // Coordinador que creó el período (para referencia)
  fechaInicio: Date;
  fechaFin: Date;
  activo: boolean;

  // Dispositivos asignados en este período
  dispositivos: IDispositivoAsignado[];

  // Estadísticas calculadas
  totalDispositivos: number;
  dispositivosCompletados: number;
  porcentajeCompletado: number;

  descripcion?: string;
}

const DispositivoAsignadoSchema = new Schema<IDispositivoAsignado>({
  deviceCatalog: {
    type: Schema.Types.ObjectId,
    ref: 'DeviceCatalog',
    required: true
  },
  colaboradorAsignado: {
    type: Schema.Types.ObjectId,
    ref: 'Colaborador',
    required: false // Permitir null para asignaciones múltiples
  },
  estado: {
    type: String,
    enum: ['pendiente', 'en_progreso', 'completado'],
    default: 'pendiente'
  },
  fechaAsignacion: {
    type: Date,
    default: Date.now
  },
  fechaCompletado: { type: Date },
  deviceReport: {
    type: Schema.Types.ObjectId,
    ref: 'DeviceReport'
  },
  notas: { type: String },

  // Nuevos campos para trabajo colaborativo y asignación múltiple
  asignacionMultiple: { type: Boolean, default: false },
  completadoPor: {
    type: Schema.Types.ObjectId,
    ref: 'Colaborador'
  },
  esColaborativo: { type: Boolean, default: false },
  colaboradores: [{
    type: Schema.Types.ObjectId,
    ref: 'Colaborador'
  }],
  // Para asignaciones múltiples: lista de colaboradores elegibles para completar la tarea
  colaboradoresElegibles: [{
    type: Schema.Types.ObjectId,
    ref: 'Colaborador'
  }]
}, { _id: false }); // No necesitamos _id para subdocumentos

const PeriodoMPSchema = new Schema<IPeriodoMP>({
  especialidad: {
    type: Schema.Types.ObjectId,
    ref: 'Especialidad',
    required: true
  },
  poliza: {
    type: Schema.Types.ObjectId,
    ref: 'Poliza',
    required: true
  },
  coordinador: {
    type: Schema.Types.ObjectId,
    ref: 'Coordinador',
    required: true
  },
  fechaInicio: { type: Date, required: true },
  fechaFin: { type: Date, required: true },
  activo: { type: Boolean, default: true },

  dispositivos: [DispositivoAsignadoSchema],

  // Estadísticas
  totalDispositivos: { type: Number, default: 0 },
  dispositivosCompletados: { type: Number, default: 0 },
  porcentajeCompletado: { type: Number, default: 0 },

  descripcion: { type: String }
}, {
  timestamps: true
});

// Middleware para calcular estadísticas antes de guardar
PeriodoMPSchema.pre('save', function (next) {
  this.totalDispositivos = this.dispositivos.length;
  this.dispositivosCompletados = this.dispositivos.filter(d => d.estado === 'completado').length;
  this.porcentajeCompletado = this.totalDispositivos > 0
    ? Math.round((this.dispositivosCompletados / this.totalDispositivos) * 100)
    : 0;
  next();
});

// Virtual para generar el nombre automáticamente basado en la especialidad
PeriodoMPSchema.virtual('nombre').get(function (this: IPeriodoMP) {
  if (this.populated('especialidad') && typeof this.especialidad === 'object' && 'nombre' in this.especialidad) {
    const especialidadNombre = (this.especialidad as any).nombre;
    return especialidadNombre; // Solo el nombre de la especialidad
  }
  return 'Período MP'; // Fallback si no hay especialidad
});

// Asegurar que el virtual se incluya en JSON
PeriodoMPSchema.set('toJSON', { virtuals: true });
PeriodoMPSchema.set('toObject', { virtuals: true });

// Índices para búsquedas eficientes
PeriodoMPSchema.index({ poliza: 1, especialidad: 1, activo: 1 }); // Buscar por póliza y especialidad
PeriodoMPSchema.index({ coordinador: 1, activo: 1 }); // Buscar por coordinador
PeriodoMPSchema.index({ fechaInicio: -1, fechaFin: -1 });
PeriodoMPSchema.index({ 'dispositivos.colaboradorAsignado': 1 });
PeriodoMPSchema.index({ 'dispositivos.estado': 1 });

export default model<IPeriodoMP>('PeriodoMP', PeriodoMPSchema);