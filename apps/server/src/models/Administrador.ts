import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
  nombre: { type: String, required: true },
  correo:    { type: String, required: true, unique: true },
  contraseña: { type: String, required: true },
  rol:     {
    type: String,
    enum: ['administrador'],
  }
}, { timestamps: true });

export default mongoose.model('Admin', adminSchema);
