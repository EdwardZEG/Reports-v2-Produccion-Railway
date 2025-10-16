import mongoose from 'mongoose';
import DeviceCatalog from '../models/DeviceCatalog';
import connectDB from '../config/db';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

export const verifyDevicesFields = async () => {
    try {
        console.log('🔍 Verificando campos de dispositivos...');

        await connectDB();

        // Buscar todos los dispositivos con todos sus campos
        const devices = await DeviceCatalog.find({})
            .sort({ insertOrder: 1 })
            .lean();

        console.log(`📋 Total dispositivos encontrados: ${devices.length}\n`);

        devices.forEach((device, index) => {
            console.log(`${index + 1}. ${device.identifier}:`);
            console.log(`   - poliza: ${device.poliza || 'NO DEFINIDO'}`);
            console.log(`   - especialidad: ${device.especialidad || 'NO DEFINIDO'}`);
            console.log(`   - insertOrder: ${device.insertOrder}`);
            console.log(`   - type: ${device.type}`);
            console.log('');
        });

        // Contar cuántos tienen los campos
        const withPoliza = devices.filter(d => d.poliza).length;
        const withEspecialidad = devices.filter(d => d.especialidad).length;

        console.log('📊 Resumen:');
        console.log(`   - Dispositivos con poliza: ${withPoliza}/${devices.length}`);
        console.log(`   - Dispositivos con especialidad: ${withEspecialidad}/${devices.length}`);

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
};

// Si ejecutas directamente este archivo
if (require.main === module) {
    verifyDevicesFields()
        .then(() => {
            console.log('✅ Verificación completada');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error ejecutando script:', error);
            process.exit(1);
        });
}