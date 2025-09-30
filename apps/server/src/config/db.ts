import mongoose from 'mongoose';

const connectDB = async () => {
  try {
    // Configuración optimizada para mejor rendimiento (compatible con MongoDB driver v6+)
    const conn = await mongoose.connect(process.env.MONGO_URI || '', {
      maxPoolSize: 10, // Mantener hasta 10 conexiones socket
      serverSelectionTimeoutMS: 5000, // Mantener intentando enviar operaciones por 5 segundos
      socketTimeoutMS: 45000, // Cerrar conexiones después de 45 segundos de inactividad
      maxIdleTimeMS: 30000, // Cerrar conexiones después de 30 segundos de inactividad
      bufferCommands: false, // Deshabilitar el almacenamiento en buffer de comandos de mongoose
    } as any);

    // Configuraciones adicionales para rendimiento
    mongoose.set('maxTimeMS', 30000); // Timeout de consultas a 30 segundos

    console.log(`MongoDB conectado: ${conn.connection.host}`);
    console.log('⚡ Configuración de rendimiento aplicada');
  } catch (error) {
    console.error('Error al conectar con MongoDB:', error);
    process.exit(1);
  }
};

export default connectDB;
