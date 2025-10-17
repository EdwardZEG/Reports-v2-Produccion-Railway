import { Schema, model, Document, Types } from 'mongoose';

export interface IDeviceCatalog extends Document {
  type: string;
  ubication: string;
  identifier: string;
  building?: string;
  level?: string;
  active: boolean; // Para desactivar dispositivos sin eliminarlos
  insertOrder: number; // Orden automático de inserción
  poliza?: Types.ObjectId; // ID de la póliza a la que pertenece el dispositivo
  especialidad?: Types.ObjectId; // ID de la especialidad que maneja el dispositivo
}

const DeviceCatalogSchema = new Schema<IDeviceCatalog>({
  type: { type: String, required: true },
  ubication: { type: String, required: true },
  identifier: { type: String, required: true },
  building: { type: String },
  level: { type: String },
  active: { type: Boolean, default: true },
  insertOrder: { type: Number, unique: true }, // Orden automático y único
  poliza: { type: Schema.Types.ObjectId, ref: 'Poliza' }, // Referencia a la colección Poliza
  especialidad: { type: Schema.Types.ObjectId, ref: 'Especialidad' } // Referencia a la colección Especialidad
}, {
  timestamps: true
});

// Middleware para asignar insertOrder automáticamente antes de guardar
DeviceCatalogSchema.pre('save', async function (next) {
  if (this.isNew && !this.insertOrder) {
    try {
      // Buscar el último insertOrder y sumar 1
      const DeviceCatalogModel = this.constructor as any;
      const lastDevice = await DeviceCatalogModel.findOne({}, {}, { sort: { insertOrder: -1 } });
      this.insertOrder = (lastDevice?.insertOrder || 0) + 1;
    } catch (error: any) {
      return next(error);
    }
  }
  next();
});

// Middleware para insertMany (bulk operations)
DeviceCatalogSchema.pre('insertMany', async function (next, docs: any[]) {
  try {
    // Buscar el último insertOrder
    const lastDevice = await this.findOne({}, {}, { sort: { insertOrder: -1 } });
    let nextOrder = (lastDevice?.insertOrder || 0) + 1;

    // Asignar insertOrder secuencial a documentos que no lo tengan
    docs.forEach((doc: any) => {
      if (!doc.insertOrder) {
        doc.insertOrder = nextOrder++;
      }
    });
  } catch (error: any) {
    return next(error);
  }
  next();
});

// Índice único para evitar duplicados
DeviceCatalogSchema.index({ type: 1, ubication: 1, identifier: 1 }, { unique: true });

// Índices para búsquedas rápidas en autocompletado
DeviceCatalogSchema.index({ identifier: 1 });
DeviceCatalogSchema.index({ ubication: 1 });
DeviceCatalogSchema.index({ type: 1 });
DeviceCatalogSchema.index({ active: 1 });

export default model<IDeviceCatalog>('DeviceCatalog', DeviceCatalogSchema);