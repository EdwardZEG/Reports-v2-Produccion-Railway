import { useEffect, useState } from 'react';
import { isTokenExpired } from '../utils/tokenUtils';

/**
 * Hook personalizado para manejo de autenticación
 * Controla el estado de autenticación del usuario y la carga inicial
 */
export const useAuth = () => {
  // Estados de autenticación
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    /**
     * Verificar el estado de autenticación inicial
     * Valida la existencia Y validez del token
     */
    const checkInitialAuth = () => {
      const token = localStorage.getItem('token');

      if (token) {
        // Verificar si el token está expirado
        if (isTokenExpired(token)) {
          console.log('🔴 Token expirado detectado en useAuth - limpiando localStorage');
          // Token expirado, limpiar todo y marcar como no autenticado
          localStorage.removeItem('token');
          localStorage.removeItem('rol');
          localStorage.removeItem('nombre');
          setIsAuthenticated(false);
        } else {
          // Token válido
          console.log('🟢 Token válido detectado en useAuth');
          setIsAuthenticated(true);
        }
      } else {
        // No hay token
        setIsAuthenticated(false);
      }

      setIsLoading(false);
    };

    checkInitialAuth();
  }, []);

  return { isAuthenticated, setIsAuthenticated, isLoading };
};
