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
      // Verificar si el token ha expirado antes de hacer la llamada API
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('🔴 useColaborador: No hay token, no cargando datos');
        return;
      }

      // Importar dinámicamente para evitar problemas de circular imports
      const { isTokenExpired } = await import('../../utils/tokenUtils');
      if (isTokenExpired(token)) {
        console.log('🔴 useColaborador: Token expirado, no cargando datos');
        return;
      }

      const [resEncargados, resPolizas, resEspecialidades] = await Promise.all([
        api.get("/colaboradores"),
        api.get("/polizas"),
        api.get("/especialidades"),
      ]);
      setEncargados(resEncargados.data);
      setPolizas(resPolizas.data);
      setEspecialidades(resEspecialidades.data);
    } catch (err) {
      // Suprimir toast si el token ha expirado
      const token = localStorage.getItem('token');
      if (token) {
        const { isTokenExpired } = await import('../../utils/tokenUtils');
        if (!isTokenExpired(token)) {
          toast.error("Error al cargar datos");
          console.error("Error al cargar datos", err);
        }
      }
    }
  };

  // 🤝 Nueva función específica para trabajo colaborativo
  const fetchEncargadosParaColaborativo = async () => {
    try {
      // Verificar si el token ha expirado antes de hacer la llamada API
      const token = localStorage.getItem('token');
      if (!token) {
        console.log('🔴 useColaborador (colaborativo): No hay token, no cargando datos');
        return;
      }

      // Importar dinámicamente para evitar problemas de circular imports
      const { isTokenExpired } = await import('../../utils/tokenUtils');
      if (isTokenExpired(token)) {
        console.log('🔴 useColaborador (colaborativo): Token expirado, no cargando datos');
        return;
      }

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
      // Suprimir toast si el token ha expirado
      const token = localStorage.getItem('token');
      if (token) {
        const { isTokenExpired } = await import('../../utils/tokenUtils');
        if (!isTokenExpired(token)) {
          toast.error("Error al cargar colaboradores para trabajo colaborativo");
          console.error("Error al cargar colaboradores para trabajo colaborativo", err);
        }
      }
    }
  };

  /**
   * Crear nuevo colaborador con resaltado temporal
   * Mantiene el colaborador creado visible y resaltado por 3 segundos
   * Incluye refetch automático para sincronizar con el servidor
   * @param datos - Datos del nuevo colaborador
   * @returns Objeto con success, data y encargados actualizados para navegación
   */
  const crearColaborador = async (datos: any) => {
    console.log('🔄 Hook crearColaborador - Iniciando:', {
      datosRecibidos: datos,
      polizaValue: datos.poliza,
      polizaType: typeof datos.poliza,
      polizaIsNull: datos.poliza === null,
      polizaIsEmpty: datos.poliza === '',
      polizaIsUndefined: datos.poliza === undefined
    });

    try {
      console.log('📤 Hook crearColaborador - Enviando al API:', {
        url: '/colaboradores',
        datos: datos
      });

      const response = await api.post('/colaboradores', datos);
      console.log('✅ Hook crearColaborador - Respuesta exitosa:', response.data);

      // ENFOQUE DIRECTO: Agregar inmediatamente el nuevo colaborador al estado
      // Para evitar problemas de sincronización cuando la lista está vacía
      const nuevoColaborador = { ...response.data, resaltado: true };

      console.log('🎯 Estado actual antes de agregar:', encargados.length, 'elementos');

      setEncargados(prev => {
        console.log('🔄 setEncargados - Estado anterior:', prev.length, 'encargados');
        // Verificar si el colaborador ya existe (por si el refetch fue exitoso)
        const existeYa = prev.some(e => e._id === response.data._id);
        if (existeYa) {
          console.log('👤 Colaborador ya existe en lista, solo aplicando resaltado');
          const nuevoEstado = prev.map(e =>
            e._id === response.data._id ? { ...e, resaltado: true } : { ...e, resaltado: false }
          );
          console.log('🔄 setEncargados - Estado nuevo (existía):', nuevoEstado.length, 'encargados');
          return nuevoEstado;
        } else {
          console.log('➕ Agregando nuevo colaborador a lista vacía/incompleta');
          const nuevoEstado = [...prev.map(e => ({ ...e, resaltado: false })), nuevoColaborador];
          console.log('🔄 setEncargados - Estado nuevo (agregado):', nuevoEstado.length, 'encargados');
          return nuevoEstado;
        }
      });

      // Hacer refetch en background para sincronizar con servidor
      // pero no dependemos de él para mostrar el elemento
      fetchEncargados().catch(error => {
        console.error('⚠️ Error en refetch background:', error);
      });

      // Limpiar timer anterior si existe
      const timerAnterior = timersResaltado.current.get(response.data._id);
      if (timerAnterior) {
        clearTimeout(timerAnterior);
      }

      // Quitar el resaltado después de 3 segundos
      const nuevoTimer = setTimeout(() => {
        setEncargados(prev => prev.map(e =>
          e._id === response.data._id ? { ...e, resaltado: false } : e
        ));
        timersResaltado.current.delete(response.data._id);
      }, 3000);

      timersResaltado.current.set(response.data._id, nuevoTimer);

      toast.success("Colaborador creado exitosamente");
      return { success: true, data: response.data, encargados: encargados };
    } catch (error: any) {
      const mensaje = error.response?.data?.message || "Error al crear el colaborador.";
      toast.error(mensaje);
      console.error('❌ Hook crearColaborador - Error:', error);
      // Refetch en caso de error para mantener sincronización
      await fetchEncargados();
      return { success: false };
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
    crearColaborador, // Nueva función para crear colaboradores con resaltado
    actualizarEncargado,
    eliminarEncargado,
    marcarColaboradorCreado, // Nueva función para resaltado
    getPolizaNombre,
  };
};
