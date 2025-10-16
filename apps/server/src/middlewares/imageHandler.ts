import { Request, Response, NextFunction } from 'express';

/**
 * Middleware para manejar imágenes grandes y prevenir errores 431
 */
export const imageHandler = (req: Request, res: Response, next: NextFunction) => {
    // Log del tamaño de la petición
    const contentLength = req.headers['content-length'];
    if (contentLength) {
        const sizeMB = parseInt(contentLength) / (1024 * 1024);
        console.log(`📦 Tamaño de petición: ${sizeMB.toFixed(2)} MB`);

        if (sizeMB > 50) {
            console.log('⚠️ Petición grande detectada - posible causa de error 431');
        }
    }

    // Log de headers sospechosos
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.length > 2000) {
        console.log('⚠️ Header Authorization muy largo:', authHeader.length, 'caracteres');
    }

    // Configurar headers para manejar requests grandes
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Keep-Alive', 'timeout=300, max=1000');

    next();
};

/**
 * Middleware específico para rutas de generación de documentos
 */
export const documentHandler = (req: Request, res: Response, next: NextFunction) => {
    console.log('📄 === INICIO PROCESAMIENTO DOCUMENTO ===');
    console.log('🔍 URL:', req.url);
    console.log('🔍 Method:', req.method);

    // Log del body si contiene dispositivos
    if (req.body && req.body.idDevices) {
        console.log('🔍 Dispositivos solicitados:', req.body.idDevices.length);
    }

    // Configurar timeouts extendidos para generación de documentos
    req.setTimeout(300000); // 5 minutos
    res.setTimeout(300000); // 5 minutos

    next();
};