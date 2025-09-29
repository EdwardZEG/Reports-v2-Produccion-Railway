/**
 * @fileoverview Contexto DVD para el sistema de easter egg animado
 * Proporciona funcionalidad de fondo animado estilo DVD screensaver
 * con integración específica para vistas de formulario
 */

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import logoCircular from '../assets/logo_rwnet_circular.webp';

/**
 * Interfaz del contexto DVD
 * Define las propiedades y métodos disponibles en el contexto
 */
interface DVDContextType {
    /** Estado de activación de la animación DVD */
    isDVDActive: boolean;
    /** Indica si estamos en una vista de formulario (login/register) */
    isFormView: boolean;
    /** Función para alternar la animación DVD */
    toggleDVD: () => void;
    /** Función para establecer si estamos en vista de formulario */
    setFormView: (isForm: boolean) => void;
    /** Función para reiniciar completamente el contexto DVD */
    resetDVD: () => void;
}

const DVDContext = createContext<DVDContextType | undefined>(undefined);

/**
 * Hook personalizado para usar el contexto DVD
 * Proporciona una interfaz fácil para acceder a las funcionalidades DVD
 * 
 * @throws Error si se usa fuera de un DVDProvider
 * @returns Objeto con propiedades y métodos del contexto DVD
 */
export const useDVD = () => {
    const context = useContext(DVDContext);
    if (!context) {
        throw new Error('useDVD must be used within a DVDProvider');
    }
    return context;
};

/**
 * Proveedor del contexto DVD
 * Maneja el estado global de la animación DVD y el fondo de formularios
 * 
 * Funcionalidades principales:
 * - Control de activación/desactivación de la animación DVD
 * - Detección de vistas de formulario para mostrar fondo específico
 * - Animación física realista del logo que rebota en los bordes
 * - Posicionamiento aleatorio inicial para variabilidad
 * - Optimización de rendimiento con requestAnimationFrame
 * - Cleanup automático para prevenir memory leaks
 * 
 * Easter Egg: Al hacer clic en el logo en páginas de login/register,
 * se activa una animación tipo DVD screensaver con el logo de la empresa
 * 
 * @param children - Componentes hijos que tendrán acceso al contexto
 * @returns Proveedor de contexto con funcionalidades DVD
 */
export const DVDProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // Estados del contexto
    const [isDVDActive, setIsDVDActive] = useState(false);
    const [isFormView, setIsFormView] = useState(false);

    // Referencias para el control de la animación
    const dvdLogoRef = useRef<HTMLDivElement>(null);
    const animationIdRef = useRef<number | null>(null);
    const positionRef = useRef({ x: 100, y: 100, dx: 1, dy: 1 });

    /**
     * Alterna el estado de activación de la animación DVD
     * Funciona como easter egg cuando se hace clic en el logo
     */
    const toggleDVD = () => {
        setIsDVDActive(prev => !prev);
    };

    /**
     * Establece si la vista actual es un formulario
     * Controla la visibilidad del fondo rojo y la disponibilidad del easter egg
     * 
     * @param isForm - true si estamos en una vista de formulario
     */
    const setFormView = (isForm: boolean) => {
        setIsFormView(isForm);
    };

    /**
     * Reinicia completamente el contexto DVD
     * Desactiva la animación, limpia posiciones y reinicia estados
     * Útil para limpiar el estado al cerrar sesión
     */
    const resetDVD = () => {
        setIsDVDActive(false);
        setIsFormView(false);
        // Cancelar animación activa
        if (animationIdRef.current) {
            cancelAnimationFrame(animationIdRef.current);
            animationIdRef.current = null;
        }
        // Reiniciar posición para próxima activación
        positionRef.current = { x: 100, y: 100, dx: 1, dy: 1 };
    };

    /**
     * Efecto para manejar la animación DVD
     * Implementa la lógica de movimiento y rebote del logo
     */
    useEffect(() => {
        // Si la animación no está activa o no hay referencia al logo, detener
        if (!isDVDActive || !dvdLogoRef.current) {
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
            return;
        }

        const logo = dvdLogoRef.current;
        const logoSize = 144; // Tamaño del logo (aumentado 20% del tamaño base)

        // Inicializar posición aleatoria si es la primera vez
        if (positionRef.current.x === 100 && positionRef.current.y === 100) {
            positionRef.current.x = Math.random() * (window.innerWidth - logoSize);
            positionRef.current.y = Math.random() * (window.innerHeight - logoSize);
        }

        /**
         * Función de animación que se ejecuta en cada frame
         * Implementa física de rebote en los bordes de la pantalla
         */
        const animate = () => {
            const { x, y, dx, dy } = positionRef.current;

            // Calcular nueva posición
            let newX = x + dx;
            let newY = y + dy;
            let newDx = dx;
            let newDy = dy;

            // Detectar colisión con bordes horizontales y rebotar
            if (newX <= 0 || newX >= window.innerWidth - logoSize) {
                newDx = -newDx;
                newX = newX <= 0 ? 0 : window.innerWidth - logoSize;
            }

            // Detectar colisión con bordes verticales y rebotar
            if (newY <= 0 || newY >= window.innerHeight - logoSize) {
                newDy = -newDy;
                newY = newY <= 0 ? 0 : window.innerHeight - logoSize;
            }

            // Actualizar posición y dirección
            positionRef.current = { x: newX, y: newY, dx: newDx, dy: newDy };

            // Aplicar nueva posición al elemento DOM
            logo.style.left = newX + 'px';
            logo.style.top = newY + 'px';

            // Continuar animación si sigue activa
            if (isDVDActive) {
                animationIdRef.current = requestAnimationFrame(animate);
            }
        };

        // Iniciar animación
        animationIdRef.current = requestAnimationFrame(animate);

        // Cleanup: cancelar animación al desmontar o desactivar
        return () => {
            if (animationIdRef.current) {
                cancelAnimationFrame(animationIdRef.current);
            }
        };
    }, [isDVDActive]);

    return (
        <DVDContext.Provider value={{ isDVDActive, isFormView, toggleDVD, setFormView, resetDVD }}>
            {/* Fondo rojo corporativo - solo visible en vistas de formulario */}
            {isFormView && (
                <div
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        width: '100vw',
                        height: '100vh',
                        background: '#E9383B', // Color corporativo rojo sólido
                        zIndex: 1, // Por debajo del logo DVD y formulario
                        pointerEvents: 'none' // No interfiere con interacciones
                    }}
                />
            )}

            {/* Logo DVD animado - solo visible en formularios cuando está activo */}
            {isFormView && (
                <div
                    ref={dvdLogoRef}
                    style={{
                        position: 'fixed',
                        width: '144px',
                        height: '144px',
                        zIndex: 3, // Por encima del fondo (1) pero debajo del formulario (10)
                        pointerEvents: 'none', // No interfiere con interacciones
                        display: isDVDActive ? 'block' : 'none' // Solo visible cuando está activo
                    }}
                >
                    <img
                        src={logoCircular}
                        alt="DVD Logo"
                        style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain' // Mantiene proporciones del logo
                        }}
                    />
                </div>
            )}

            {children}
        </DVDContext.Provider>
    );
};
