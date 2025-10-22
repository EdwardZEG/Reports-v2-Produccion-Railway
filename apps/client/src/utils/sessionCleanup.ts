/**
 * Utilidades para limpieza automática de sesión
 * Incluye limpieza de archivos temporales cuando expira la sesión
 */

import { getBaseApiUrl } from './apiUrl';

/**
 * Función para limpiar archivos temporales del usuario durante sesión activa
 * Requiere token válido y autenticación
 */
export const limpiarArchivosTemporales = async (): Promise<boolean> => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('🔍 No hay token, saltando limpieza de archivos');
            return true; // No hay archivos que limpiar
        }

        console.log('🧹 Iniciando limpieza de archivos temporales (sesión activa)...');
        const response = await fetch(`${getBaseApiUrl()}/reportes/limpiar-archivos-usuario`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Limpieza de archivos exitosa:', result);
            return true;
        } else {
            console.error('❌ Error en limpieza de archivos:', response.status, response.statusText);

            // Si es error de autenticación, intentar con ruta de logout
            if (response.status === 401) {
                console.log('� Token expirado, intentando con ruta de logout...');
                return await limpiarArchivosLogout();
            }

            return false;
        }
    } catch (error) {
        console.error('❌ Error limpiando archivos temporales:', error);
        // En caso de error de red, intentar con ruta de logout como fallback
        return await limpiarArchivosLogout();
    }
};

/**
 * Función especial para limpiar archivos durante logout o sesión expirada
 * No requiere token válido, extrae userId del token expirado
 */
export const limpiarArchivosLogout = async (): Promise<boolean> => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('🔍 No hay token para limpieza de logout');
            return true; // No hay archivos que limpiar
        }

        console.log('🧹 Iniciando limpieza de archivos (logout/sesión expirada)...');
        const response = await fetch(`${getBaseApiUrl()}/reportes/limpiar-archivos-logout`, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`, // Se envía pero puede estar expirado
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Limpieza de archivos de logout exitosa:', result);
            return true;
        } else {
            console.error('❌ Error in limpieza de archivos de logout:', response.status, response.statusText);
            return false;
        }
    } catch (error) {
        console.error('❌ Error limpiando archivos de logout:', error);
        return false;
    }
};

/**
 * Función para limpiar localStorage de manera segura
 */
export const limpiarLocalStorage = () => {
    console.log('🧹 Limpiando localStorage...');
    localStorage.removeItem('auth');
    localStorage.removeItem('token');
    localStorage.removeItem('nombre');
    localStorage.removeItem('rol');
    localStorage.removeItem('polizaId');
};

/**
 * Función completa de limpieza de sesión
 * Incluye archivos temporales y localStorage
 */
export const limpiezaCompletaSesion = async (): Promise<void> => {
    console.log('🔄 Iniciando limpieza completa de sesión...');

    // 1. Intentar limpiar archivos temporales con fallback a logout
    const archivoLimpio = await limpiarArchivosLogout();

    // 2. Limpiar localStorage siempre (incluso si falla la limpieza de archivos)
    limpiarLocalStorage();

    // 3. Log del resultado
    if (archivoLimpio) {
        console.log('✅ Limpieza completa de sesión exitosa');
    } else {
        console.log('⚠️ Limpieza de sesión completada con advertencias (archivos no limpiados)');
    }
};

/**
 * Función para verificar si el usuario está activo en la base de datos
 * Retorna { isActive: boolean, error?: string }
 */
export const verificarEstadoUsuario = async (): Promise<{ isActive: boolean; error?: string }> => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            return { isActive: false, error: 'No token found' };
        }

        console.log('🔍 Verificando estado del usuario en la base de datos...');
        const response = await fetch(`${getBaseApiUrl()}/auth/verificar-estado`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.ok) {
            const result = await response.json();
            console.log('✅ Estado del usuario verificado:', result);
            return { isActive: result.isActive };
        } else if (response.status === 401) {
            // Token expirado - no es error de usuario inactivo
            return { isActive: false, error: 'TOKEN_EXPIRED' };
        } else {
            console.error('❌ Error verificando estado del usuario:', response.status, response.statusText);
            return { isActive: false, error: 'VERIFICATION_ERROR' };
        }
    } catch (error) {
        console.error('❌ Error en verificación de estado:', error);
        return { isActive: false, error: 'NETWORK_ERROR' };
    }
};

/**
 * Función para cerrar sesión con limpieza automática y redirección
 * Versión más robusta que maneja errores graciosamente
 */
export const cerrarSesionConLimpieza = async (): Promise<void> => {
    try {
        await limpiezaCompletaSesion();
    } catch (error) {
        console.error('Error en limpieza de sesión:', error);
        // Limpiar localStorage como fallback
        limpiarLocalStorage();
    } finally {
        // Siempre redirigir al login, sin importar si la limpieza falló
        console.log('🚪 Redirigiendo al login...');
        window.location.href = '/login';
    }
};