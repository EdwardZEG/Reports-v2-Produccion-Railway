import { Schema, model, Document } from 'mongoose';

export interface IDeviceCatalog extends Document {
  type: string;
  ubication: string;
  identifier: string;
  building?: string;
  level?: string;
  active: boolean; // Para desactivar dispositivos sin eliminarlos
}

const DeviceCatalogSchema = new Schema<IDeviceCatalog>({
  type: { type: String, required: true },
  ubication: { type: String, required: true },
  identifier: { type: String, required: true },
  building: { type: String },
  level: { type: String },
  active: { type: Boolean, default: true }
}, {
  timestamps: true
});

// Índice único para evitar duplicados
DeviceCatalogSchema.index({ type: 1, ubication: 1, identifier: 1 }, { unique: true });

// Índices para búsquedas rápidas en autocompletado
DeviceCatalogSchema.index({ identifier: 1 });
DeviceCatalogSchema.index({ ubication: 1 });
DeviceCatalogSchema.index({ type: 1 });
DeviceCatalogSchema.index({ active: 1 });

export default model<IDeviceCatalog>('DeviceCatalog', DeviceCatalogSchema);