import mongoose from 'mongoose';
import DeviceCatalog from '../models/DeviceCatalog';
import connectDB from '../config/db';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Datos que quieres insertar (solo campos relevantes para DeviceCatalog)
const deviceData = [
    {
        "type": "Smoke (Photo)",
        "ubication": "CTO MONITOREO",
        "identifier": "N01L01D001",
        "building": "ED PRINCIPAL",
        "level": "Z17",
        "active": true
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "BODEGA LOZA 1",
        "identifier": "N01L01D002",
        "building": "VILLA COTORR",
        "level": "Z5",
        "active": true
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 016 SALA  PB",
        "identifier": "N01L01D003",
        "building": "VILLA COTORR",
        "level": "Z5,Z123",
        "active": true
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 016 RECEPCION PB",
        "identifier": "N01L01D004",
        "building": "VILLA COTORR",
        "level": "Z5,Z123",
        "active": true
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 016 RECAMARA  PB",
        "identifier": "N01L01D005",
        "building": "VILLA COTORR",
        "level": "Z5,Z123",
        "active": true
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "FINAL DE BAMBUCO",
        "identifier": "N01L01D006",
        "building": "BAMBUCO",
        "level": "Z18",
        "active": true
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "BODEGA PISCINA",
        "identifier": "N01L01D007",
        "building": "VILLA COTORR",
        "level": "Z18",
        "active": true
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 017 SALA  N1",
        "identifier": "N01L01D008",
        "building": "VILLA COTORR",
        "level": "Z5,Z124",
        "active": true
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 017 RECAMARA N1",
        "identifier": "N01L01D009",
        "building": "VILLA COTORR",
        "level": "Z5,Z124",
        "active": true
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 018 RECAMARA  N1",
        "identifier": "N01L01D010",
        "building": "VILLA COTORR",
        "level": "Z5,Z125",
        "active": true
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 022 RECAMARA N1",
        "identifier": "N01L01D011",
        "building": "VILLA COTORR",
        "level": "Z5,Z126",
        "active": true
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 022 SALA N1",
        "identifier": "N01L01D012",
        "building": "VILLA COTORR",
        "level": "Z5,Z126",
        "active": true
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 023 RECAMARA N1",
        "identifier": "N01L01D013",
        "building": "VILLA COTORR",
        "level": "Z5,Z127",
        "active": true
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 019 RECAMARA N2",
        "identifier": "N01L01D014",
        "building": "VILLA COTORR",
        "level": "Z5,Z128",
        "active": true
    },
    {
        "type": "Smoke (Photo)",
        "ubication": "HAB 019 SALA N2",
        "identifier": "N01L01D015",
        "building": "VILLA COTORR",
        "level": "Z5,Z128",
        "active": true
    }
];

export const insertDevicesWithOrder = async () => {
    try {
        console.log('🔄 Iniciando inserción de dispositivos con orden...');

        await connectDB();

        // Buscar el último insertOrder para continuar la secuencia
        const lastDevice = await DeviceCatalog.findOne({}, {}, { sort: { insertOrder: -1 } });
        let nextOrder = (lastDevice?.insertOrder || 0) + 1;

        console.log(`📋 Último insertOrder encontrado: ${lastDevice?.insertOrder || 0}`);
        console.log(`🔢 Comenzando desde insertOrder: ${nextOrder}`);

        // Asignar insertOrder a cada dispositivo
        const devicesWithOrder = deviceData.map((device, index) => ({
            ...device,
            insertOrder: nextOrder + index
        }));

        console.log('📤 Insertando dispositivos...');

        // Insertar todos los dispositivos
        const result = await DeviceCatalog.insertMany(devicesWithOrder);

        console.log(`✅ ${result.length} dispositivos insertados exitosamente`);

        // Verificar el orden
        const allDevices = await DeviceCatalog.find({})
            .sort({ insertOrder: 1 })
            .select('identifier insertOrder')
            .lean();

        console.log('\n📊 Orden final de dispositivos:');
        allDevices.forEach((device, index) => {
            console.log(`  ${index + 1}. ${device.identifier} -> insertOrder: ${device.insertOrder}`);
        });

    } catch (error) {
        console.error('❌ Error insertando dispositivos:', error);
        throw error;
    }
};

// Si ejecutas directamente este archivo
if (require.main === module) {
    insertDevicesWithOrder()
        .then(() => {
            console.log('✅ Script completado');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error ejecutando script:', error);
            process.exit(1);
        });
}