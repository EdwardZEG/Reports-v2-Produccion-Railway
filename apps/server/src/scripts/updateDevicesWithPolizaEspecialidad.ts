import mongoose from 'mongoose';
import DeviceCatalog from '../models/DeviceCatalog';
import connectDB from '../config/db';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const updateDevicesWithPolizaEspecialidad = async () => {
    try {
        console.log('🔄 Actualizando dispositivos existentes con poliza y especialidad...');

        await connectDB();

        // IDs que proporcionaste
        const polizaId = "68e33d9cc600a141ae62a8da";
        const especialidadId = "68db6349aee18cafffd59170";

        // Actualizar todos los dispositivos que no tengan estos campos
        const result = await DeviceCatalog.updateMany(
            {
                $or: [
                    { poliza: { $exists: false } },
                    { especialidad: { $exists: false } }
                ]
            },
            {
                $set: {
                    poliza: polizaId,
                    especialidad: especialidadId
                }
            }
        );

        console.log(`✅ ${result.modifiedCount} dispositivos actualizados`);

        // Verificar la actualización
        const verification = await DeviceCatalog.find({})
            .sort({ insertOrder: 1 })
            .select('identifier poliza especialidad insertOrder')
            .lean();

        console.log('\n📊 Verificación de dispositivos actualizados:');
        verification.forEach((device, index) => {
            const polizaStatus = device.poliza ? '✅' : '❌';
            const especialidadStatus = device.especialidad ? '✅' : '❌';
            console.log(`  ${index + 1}. ${device.identifier} -> poliza: ${polizaStatus} especialidad: ${especialidadStatus}`);
        });

        console.log('\n🎉 ¡Dispositivos actualizados exitosamente!');

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
};

// Si ejecutas directamente este archivo
if (require.main === module) {
    updateDevicesWithPolizaEspecialidad()
        .then(() => {
            console.log('✅ Script completado');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error ejecutando script:', error);
            process.exit(1);
        });
}