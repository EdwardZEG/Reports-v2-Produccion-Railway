import { Schema, model, Document } from 'mongoose';

export interface IDevice extends Document {
  type: string;
  ubication: string;
  identifier?: string;
  building?: string;
  level?: string;
  note?: string;
  fechaMP?: string;
  images: Schema.Types.ObjectId[];
  report: Schema.Types.ObjectId;
  colaborador: Schema.Types.ObjectId;
  especialidad: Schema.Types.ObjectId;
}

const DeviceSchema = new Schema<IDevice>({
  type: { type: String, required: true },
  ubication: { type: String, required: true },
  identifier: String,
  building: String,
  level: String,
  note: String,
  images: [{ type: Schema.Types.ObjectId, ref: 'DeviceImages' }],
  report: { type: Schema.Types.ObjectId, ref: 'Reporte' },
  colaborador: { type: Schema.Types.ObjectId, ref: 'Colaborador', required: true },
  especialidad: { type: Schema.Types.ObjectId, ref: 'Especialidad', required: true },
}, { timestamps: true });

export default model<IDevice>('Device', DeviceSchema);
