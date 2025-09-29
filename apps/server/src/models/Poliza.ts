import mongoose, { Schema, model, Document } from "mongoose";

interface IPoliza extends Document {
  nombre: string;
  ubicacion: string;
  coordinador?: mongoose.Schema.Types.ObjectId;
  colaboradores?: mongoose.Schema.Types.ObjectId[];
}

const PolizaSchema = new Schema<IPoliza>({
  nombre: { type: String, required: true },
  ubicacion: { type: String, required: true },
  coordinador: { 
    type: Schema.Types.ObjectId, 
    ref: "Coordinador",
    default: null
  },
  colaboradores: [{
    type: Schema.Types.ObjectId,
    ref: "Colaborador"
  }]
}, { timestamps: true,
  toJSON: { virtuals: true },
    toObject: { virtuals: true }
 });
 
PolizaSchema.path("colaboradores").default(() => []); 

export default model<IPoliza>("Poliza", PolizaSchema);