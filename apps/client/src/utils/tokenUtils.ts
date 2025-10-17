import { jwtDecode } from 'jwt-decode';

interface DecodedToken {
    userId: string;
    rol: string;
    polizaId?: string;
    exp: number;
    iat: number;
}

/**
 * Verifica si un token JWT está expirado
 * @param token - El token JWT a verificar
 * @returns true si está expirado, false si aún es válido
 */
export const isTokenExpired = (token: string): boolean => {
    try {
        const decoded: DecodedToken = jwtDecode(token);
        const now = Date.now() / 1000; // Convertir a segundos
        return decoded.exp < now;
    } catch (error) {
        console.error('Error verificando token:', error);
        return true; // Si hay error, considerar como expirado por seguridad
    }
};

/**
 * Obtiene información del token sin verificar expiración
 * @param token - El token JWT a decodificar
 * @returns Información del token o null si hay error
 */
export const getTokenInfo = (token: string): DecodedToken | null => {
    try {
        return jwtDecode(token);
    } catch (error) {
        console.error('Error decodificando token:', error);
        return null;
    }
};

/**
 * Calcula cuánto tiempo queda antes de que expire el token
 * @param token - El token JWT a verificar
 * @returns Tiempo restante en milisegundos, o 0 si está expirado
 */
export const getTimeUntilExpiration = (token: string): number => {
    try {
        const decoded: DecodedToken = jwtDecode(token);
        const now = Date.now() / 1000;
        const timeLeft = (decoded.exp - now) * 1000; // Convertir a milisegundos
        return Math.max(0, timeLeft);
    } catch (error) {
        console.error('Error calculando tiempo de expiración:', error);
        return 0;
    }
};

/**
 * Formatea el tiempo restante del token en un string legible
 * @param token - El token JWT a verificar
 * @returns String formateado con el tiempo restante
 */
export const formatTimeUntilExpiration = (token: string): string => {
    const timeLeft = getTimeUntilExpiration(token);

    if (timeLeft <= 0) {
        return 'Expirado';
    }

    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
        return `${days} día(s) y ${hours} hora(s)`;
    } else if (hours > 0) {
        return `${hours} hora(s) y ${minutes} minuto(s)`;
    } else {
        return `${minutes} minuto(s)`;
    }
};

/**
 * Verifica si se deben suprimir alerts/toasts debido a token expirado
 * Útil para evitar alerts cuando el token ya expiró
 * @returns true si se deben suprimir alerts, false si se pueden mostrar
 */
export const shouldSuppressAlerts = (): boolean => {
    const token = localStorage.getItem('token');
    if (!token) return false;

    return isTokenExpired(token);
};