/**
 * @fileoverview Hook para detectar cuando los recursos críticos están listos
 * Previene FOUC (Flash of Unstyled Content) y mejora la experiencia de usuario
 * con transiciones suaves y naturales
 */

import { useState, useEffect } from 'react';

/**
 * Hook personalizado que detecta cuando los recursos críticos están listos para renderizar
 * 
 * Este hook es fundamental para prevenir el FOUC (Flash of Unstyled Content) y asegurar
 * que las páginas se muestren solo cuando todos los recursos necesarios están cargados.
 * 
 * Funcionalidades:
 * - Detecta cuando el DOM está completamente cargado
 * - Verifica que las fuentes web estén disponibles
 * - Proporciona un delay mínimo para transiciones suaves
 * - Compatibilidad con navegadores que no soportan document.fonts
 * - Cleanup automático de event listeners
 * 
 * Casos de uso:
 * - Páginas de autenticación (login, register)
 * - Cualquier página que requiera fuentes web específicas
 * - Componentes que necesiten aparecer con animaciones suaves
 * 
 * @returns boolean - true cuando los recursos están listos para mostrar el contenido
 * 
 * @example
 * ```tsx
 * const MyComponent = () => {
 *   const isResourcesReady = useResourcesReady();
 *   
 *   return (
 *     <div className={`container ${isResourcesReady ? 'ready' : ''}`}>
 *       Content here
 *     </div>
 *   );
 * };
 * ```
 */
export const useResourcesReady = () => {
    const [isReady, setIsReady] = useState(false);

    useEffect(() => {
        /**
         * Si el documento ya está completamente cargado,
         * activar inmediatamente con un delay mínimo para suavidad
         */
        if (document.readyState === 'complete') {
            // Delay corto para evitar flash pero mantener fluidez
            setTimeout(() => setIsReady(true), 50);
            return;
        }

        /**
         * Función para verificar si los recursos críticos están listos
         * Se enfoca principalmente en las fuentes web
         */
        const checkResourcesReady = () => {
            // Verificar que las fuentes web estén cargadas
            if (document.fonts && document.fonts.ready) {
                document.fonts.ready.then(() => {
                    // Delay mínimo para una transición de entrada suave
                    setTimeout(() => setIsReady(true), 100);
                });
            } else {
                // Fallback para navegadores legacy que no soportan document.fonts
                setTimeout(() => setIsReady(true), 100);
            }
        };

        /**
         * Escuchar el evento DOMContentLoaded si el documento aún está cargando
         * En caso contrario, verificar recursos inmediatamente
         */
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkResourcesReady);
        } else {
            checkResourcesReady();
        }

        /**
         * Cleanup: remover event listeners para prevenir memory leaks
         */
        return () => {
            document.removeEventListener('DOMContentLoaded', checkResourcesReady);
        };
    }, []); // Array de dependencias vacío - solo ejecutar una vez al montar

    return isReady;
};
