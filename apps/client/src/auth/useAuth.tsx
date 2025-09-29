import { useEffect, useState } from 'react';

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
     * Solo valida la existencia de un token activo, no credenciales recordadas
     */
    const checkInitialAuth = () => {
      const token = localStorage.getItem('token');

      // Solo considerar autenticado si hay un token válido
      // Las credenciales recordadas NO significan autenticación automática
      const authStatus = !!token;

      setIsAuthenticated(authStatus);
      setIsLoading(false);
    };

    checkInitialAuth();
  }, []);

  return { isAuthenticated, setIsAuthenticated, isLoading };
};
