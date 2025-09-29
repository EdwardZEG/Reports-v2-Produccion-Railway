// Componente principal para búsqueda y generación de reportes
import React, { useEffect, useState } from "react";
import "./SearchReportForm.css";
import api from "../../api";
import { toast } from "react-toastify";
import { getToken } from "../../auth/authService";
import { useData } from "../../context/DataContext";

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
  onShowModal?: () => void;                        // Callback para mostrar modal de resultados
  hasResults?: boolean;                            // Indica si hay resultados para mostrar modal
  onLoadingStart?: () => void;                     // Callback cuando inicia carga
  onLoadingEnd?: () => void;                       // Callback cuando termina carga
  onProgressUpdate?: (progress: number, message: string, timeRemaining?: number) => void; // Callback para actualizar progreso
}

/**
 * Componente SearchReportForm: Formulario principal para búsqueda de dispositivos
 * Permite filtrar por póliza, especialidad y rango de fechas
 * Genera reportes automáticamente al encontrar dispositivos
 */
const SearchReportForm: React.FC<SearchReportFormProps> = ({
  onSearch,
  onReporteGenerado,
  onShowModal,
  hasResults = false,
  onLoadingStart,
  onLoadingEnd,
  onProgressUpdate,
}) => {
  // Estados para los campos del formulario
  const [poliza, setPoliza] = useState("");           // ID de la póliza seleccionada
  const [especialidad, setEspecialidad] = useState(""); // ID de la especialidad seleccionada
  const [fechaInicio, setFechaInicio] = useState("");   // Fecha de inicio del período
  const [fechaFinal, setFechaFinal] = useState("");     // Fecha final del período

  // Estados para datos de la aplicación - Usando contexto optimizado
  const { colaboradores, loadColaboradoresIfNeeded } = useData(); // Lista completa de colaboradores desde contexto
  const [especialidadesFiltradas, setEspecialidadesFiltradas] = useState< // Especialidades disponibles para la póliza seleccionada
    { _id: string; nombre: string }[]
  >([]);
  const [isLoading, setIsLoading] = useState(false); // Estado de carga

  // Cargar colaboradores si no están disponibles
  useEffect(() => {
    if (colaboradores.length === 0) {
      loadColaboradoresIfNeeded();
    }
  }, [colaboradores.length, loadColaboradoresIfNeeded]);

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
    colaboradores
      .filter((c) => c.poliza?._id === poliza)
      .forEach((c) => {
        c.especialidad.forEach((e) => {
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
  }, [poliza, colaboradores]);

  /**
   * Función auxiliar para generar reporte usando Server-Sent Events
   * Proporciona progreso en tiempo real durante la generación del documento Word
   */
  const generarReporteConProgreso = async (devices: Device[], especialidad: string, poliza: string, fechaInicio: string, fechaFinal: string) => {
    return new Promise<{ nombre: string; url: string }>((resolve, reject) => {
      // Crear nombre descriptivo del archivo antes de enviarlo al backend
      const colaboradorConPoliza = colaboradores.find(c => c.poliza?._id === poliza);
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
      fetch('http://localhost:4000/api/reportes/generar-con-progreso', {
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
                        const fullDownloadUrl = `http://localhost:4000${data.downloadUrl}`;
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

      // 3. Buscar dispositivos usando los filtros seleccionados
      const res = await api.get<Device[]>("/devices", {
        params: {
          colaboradores: idsColaboradores.join(","),
          especialidad,
          fechaInicio,
          fechaFinal,
        },
      });
      const devices = res.data;

      // 4. Notificar al componente padre sobre los dispositivos encontrados
      onSearch(devices);

      if (devices.length === 0) {
        toast.info("No hay dispositivos para generar reporte");
        return;
      }

      // 5. Generar reporte con progreso en tiempo real usando Server-Sent Events
      const { nombre, url } = await generarReporteConProgreso(devices, especialidad, poliza, fechaInicio, fechaFinal);

      // 6. Notificar al componente padre sobre el reporte generado
      onReporteGenerado(nombre, url);
    } catch (err: any) {
      // Cambio: Manejo robusto de errores con logging detallado y reseteo de estado
      console.error("Error en generación:", err);
      toast.error("Error buscando dispositivos o generando reporte");
      onReporteGenerado("", ""); // Resetear estado del reporte
    } finally {
      // Cambio: Garantizar que el estado de carga se desactive siempre, incluso en errores
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
              // Filtrar colaboradores que tienen póliza
              const colaboradoresConPoliza = colaboradores.filter((c) => c.poliza && c.poliza._id && c.poliza.nombre);

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
          title={isLoading ? "Buscando..." : "Buscar dispositivos"}
          disabled={isLoading}
        >
          {/* Cambio: Icono dinámico que muestra estado de carga con animación */}
          <i className={isLoading ? "bi bi-arrow-clockwise loading-spin" : "bi bi-search"}></i>
        </button>

        {/* Cambio: Botón para modal de resultados con estado condicional habilitado/deshabilitado */}
        <button
          type="button"
          className={`modal-toggle-button ${hasResults ? 'enabled' : ''}`}
          onClick={hasResults ? onShowModal : undefined}
          disabled={!hasResults}
          title={hasResults ? "Ver resultados detallados" : "Realizar búsqueda para ver resultados"}
        >
          <i className="bi bi-graph-up-arrow"></i>
        </button>
      </form>
    </div>
  );
};

export default React.memo(SearchReportForm);
