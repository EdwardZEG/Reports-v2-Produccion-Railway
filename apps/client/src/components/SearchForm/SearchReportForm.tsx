// Componente principal para búsqueda y generación de reportes
import React, { useEffect, useState } from "react";
import "./SearchReportForm.css";
import api from "../../api";
import { toast } from "react-toastify";
import { getToken } from "../../auth/authService";
import { useData } from "../../context/DataContext";
import { getBaseApiUrl } from "../../utils/apiUrl";
import { jwtDecode } from "jwt-decode";
import { inputDateToStartOfDay, inputDateToEndOfDay } from "../../utils/dateUtils";

// Interface para dispositivos encontrados en la búsqueda
interface Device {
  _id: string;
  type: string;        // Tipo de dispositivo
  ubication: string;   // Ubicación del dispositivo
  identifier: string;  // Identificador único
  building: string;    // Edificio donde se encuentra
  level: string;       // Nivel/piso
  note: string;        // Notas del técnico
  images: string[];    // Array de URLs de imágenes
  createdAt?: string;  // Fecha de creación del reporte
  colaborador?: {      // Información del usuario que hizo el reporte
    _id: string;
    nombre: string;
    correo?: string;
    rol?: string;
  };
}

// Props del componente principal
interface SearchReportFormProps {
  onSearch: (devices: Device[]) => void;           // Callback cuando se encuentran dispositivos
  onReporteGenerado: (nombre: string, url: string) => void; // Callback cuando se genera reporte
  hasResults?: boolean;                            // Indica si hay resultados para mostrar modal
  disableWordGeneration?: boolean;                 // Deshabilitar generación de reportes Word
  onLoadingStart?: () => void;                     // Callback cuando inicia carga
  onLoadingEnd?: () => void;                       // Callback cuando termina carga
  onProgressUpdate?: (progress: number, message: string, timeRemaining?: number) => void; // Callback para actualizar progreso
  onShowMejorasModal?: () => void;                 // Callback para mostrar modal de mejoras
}

/**
 * Componente SearchReportForm: Formulario principal para búsqueda de dispositivos
 * Permite filtrar por póliza, especialidad y rango de fechas
 * Genera reportes automáticamente al encontrar dispositivos
 */
const SearchReportForm: React.FC<SearchReportFormProps> = ({
  onSearch,
  onReporteGenerado,
  hasResults = false,
  disableWordGeneration = false,
  onLoadingStart,
  onLoadingEnd,
  onProgressUpdate,
  onShowMejorasModal,
}) => {
  // Estados para los campos del formulario
  const [poliza, setPoliza] = useState("");           // ID de la póliza seleccionada
  const [especialidad, setEspecialidad] = useState(""); // ID de la especialidad seleccionada
  const [fechaInicio, setFechaInicio] = useState("");   // Fecha de inicio del período
  const [fechaFinal, setFechaFinal] = useState("");     // Fecha final del período

  // Estados para datos de la aplicación - Usando contexto optimizado
  const { colaboradores, loadColaboradoresIfNeeded, isColaboradoresLoading } = useData(); // Lista completa de colaboradores desde contexto

  // Estados para filtrado por rol del usuario
  const [colaboradoresFiltrados, setColaboradoresFiltrados] = useState<any[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const [userPolizaId, setUserPolizaId] = useState<string | null>(null);

  const [especialidadesFiltradas, setEspecialidadesFiltradas] = useState< // Especialidades disponibles para la póliza seleccionada
    { _id: string; nombre: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false); // Estado de carga

  // Cargar colaboradores si no están disponibles
  // 🛡️ PROTECCIÓN ANTI-LOOP: Solo ejecutar una vez al montar el componente
  useEffect(() => {
    console.log('🔍 SearchReportForm: Componente montado - Verificando colaboradores...');
    console.log('🔍 SearchReportForm: Estado inicial:', {
      colaboradoresLength: colaboradores.length,
      isColaboradoresLoading
    });

    // Solo cargar si realmente no hay colaboradores y no está cargando
    if (colaboradores.length === 0 && !isColaboradoresLoading) {
      console.log('🔄 SearchReportForm: Iniciando carga inicial de colaboradores...');
      loadColaboradoresIfNeeded();
    } else {
      console.log('⏭️ SearchReportForm: Saltando carga - colaboradores disponibles o cargando');
    }
  }, []); // 🔧 Array vacío para ejecutar solo una vez al montar

  // Efecto separado para logging cuando cambien los colaboradores
  useEffect(() => {
    console.log('📊 SearchReportForm: Colaboradores actualizados:', colaboradores.length);
  }, [colaboradores.length]);

  // useEffect para obtener información del usuario logueado (copiado de Polizas.tsx)
  useEffect(() => {
    const token = getToken();
    const role = localStorage.getItem('rol')?.toLowerCase() || "";

    setUserRole(role);

    if (token) {
      try {
        const decodedToken: any = jwtDecode(token);
        if (decodedToken?.polizaId) {
          setUserPolizaId(decodedToken.polizaId);
        }
      } catch (error) {
        console.error("Error decodificando token:", error);
      }
    }
  }, []);

  // useEffect para filtrar colaboradores según el rol (copiado de Polizas.tsx)
  useEffect(() => {
    let colaboradoresData = colaboradores;

    // Filtrar colaboradores para coordinadores y colaboradores: solo mostrar colaboradores de su póliza
    const isCoordinadorOColaborador = userRole === 'coordinador' || userRole === 'encargado' || userRole === 'auxiliar';
    if (isCoordinadorOColaborador && userPolizaId) {
      colaboradoresData = colaboradores.filter((colaborador: any) => {
        const colaboradorPolizaId = typeof colaborador.poliza === 'string'
          ? colaborador.poliza
          : colaborador.poliza?._id;
        return colaboradorPolizaId === userPolizaId;
      });
    }

    setColaboradoresFiltrados(colaboradoresData);
  }, [colaboradores, userRole, userPolizaId]);

  // Cambio: Efecto para filtrar especialidades dinámicamente según póliza seleccionada
  useEffect(() => {
    if (!poliza) {
      setEspecialidadesFiltradas([]);
      return;
    }

    // Cambio: Crear sets para evitar duplicados y optimizar rendimiento
    const especialidadesSet = new Set<string>();
    const especialidadesMap = new Map<string, string>();

    // Cambio: Filtrar colaboradores por póliza y extraer sus especialidades únicas
    colaboradoresFiltrados
      .filter((c) => c.poliza?._id === poliza)
      .forEach((c) => {
        c.especialidad.forEach((e: any) => {
          if (!especialidadesSet.has(e._id)) {
            especialidadesSet.add(e._id);
            especialidadesMap.set(e._id, e.nombre);
          }
        });
      });

    // Convertir a array para el select
    const listaEspecialidades = Array.from(especialidadesSet).map((id) => ({
      _id: id,
      nombre: especialidadesMap.get(id)!,
    }));

    setEspecialidadesFiltradas(listaEspecialidades);
    setEspecialidad(""); // Resetear especialidad seleccionada
  }, [poliza, colaboradoresFiltrados]);

  /**
   * Función para validar si existe plantilla para una especialidad
   * Previene que se inicie la generación si no hay plantilla disponible
   */
  const validarPlantillaEspecialidad = async (especialidadId: string): Promise<{ tienePrivileges: boolean; mensaje: string; especialidad: any }> => {
    try {
      const response = await fetch(`${getBaseApiUrl()}/reportes/validar-plantilla/${especialidadId}`, {
        headers: {
          'Authorization': `Bearer ${getToken()}`,
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error validando plantilla:', error);
      return {
        tienePrivileges: false,
        mensaje: 'Error al validar la plantilla. Inténtelo de nuevo.',
        especialidad: null
      };
    }
  };

  /**
   * Función auxiliar para generar reporte usando Server-Sent Events
   * Proporciona progreso en tiempo real durante la generación del documento Word
   */
  const generarReporteConProgreso = async (devices: Device[], especialidad: string, poliza: string, fechaInicio: string, fechaFinal: string) => {
    return new Promise<{ nombre: string; url: string }>((resolve, reject) => {
      // Crear nombre descriptivo del archivo antes de enviarlo al backend
      const colaboradorConPoliza = colaboradoresFiltrados.find(c => c.poliza?._id === poliza);
      const polizaSeleccionada = colaboradorConPoliza?.poliza?.nombre || "SinPoliza";
      const especialidadObj = especialidadesFiltradas.find(e => e._id === especialidad);
      const especialidadSeleccionada = especialidadObj?.nombre || "SinEspecialidad";
      const fechaIni = fechaInicio.replace(/-/g, '');
      const fechaFin = fechaFinal.replace(/-/g, '');
      const periodo = `${fechaIni}_${fechaFin}`;
      const polizaLimpia = polizaSeleccionada.replace(/[^a-zA-Z0-9]/g, '_');
      const especialidadLimpia = especialidadSeleccionada.replace(/[^a-zA-Z0-9]/g, '_');
      const nombreArchivo = `Reporte_${polizaLimpia}_${especialidadLimpia}_${periodo}.docx`;

      // Usar fetch con stream reader para recibir eventos SSE
      fetch(`${getBaseApiUrl()}/reportes/generar-con-progreso`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
          'Authorization': `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          idEspecialidad: especialidad,
          idDevices: devices.map((d) => d._id),
        }),
      })
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          const reader = response.body?.getReader();
          if (!reader) {
            throw new Error('No se pudo obtener el reader del stream');
          }

          let estimatedTime = 12; // Tiempo estimado inicial
          let startTime = Date.now();

          const readStream = async () => {
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = new TextDecoder().decode(value);
                const lines = chunk.split('\n');

                for (const line of lines) {
                  if (line.startsWith('event:')) {
                    // Ignorar líneas de tipo de evento
                    continue;
                  }

                  if (line.startsWith('data:')) {
                    try {
                      const data = JSON.parse(line.substring(5).trim());

                      if (data.progress !== undefined) {
                        // Calcular tiempo restante basado en progreso
                        const elapsed = (Date.now() - startTime) / 1000;
                        const progressRatio = data.progress / 100;
                        const estimatedTotal = progressRatio > 0 ? elapsed / progressRatio : estimatedTime;
                        const timeRemaining = Math.max(0, Math.ceil(estimatedTotal - elapsed));

                        // Notificar progreso al componente padre
                        onProgressUpdate?.(data.progress, data.message, timeRemaining);
                      }

                      // Manejar evento de completado
                      if (data.downloadUrl) {
                        // Usar URL de descarga del servidor (archivos temporales)
                        const apiUrl = import.meta.env.PROD ? '' : 'http://localhost:4000';
                        const fullDownloadUrl = `${apiUrl}${data.downloadUrl}`;
                        resolve({ nombre: nombreArchivo, url: fullDownloadUrl });
                        return;
                      }

                    } catch (e) {
                      console.warn('Error parsing SSE data:', e);
                    }
                  }
                }
              }
            } catch (error) {
              reject(error);
            }
          };

          readStream();
        })
        .catch(error => {
          console.error('Error en SSE stream:', error);
          reject(error);
        });
    });
  };

  /**
   * Función principal para manejar el envío del formulario
   * Busca dispositivos y genera reporte con progreso en tiempo real
   * Cambio: Implementada lógica completa de progreso real usando Server-Sent Events
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validación de campos requeridos antes de proceder con la búsqueda
    if (!poliza || !especialidad || !fechaInicio || !fechaFinal) {
      toast.warning("Complete todos los campos");
      return;
    }

    // Cambio: Activar estado de carga con comunicación al componente padre para UX mejorada
    setIsLoading(true);
    onLoadingStart?.(); // Notificar al componente padre

    try {
      // 1. Buscar colaboradores que coincidan con la especialidad y póliza seleccionadas
      const colaboradoresCoincidentes = colaboradores.filter(
        (c) =>
          c.poliza?._id === poliza &&
          c.especialidad.some((e) => e._id === especialidad)
      );

      if (colaboradoresCoincidentes.length === 0) {
        toast.info(
          "No se encontraron colaboradores para la especialidad seleccionada"
        );
        return;
      }

      // 2. Extraer IDs de colaboradores para la búsqueda de dispositivos
      const idsColaboradores = colaboradoresCoincidentes.map((c) => c._id);

      // 3. Buscar dispositivos usando los filtros seleccionados con fechas inteligentes
      const fechaInicioISO = inputDateToStartOfDay(fechaInicio); // 00:00:00 del día seleccionado
      const fechaFinalISO = inputDateToEndOfDay(fechaFinal); // Hasta la hora actual si es hoy, o 23:59:59 si es día pasado
      
      const res = await api.get<Device[]>("/devices", {
        params: {
          colaboradores: idsColaboradores.join(","),
          especialidad,
          fechaInicio: fechaInicioISO,
          fechaFinal: fechaFinalISO,
        },
      });
      const devices = res.data;

      if (devices.length === 0) {
        setIsLoading(false);
        onLoadingEnd?.(); // Notificar al componente padre
        toast.info("Nada que mostrar en este período");
        return;
      }

      // 4. NUEVA LÓGICA: Para sincronizar vista previa con Word
      if (!disableWordGeneration) {
        try {
          console.log('🚀 Frontend: Iniciando generación de reporte Word...');
          console.log('📱 Devices encontrados:', devices.length);
          console.log('📊 IDs de devices:', devices.map(d => d._id));
          console.log('🎯 Especialidad seleccionada:', especialidad);
          console.log('🏢 Póliza seleccionada:', poliza);
          console.log('📅 Período:', fechaInicio, 'a', fechaFinal);
          console.log('📅 Fechas ISO enviadas:', fechaInicioISO, 'a', fechaFinalISO);

          // Validar que existe plantilla antes de generar el reporte
          console.log('🔍 Validando plantilla para especialidad:', especialidad);
          const validacion = await validarPlantillaEspecialidad(especialidad);

          if (!validacion.tienePrivileges) {
            console.error('❌ No hay plantilla disponible:', validacion.mensaje);
            toast.error(validacion.mensaje);

            // Limpiar cualquier resultado anterior cuando no hay plantilla
            onSearch([]); // Limpiar los datos mostrados anteriormente
            onReporteGenerado("", ""); // Limpiar estado del reporte anterior
            setIsLoading(false);
            onLoadingEnd?.();
            return;
          }

          console.log('✅ Plantilla validada correctamente, procediendo con generación...');

          // Generar Word primero
          const { nombre, url } = await generarReporteConProgreso(devices, especialidad, poliza, fechaInicioISO, fechaFinalISO);

          console.log('✅ Frontend: Reporte Word generado exitosamente');
          console.log('📄 Nombre archivo:', nombre);
          console.log('🔗 URL descarga:', url);

          // Solo después de que el Word esté listo, mostrar dispositivos y reporte
          onSearch(devices);
          onReporteGenerado(nombre, url);

          // Terminar loading
          setIsLoading(false);
          onLoadingEnd?.();
        } catch (reportError) {
          console.error("❌ Frontend: Error generando reporte:", reportError);
          // Si falla el Word, aún mostrar los datos
          onSearch(devices);
          onReporteGenerado("", "");
          setIsLoading(false);
          onLoadingEnd?.();
          toast.error("Error generando reporte, pero los datos se mostraron correctamente");
        }
      } else {
        // Para colaboradores, mostrar datos inmediatamente sin Word
        onSearch(devices);
        onReporteGenerado("", "");
        setIsLoading(false);
        onLoadingEnd?.();
      }
    } catch (err: any) {
      // Cambio: Manejo robusto de errores con logging detallado y reseteo de estado
      console.error("Error en búsqueda de dispositivos:", err);
      toast.error("Error buscando dispositivos");
      onReporteGenerado("", ""); // Resetear estado del reporte
      // Terminar loading solo si no se terminó antes
      setIsLoading(false);
      onLoadingEnd?.(); // Notificar al componente padre
    }
  };

  return (
    <div>
      {/* Formulario principal de búsqueda */}
      <form className="search-form" onSubmit={handleSubmit}>
        {/* Cambio: Campo de selección de póliza con generación dinámica de opciones únicas */}
        <div className="search-form__field-group">
          <label className="search-form__label">Póliza</label>
          <select
            className="search-form__input"
            value={poliza}
            onChange={(e) => setPoliza(e.target.value)}
          >
            <option value="">Seleccione una póliza</option>
            {/* Generar opciones únicas de pólizas desde colaboradores */}
            {(() => {
              // Usar colaboradores ya filtrados por rol
              const colaboradoresConPoliza = colaboradoresFiltrados.filter((c) => c.poliza && c.poliza._id && c.poliza.nombre);

              // Crear un Map para evitar duplicados
              const polizasMap = new Map();
              colaboradoresConPoliza.forEach((c) => {
                if (c.poliza && c.poliza._id) {
                  polizasMap.set(c.poliza._id, {
                    _id: c.poliza._id,
                    nombre: c.poliza.nombre,
                    codigo: c.poliza.codigo || ''
                  });
                }
              });

              const polizasUnicas = Array.from(polizasMap.values());

              return polizasUnicas.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.nombre} {p.codigo ? `(${p.codigo})` : ''}
                </option>
              ));
            })()}
          </select>
        </div>

        {/* Cambio: Campo de especialidad dinámico - habilitado solo si hay póliza seleccionada */}
        <div className="search-form__field-group">
          <label className="search-form__label">Especialidad</label>
          <select
            className="search-form__input"
            value={especialidad}
            onChange={(e) => setEspecialidad(e.target.value)}
            disabled={!poliza}
          >
            <option value="">Seleccione una especialidad</option>
            {/* Mostrar especialidades filtradas por póliza */}
            {especialidadesFiltradas.map((esp) => (
              <option key={esp._id} value={esp._id}>
                {esp.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Campos de rango de fechas */}
        <div className="search-form__field-group">
          <label className="search-form__label">Período de reporte</label>
          <div className="search-form__dates">
            <input
              type="date"
              className="search-form__input"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              placeholder="Fecha inicio"
            />
            <span className="search-form__date-separator">a</span>
            <input
              type="date"
              className="search-form__input"
              value={fechaFinal}
              onChange={(e) => setFechaFinal(e.target.value)}
              placeholder="Fecha final"
            />
          </div>
        </div>

        {/* Botón de búsqueda principal */}
        <button
          type="submit"
          className="search-form__button"
          title={isLoading ? "Buscando..." : "Buscar reportes"}
          disabled={isLoading}
        >
          {/* Cambio: Icono dinámico que muestra estado de carga con animación */}
          <i className={isLoading ? "bi bi-arrow-clockwise loading-spin" : "bi bi-search"}></i>
        </button>

        {/* Cambio: Botón para modal de mejoras temporalmente deshabilitado */}
        <button
          type="button"
          className={`modal-toggle-button ${hasResults ? 'enabled' : ''}`}
          onClick={hasResults ? onShowMejorasModal : undefined}
          disabled={!hasResults}
          title={hasResults ? "Ver estadísticas (temporalmente deshabilitado)" : "Realizar búsqueda para ver estadísticas"}
        >
          <i className="bi bi-graph-up-arrow"></i>
        </button>
      </form>
    </div>
  );
};

export default React.memo(SearchReportForm);
