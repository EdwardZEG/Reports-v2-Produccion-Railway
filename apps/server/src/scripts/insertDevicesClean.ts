import mongoose from 'mongoose';
import DeviceCatalog from '../models/DeviceCatalog';
import connectDB from '../config/db';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Datos originales limpios (IDs como strings, se convertirán a ObjectId automáticamente)
// Cada dispositivo puede tener diferentes pólizas y especialidades según corresponda
const deviceData = [
    {
        "type": "Smoke (Photo)",
        "ubication": "PASILLO ESTE N2",
        "identifier": "N03L01D001",
        "building": "ED PRINCIPAL",
        "level": "Z18",
        "active": true,
        "poliza": "68f7ce646580cfda285b77bf",
        "especialidad": "68f7ce756580cfda285b77c5"
    },
    {
        "type": "Heat (Fixed Temperature)",
        "ubication": "SALA DE TRANSFORMADORES",
        "identifier": "N03L01D002",
        "building": "ED SERVICIOS",
        "level": "Z08",
        "active": false,
        "poliza": "68f7ce646580cfda285b77bf",
        "especialidad": "68f7ce756580cfda285b77c5"
    },
    {
        "type": "Flame Detector",
        "ubication": "ÁREA DE TANQUES",
        "identifier": "N03L01D003",
        "building": "ED INDUSTRIAL",
        "level": "Z12",
        "active": true,
        "poliza": "68f7ce646580cfda285b77bf",
        "especialidad": "68f7ce756580cfda285b77c5"
    },
    {
        "type": "Manual Call Point",
        "ubication": "SALIDA DE EMERGENCIA NORTE",
        "identifier": "N03L01D004",
        "building": "ED PRINCIPAL",
        "level": "Z02",
        "active": true,
        "poliza": "68f7ce646580cfda285b77bf",
        "especialidad": "68f7ce756580cfda285b77c5"
    },
    {
        "type": "Beam Detector",
        "ubication": "BODEGA DE EQUIPOS",
        "identifier": "N03L01D005",
        "building": "ED ALMACÉN",
        "level": "Z10",
        "active": false,
        "poliza": "68f7ce646580cfda285b77bf",
        "especialidad": "68f7ce756580cfda285b77c5"
    },
    {
        "type": "Gas Detector",
        "ubication": "PLANTA DE EMERGENCIA",
        "identifier": "N03L01D006",
        "building": "ED SERVICIOS",
        "level": "Z04",
        "active": true,
        "poliza": "68f7ce646580cfda285b77bf",
        "especialidad": "68f7ce756580cfda285b77c5"
    },
    {
        "type": "Smoke (Ionization)",
        "ubication": "LABORATORIO BIOLÓGICO",
        "identifier": "N03L01D007",
        "building": "ED LABORATORIO",
        "level": "Z14",
        "active": true,
        "poliza": "68f7ce646580cfda285b77bf",
        "especialidad": "68f7ce756580cfda285b77c5"
    },
    {
        "type": "Temperature Sensor",
        "ubication": "CUARTO DE SERVIDORES",
        "identifier": "N03L01D008",
        "building": "ED ADMINISTRATIVO",
        "level": "Z05",
        "active": true,
        "poliza": "68f7ce646580cfda285b77bf",
        "especialidad": "68f7ce756580cfda285b77c5"
    },
    {
        "type": "Heat (Rate of Rise)",
        "ubication": "TALLER ELÉCTRICO",
        "identifier": "N03L01D009",
        "building": "ED INDUSTRIAL",
        "level": "Z09",
        "active": false,
        "poliza": "68f7ce646580cfda285b77bf",
        "especialidad": "68f7ce756580cfda285b77c5"
    },
    {
        "type": "Flame Detector",
        "ubication": "ZONA DE CARGA DE COMBUSTIBLE",
        "identifier": "N03L01D010",
        "building": "ED OPERACIONES",
        "level": "Z11",
        "active": true,
        "poliza": "68f7ce646580cfda285b77bf",
        "especialidad": "68f7ce756580cfda285b77c5"
    }
];

export const insertDevicesWithCorrectOrder = async () => {
    try {
        console.log('🔄 Insertando dispositivos con insertOrder correcto...');

        await connectDB();

        // CAMBIO: No limpiar automáticamente, verificar si ya existen
        console.log('🔍 Verificando dispositivos existentes...');

        const existingDevices = await DeviceCatalog.find({}).lean();
        console.log(`📋 Dispositivos existentes encontrados: ${existingDevices.length}`);

        if (existingDevices.length > 0) {
            console.log('⚠️ Ya existen dispositivos en la base de datos.');
            console.log('💡 Para evitar problemas con PeriodoMP, se insertarán solo los nuevos.');

            // Insertar solo los dispositivos que no existen
            const existingIdentifiers = existingDevices.map(d => d.identifier);
            const newDevices = deviceData.filter(device => !existingIdentifiers.includes(device.identifier));

            console.log(`📊 Dispositivos nuevos a insertar: ${newDevices.length}`);

            if (newDevices.length === 0) {
                console.log('✅ Todos los dispositivos ya existen. No hay nada que insertar.');
                return;
            }

            // Buscar el último insertOrder para continuar la secuencia
            const lastDevice = await DeviceCatalog.findOne({}, {}, { sort: { insertOrder: -1 } });
            let nextOrder = (lastDevice?.insertOrder || 0) + 1;

            console.log(`🔢 Comenzando desde insertOrder: ${nextOrder}`);

            // Preparar solo los nuevos dispositivos con conversión a ObjectId
            const devicesWithOrder = newDevices.map((device, index) => ({
                ...device,
                insertOrder: nextOrder + index,
                // Convertir strings a ObjectId automáticamente
                poliza: device.poliza ? new mongoose.Types.ObjectId(device.poliza) : undefined,
                especialidad: device.especialidad ? new mongoose.Types.ObjectId(device.especialidad) : undefined
            }));

            console.log('📤 Insertando dispositivos nuevos...');
            const result = await DeviceCatalog.insertMany(devicesWithOrder);
            console.log(`✅ ${result.length} dispositivos nuevos insertados exitosamente`);

        } else {
            // Si no hay dispositivos, insertar todos (comportamiento original)
            console.log('📤 Base de datos vacía, insertando todos los dispositivos...');

            const devicesWithOrder = deviceData.map((device, index) => ({
                ...device,
                insertOrder: index + 1,
                // Convertir strings a ObjectId automáticamente
                poliza: device.poliza ? new mongoose.Types.ObjectId(device.poliza) : undefined,
                especialidad: device.especialidad ? new mongoose.Types.ObjectId(device.especialidad) : undefined
            }));

            const result = await DeviceCatalog.insertMany(devicesWithOrder);
            console.log(`✅ ${result.length} dispositivos insertados exitosamente`);
        }

        // Verificar el orden
        const verification = await DeviceCatalog.find({})
            .sort({ insertOrder: 1 })
            .select('identifier insertOrder')
            .lean();

        console.log('\n📊 Orden final verificado:');
        verification.forEach((device, index) => {
            console.log(`  ${index + 1}. ${device.identifier} -> insertOrder: ${device.insertOrder}`);
        });

        console.log('\n🎉 ¡Dispositivos insertados con orden perfecto!');
        console.log('💡 Próximos dispositivos se asignarán automáticamente desde insertOrder: 16');

    } catch (error) {
        console.error('❌ Error:', error);
        throw error;
    }
};

// Si ejecutas directamente este archivo
if (require.main === module) {
    insertDevicesWithCorrectOrder()
        .then(() => {
            console.log('✅ Script completado');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error ejecutando script:', error);
            process.exit(1);
        });
}