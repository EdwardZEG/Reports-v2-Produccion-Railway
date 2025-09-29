import mongoose from "mongoose";
import bcrypt from 'bcryptjs';

const colaboradorSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  apellido_paterno: { type: String, required: true },
  apellido_materno: { type: String, required: true },
  correo: { type: String, required: true, unique: true },
  contraseña: { type: String, required: true, select: false },
  telefono: { type: String, required: true },
  poliza: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Poliza",
    default: null
  },
  coordinador: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: "Coordinador",
    default: null
  },
  estado: { 
    type: String, 
    enum: ["Activo", "Inactivo"], 
    default: "Activo" 
  },
  rol: { 
    type: String, 
    enum: ["Encargado", "Auxiliar"], 
    required: true 
  },
  especialidad: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "Especialidad"
  }],
}, { timestamps: true });


export default mongoose.model("Colaborador", colaboradorSchema);