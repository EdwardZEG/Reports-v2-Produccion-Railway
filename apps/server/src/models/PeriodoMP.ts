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
  nombre: string;
  coordinador: Schema.Types.ObjectId;
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
  nombre: { type: String, required: true },
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

// Índices para búsquedas eficientes
PeriodoMPSchema.index({ coordinador: 1, activo: 1 });
PeriodoMPSchema.index({ fechaInicio: -1, fechaFin: -1 });
PeriodoMPSchema.index({ 'dispositivos.colaboradorAsignado': 1 });
PeriodoMPSchema.index({ 'dispositivos.estado': 1 });

export default model<IPeriodoMP>('PeriodoMP', PeriodoMPSchema);