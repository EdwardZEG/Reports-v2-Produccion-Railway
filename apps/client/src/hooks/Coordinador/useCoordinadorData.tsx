/**
 * Hook personalizado para gestionar operaciones CRUD de coordinadores
 * Incluye funcionalidad de resaltado y navegación automática
 * Integrado con sistema de notificaciones toast
 */
import { useEffect, useState, useRef } from "react";
import api from "../../api";
import { toast } from "react-toastify";

interface Poliza {
  _id: string;
  nombre: string;
}

interface Coordinador {
  _id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  correo: string;
  contraseña?: string;
  telefono?: string;
  estado?: string;
  poliza?: Poliza | string;
  resaltado?: boolean; // Para resaltar coordinador recién creado/editado igual que polizas
}

interface NuevoCoordinador {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  correo: string;
  contraseña: string;
  telefono: string;
  poliza: string;
  estado: string;
}

/**
 * Hook personalizado para operaciones CRUD de coordinadores
 * Proporciona estado reactivo y funciones para manejar coordinadores y pólizas
 * Incluye funcionalidad de resaltado temporal y navegación automática
 */
export const useCoordinadores = () => {
  const [coordinadores, setCoordinadores] = useState<Coordinador[]>([]);
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Ref para manejar timers de resaltado y evitar conflicts
  const timersResaltado = useRef<Map<string, number>>(new Map());

  /**
   * Obtener datos de coordinadores y pólizas desde el servidor
   * Soporte opcional para búsqueda mediante parámetro search
   */
  const fetchData = async (search = "") => {
    try {
      const query = search ? `?search=${encodeURIComponent(search)}` : "";
      const [resCoordinadores, resPolizas] = await Promise.all([
        api.get(`/coordinadores${query}`),
        api.get("/polizas")
      ]);
      setCoordinadores(resCoordinadores.data);
      setPolizas(resPolizas.data);
    } catch (error) {
      toast.error("Error al cargar los datos. Intente nuevamente.");
      setError("Error al cargar los datos. Intente nuevamente.");
    }
  };

  /**
   * Efecto para cargar datos inicialmente al montar el componente
   */
  useEffect(() => {
    fetchData();
  }, []);

  /**
   * Efecto para limpiar timers cuando el componente se desmonte
   */
  useEffect(() => {
    return () => {
      // Limpiar todos los timers al desmontar
      timersResaltado.current.forEach(timer => clearTimeout(timer));
      timersResaltado.current.clear();
    };
  }, []);

  /**
   * Crear nuevo coordinador con resaltado temporal y navegación automática
   * Igual funcionalidad que polizas para consistencia UX
   * @param nuevo - Datos del coordinador a crear
   * @returns Objeto con success, data y coordinadores actualizados para navegación
   */
  const crearCoordinador = async (nuevo: NuevoCoordinador) => {
    try {
      const response = await api.post("/coordinadores", nuevo);
      const nuevoCoordinador = { ...response.data, resaltado: true };
      const coordinadoresActualizados = [...coordinadores.map(c => ({ ...c, resaltado: false })), nuevoCoordinador];
      setCoordinadores(coordinadoresActualizados);

      // Quitar el resaltado después de 3 segundos con sistema de timers
      const nuevoTimer = setTimeout(() => {
        setCoordinadores(prev => prev.map(c =>
          c._id === nuevoCoordinador._id ? { ...c, resaltado: false } : c
        ));
        timersResaltado.current.delete(nuevoCoordinador._id);
      }, 3000);

      timersResaltado.current.set(nuevoCoordinador._id, nuevoTimer);

      // Toast message removed as requested
      return { success: true, data: nuevoCoordinador, coordinadores: coordinadoresActualizados };
    } catch (error: any) {
      const mensaje = error.response?.data?.message || "Error al crear el coordinador.";
      toast.error(mensaje);
      setError(mensaje);
      return { success: false };
    }
  };

  /**
   * Actualizar coordinador existente con resaltado temporal
   * Mantiene el coordinador editado visible y resaltado por 3 segundos
   * Incluye actualización optimista para evitar parpadeos en el UI
   * @param _id - ID del coordinador a actualizar
   * @param datos - Datos parciales a actualizar
   * @returns Objeto con success, coordinadorId y coordinadores actualizados para navegación
   */
  const actualizarCoordinador = async (_id: string, datos: Partial<NuevoCoordinador>) => {
    // Actualización optimista: actualizar UI inmediatamente
    const coordinadoresOptimistas = coordinadores.map(coor =>
      coor._id === _id ? { ...coor, ...datos } : coor
    );
    setCoordinadores(coordinadoresOptimistas);

    try {
      await api.put(`/coordinadores/${_id}`, datos);

      // Confirmar actualización con resaltado - USAR coordinadoresOptimistas en lugar de coordinadores original
      const coordinadoresActualizados = coordinadoresOptimistas.map(coor =>
        coor._id === _id ? { ...coor, ...datos, resaltado: true } : { ...coor, resaltado: false }
      );
      setCoordinadores(coordinadoresActualizados);

      // Limpiar timer anterior si existe
      const timerAnterior = timersResaltado.current.get(_id);
      if (timerAnterior) {
        clearTimeout(timerAnterior);
      }

      // Quitar el resaltado después de 3 segundos
      const nuevoTimer = setTimeout(() => {
        setCoordinadores(prev => prev.map(c =>
          c._id === _id ? { ...c, resaltado: false } : c
        ));
        timersResaltado.current.delete(_id);
      }, 3000);

      timersResaltado.current.set(_id, nuevoTimer);

      // Toast message removed as requested
      return { success: true, coordinadorId: _id, coordinadores: coordinadoresActualizados };
    } catch (error: any) {
      // En caso de error, revertir la actualización optimista usando el estado original
      const coordinadoresOriginales = coordinadores.map(coor => ({ ...coor, resaltado: false }));
      setCoordinadores(coordinadoresOriginales);
      toast.error(error.response?.data?.message || "Error al actualizar el coordinador.");
      return { success: false };
    }
  };

  /**
   * Eliminar coordinador del sistema con confirmación
   * Actualiza la lista local después de eliminación exitosa
   * @param _id - ID del coordinador a eliminar
   */
  const eliminarCoordinador = async (_id: string) => {
    try {
      await api.delete(`/coordinadores/${_id}`);
      setCoordinadores(prev => prev.filter(coor => coor._id !== _id));
      toast.success("Coordinador eliminado exitosamente.");
    } catch (error) {
      toast.error("Error al eliminar el coordinador.");
    }
  };

  /**
   * Obtener nombre de póliza por ID
   * Función utilitaria para mostrar nombres legibles en la interfaz
   * @param polizaId - ID de la póliza
   * @returns Nombre de la póliza o "Sin póliza"
   */
  const getPolizaNombre = (polizaId: string) => {
    const poliza = polizas.find(p => p._id === polizaId);
    return poliza ? poliza.nombre : "Sin póliza";
  };

  return {
    coordinadores,
    polizas,
    error,
    crearCoordinador,
    actualizarCoordinador,
    eliminarCoordinador,
    getPolizaNombre,
    setError,
    fetchData,
  };
};
