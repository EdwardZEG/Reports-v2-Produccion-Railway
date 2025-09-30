import mongoose from 'mongoose';
import Colaborador from '../models/Colaborador';
import Coordinador from '../models/Coordinador';
import Poliza from '../models/Poliza';
import PeriodoMP from '../models/PeriodoMP';

/**
 * Script para optimizar la base de datos agregando índices importantes
 * Ejecutar una sola vez para mejorar el rendimiento de las consultas
 */
export const optimizeDatabase = async () => {
    try {
        console.log('🚀 Iniciando optimización de base de datos...');

        // Índices para Colaborador
        console.log('📊 Creando índices para Colaborador...');
        await Colaborador.collection.createIndex({ poliza: 1 });
        await Colaborador.collection.createIndex({ coordinador: 1 });
        await Colaborador.collection.createIndex({ especialidad: 1 });
        await Colaborador.collection.createIndex({ estado: 1 });
        await Colaborador.collection.createIndex({ rol: 1 });
        await Colaborador.collection.createIndex({ correo: 1 }, { unique: true });

        // Índices para Coordinador
        console.log('📊 Creando índices para Coordinador...');
        await Coordinador.collection.createIndex({ poliza: 1 });
        await Coordinador.collection.createIndex({ correo: 1 }, { unique: true });

        // Índices para PeriodoMP
        console.log('📊 Creando índices para PeriodoMP...');
        await PeriodoMP.collection.createIndex({ coordinador: 1 });
        await PeriodoMP.collection.createIndex({ activo: 1 });
        await PeriodoMP.collection.createIndex({ fechaInicio: 1 });
        await PeriodoMP.collection.createIndex({ fechaFin: 1 });

        // Índices para Poliza
        console.log('📊 Creando índices para Poliza...');
        await Poliza.collection.createIndex({ coordinador: 1 });
        await Poliza.collection.createIndex({ nombre: 1 });

        console.log('✅ Optimización de base de datos completada!');

        // Mostrar estadísticas de índices
        const colaboradorIndexes = await Colaborador.collection.indexes();
        const coordinadorIndexes = await Coordinador.collection.indexes();
        const polizaIndexes = await Poliza.collection.indexes();
        const periodoMPIndexes = await PeriodoMP.collection.indexes();

        console.log('📈 Índices creados:');
        console.log('  - Colaborador:', colaboradorIndexes.length, 'índices');
        console.log('  - Coordinador:', coordinadorIndexes.length, 'índices');
        console.log('  - Poliza:', polizaIndexes.length, 'índices');
        console.log('  - PeriodoMP:', periodoMPIndexes.length, 'índices');

    } catch (error) {
        console.error('❌ Error optimizando base de datos:', error);
        throw error;
    }
};

// Ejecutar si se llama directamente
if (require.main === module) {
    const connectDB = require('../config/db').default;

    connectDB().then(async () => {
        await optimizeDatabase();
        process.exit(0);
    }).catch((error: any) => {
        console.error('Error:', error);
        process.exit(1);
    });
}