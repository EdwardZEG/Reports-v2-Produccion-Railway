import { Schema, model, Document } from 'mongoose';
import mongoose from 'mongoose';

export interface IDeviceImages extends Document {
  WorkEvidence: string;
  DeviceEvidence: string;
  ViewEvidence: string;
  manualUploadReason?: string;
  nombre?: string;
  rol?: string;
  IdDevice: Schema.Types.ObjectId;
}

const DeviceImagesSchema  = new Schema<IDeviceImages>({
  WorkEvidence:   { type: String, default: null },
  DeviceEvidence: { type: String, default: null },
  ViewEvidence:   { type: String, default: null },
  manualUploadReason: {
    type: String,
    default: null
  },
  IdDevice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device"
    }
}, { timestamps: true });

export default model<IDeviceImages>('DeviceImages', DeviceImagesSchema);