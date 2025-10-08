import "../styles/Especialidad.css";
import { useEffect, useState } from "react";
import axios, { AxiosResponse } from "axios";
import api from "../api";
import { toast } from "react-toastify";
import PreviewEspecialidad from "../components/PreviewEspecialidad/PreviewEspecialidad"; // Importa nuevo componente de cards

// Interfaces mantienen compatibilidad con backend existente
interface Especialidad {
  _id: string;
  nombre: string;
  descripcion: string;
  poliza?: string[] | string | Poliza[] | Poliza;
  resaltado?: boolean;
  reporte?: string | Reporte;
}

interface Poliza {
  _id: string;
  nombre: string;
}

interface Reporte {
  _id: string;
}

const Especialidades = () => {
  // Estados originales del componente
  const [especialidades, setEspecialidades] = useState<Especialidad[]>([]);
  // Nuevos estados para funcionalidad de búsqueda
  const [especialidadesFiltradas, setEspecialidadesFiltradas] = useState<Especialidad[]>([]);
  const [terminoBusqueda, setTerminoBusqueda] = useState("");
  // Estados existentes mantienen funcionalidad CRUD
  const [mostrarModal, setMostrarModal] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<{ [key: string]: string }>({});

  // Estados para modal de confirmación de eliminar
  const [showModalEliminar, setShowModalEliminar] = useState(false);
  const [especialidadAEliminar, setEspecialidadAEliminar] = useState<Especialidad | null>(null);

  // Estados para el carrusel de polizas
  const [carruselIndex, setCarruselIndex] = useState(0);
  const POLIZAS_POR_PAGINA = 1; // Mostrar 1 poliza a la vez

  const [formData, setFormData] = useState({
    nombre: "",
    descripcion: "",
    poliza: [] as string[],
  });
  const [archivo, setArchivo] = useState<File | null>(null);
  const [archivoActual, setArchivoActual] = useState<string | null>(null);

  useEffect(() => {
    const obtenerDatos = async () => {
      try {
        const [resPolizas, resEspecialidades] = await Promise.all([
          api.get("/polizas"),
          api.get("/especialidades"),
        ]);
        setPolizas(resPolizas.data);
        setEspecialidades(resEspecialidades.data);
        setEspecialidadesFiltradas(resEspecialidades.data); // Inicializar filtradas para búsqueda
      } catch (err) {
        console.error("Error al obtener datos:", err);
        setError("Error al cargar los datos. Intente nuevamente.");
        toast.error("Error al cargar los datos. Intente nuevamente.");
      }
    };
    obtenerDatos();
  }, []);

  // useEffect para filtrar especialidades cuando cambia el término de búsqueda
  // Sistema de búsqueda avanzada con múltiples criterios
  // ===== FUNCIONES PARA BÚSQUEDA INTELIGENTE =====

  // Función para normalizar texto - elimina acentos, convierte a minúsculas
  const normalizarTexto = (texto: string): string => {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
      .replace(/[^\w\s]/g, ' ') // Reemplaza caracteres especiales por espacios
      .replace(/\s+/g, ' ') // Normaliza espacios múltiples
      .trim();
  };

  // Función para calcular distancia de Levenshtein (tolerancia a errores ortográficos)
  const calcularDistanciaLevenshtein = (a: string, b: string): number => {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;

    const matriz = Array(a.length + 1).fill(null).map(() => Array(b.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) matriz[i][0] = i;
    for (let j = 0; j <= b.length; j++) matriz[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const costo = a[i - 1] === b[j - 1] ? 0 : 1;
        matriz[i][j] = Math.min(
          matriz[i - 1][j] + 1,     // eliminación
          matriz[i][j - 1] + 1,     // inserción
          matriz[i - 1][j - 1] + costo // sustitución
        );
      }
    }
    return matriz[a.length][b.length];
  };

  // Función para verificar si hay coincidencia difusa (tolerante a errores)
  const coincidenciaDifusa = (busqueda: string, texto: string, tolerancia: number = 2): boolean => {
    const busquedaNorm = normalizarTexto(busqueda);
    const textoNorm = normalizarTexto(texto);

    // Coincidencia exacta después de normalización
    if (textoNorm.includes(busquedaNorm)) return true;

    // Solo aplicar distancia de Levenshtein para palabras de 4+ caracteres
    if (busquedaNorm.length < 4) return false;

    // Buscar coincidencias difusas en palabras del texto
    const palabrasTexto = textoNorm.split(' ');
    return palabrasTexto.some(palabra => {
      if (palabra.length < 3) return false;
      const distancia = calcularDistanciaLevenshtein(busquedaNorm, palabra);
      const porcentajeTolerancia = Math.max(1, Math.floor(palabra.length * 0.3)); // 30% de tolerancia
      return distancia <= Math.min(tolerancia, porcentajeTolerancia);
    });
  };

  // Efecto para filtrar especialidades con búsqueda inteligente mejorada
  useEffect(() => {
    if (!terminoBusqueda.trim()) {
      // Sin término de búsqueda - mostrar todas
      setEspecialidadesFiltradas(especialidades);
    } else {
      const filtradas = especialidades.filter((esp) => {
        const terminoOriginal = terminoBusqueda.trim();
        const terminoNormalizado = normalizarTexto(terminoOriginal);

        // Crear contenido completo searchable de la card
        const contenidoCompleto = [
          esp.nombre,
          esp.descripcion,
          getPolizasNombres(esp.poliza), // Nombres de pólizas
          esp.reporte ? 'plantilla cargada activo disponible reporte' : 'sin plantilla inactivo no disponible vacio', // Estado
          // Términos adicionales inteligentes basados en contenido
          esp.nombre.toLowerCase().includes('mantenimiento') ? 'reparar arreglar mantener herramientas servicio tecnico' : '',
          esp.nombre.toLowerCase().includes('software') ? 'programar código aplicación sistema app programa' : '',
          esp.nombre.toLowerCase().includes('red') ? 'internet conectividad wifi ethernet network conexion' : '',
          esp.nombre.toLowerCase().includes('seguridad') ? 'proteger firewall antivirus proteccion security' : '',
          esp.nombre.toLowerCase().includes('soporte') ? 'ayuda asistencia support help helpdesk mesa' : '',
          esp.nombre.toLowerCase().includes('desarrollo') ? 'crear programar build construir development dev' : '',
        ].join(' ');

        const contenidoNormalizado = normalizarTexto(contenidoCompleto);

        // 1. Búsqueda exacta normalizada (sin acentos, case-insensitive)
        if (contenidoNormalizado.includes(terminoNormalizado)) return true;

        // 2. Búsqueda por palabras individuales (para términos con espacios)
        const palabrasBusqueda = terminoNormalizado.split(' ').filter(palabra => palabra.length > 2);
        if (palabrasBusqueda.length > 1) {
          const todasCoinciden = palabrasBusqueda.every(palabra =>
            contenidoNormalizado.includes(palabra) ||
            coincidenciaDifusa(palabra, contenidoCompleto, 1)
          );
          if (todasCoinciden) return true;
        }

        // 3. Búsqueda difusa (tolerante a errores ortográficos)
        if (terminoNormalizado.length >= 4) {
          if (coincidenciaDifusa(terminoOriginal, esp.nombre, 2)) return true;
          if (coincidenciaDifusa(terminoOriginal, esp.descripcion, 2)) return true;
        }

        // 4. Búsqueda parcial flexible (subcadenas de 3+ caracteres)
        if (terminoNormalizado.length >= 3) {
          const palabrasContenido = contenidoNormalizado.split(' ');
          return palabrasContenido.some(palabra =>
            palabra.includes(terminoNormalizado) ||
            (palabra.length >= 4 && terminoNormalizado.includes(palabra))
          );
        }

        return false;
      });
      setEspecialidadesFiltradas(filtradas);
    }
  }, [terminoBusqueda, especialidades]); // Dependencias: se ejecuta cuando cambia búsqueda o datos

  // Función para obtener nombres de pólizas (reutilizada del componente PreviewEspecialidad)
  // Maneja diferentes formatos de datos de pólizas para compatibilidad
  const getPolizasNombres = (especialidadPoliza: any) => {
    if (Array.isArray(especialidadPoliza)) {
      // Array de pólizas - mapear nombres
      return especialidadPoliza.map((p: any) =>
        typeof p === "object" ? p.nombre : polizas.find(x => x._id === p)?.nombre
      ).join(", ");
    } else if (typeof especialidadPoliza === "object" && especialidadPoliza !== null) {
      // Objeto póliza único
      return especialidadPoliza.nombre;
    } else if (typeof especialidadPoliza === "string") {
      // ID de póliza como string
      return polizas.find(p => p._id === especialidadPoliza)?.nombre || "No asignada";
    }
    return "No asignada";
  };

  // Función para manejar cambios en el input de búsqueda
  // Actualiza el término de búsqueda y dispara filtrado automático
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTerminoBusqueda(e.target.value);
  };

  // Función para manejar clic en el botón de búsqueda
  // La búsqueda ya se actualiza automáticamente con el useEffect
  const handleSearchClick = () => {
    // Esta función puede usarse para acciones adicionales si es necesario
    console.log("Buscando:", terminoBusqueda);
  };

  // Función para limpiar la búsqueda
  // Restaura vista completa de especialidades
  const limpiarBusqueda = () => {
    setTerminoBusqueda("");
  };

  // Función para manejar cambios en campos del formulario
  // Gestiona tanto campos de texto como checkboxes de pólizas
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, checked } = e.target;

    if (name === "poliza") {
      // Manejo especial para checkboxes de pólizas - permite selección múltiple
      setFormData((prev) => ({
        ...prev,
        poliza: checked
          ? [...prev.poliza, value] // Agregar póliza si se marca
          : prev.poliza.filter((id) => id !== value), // Remover póliza si se desmarca
      }));
    } else {
      // Campos de texto normales
      setFormData({ ...formData, [name]: value });
    }
  };

  // Función para manejar cambios en el archivo de plantilla
  // Valida que se seleccione un archivo y lo almacena en estado
  const handleArchivoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setArchivo(e.target.files[0]); // Almacenar archivo seleccionado
    } else {
      setArchivo(null); // Limpiar si no hay archivo
    }
  };

  // Función principal para manejar envío del formulario
  // Incluye validación, creación/edición de especialidad y subida de plantillas
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones de campos con regex - permitiendo caracteres especiales comunes en descripciones
    const nuevosErrores: { [key: string]: string } = {};
    const textoBasico = /^[\w\sáéíóúÁÉÍÓÚñÑ-]+$/; // Para nombres - solo letras, números, espacios y guiones
    const textoDescriptivo = /^[\w\sáéíóúÁÉÍÓÚñÑ.,;:()\-\/&%$#@!¿?¡+*="']+$/; // Para descripciones - permite puntuación común

    if (!formData.nombre.trim()) {
      nuevosErrores.nombre = "Este campo es obligatorio";
    } else if (!textoBasico.test(formData.nombre.trim())) {
      nuevosErrores.nombre = "No se permiten símbolos especiales en el nombre";
    }

    if (!formData.descripcion.trim()) {
      nuevosErrores.descripcion = "Este campo es obligatorio";
    } else if (!textoDescriptivo.test(formData.descripcion.trim())) {
      nuevosErrores.descripcion = "Solo se permiten caracteres alfanuméricos y puntuación básica";
    }

    // Mostrar errores si existen
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) {
      toast.warn("Corrige los campos marcados.");
      return;
    }

    try {
      let especialidadRes: AxiosResponse<any, any>;
      // Preparar datos para envío al backend
      const payloadEsp = {
        nombre: formData.nombre.trim(),
        descripcion: formData.descripcion.trim(),
        poliza: formData.poliza,
      };

      // Determinar si es edición o creación
      if (modoEdicion && idEditando) {
        // Actualizar especialidad existente
        especialidadRes = await api.put(`/especialidades/${idEditando}`, payloadEsp);
      } else {
        // Crear nueva especialidad
        especialidadRes = await api.post("/especialidades", payloadEsp);
      }

      const espId = especialidadRes.data._id;

      // Manejar subida de archivo de plantilla si existe
      if (archivo) {
        const form = new FormData();
        form.append("archivo", archivo);
        form.append("idEspecialidad", espId);
        form.append("name", `${formData.nombre.trim()}-plantilla`);

        // Subir plantilla al servidor
        const resReporte = await api.post("/reportes", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        const reporteId = resReporte.data._id;

        // Vincular plantilla con especialidad
        await api.put(`/especialidades/${espId}`, { reporte: reporteId });
      }

      // Obtener datos actualizados de la especialidad 
      let nuevaEspData = especialidadRes.data;
      try {
        const fullRes = await api.get(`/especialidades/${espId}`);
        nuevaEspData = fullRes.data;
      } catch {
        console.warn("No se pudo obtener especialidad actualizada.");
      }

      // Actualizar estado local de manera eficiente
      if (modoEdicion && idEditando) {
        // Reemplazar especialidad editada
        const especialidadesActualizadas = especialidades.map(e => (e._id === espId ? nuevaEspData : e));
        setEspecialidades(especialidadesActualizadas);
      } else {
        // Agregar nueva especialidad
        const especialidadesActualizadas = [...especialidades, nuevaEspData];
        setEspecialidades(especialidadesActualizadas);
      }
      // Las filtradas se actualizarán automáticamente por el useEffect del término de búsqueda

      // Limpiar formulario y cerrar modal
      setMostrarModal(false);
      setModoEdicion(false);
      setIdEditando(null);
      setFormData({ nombre: "", descripcion: "", poliza: [] });
      setArchivo(null);
      setArchivoActual(null);
      setErrores({});
      toast.success("Especialidad guardada exitosamente.");
    } catch (err: any) {
      // Manejo de errores específicos del servidor
      if (axios.isAxiosError(err)) {
        if (err.response?.status === 409) {
          // Error 409: Conflicto - especialidad duplicada
          setErrores({ nombre: "Ya existe una especialidad con ese nombre." });
          toast.error("Ya existe una especialidad con ese nombre.");
          return;
        } else if (err.response?.data?.message) {
          // Error con mensaje específico del servidor
          toast.error(err.response.data.message);
        } else {
          // Error genérico de Axios
          toast.error("Error al guardar la especialidad.");
        }
      } else {
        // Error no relacionado con Axios
        toast.error("Error inesperado.");
      }
    }
  };

  // Función para manejar edición de especialidad existente
  // Prellenar formulario con datos actuales y configurar modo edición
  const handleEditar = (esp: Especialidad) => {
    let polizaIds: string[] = [];

    // Normalizar formato de pólizas para compatibilidad con formulario
    if (Array.isArray(esp.poliza)) {
      polizaIds = esp.poliza.map(p => typeof p === "object" ? p._id : p);
    } else if (typeof esp.poliza === "object" && esp.poliza !== null) {
      polizaIds = [esp.poliza._id];
    } else if (typeof esp.poliza === "string") {
      polizaIds = [esp.poliza];
    }

    // Prellenar formulario con datos existentes
    setFormData({
      nombre: esp.nombre,
      descripcion: esp.descripcion,
      poliza: polizaIds,
    });

    // Configurar modo edición
    setIdEditando(esp._id);
    setModoEdicion(true);
    setMostrarModal(true);
    setArchivo(null);
    setArchivoActual(esp.reporte ? "Archivo cargado" : null); // Mostrar estado de plantilla
  };

  // ===== FUNCIONES PARA CARRUSEL DE POLIZAS =====
  const siguienteCarrusel = () => {
    if (carruselIndex + POLIZAS_POR_PAGINA < polizas.length) {
      setCarruselIndex(carruselIndex + POLIZAS_POR_PAGINA);
    }
  };

  const anteriorCarrusel = () => {
    if (carruselIndex > 0) {
      setCarruselIndex(Math.max(0, carruselIndex - POLIZAS_POR_PAGINA));
    }
  };

  const togglePolizaSeleccion = (polizaId: string) => {
    const nuevasPolizas = formData.poliza.includes(polizaId)
      ? formData.poliza.filter(id => id !== polizaId)
      : [...formData.poliza, polizaId];

    setFormData({
      ...formData,
      poliza: nuevasPolizas
    });
  };

  const getPolizasVisibles = () => {
    return polizas.slice(carruselIndex, carruselIndex + POLIZAS_POR_PAGINA);
  };

  // ===== FUNCIONES PARA MODAL DE ELIMINAR =====
  const abrirModalEliminar = (id: string) => {
    const especialidad = especialidades.find(esp => esp._id === id);
    if (especialidad) {
      setEspecialidadAEliminar(especialidad);
      setShowModalEliminar(true);
    }
  };

  const cancelarEliminacion = () => {
    setShowModalEliminar(false);
    setEspecialidadAEliminar(null);
  };

  const confirmarEliminacion = async () => {
    if (!especialidadAEliminar) return;

    try {
      await api.delete(`/especialidades/${especialidadAEliminar._id}`);
      
      // Actualizar estado local eliminando la especialidad
      const especialidadesActualizadas = especialidades.filter((e) => e._id !== especialidadAEliminar._id);
      setEspecialidades(especialidadesActualizadas);
      // Las filtradas se actualizarán automáticamente por el useEffect del término de búsqueda
      
      toast.success("Especialidad eliminada exitosamente.");
      setShowModalEliminar(false);
      setEspecialidadAEliminar(null);
    } catch (err) {
      toast.error("Error al eliminar la especialidad.");
      console.error("Error al eliminar la especialidad:", err);
      setShowModalEliminar(false);
      setEspecialidadAEliminar(null);
    }
  };

  // Función para manejar eliminación de especialidad
  // Ahora abre el modal de confirmación en lugar del confirm() del navegador
  const handleEliminar = async (id: string | undefined) => {
    if (!id) return;
    abrirModalEliminar(id);
  };

  // Renderizado del componente principal
  return (
    <div className="especialidad-container">
      {error && <div className="error-message">{error}</div>}

      {/* Nueva sección de vista previa con diseño de cards y búsqueda integrada */}
      <div className="preview-section-especialidad">
        {/* Header con título y controles de búsqueda */}
        <div className="section-header-especialidad">
          <div className="section-title-especialidad">
            <i className="bi bi-award"></i> {/* Icono representativo de especialidades */}
            <h3>Especialidades</h3>
          </div>
          {/* Controles de búsqueda con input y botones */}
          <div className="section-controls-especialidad">
            <div className="search-container-especialidad">
              <input
                type="text"
                placeholder="Buscar en especialidades, descripciones, pólizas..."
                className="search-input-especialidad"
                value={terminoBusqueda}
                onChange={handleSearchChange} // Búsqueda en tiempo real
              />
              {/* Botón dinámico: lupa cuando no hay búsqueda, X cuando hay texto */}
              <button
                className="search-button-especialidad"
                type="button"
                onClick={terminoBusqueda ? limpiarBusqueda : handleSearchClick}
                title={terminoBusqueda ? "Limpiar búsqueda" : "Buscar"}
              >
                <i className={`bi ${terminoBusqueda ? 'bi-x' : 'bi-search'}`}></i>
              </button>
            </div>
            {/* Botón para abrir modal de registro/creación */}
            <button
              className="btn-registrar-especialidad"
              onClick={() => {
                setMostrarModal(true);
                setModoEdicion(false); // Modo creación
                setIdEditando(null);
                // Limpiar formulario para nueva especialidad
                setFormData({ nombre: "", descripcion: "", poliza: [] });
                setArchivo(null);
                setArchivoActual(null);
              }}
            >
              <i className="bi bi-plus-circle"></i>
              Registrar
            </button>
          </div>
        </div>

        {/* Indicador de resultados de búsqueda - feedback visual para el usuario */}
        {terminoBusqueda && (
          <div className="search-results-indicator">
            <i className="bi bi-funnel"></i>
            <span>
              {especialidadesFiltradas.length} resultado(s) encontrado(s) para "{terminoBusqueda}"
            </span>
            {/* Mensaje cuando no hay resultados */}
            {especialidadesFiltradas.length === 0 && (
              <span className="no-results">
                <i className="bi bi-exclamation-triangle"></i>
                No se encontraron especialidades. La búsqueda incluye nombres, descripciones, pólizas y es tolerante a errores.
              </span>
            )}
          </div>
        )}

        {/* Contenedor principal para las cards de especialidades */}
        <div className="preview-container-especialidad">
          <PreviewEspecialidad
            especialidades={especialidadesFiltradas} // Usar array filtrado
            polizas={polizas}
            onEditar={handleEditar} // Callback para edición
            onEliminar={(id) => handleEliminar(id)} // Callback para eliminación
            isLoading={false}
          />
        </div>
      </div>

      {/* Modal para creación y edición de especialidades */}
      {mostrarModal && (
        <div className="modal-overlay-coordinadores">
          <div className="modal-content-coordinadores">
            <button className="modal-close" onClick={() => {
              setMostrarModal(false);
              setModoEdicion(false);
              setIdEditando(null);
              setFormData({ nombre: "", descripcion: "", poliza: [] });
              setArchivo(null);
              setArchivoActual(null);
              setCarruselIndex(0);
              setErrores({});
            }}>
              ×
            </button>

            <div className="modal-title" style={{ fontWeight: 'bold' }}>
              {modoEdicion ? "Editar Especialidad" : "Registrar Nueva Especialidad"}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-user-info">
                {/* Campo nombre de especialidad con validación */}
                <div className="form-group">
                  <label>Nombre de la Especialidad:</label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    className={errores.nombre ? "input-error" : ""}
                    placeholder="Ingrese el nombre de la especialidad"
                  />
                  {errores.nombre && <span className="mensaje-error-poliza">{errores.nombre}</span>}
                </div>

                {/* Campo descripción con validación */}
                <div className="form-group">
                  <label>Descripción:</label>
                  <input
                    type="text"
                    name="descripcion"
                    value={formData.descripcion}
                    onChange={handleChange}
                    className={errores.descripcion ? "input-error" : ""}
                    placeholder="Ingrese la descripción"
                  />
                  {errores.descripcion && <span className="mensaje-error-poliza">{errores.descripcion}</span>}
                </div>

                {/* Carrusel de pólizas */}
                <div className="form-group">
                  <label>Pólizas Asignadas:</label>
                  <div className="polizas-carrusel">
                    <div className="carrusel-navegacion">
                      <button
                        type="button"
                        className="pagination-btn prev"
                        onClick={anteriorCarrusel}
                        disabled={carruselIndex === 0}
                        title="Poliza anterior"
                      >
                        <i className="bi bi-chevron-left"></i>
                      </button>

                      <div className="carrusel-poliza-contenido">
                        {getPolizasVisibles().map((poliza) => (
                          <div
                            key={poliza._id}
                            className={`poliza-card ${formData.poliza.includes(poliza._id) ? 'poliza-selected' : ''}`}
                            onClick={() => togglePolizaSeleccion(poliza._id)}
                          >
                            <i className="bi bi-shield-check"></i>
                            <span>{poliza.nombre}</span>
                            {formData.poliza.includes(poliza._id) && (
                              <i className="bi bi-check-circle-fill poliza-check"></i>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="pagination-btn next"
                        onClick={siguienteCarrusel}
                        disabled={carruselIndex + POLIZAS_POR_PAGINA >= polizas.length}
                        title="Poliza siguiente"
                      >
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Campo para subir plantilla de reporte */}
                <div className="form-group">
                  <label>Plantilla de Reporte:</label>
                  <input
                    type="file"
                    name="archivo"
                    onChange={handleArchivoChange}
                    accept=".pdf,.doc,.docx"
                  />
                  {/* Indicador de archivo existente en modo edición */}
                  {modoEdicion && archivoActual && (
                    <p style={{ fontSize: "0.85rem", marginTop: "0.5rem", color: "#555" }}>
                      Archivo ya cargado.
                    </p>
                  )}
                </div>
              </div>

              {/* Botones de acción del modal */}
              <div className="modal-buttons">
                <button
                  type="button"
                  className="modal-btn modal-btn-cancelar"
                  onClick={() => {
                    setMostrarModal(false);
                    setModoEdicion(false);
                    setIdEditando(null);
                    setFormData({ nombre: "", descripcion: "", poliza: [] });
                    setArchivo(null);
                    setArchivoActual(null);
                    setCarruselIndex(0);
                    setErrores({});
                  }}
                >
                  <i className="bi bi-x-circle"></i>
                  Cancelar
                </button>
                <button type="submit" className="modal-btn modal-btn-confirmar-poliza">
                  <i className="bi bi-check-circle"></i>
                  {modoEdicion ? "Actualizar" : "Registrar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar especialidad */}
      {showModalEliminar && especialidadAEliminar && (
        <div className="modal-overlay-coordinadores">
          <div className="modal-content-coordinadores">
            <button className="modal-close" onClick={cancelarEliminacion}>
              ×
            </button>

            <div className="modal-title">
              ¿Seguro que quieres <strong>eliminar</strong> esta especialidad?
            </div>

            <div className="modal-user-info">
              <p><strong>Especialidad:</strong> {especialidadAEliminar.nombre}</p>
              <p><strong>Descripción:</strong> {especialidadAEliminar.descripcion}</p>
              <div className="modal-warning">
                <i className="bi bi-exclamation-triangle"></i>
                <span>Al eliminar esta especialidad, se perderán las pólizas y plantillas asociadas.</span>
              </div>
            </div>

            <div className="modal-buttons">
              <button className="modal-btn modal-btn-cancelar" onClick={cancelarEliminacion}>
                <i className="bi bi-x-circle"></i>
                Cancelar
              </button>
              <button className="modal-btn modal-btn-confirmar" onClick={confirmarEliminacion}>
                <i className="bi bi-check-circle"></i>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Especialidades;
