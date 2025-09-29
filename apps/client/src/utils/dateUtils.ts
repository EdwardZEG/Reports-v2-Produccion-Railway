/**
 * Utilidades para el manejo correcto de fechas
 * Soluciona problemas de zona horaria y formato
 */

/**
 * Formatea una fecha UTC para mostrar correctamente sin desfase de zona horaria
 * @param dateString - String de fecha en formato ISO (desde la base de datos)
 * @param locale - Configuración regional (por defecto 'es-ES')
 * @returns Fecha formateada como string
 */
export const formatDateUTC = (dateString: string, locale: string = 'es-ES'): string => {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        return date.toLocaleDateString(locale, {
            timeZone: 'UTC',
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        });
    } catch (error) {
        console.error('Error formateando fecha:', error);
        return dateString;
    }
};

/**
 * Formatea un rango de fechas UTC
 * @param startDate - Fecha de inicio
 * @param endDate - Fecha de fin
 * @param locale - Configuración regional (por defecto 'es-ES')
 * @returns Rango de fechas formateado como string
 */
export const formatDateRangeUTC = (startDate: string, endDate: string, locale: string = 'es-ES'): string => {
    if (!startDate || !endDate) return '';

    const formattedStart = formatDateUTC(startDate, locale);
    const formattedEnd = formatDateUTC(endDate, locale);

    return `${formattedStart} - ${formattedEnd}`;
};

/**
 * Obtiene la fecha actual en formato UTC para inputs de tipo date
 * @returns Fecha en formato YYYY-MM-DD
 */
export const getCurrentDateForInput = (): string => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const day = String(now.getUTCDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
};

/**
 * Convierte una fecha de input (YYYY-MM-DD) a UTC para el backend
 * @param inputDate - Fecha desde un input tipo date
 * @returns Fecha en formato ISO UTC
 */
export const inputDateToUTC = (inputDate: string): string => {
    if (!inputDate) return '';

    // Crear fecha asumiendo UTC para evitar desfases de zona horaria
    const date = new Date(inputDate + 'T00:00:00.000Z');
    return date.toISOString();
};