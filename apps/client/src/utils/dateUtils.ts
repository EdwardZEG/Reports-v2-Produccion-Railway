/**
 * Utilidades para el manejo correcto de fechas
 * Soluciona problemas de zona horaria y formato
 */

/**
 * Formatea una fecha para mostrar en la zona horaria local del usuario
 * @param dateString - String de fecha en formato ISO (desde la base de datos)
 * @param locale - Configuración regional (por defecto 'es-ES')
 * @returns Fecha formateada como string en zona horaria local
 */
export const formatDateUTC = (dateString: string, locale: string = 'es-ES'): string => {
    if (!dateString) return '';

    try {
        const date = new Date(dateString);
        // Cambiar para usar zona horaria local del usuario en lugar de UTC
        return date.toLocaleDateString(locale, {
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
 * Formatea un rango de fechas en zona horaria local
 * @param startDate - Fecha de inicio
 * @param endDate - Fecha de fin
 * @param locale - Configuración regional (por defecto 'es-ES')
 * @returns Rango de fechas formateado como string en zona horaria local
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
 * Convierte una fecha de input (YYYY-MM-DD) a formato ISO manteniendo la fecha exacta
 * @param inputDate - Fecha desde un input tipo date
 * @returns Fecha en formato ISO preservando el día seleccionado
 */
export const inputDateToUTC = (inputDate: string): string => {
    if (!inputDate) return '';

    // Crear fecha local y luego convertir a ISO manteniendo el día exacto
    const date = new Date(inputDate + 'T12:00:00'); // Usar mediodía para evitar problemas de zona horaria
    return date.toISOString();
};

/**
 * Convierte una fecha de inicio (YYYY-MM-DD) a timestamp de inicio del día (00:00:00)
 * @param inputDate - Fecha desde un input tipo date
 * @returns Fecha ISO desde las 00:00:00 del día seleccionado
 */
export const inputDateToStartOfDay = (inputDate: string): string => {
    if (!inputDate) return '';

    // Crear fecha al inicio del día (00:00:00)
    const date = new Date(inputDate + 'T00:00:00');
    return date.toISOString();
};

/**
 * Convierte una fecha de fin (YYYY-MM-DD) a timestamp inteligente:
 * - Si es hoy: hasta la hora actual
 * - Si es día pasado: hasta las 23:59:59
 * @param inputDate - Fecha desde un input tipo date
 * @returns Fecha ISO hasta la hora correspondiente
 */
export const inputDateToEndOfDay = (inputDate: string): string => {
    if (!inputDate) return '';

    const selectedDate = new Date(inputDate + 'T00:00:00');
    const today = new Date();
    
    // Comparar solo las fechas (sin tiempo)
    const selectedDateOnly = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    
    if (selectedDateOnly.getTime() === todayOnly.getTime()) {
        // Si es hoy, usar la hora actual
        return today.toISOString();
    } else {
        // Si es otro día, usar las 23:59:59
        const endDate = new Date(inputDate + 'T23:59:59');
        return endDate.toISOString();
    }
};