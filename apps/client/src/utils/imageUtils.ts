/**
 * Utilidades para manejo optimizado de imágenes
 */

/**
 * Comprime una imagen base64 para reducir su tamaño
 */
export const compressBase64Image = (base64: string, quality: number = 0.7): Promise<string> => {
    return new Promise((resolve) => {
        // Si no es una imagen base64 válida, retornar la original
        if (!base64 || !base64.includes('data:image/')) {
            resolve(base64);
            return;
        }

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (!ctx) {
                resolve(base64);
                return;
            }

            // Calcular nuevas dimensiones (máximo 800px)
            const maxWidth = 800;
            const maxHeight = 800;
            let { width, height } = img;

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width *= ratio;
                height *= ratio;
            }

            canvas.width = width;
            canvas.height = height;

            // Dibujar imagen comprimida
            ctx.drawImage(img, 0, 0, width, height);

            // Convertir a base64 con calidad reducida
            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedBase64);
        };

        img.onerror = () => {
            resolve(base64); // Si hay error, retornar original
        };

        img.src = base64;
    });
};

/**
 * Verifica si una imagen base64 es válida
 */
export const isValidBase64Image = (base64: string): boolean => {
    if (!base64 || typeof base64 !== 'string') {
        return false;
    }

    // Verificar que tenga el formato correcto
    if (!base64.includes('data:image/') || !base64.includes('base64,')) {
        return false;
    }

    // Verificar que tenga contenido después del header
    const base64Data = base64.split('base64,')[1];
    return !!(base64Data && base64Data.length > 0);
};

/**
 * Obtiene el tamaño aproximado de una imagen base64 en KB
 */
export const getBase64ImageSize = (base64: string): number => {
    if (!isValidBase64Image(base64)) {
        return 0;
    }

    const base64Data = base64.split('base64,')[1];
    const sizeInBytes = (base64Data.length * 3) / 4;
    return Math.round(sizeInBytes / 1024); // Convertir a KB
};

/**
 * Crea una imagen placeholder transparente pequeña
 */
export const createPlaceholderImage = (): string => {
    return 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
};