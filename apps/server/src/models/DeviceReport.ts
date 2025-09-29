import { Schema, model, Document } from 'mongoose';

export interface IDeviceReport extends Document {
  // Referencia al catálogo de dispositivos
  deviceCatalog: Schema.Types.ObjectId;

  // Datos del reporte específico
  colaborador: Schema.Types.ObjectId; // Colaborador principal
  especialidad: Schema.Types.ObjectId;
  fechaReporte: Date;

  // Imágenes del reporte
  WorkEvidence?: string;
  DeviceEvidence?: string;
  ViewEvidence?: string;
  manualUploadReason?: string;

  // Estado para Periodos MP
  asignado: boolean;
  completado: boolean;
  fechaAsignacion?: Date;
  fechaCompletado?: Date;
  periodoMP?: Schema.Types.ObjectId; // Referencia al período MP

  // Notas específicas del reporte
  note?: string;

  // Estado del reporte
  estado: 'pendiente' | 'en_progreso' | 'completado' | 'rechazado';

  // Referencia al reporte generado (PDF)
  reporteGenerado?: Schema.Types.ObjectId;

  // Nuevos campos para trabajo colaborativo
  esColaborativo?: boolean; // true si participaron múltiples colaboradores
  colaboradores?: Schema.Types.ObjectId[]; // Todos los colaboradores que participaron
  tipoParticipacion?: {
    colaborador: Schema.Types.ObjectId;
    rol: 'principal' | 'colaborador'; // principal = quien subió, colaborador = quien ayudó
    descripcion?: string; // descripción de la participación
  }[];
}

const DeviceReportSchema = new Schema<IDeviceReport>({
  deviceCatalog: {
    type: Schema.Types.ObjectId,
    ref: 'DeviceCatalog',
    required: true
  },
  colaborador: {
    type: Schema.Types.ObjectId,
    ref: 'Colaborador',
    required: true
  },
  especialidad: {
    type: Schema.Types.ObjectId,
    ref: 'Especialidad',
    required: true
  },
  fechaReporte: {
    type: Date,
    default: Date.now
  },

  // Imágenes del reporte
  WorkEvidence: { type: String, default: null },
  DeviceEvidence: { type: String, default: null },
  ViewEvidence: { type: String, default: null },
  manualUploadReason: { type: String, default: null },

  // Estado para Periodos MP
  asignado: { type: Boolean, default: false },
  completado: { type: Boolean, default: false },
  fechaAsignacion: { type: Date },
  fechaCompletado: { type: Date },
  periodoMP: { type: Schema.Types.ObjectId, ref: 'PeriodoMP' },

  // Notas y estado
  note: { type: String },
  estado: {
    type: String,
    enum: ['pendiente', 'en_progreso', 'completado', 'rechazado'],
    default: 'pendiente'
  },

  reporteGenerado: { type: Schema.Types.ObjectId, ref: 'Reporte' },

  // Campos para trabajo colaborativo
  esColaborativo: { type: Boolean, default: false },
  colaboradores: [{ type: Schema.Types.ObjectId, ref: 'Colaborador' }],
  tipoParticipacion: [{
    colaborador: { type: Schema.Types.ObjectId, ref: 'Colaborador' },
    rol: { type: String, enum: ['principal', 'colaborador'], default: 'colaborador' },
    descripcion: { type: String } // Para describir qué hizo cada colaborador
  }]
}, {
  timestamps: true
});

// Índices para búsquedas eficientes
DeviceReportSchema.index({ fechaReporte: -1 });
DeviceReportSchema.index({ colaborador: 1, fechaReporte: -1 });
DeviceReportSchema.index({ especialidad: 1, fechaReporte: -1 });
DeviceReportSchema.index({ estado: 1 });
DeviceReportSchema.index({ asignado: 1, completado: 1 });
DeviceReportSchema.index({ periodoMP: 1 });

export default model<IDeviceReport>('DeviceReport', DeviceReportSchema);