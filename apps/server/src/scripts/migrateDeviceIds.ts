import mongoose from 'mongoose';
import Device from '../models/Device';
import connectDB from '../config/db';

/**
 * Script de migración para convertir campos colaborador y especialidad de string a ObjectId
 * Ejecutar una vez para arreglar los datos existentes
 */
export const migrateDeviceIds = async () => {
    try {
        // Conectar a la base de datos
        await connectDB();

        console.log('🔄 Iniciando migración de IDs de dispositivos...');

        // Buscar todos los dispositivos que tienen colaborador o especialidad como string
        const devices = await Device.find({}).lean();

        let migratedCount = 0;

        for (const device of devices) {
            const updates: any = {};
            let needsUpdate = false;

            // Verificar si colaborador es string y convertir a ObjectId
            if (device.colaborador && typeof device.colaborador === 'string') {
                try {
                    updates.colaborador = new mongoose.Types.ObjectId(device.colaborador);
                    needsUpdate = true;
                } catch (error) {
                    console.error(`Error converting colaborador ID ${device.colaborador} for device ${device._id}:`, error);
                }
            }

            // Verificar si especialidad es string y convertir a ObjectId  
            if (device.especialidad && typeof device.especialidad === 'string') {
                try {
                    updates.especialidad = new mongoose.Types.ObjectId(device.especialidad);
                    needsUpdate = true;
                } catch (error) {
                    console.error(`Error converting especialidad ID ${device.especialidad} for device ${device._id}:`, error);
                }
            }

            // Actualizar el dispositivo si es necesario
            if (needsUpdate) {
                await Device.updateOne(
                    { _id: device._id },
                    { $set: updates }
                );
                migratedCount++;
                console.log(`✅ Migrated device ${device._id}`);
            }
        }

        console.log(`🎉 Migración completada. ${migratedCount} dispositivos actualizados de ${devices.length} total.`);

        // Cerrar conexión
        await mongoose.connection.close();

    } catch (error) {
        console.error('❌ Error en migración:', error);
        process.exit(1);
    }
};

// Ejecutar migración si se llama directamente
if (require.main === module) {
    migrateDeviceIds().then(() => {
        console.log('Migración finalizada.');
        process.exit(0);
    });
}