import { Schema, model, Document } from 'mongoose';

export interface IReporte extends Document {
  name: string;
  file: {
    data: Buffer;
    originalname: string;
    mimetype: string;
  };
  idEspecialidad: Schema.Types.ObjectId;
  Device: Schema.Types.ObjectId;
}

const ReporteSchema = new Schema<IReporte>(
  {
    name: { type: String, required: true },
    file: {
      data: { type: Buffer, required: true },
      originalname: { type: String, required: true },
      mimetype: { type: String, required: true },
    },
    idEspecialidad: { type: Schema.Types.ObjectId, ref: 'Especialidad' },
    Device: { type: Schema.Types.ObjectId, ref: 'Device' },
  },
  { timestamps: true }
);

export default model<IReporte>('Reporte', ReporteSchema);
