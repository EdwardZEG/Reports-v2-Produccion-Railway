import { compressBase64Image, isValidBase64Image, getBase64ImageSize } from './imageUtils';

/**
 * Optimiza un array de dispositivos comprimiendo sus imágenes para evitar errores 431
 */
export const optimizeDevicesForRequest = async (devices: any[]): Promise<any[]> => {
    console.log('🔧 Optimizando imágenes antes del envío...');

    const optimizedDevices = await Promise.all(
        devices.map(async (device) => {
            const optimizedDevice = { ...device };

            if (device.images && Array.isArray(device.images)) {
                optimizedDevice.images = await Promise.all(
                    device.images.map(async (img: any) => {
                        const optimizedImg = { ...img };

                        // Comprimir WorkEvidence
                        if (isValidBase64Image(img.WorkEvidence)) {
                            const originalSize = getBase64ImageSize(img.WorkEvidence);
                            optimizedImg.WorkEvidence = await compressBase64Image(img.WorkEvidence, 0.6);
                            const newSize = getBase64ImageSize(optimizedImg.WorkEvidence);
                            console.log(`📸 WorkEvidence comprimida: ${originalSize}KB → ${newSize}KB`);
                        }

                        // Comprimir DeviceEvidence
                        if (isValidBase64Image(img.DeviceEvidence)) {
                            const originalSize = getBase64ImageSize(img.DeviceEvidence);
                            optimizedImg.DeviceEvidence = await compressBase64Image(img.DeviceEvidence, 0.6);
                            const newSize = getBase64ImageSize(optimizedImg.DeviceEvidence);
                            console.log(`📸 DeviceEvidence comprimida: ${originalSize}KB → ${newSize}KB`);
                        }

                        // Comprimir ViewEvidence
                        if (isValidBase64Image(img.ViewEvidence)) {
                            const originalSize = getBase64ImageSize(img.ViewEvidence);
                            optimizedImg.ViewEvidence = await compressBase64Image(img.ViewEvidence, 0.6);
                            const newSize = getBase64ImageSize(optimizedImg.ViewEvidence);
                            console.log(`📸 ViewEvidence comprimida: ${originalSize}KB → ${newSize}KB`);
                        }

                        return optimizedImg;
                    })
                );
            }

            return optimizedDevice;
        })
    );

    console.log('✅ Optimización de imágenes completada');
    return optimizedDevices;
};

/**
 * Calcula el tamaño total de una petición con dispositivos
 */
export const calculateRequestSize = (data: any): number => {
    const jsonString = JSON.stringify(data);
    const sizeInBytes = new Blob([jsonString]).size;
    return Math.round(sizeInBytes / (1024 * 1024) * 100) / 100; // MB con 2 decimales
};

/**
 * Verifica si una petición puede causar error 431
 */
export const checkRequestSizeWarning = (data: any): boolean => {
    const sizeMB = calculateRequestSize(data);
    if (sizeMB > 10) {
        console.log(`⚠️ Petición grande detectada: ${sizeMB}MB - posible error 431`);
        return true;
    }
    return false;
};