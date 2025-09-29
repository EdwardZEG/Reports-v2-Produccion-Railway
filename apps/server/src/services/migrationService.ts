import mongoose from 'mongoose';
import Device from '../models/Device';
import DeviceImages from '../models/DeviceImages';
import DeviceCatalog from '../models/DeviceCatalog';
import DeviceReport from '../models/DeviceReport';

interface MigrationResult {
  catalogCreated: number;
  reportsCreated: number;
  errors: string[];
  duplicatesFound: number;
}

/**
 * Script de migración para convertir la estructura antigua (Device + DeviceImages)
 * a la nueva estructura (DeviceCatalog + DeviceReport)
 */
export async function migrateToNewStructure(): Promise<MigrationResult> {
  const result: MigrationResult = {
    catalogCreated: 0,
    reportsCreated: 0,
    errors: [],
    duplicatesFound: 0
  };

  try {
    console.log('🚀 Iniciando migración de estructura de dispositivos...');

    // PASO 1: Crear DeviceCatalog con dispositivos únicos
    console.log('📋 Paso 1: Creando catálogo de dispositivos únicos...');

    const devices = await Device.find({}).lean();
    const uniqueDevices = new Map<string, any>();

    // Crear clave única para cada dispositivo
    for (const device of devices) {
      const key = `${device.type}-${device.ubication}-${device.identifier}`;

      if (!uniqueDevices.has(key)) {
        uniqueDevices.set(key, {
          type: device.type,
          ubication: device.ubication,
          identifier: device.identifier,
          building: device.building,
          level: device.level,
          active: true
        });
      } else {
        result.duplicatesFound++;
      }
    }

    // Insertar dispositivos únicos en DeviceCatalog
    const catalogDevices = Array.from(uniqueDevices.values());

    for (const catalogDevice of catalogDevices) {
      try {
        await DeviceCatalog.create(catalogDevice);
        result.catalogCreated++;
      } catch (error: any) {
        if (error.code === 11000) {
          // Duplicado - ignorar
          result.duplicatesFound++;
        } else {
          result.errors.push(`Error creando catálogo: ${error.message}`);
        }
      }
    }

    console.log(`✅ Catálogo creado: ${result.catalogCreated} dispositivos únicos`);
    console.log(`⚠️ Duplicados encontrados: ${result.duplicatesFound}`);

    // PASO 2: Migrar DeviceImages a DeviceReport
    console.log('📸 Paso 2: Migrando reportes de imágenes...');

    const deviceImages = await DeviceImages.find({})
      .populate('IdDevice');

    for (const imageDoc of deviceImages) {
      try {
        const device = imageDoc.IdDevice as any;

        if (!device) {
          result.errors.push(`Imagen sin dispositivo asociado: ${imageDoc._id}`);
          continue;
        }

        // Buscar el dispositivo en el catálogo
        const catalogDevice = await DeviceCatalog.findOne({
          type: device.type,
          ubication: device.ubication,
          identifier: device.identifier
        });

        if (!catalogDevice) {
          result.errors.push(`No se encontró dispositivo en catálogo para: ${device.identifier}`);
          continue;
        }

        // Crear DeviceReport
        await DeviceReport.create({
          deviceCatalog: catalogDevice._id,
          colaborador: device.colaborador,
          especialidad: device.especialidad,
          fechaReporte: (imageDoc as any).createdAt || new Date(),
          WorkEvidence: imageDoc.WorkEvidence,
          DeviceEvidence: imageDoc.DeviceEvidence,
          ViewEvidence: imageDoc.ViewEvidence,
          manualUploadReason: imageDoc.manualUploadReason,
          note: device.note,
          estado: 'completado', // Las imágenes existentes se consideran completadas
          asignado: false,
          completado: true,
          fechaCompletado: (imageDoc as any).createdAt || new Date()
        });

        result.reportsCreated++;

      } catch (error: any) {
        result.errors.push(`Error migrando reporte: ${error.message}`);
      }
    }

    console.log(`✅ Reportes migrados: ${result.reportsCreated}`);

    // PASO 3: Verificar integridad
    console.log('🔍 Paso 3: Verificando integridad de datos...');

    const catalogCount = await DeviceCatalog.countDocuments();
    const reportCount = await DeviceReport.countDocuments();
    const originalDeviceCount = await Device.countDocuments();
    const originalImageCount = await DeviceImages.countDocuments();

    console.log('\n📊 RESUMEN DE MIGRACIÓN:');
    console.log(`Original Devices: ${originalDeviceCount}`);
    console.log(`Original DeviceImages: ${originalImageCount}`);
    console.log(`Nuevo DeviceCatalog: ${catalogCount}`);
    console.log(`Nuevo DeviceReport: ${reportCount}`);
    console.log(`Duplicados encontrados: ${result.duplicatesFound}`);
    console.log(`Errores: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ ERRORES ENCONTRADOS:');
      result.errors.forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
    }

    console.log('\n✅ Migración completada');

  } catch (error: any) {
    result.errors.push(`Error general en migración: ${error.message}`);
    console.error('❌ Error en migración:', error);
  }

  return result;
}

/**
 * Función para revertir la migración (solo para pruebas)
 */
export async function rollbackMigration(): Promise<void> {
  console.log('⚠️ Revirtiendo migración...');

  try {
    await DeviceCatalog.deleteMany({});
    await DeviceReport.deleteMany({});
    console.log('✅ Migración revertida');
  } catch (error) {
    console.error('❌ Error revirtiendo migración:', error);
    throw error;
  }
}

/**
 * Función para validar que la migración fue exitosa
 */
export async function validateMigration(): Promise<boolean> {
  try {
    console.log('🔍 Validando migración...');

    // Verificar que hay datos en las nuevas tablas
    const catalogCount = await DeviceCatalog.countDocuments();
    const reportCount = await DeviceReport.countDocuments();

    if (catalogCount === 0 || reportCount === 0) {
      console.log('❌ Validación fallida: No hay datos en las nuevas tablas');
      return false;
    }

    // Verificar que todos los reportes tienen dispositivo asociado
    const reportsWithoutDevice = await DeviceReport.countDocuments({
      deviceCatalog: { $exists: false }
    });

    if (reportsWithoutDevice > 0) {
      console.log(`❌ Validación fallida: ${reportsWithoutDevice} reportes sin dispositivo`);
      return false;
    }

    // Verificar que todos los reportes tienen colaborador y especialidad
    const reportsWithoutColaborador = await DeviceReport.countDocuments({
      $or: [
        { colaborador: { $exists: false } },
        { especialidad: { $exists: false } }
      ]
    });

    if (reportsWithoutColaborador > 0) {
      console.log(`❌ Validación fallida: ${reportsWithoutColaborador} reportes sin colaborador/especialidad`);
      return false;
    }

    console.log('✅ Validación exitosa');
    return true;

  } catch (error) {
    console.error('❌ Error en validación:', error);
    return false;
  }
}