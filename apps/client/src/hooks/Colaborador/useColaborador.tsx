import { useState, useEffect, useRef } from "react";
import api from "../../api";
import { toast } from "react-toastify";

export interface PolizaShort {
  _id: string;
  nombre: string;
}

export interface EspecialidadShort {
  _id: string;
  nombre: string;
}

export interface Encargado {
  _id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  correo: string;
  telefono?: string;
  estado: string;
  poliza?: PolizaShort | null;
  especialidad: EspecialidadShort[] | null;
  ubicacion?: string;
  rol: string;
  resaltado?: boolean; // Para resaltar colaborador recién creado/editado igual que coordinadores
}

export const useEncargadosData = () => {
  const [encargados, setEncargados] = useState<Encargado[]>([]);
  const [polizas, setPolizas] = useState<PolizaShort[]>([]);
  const [especialidades, setEspecialidades] = useState<EspecialidadShort[]>([]);

  // Ref para manejar timers de resaltado y evitar conflicts - igual que coordinadores
  const timersResaltado = useRef<Map<string, number>>(new Map());

  const fetchEncargados = async () => {
    try {
      const [resEncargados, resPolizas, resEspecialidades] = await Promise.all([
        api.get("/colaboradores"),
        api.get("/polizas"),
        api.get("/especialidades"),
      ]);
      setEncargados(resEncargados.data);
      setPolizas(resPolizas.data);
      setEspecialidades(resEspecialidades.data);
    } catch (err) {
      toast.error("Error al cargar datos");
      console.error("Error al cargar datos", err);
    }
  };

  // 🤝 Nueva función específica para trabajo colaborativo
  const fetchEncargadosParaColaborativo = async () => {
    try {
      console.log('🤝 Obteniendo colaboradores para trabajo colaborativo...');
      const [resEncargados, resPolizas, resEspecialidades] = await Promise.all([
        api.get("/colaboradores/para-colaborativo"), // 🔒 Endpoint con filtrado estricto por póliza
        api.get("/polizas"),
        api.get("/especialidades"),
      ]);
      console.log('✅ Colaboradores para colaborativo obtenidos:', resEncargados.data.length);
      setEncargados(resEncargados.data);
      setPolizas(resPolizas.data);
      setEspecialidades(resEspecialidades.data);
    } catch (err) {
      toast.error("Error al cargar colaboradores para trabajo colaborativo");
      console.error("Error al cargar colaboradores para trabajo colaborativo", err);
    }
  };

  const marcarColaboradorCreado = async (nuevoEncargado: Encargado) => {
    try {
      // REFETCH COMPLETO: Obtener datos más recientes del servidor
      await fetchEncargados();

      // Aplicar resaltado al nuevo colaborador después del refetch
      setEncargados(prev => {
        const encargadosActualizados = prev.map(e =>
          e._id === nuevoEncargado._id ? { ...e, resaltado: true } : { ...e, resaltado: false }
        );
        return encargadosActualizados;
      });

      // Limpiar timer anterior si existe
      const timerAnterior = timersResaltado.current.get(nuevoEncargado._id);
      if (timerAnterior) {
        clearTimeout(timerAnterior);
      }

      // Quitar el resaltado después de 3 segundos con sistema de timers
      const nuevoTimer = setTimeout(() => {
        setEncargados(prev => prev.map(e =>
          e._id === nuevoEncargado._id ? { ...e, resaltado: false } : e
        ));
        timersResaltado.current.delete(nuevoEncargado._id);
      }, 3000);

      timersResaltado.current.set(nuevoEncargado._id, nuevoTimer);

      return { success: true, data: nuevoEncargado, encargados: encargados };
    } catch (err) {
      console.error("Error al marcar colaborador como creado:", err);
      return { success: false };
    }
  };

  const actualizarEncargado = async (encargado: Encargado) => {
    // ACTUALIZACIÓN OPTIMISTA: actualizar UI inmediatamente para evitar parpadeos
    const encargadosOptimistas = encargados.map(e =>
      e._id === encargado._id ? { ...encargado } : e
    );
    setEncargados(encargadosOptimistas);

    try {
      await api.put(`/colaboradores/${encargado._id}`, {
        ...encargado,
        poliza: encargado.poliza?._id || null,
        especialidad: encargado.especialidad?.map(e => e._id) || [],
      });

      // REFETCH COMPLETO: Obtener datos actualizados del servidor para sincronización completa
      await fetchEncargados();

      // Aplicar resaltado al colaborador actualizado después del refetch
      setEncargados(prev => prev.map(e =>
        e._id === encargado._id ? { ...e, resaltado: true } : { ...e, resaltado: false }
      ));

      // Limpiar timer anterior si existe
      const timerAnterior = timersResaltado.current.get(encargado._id);
      if (timerAnterior) {
        clearTimeout(timerAnterior);
      }

      // Quitar el resaltado después de 3 segundos con sistema de timers
      const nuevoTimer = setTimeout(() => {
        setEncargados(prev => prev.map(e =>
          e._id === encargado._id ? { ...e, resaltado: false } : e
        ));
        timersResaltado.current.delete(encargado._id);
      }, 3000);

      timersResaltado.current.set(encargado._id, nuevoTimer);

      toast.success("Información de colaborador actualizada");

      // Devolver los datos actualizados del estado para el componente
      return { success: true, encargadoId: encargado._id, encargados: encargados };
    } catch (err: any) {
      // En caso de error, hacer refetch para obtener el estado real del servidor
      await fetchEncargados();
      console.error("Error al actualizar encargado:", err.response?.data || err);
      toast.error("Error al actualizar encargado");
      return { success: false };
    }
  };

  const eliminarEncargado = async (id: string) => {
    try {
      await api.delete(`/colaboradores/${id}`);
      // REFETCH COMPLETO: Obtener datos actualizados después de eliminar
      await fetchEncargados();
      toast.success("Colaborador eliminado exitosamente");
    } catch (err) {
      console.error("Error al eliminar encargado:", err);
      toast.error("Error al eliminar colaborador");
      // Refetch en caso de error para mantener sincronización
      await fetchEncargados();
    }
  };

  useEffect(() => {
    fetchEncargados();
  }, []);

  /**
   * Efecto para limpiar timers cuando el componente se desmonte
   * Previene memory leaks y timers huérfanos
   */
  useEffect(() => {
    return () => {
      // Limpiar todos los timers al desmontar
      timersResaltado.current.forEach(timer => clearTimeout(timer));
      timersResaltado.current.clear();
    };
  }, []);

  /**
   * Función utilitaria para mostrar nombres legibles en la interfaz
   * @param polizaId - ID de la póliza
   * @returns Nombre de la póliza o "Sin póliza"
   */
  const getPolizaNombre = (polizaId: string) => {
    const poliza = polizas.find(p => p._id === polizaId);
    return poliza ? poliza.nombre : "Sin póliza";
  };

  return {
    encargados,
    polizas,
    especialidades,
    fetchEncargados,
    fetchEncargadosParaColaborativo, // 🤝 Nueva función para trabajo colaborativo
    actualizarEncargado,
    eliminarEncargado,
    marcarColaboradorCreado, // Nueva función para resaltado
    getPolizaNombre,
  };
};
