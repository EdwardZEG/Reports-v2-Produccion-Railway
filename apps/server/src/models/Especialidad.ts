import mongoose, { Schema, model, Document } from "mongoose";

interface IEspecialidad extends Document {
  nombre: string;
  descripcion: string;
  reporte: mongoose.Schema.Types.ObjectId;
  poliza: mongoose.Types.ObjectId[];
  colaborador: mongoose.Schema.Types.ObjectId[];
}

const EspecialidadSchema = new Schema<IEspecialidad>({
  nombre: { 
    type: String, 
    required: true,
    trim: true,
    maxlength: [100, 'El nombre no puede exceder los 100 caracteres']
  },
  descripcion: {
    type: String,
    required: true,
    trim: true,
    maxlength: [500, 'La descripción no puede exceder los 500 caracteres']
  },
    reporte: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Reporte' 
  },
    poliza: [{
    type: Schema.Types.ObjectId,
    ref: "Poliza",
    required: true
  }],
colaborador: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Colaborador' }]
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

EspecialidadSchema.index({ nombre: 1 });
EspecialidadSchema.index({ poliza: 1 });
EspecialidadSchema.index({ colaborador: 1 });

export default model<IEspecialidad>("Especialidad", EspecialidadSchema);