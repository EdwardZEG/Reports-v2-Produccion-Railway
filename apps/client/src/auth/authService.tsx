// Función de inicio de sesión - almacena token y datos del usuario
export const login = (token: string, user: any) => {
    localStorage.setItem('token', token);
    localStorage.setItem('nombre', JSON.stringify(user));
    localStorage.setItem('rol', user.rol);
    
  };
  
  // Función de cierre de sesión con limpieza automática de archivos temporales
  export const logout = async () => {
    try {
      // Sección: Limpieza de archivos temporales del usuario
      const token = getToken();
      if (token) {
        console.log('Iniciando limpieza de archivos temporales...');
        const response = await fetch('http://localhost:4000/api/reportes/limpiar-archivos-usuario', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        });
        
        // Verificación de respuesta de la API de limpieza
        if (response.ok) {
          const result = await response.json();
          console.log('Limpieza exitosa:', result);
        } else {
          console.error('Error en limpieza:', response.status, response.statusText);
        }
      }
    } catch (error) {
      console.error('Error limpiando archivos en logout:', error);
      // Continuar con logout aunque falle la limpieza
    }
    
    // Sección: Limpieza del localStorage y redirección
    localStorage.removeItem('auth');   
    localStorage.removeItem('token');
    localStorage.removeItem('nombre');
    localStorage.removeItem('rol');
    localStorage.removeItem('polizaId');
    window.location.href = '/login';
  };
  
  // Funciones auxiliares para manejo de autenticación
  export const getToken = () => localStorage.getItem('token');
  export const getRol = () => localStorage.getItem('rol');
  export const getPolizaId = () => localStorage.getItem('polizaId');
  export const isAuthenticated = () => !!getToken();