import { useState, useEffect } from "react";
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

  /**
   * Función para marcar un colaborador como recién creado con resaltado temporal
   * Utilizada cuando se crea un colaborador desde el modal
   * @param nuevoEncargado - El colaborador recién creado
   * @returns Objeto con success y encargados actualizados para navegación
   */
  const marcarColaboradorCreado = (nuevoEncargado: Encargado) => {
    try {
      // Agregar el nuevo colaborador con resaltado y quitar resaltado de otros
      const encargadoConResaltado = { ...nuevoEncargado, resaltado: true };
      const encargadosActualizados = [...encargados.map(e => ({ ...e, resaltado: false })), encargadoConResaltado];
      setEncargados(encargadosActualizados);

      // Quitar el resaltado después de 3 segundos
      setTimeout(() => {
        const encargadosSinResaltar = encargadosActualizados.map(e => ({ ...e, resaltado: false }));
        setEncargados(encargadosSinResaltar);
      }, 3000);

      return { success: true, data: encargadoConResaltado, encargados: encargadosActualizados };
    } catch (err) {
      console.error("Error al marcar colaborador como creado:", err);
      return { success: false };
    }
  };

  const actualizarEncargado = async (encargado: Encargado) => {
    try {
      await api.put(`/colaboradores/${encargado._id}`, {
        ...encargado,
        poliza: encargado.poliza?._id || null,
        especialidad: encargado.especialidad?.map(e => e._id) || [],
      });

      // Actualizar con resaltado temporal igual que coordinadores
      const encargadosActualizados = encargados.map(e =>
        e._id === encargado._id ? { ...encargado, resaltado: true } : { ...e, resaltado: false }
      );
      setEncargados(encargadosActualizados);

      // Quitar el resaltado después de 3 segundos
      setTimeout(() => {
        const encargadosSinResaltar = encargadosActualizados.map(e => ({ ...e, resaltado: false }));
        setEncargados(encargadosSinResaltar);
      }, 3000);

      toast.success("Información de colaborador actualizada");
      return { success: true, encargadoId: encargado._id, encargados: encargadosActualizados };
    } catch (err: any) {
      console.error("Error al actualizar encargado:", err.response?.data || err);
      toast.error("Error al actualizar encargado");
      return { success: false };
    }
  };

  const eliminarEncargado = async (id: string) => {
    await api.delete(`/colaboradores/${id}`);
    setEncargados(prev => prev.filter(e => e._id !== id));
  };

  useEffect(() => {
    fetchEncargados();
  }, []);

  return {
    encargados,
    polizas,
    especialidades,
    fetchEncargados,
    fetchEncargadosParaColaborativo, // 🤝 Nueva función para trabajo colaborativo
    actualizarEncargado,
    eliminarEncargado,
    marcarColaboradorCreado, // Nueva función para resaltado
  };
};
