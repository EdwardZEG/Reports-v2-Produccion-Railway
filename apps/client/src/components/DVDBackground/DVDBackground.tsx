/**
 * @fileoverview Componente DVDBackground
 * Controla el estado del contexto DVD para habilitar el fondo animado en vistas de formulario
 */

import React, { useEffect } from 'react';
import { useDVD } from '../../context/DVDContext';

/**
 * Componente de control para el fondo DVD animado
 * 
 * Este componente no renderiza elementos visuales, sino que actúa como un controlador
 * que marca cuando una vista de formulario está activa, habilitando así el fondo rojo
 * y la capacidad de mostrar el logo DVD animado cuando el usuario hace clic en el logo.
 * 
 * Funcionalidades:
 * - Marca la vista actual como "formulario" en el contexto DVD
 * - Habilita el fondo rojo específico para páginas de autenticación
 * - Permite la activación del easter egg DVD al hacer clic en el logo
 * - Se limpia automáticamente cuando el componente se desmonta
 * 
 * Uso típico: Incluir en páginas de login y registro
 * 
 * @returns null - No renderiza elementos visuales
 */
const DVDBackground: React.FC = () => {
    const { setFormView } = useDVD();

    useEffect(() => {
        // Marcar que estamos en una vista de formulario al montar el componente
        setFormView(true);

        // Cleanup: marcar que ya no estamos en una vista de formulario al desmontar
        return () => {
            setFormView(false);
        };
    }, [setFormView]);

    // Este componente no renderiza nada, solo controla el estado del contexto
    return null;
};

export default DVDBackground;
