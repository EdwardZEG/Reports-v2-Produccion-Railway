import mongoose, { model, Schema } from "mongoose";

interface ICoordinador extends Document {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  correo: string;
  contraseña: string;
  telefono: string;
  poliza?: mongoose.Schema.Types.ObjectId | null;
  colaboradores: mongoose.Schema.Types.ObjectId[];
  estado?: "Activo" | "Inactivo";
}

const CoordinadorSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido_paterno: { type: String, required: true },
  apellido_materno: { type: String, required: true },
  correo: { type: String, required: true, select: false },
  contraseña: { type: String, required: true },
  telefono: { type: String, required: true },
  poliza: {
    type: Schema.Types.ObjectId,
    ref: "Poliza",
    default: null
  },
  estado: { 
    type: String, 
    enum: ["Activo", "Inactivo"], 
    default: "Activo" 
  },
  rol: { 
    type: String, 
    enum: ["coordinador"], 
    default: "coordinador" 
  },
  colaboradores: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Colaborador"
  }]
}, { timestamps: true });

export default model<ICoordinador>("Coordinador", CoordinadorSchema);