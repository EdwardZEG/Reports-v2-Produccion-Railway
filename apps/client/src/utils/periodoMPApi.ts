/**
 * Utilidades para gestionar períodos MP
 * Incluye funciones para eliminación segura de períodos
 */

interface EliminarPeriodoResponse {
    success: boolean;
    message: string;
    reportCount?: number;
    reportesEliminados?: number;
}

/**
 * Elimina un período MP verificando si hay reportes asociados
 * @param periodoId - ID del período a eliminar
 * @returns Promise con resultado de la operación
 */
export const eliminarPeriodoMP = async (periodoId: string): Promise<EliminarPeriodoResponse> => {
    const token = localStorage.getItem('token');

    const response = await fetch(`http://localhost:4000/api/periodos-mp/${periodoId}`, {
        method: 'DELETE',
        headers: {
            Authorization: token ? `Bearer ${token}` : '',
        },
    });

    return await response.json();
};

/**
 * Fuerza la eliminación de un período MP junto con todos sus reportes asociados
 * ⚠️ CUIDADO: Esta operación elimina permanentemente todos los reportes asociados
 * @param periodoId - ID del período a eliminar
 * @returns Promise con resultado de la operación
 */
export const forzarEliminacionPeriodoMP = async (periodoId: string): Promise<EliminarPeriodoResponse> => {
    const token = localStorage.getItem('token');

    const response = await fetch(`http://localhost:4000/api/periodos-mp/${periodoId}/force`, {
        method: 'DELETE',
        headers: {
            Authorization: token ? `Bearer ${token}` : '',
        },
    });

    return await response.json();
};

/**
 * Ejemplo de uso completo para eliminación de períodos
 * @param periodoId - ID del período
 * @param periodoNombre - Nombre del período para mostrar en confirmaciones
 * @param onSuccess - Callback cuando la eliminación es exitosa
 * @param onError - Callback cuando hay un error
 */
export const manejarEliminacionPeriodo = async (
    periodoId: string,
    periodoNombre: string,
    onSuccess: (message: string) => void,
    onError: (message: string) => void
) => {
    try {
        // Confirmación inicial
        const confirmacion = window.confirm(
            `¿Estás seguro de que deseas eliminar el período "${periodoNombre}"?\n\nSi hay reportes asociados, la eliminación fallará.`
        );

        if (!confirmacion) return;

        // Intentar eliminación normal
        const resultado = await eliminarPeriodoMP(periodoId);

        if (resultado.success) {
            onSuccess('Período eliminado exitosamente');
        } else if (resultado.reportCount && resultado.reportCount > 0) {
            // Hay reportes asociados, preguntar si forzar eliminación
            const respuestaForzar = window.confirm(
                `No se puede eliminar el período porque tiene ${resultado.reportCount} reporte(s) asociado(s).\n\n¿Deseas forzar la eliminación? ESTO ELIMINARÁ TODOS LOS REPORTES ASOCIADOS DE FORMA PERMANENTE.`
            );

            if (respuestaForzar) {
                const resultadoForzado = await forzarEliminacionPeriodoMP(periodoId);

                if (resultadoForzado.success) {
                    onSuccess(`Período "${periodoNombre}" y ${resultadoForzado.reportesEliminados} reporte(s) eliminados exitosamente`);
                } else {
                    onError(resultadoForzado.message || 'Error forzando eliminación');
                }
            }
        } else {
            onError(resultado.message || 'Error eliminando período');
        }
    } catch (error) {
        console.error('Error eliminando período:', error);
        onError('Error de conexión al eliminar período');
    }
};