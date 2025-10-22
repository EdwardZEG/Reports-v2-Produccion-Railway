import axios from 'axios';
import { getToken } from '../src/auth/authService';

const api = axios.create({
  baseURL: import.meta.env.PROD ? '/api/' : 'http://localhost:4000/api/',
  withCredentials: true
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Interceptor para manejar respuestas y tokens expirados
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Si el error es 401 y el código es TOKEN_EXPIRED
    if (error.response?.status === 401 && error.response?.data?.code === 'TOKEN_EXPIRED') {
      console.log('🔴 Token expirado detectado en API - disparando evento para modal');

      // Disparar evento personalizado para que App.tsx muestre el modal Y ejecute limpieza automática
      const tokenExpiredEvent = new CustomEvent('tokenExpired', {
        detail: { source: 'api-interceptor' }
      });
      window.dispatchEvent(tokenExpiredEvent);
    }

    return Promise.reject(error);
  }
);

export default api;