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
        "ubication": "CTO MONITOREO",
        "identifier": "N01L01D001",
        "building": "ED PRINCIPAL",
        "level": "Z17",
        "active": true,
        "poliza": "68e33d9cc600a141ae62a8da", // Póliza A - Solo el ID como string
        "especialidad": "68db6349aee18cafffd59170" // Especialidad X - Solo el ID como string
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "BODEGA LOZA 1",
        "identifier": "N01L01D002",
        "building": "VILLA COTORR",
        "level": "Z5",
        "active": true,
        "poliza": "68e33d9cc600a141ae62a8da", // Misma póliza A
        "especialidad": "68db6349aee18cafffd59170" // Especialidad X
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 016 SALA  PB",
        "identifier": "N01L01D003",
        "building": "VILLA COTORR",
        "level": "Z5,Z123",
        "active": true,
        "poliza": "68e33d9cc600a141ae62a8da", // Misma póliza A
        "especialidad": "68db6349aee18cafffd59170" // Misma especialidad X
        // EJEMPLO: Si tuvieras otra especialidad, sería algo como:
        // "especialidad": "otro_id_de_especialidad_diferente"
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 016 RECEPCION PB",
        "identifier": "N01L01D004",
        "building": "VILLA COTORR",
        "level": "Z5,Z123",
        "active": true,
        "poliza": "68e33d9cc600a141ae62a8da",
        "especialidad": "68db6349aee18cafffd59170"
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 016 RECAMARA  PB",
        "identifier": "N01L01D005",
        "building": "VILLA COTORR",
        "level": "Z5,Z123",
        "active": true,
        "poliza": "68e33d9cc600a141ae62a8da",
        "especialidad": "68db6349aee18cafffd59170"
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "FINAL DE BAMBUCO",
        "identifier": "N01L01D006",
        "building": "BAMBUCO",
        "level": "Z18",
        "active": true,
        "poliza": "68e33d9cc600a141ae62a8da",
        "especialidad": "68db6349aee18cafffd59170"
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "BODEGA PISCINA",
        "identifier": "N01L01D007",
        "building": "VILLA COTORR",
        "level": "Z18",
        "active": true,
        "poliza": "68e33d9cc600a141ae62a8da",
        "especialidad": "68db6349aee18cafffd59170"
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 017 SALA  N1",
        "identifier": "N01L01D008",
        "building": "VILLA COTORR",
        "level": "Z5,Z124",
        "active": true,
        "poliza": "68e33d9cc600a141ae62a8da",
        "especialidad": "68db6349aee18cafffd59170"
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 017 RECAMARA N1",
        "identifier": "N01L01D009",
        "building": "VILLA COTORR",
        "level": "Z5,Z124",
        "active": true,
        "poliza": "68e33d9cc600a141ae62a8da",
        "especialidad": "68db6349aee18cafffd59170"
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 018 RECAMARA  N1",
        "identifier": "N01L01D010",
        "building": "VILLA COTORR",
        "level": "Z5,Z125",
        "active": true,
        "poliza": "68e33d9cc600a141ae62a8da",
        "especialidad": "68db6349aee18cafffd59170"
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 022 RECAMARA N1",
        "identifier": "N01L01D011",
        "building": "VILLA COTORR",
        "level": "Z5,Z126",
        "active": true,
        "poliza": "68de14e03fda2c78f298fbea",
        "especialidad": "68db6349aee18cafffd59170"
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 022 SALA N1",
        "identifier": "N01L01D012",
        "building": "VILLA COTORR",
        "level": "Z5,Z126",
        "active": true,
        "poliza": "68de14e03fda2c78f298fbea",
        "especialidad": "68db6349aee18cafffd59170"
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 023 RECAMARA N1",
        "identifier": "N01L01D013",
        "building": "VILLA COTORR",
        "level": "Z5,Z127",
        "active": true,
        "poliza": "68de14e03fda2c78f298fbea",
        "especialidad": "68db6349aee18cafffd59170"
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 019 RECAMARA N2",
        "identifier": "N01L01D014",
        "building": "VILLA COTORR",
        "level": "Z5,Z128",
        "active": true,
        "poliza": "68de14e03fda2c78f298fbea",
        "especialidad": "68db6349aee18cafffd59170"
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 019 SALA N2",
        "identifier": "N01L01D015",
        "building": "VILLA COTORR",
        "level": "Z5,Z128",
        "active": true,
        "poliza": "68de14e03fda2c78f298fbea",
        "especialidad": "68db6349aee18cafffd59170"
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