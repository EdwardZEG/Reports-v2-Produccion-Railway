import mongoose from 'mongoose';
import DeviceCatalog from '../models/DeviceCatalog';
import PeriodoMP from '../models/PeriodoMP';
import connectDB from '../config/db';
import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({ path: path.join(__dirname, '../../.env') });

/**
 * Script para reparar referencias rotas de deviceCatalog en PeriodoMP
 * Esto sucede cuando se borran dispositivos del catálogo pero los períodos siguen existiendo
 */
export const repairBrokenDeviceReferences = async () => {
    try {
        console.log('🔧 Iniciando reparación de referencias rotas...');

        await connectDB();

        // Buscar todos los períodos MP
        const periodos = await PeriodoMP.find({}).lean();
        console.log(`📋 Períodos MP encontrados: ${periodos.length}`);

        let periodosReparados = 0;
        let dispositivosReparados = 0;
        let dispositivosEliminados = 0;

        for (const periodo of periodos) {
            let periodoModificado = false;
            const dispositivosValidos = [];

            for (const dispositivo of periodo.dispositivos || []) {
                if (!dispositivo.deviceCatalog) {
                    console.log(`⚠️ Dispositivo sin deviceCatalog en período ${periodo._id}`);
                    dispositivosEliminados++;
                    periodoModificado = true;
                    continue; // Saltar este dispositivo
                }

                // Verificar si el dispositivo existe en el catálogo
                const existeEnCatalogo = await DeviceCatalog.findById(dispositivo.deviceCatalog);

                if (!existeEnCatalogo) {
                    console.log(`🗑️ Dispositivo ${dispositivo.deviceCatalog} no existe en catálogo, eliminando de período`);
                    dispositivosEliminados++;
                    periodoModificado = true;
                    continue; // Saltar este dispositivo
                }

                // El dispositivo es válido, mantenerlo
                dispositivosValidos.push(dispositivo);
            }

            // Si hubo cambios, actualizar el período
            if (periodoModificado) {
                await PeriodoMP.findByIdAndUpdate(
                    periodo._id,
                    { $set: { dispositivos: dispositivosValidos } }
                );

                periodosReparados++;
                dispositivosReparados += dispositivosValidos.length;

                console.log(`✅ Período "${periodo._id}" reparado:`);
                console.log(`   - Dispositivos válidos mantenidos: ${dispositivosValidos.length}`);
                console.log(`   - Dispositivos rotos eliminados: ${(periodo.dispositivos?.length || 0) - dispositivosValidos.length}`);
            }
        }

        console.log('\n🎉 Reparación completada:');
        console.log(`📊 Períodos reparados: ${periodosReparados}`);
        console.log(`🔧 Dispositivos válidos mantenidos: ${dispositivosReparados}`);
        console.log(`🗑️ Referencias rotas eliminadas: ${dispositivosEliminados}`);

        if (periodosReparados === 0) {
            console.log('✅ No se encontraron referencias rotas. Todo está en orden.');
        }

    } catch (error) {
        console.error('❌ Error en la reparación:', error);
        throw error;
    }
};

// Si ejecutas directamente este archivo
if (require.main === module) {
    repairBrokenDeviceReferences()
        .then(() => {
            console.log('✅ Script de reparación completado');
            process.exit(0);
        })
        .catch((error) => {
            console.error('❌ Error ejecutando script de reparación:', error);
            process.exit(1);
        });
}