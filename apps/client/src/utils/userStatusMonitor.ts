/**
 * Monitor de estado del usuario para detectar usuarios inactivos
 * Funciona junto con el sistema de verificación de token expirado
 */

import { verificarEstadoUsuario } from './sessionCleanup';

let statusCheckInterval: number | null = null;

// Intervalos dinámicos para optimizar rendimiento
const QUICK_CHECK_INTERVAL = 5000; // 5 segundos para los primeros 2 minutos
const NORMAL_CHECK_INTERVAL = 15000; // 15 segundos después de 2 minutos
const SLOW_CHECK_INTERVAL = 30000; // 30 segundos después de 10 minutos

let sessionStartTime = Date.now();
let currentInterval = QUICK_CHECK_INTERVAL;

/**
 * Función auxiliar para verificar el estado del usuario
 */
const verificarEstado = async (onUserInactive: () => void, onError?: (error: string) => void) => {
    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('🔍 No hay token, saltando verificación de estado');
            return;
        }

        console.log('🔍 Verificando estado del usuario...');
        const { isActive, error } = await verificarEstadoUsuario();

        if (error === 'TOKEN_EXPIRED') {
            console.log('🔍 Token expirado durante verificación - será manejado por otro sistema');
            return;
        }

        if (error && error !== 'TOKEN_EXPIRED') {
            console.error('❌ Error verificando estado del usuario:', error);
            if (onError) {
                onError(error);
            }
            return;
        }

        if (!isActive) {
            console.log('🚫 Usuario inactivo detectado por monitoreo');
            onUserInactive();
            // Detener monitoreo después de detectar usuario inactivo
            detenerMonitoreoEstado();
            return false; // Usuario inactivo
        } else {
            console.log('✅ Usuario activo verificado por monitoreo');
            return true; // Usuario activo
        }

    } catch (error) {
        console.error('❌ Error en monitoreo de estado:', error);
        if (onError) {
            onError('MONITORING_ERROR');
        }
        return null; // Error
    }
};

/**
 * Obtiene el intervalo dinámico basado en el tiempo de sesión
 */
const obtenerIntervaloActual = (): number => {
    const tiempoSesion = Date.now() - sessionStartTime;
    const doMinutos = 2 * 60 * 1000; // 2 minutos
    const diezMinutos = 10 * 60 * 1000; // 10 minutos

    if (tiempoSesion < doMinutos) {
        return QUICK_CHECK_INTERVAL; // 5 segundos los primeros 2 minutos
    } else if (tiempoSesion < diezMinutos) {
        return NORMAL_CHECK_INTERVAL; // 15 segundos entre 2-10 minutos
    } else {
        return SLOW_CHECK_INTERVAL; // 30 segundos después de 10 minutos
    }
};

/**
 * Programa la siguiente verificación con intervalo dinámico
 */
const programarSiguienteVerificacion = (onUserInactive: () => void, onError?: (error: string) => void) => {
    const intervalo = obtenerIntervaloActual();

    if (intervalo !== currentInterval) {
        currentInterval = intervalo;
        console.log(`🔄 Cambiando intervalo de verificación a ${intervalo / 1000} segundos`);
    }

    statusCheckInterval = window.setTimeout(async () => {
        const resultado = await verificarEstado(onUserInactive, onError);

        // Si el usuario sigue activo, programar la siguiente verificación
        if (resultado === true) {
            programarSiguienteVerificacion(onUserInactive, onError);
        }
        // Si resultado es false (inactivo) o null (error), el monitoreo se detiene
    }, intervalo);
};

/**
 * Inicia el monitoreo del estado del usuario con intervalos dinámicos optimizados
 */
export const iniciarMonitoreoEstado = (
    onUserInactive: () => void,
    onError?: (error: string) => void
) => {
    // Evitar múltiples intervalos
    if (statusCheckInterval) {
        clearInterval(statusCheckInterval);
    }

    // Reiniciar tiempo de sesión
    sessionStartTime = Date.now();
    currentInterval = QUICK_CHECK_INTERVAL;

    console.log('⚡ Iniciando monitoreo optimizado de estado del usuario');
    console.log('⚡ Primera verificación: 0.5s, luego cada 5s (primeros 2 min), 15s (2-10 min), 30s (después 10 min)');

    // ⚡ VERIFICACIÓN INMEDIATA (0.5 segundos)
    setTimeout(async () => {
        console.log('⚡ Verificación inicial inmediata...');
        const resultado = await verificarEstado(onUserInactive, onError);

        // Solo continuar monitoreo si el usuario está activo
        if (resultado === true) {
            programarSiguienteVerificacion(onUserInactive, onError);
        }
    }, 500); // 0.5 segundos para detección ultra rápida
};

/**
 * Detiene el monitoreo del estado del usuario
 */
export const detenerMonitoreoEstado = () => {
    if (statusCheckInterval) {
        console.log('🛑 Deteniendo monitoreo de estado del usuario');
        clearTimeout(statusCheckInterval); // Cambiar a clearTimeout ya que ahora usa setTimeout
        statusCheckInterval = null;
    }
};

/**
 * Verifica si el monitoreo está activo
 */
export const estaMonitoreandoEstado = (): boolean => {
    return statusCheckInterval !== null;
};

/**
 * Verificación express inmediata (sin esperas)
 * Útil para verificaciones críticas al iniciar sesión
 */
export const verificacionExpress = async (
    onUserInactive: () => void,
    onError?: (error: string) => void
): Promise<boolean | null> => {
    console.log('⚡ Ejecutando verificación express del estado del usuario...');

    try {
        const token = localStorage.getItem('token');
        if (!token) {
            console.log('⚠️ No hay token para verificación express');
            return null;
        }

        const { isActive, error } = await verificarEstadoUsuario();

        if (error === 'TOKEN_EXPIRED') {
            console.log('🔴 Token expirado en verificación express');
            return null; // Será manejado por el sistema de token
        }

        if (error) {
            console.error('❌ Error en verificación express:', error);
            if (onError) {
                onError(error);
            }
            return null;
        }

        if (!isActive) {
            console.log('🚫 Usuario inactivo detectado en verificación express');
            onUserInactive();
            return false;
        }

        console.log('✅ Usuario activo confirmado en verificación express');
        return true;

    } catch (error) {
        console.error('❌ Error crítico en verificación express:', error);
        if (onError) {
            onError('EXPRESS_CHECK_ERROR');
        }
        return null;
    }
};