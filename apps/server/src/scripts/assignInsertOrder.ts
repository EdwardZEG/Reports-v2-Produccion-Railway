import mongoose from 'mongoose';
import DeviceCatalog from '../models/DeviceCatalog';
import connectDB from '../config/db';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno desde el archivo .env del servidor
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Script para asignar insertOrder a dispositivos existentes 
 * basado en el orden actual (preservando el orden que ya tienes)
 */
export const assignInsertOrderToExistingDevices = async () => {
    try {
        console.log('🔄 Iniciando asignación de insertOrder...');

        // Conectar a la base de datos
        await connectDB();

        // Obtener todos los dispositivos en el orden actual (por insertOrder si existe, sino por _id)
        const devices = await DeviceCatalog.find({})
            .sort({ insertOrder: 1, _id: 1 }) // Usar insertOrder si existe, sino _id para consistencia
            .lean();

        console.log(`📋 Encontrados ${devices.length} dispositivos`);

        let updateCount = 0;

        // Asignar insertOrder secuencial (1, 2, 3, etc.)
        for (let i = 0; i < devices.length; i++) {
            const device = devices[i];
            const insertOrder = i + 1; // Empezar desde 1

            await DeviceCatalog.findByIdAndUpdate(
                device._id,
                { $set: { insertOrder } },
                { upsert: false }
            );

            updateCount++;

            // Log de progreso cada 10 elementos
            if (updateCount % 10 === 0 || updateCount === devices.length) {
                console.log(`✅ Procesados ${updateCount}/${devices.length} dispositivos`);
            }
        }

        console.log(`🎉 Migración completada. ${updateCount} dispositivos actualizados`);

        // Verificar los primeros dispositivos
        const ejemplos = await DeviceCatalog.find({})
            .sort({ insertOrder: 1 })
            .limit(15)
            .select('identifier insertOrder')
            .lean();

        console.log('📊 Dispositivos con insertOrder asignado:');
        ejemplos.forEach((device, index) => {
            console.log(`  ${index + 1}. ${device.identifier} -> insertOrder: ${device.insertOrder}`);
        });

        console.log('\n🔧 Ahora cuando insertes nuevos dispositivos, automáticamente se asignará el siguiente insertOrder');
        console.log('📝 Para mantener el orden: inserta uno por uno en MongoDB Atlas');

    } catch (error) {
        console.error('❌ Error en la migración:', error);
        throw error;
    }
};

// Si ejecutas directamente este archivo
if (require.main === module) {
    assignInsertOrderToExistingDevices()
        .then(() => {
            console.log('✅ Script completado');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error ejecutando script:', error);
            process.exit(1);
        });
}