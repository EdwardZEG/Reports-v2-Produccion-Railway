import "../styles/Polizas.css";
import React, { useEffect, useState } from "react";
import axios, { AxiosResponse } from "axios";
import api from "../api";
import { toast } from "react-toastify";
import PreviewPoliza from "../components/PreviewPoliza/PreviewPoliza.tsx"; // Nuevo componente de cards

// Interfaces mantienen compatibilidad con backend existente
interface Poliza {
  _id: string;
  nombre: string;
  ubicacion: string;
  coordinador?: string | Coordinador;
  resaltado?: boolean;
}

interface Coordinador {
  _id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
}

const Polizas = () => {
  // Estados originales del componente
  const [polizas, setPolizas] = useState<Poliza[]>([]);
  // Nuevos estados para funcionalidad de búsqueda
  const [polizasFiltradas, setPolizasFiltradas] = useState<Poliza[]>([]);
  const [terminoBusqueda, setTerminoBusqueda] = useState("");

  // Estados para paginación
  const [paginaActual, setPaginaActual] = useState(1);
  const CARDS_POR_PAGINA = 8;
  // Estados existentes mantienen funcionalidad CRUD
  const [mostrarModal, setMostrarModal] = useState(false);
  const [modoEdicion, setModoEdicion] = useState(false);
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [coordinadores, setCoordinadores] = useState<Coordinador[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [errores, setErrores] = useState<{ [key: string]: string }>({});

  const [formData, setFormData] = useState({
    nombre: "",
    ubicacion: "",
    coordinador: "",
  });

  useEffect(() => {
    const obtenerDatos = async () => {
      try {
        const [resCoordinadores, resPolizas] = await Promise.all([
          api.get("/coordinadores"),
          api.get("/polizas"),
        ]);
        setCoordinadores(resCoordinadores.data);
        setPolizas(resPolizas.data);
        setPolizasFiltradas(resPolizas.data); // Inicializar filtradas para búsqueda
      } catch (err) {
        console.error("Error al obtener datos:", err);
        setError("Error al cargar los datos. Intente nuevamente.");
        toast.error("Error al cargar los datos. Intente nuevamente.");
      }
    };
    obtenerDatos();
  }, []);

  // useEffect para filtrar pólizas cuando cambia el término de búsqueda
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

  // Efecto para filtrar pólizas con búsqueda inteligente mejorada
  useEffect(() => {
    if (!terminoBusqueda.trim()) {
      // Sin término de búsqueda - mostrar todas
      setPolizasFiltradas(polizas);
    } else {
      const filtradas = polizas.filter((pol) => {
        const terminoOriginal = terminoBusqueda.trim();
        const terminoNormalizado = normalizarTexto(terminoOriginal);

        // Crear contenido completo searchable de la card
        const contenidoCompleto = [
          pol.nombre,
          pol.ubicacion,
          getCoordinadorNombre(pol.coordinador), // Nombre del coordinador
          // Términos adicionales inteligentes basados en contenido
          pol.nombre.toLowerCase().includes('oficina') ? 'edificio espacio lugar trabajo' : '',
          pol.nombre.toLowerCase().includes('seguro') ? 'proteccion cobertura asegurado' : '',
          pol.ubicacion.toLowerCase().includes('centro') ? 'plaza comercial mall centro' : '',
          pol.ubicacion.toLowerCase().includes('piso') ? 'nivel planta edificio' : '',
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
          if (coincidenciaDifusa(terminoOriginal, pol.nombre, 2)) return true;
          if (coincidenciaDifusa(terminoOriginal, pol.ubicacion, 2)) return true;
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
      setPolizasFiltradas(filtradas);
    }
  }, [terminoBusqueda, polizas]); // Dependencias: se ejecuta cuando cambia búsqueda o datos

  // Función para obtener nombre del coordinador (reutilizada del componente PreviewPoliza)
  // Maneja diferentes formatos de datos de coordinador para compatibilidad
  const getCoordinadorNombre = (polizaCoordinador: any) => {
    if (typeof polizaCoordinador === "object" && polizaCoordinador !== null) {
      // Objeto coordinador único
      const nombre = polizaCoordinador.nombre || "";
      const apPaterno = polizaCoordinador.apellido_paterno || "";
      const apMaterno = polizaCoordinador.apellido_materno || "";
      return `${nombre} ${apPaterno} ${apMaterno}`.trim();
    } else if (typeof polizaCoordinador === "string") {
      // ID de coordinador como string
      const coord = coordinadores.find(c => c._id === polizaCoordinador);
      return coord ? `${coord.nombre} ${coord.apellido_paterno} ${coord.apellido_materno || ""}`.trim() : "Sin asignar";
    }
    return "Sin asignar";
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
  // Restaura vista completa de pólizas
  const limpiarBusqueda = () => {
    setTerminoBusqueda("");
    setPaginaActual(1); // Resetear a primera página
  };

  // ===== LÓGICA DE PAGINACIÓN =====
  // Función para calcular en qué página debería estar una póliza específica
  const calcularPaginaParaPoliza = (polizaId: string, listaPol: Poliza[]) => {
    const indice = listaPol.findIndex(p => p._id === polizaId);
    if (indice === -1) return 1;
    return Math.ceil((indice + 1) / CARDS_POR_PAGINA);
  };



  // Calcular total de páginas
  const totalPaginas = Math.ceil(polizasFiltradas.length / CARDS_POR_PAGINA);

  // Calcular índices para la página actual
  const indiceInicio = (paginaActual - 1) * CARDS_POR_PAGINA;
  const indiceFin = indiceInicio + CARDS_POR_PAGINA;

  // Obtener pólizas para la página actual
  const polizasPaginadas = polizasFiltradas.slice(indiceInicio, indiceFin);

  // Función para cambiar de página
  const cambiarPagina = (numeroPagina: number) => {
    if (numeroPagina >= 1 && numeroPagina <= totalPaginas) {
      setPaginaActual(numeroPagina);
      // Cerrar cualquier card expandida al cambiar de página
      window.dispatchEvent(new CustomEvent('closeExpandedCard'));
    }
  };

  // Función para ir a página anterior
  const paginaAnterior = () => {
    if (paginaActual > 1) {
      setPaginaActual(paginaActual - 1);
      // Cerrar cualquier card expandida al cambiar de página
      window.dispatchEvent(new CustomEvent('closeExpandedCard'));
    }
  };

  // Función para ir a página siguiente
  const paginaSiguiente = () => {
    if (paginaActual < totalPaginas) {
      setPaginaActual(paginaActual + 1);
      // Cerrar cualquier card expandida al cambiar de página
      window.dispatchEvent(new CustomEvent('closeExpandedCard'));
    }
  };

  // Resetear búsqueda cuando cambian los datos
  useEffect(() => {
    if (terminoBusqueda.trim() !== '') {
      setPaginaActual(1); // Resetear a primera página al buscar
    }
  }, [terminoBusqueda]);

  // Función para manejar cambios en campos del formulario
  // Gestiona campos de texto y select
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };

  // Función principal para manejar envío del formulario
  // Incluye validación y creación/edición de póliza
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validaciones de campos con regex
    const nuevosErrores: { [key: string]: string } = {};
    const textoBasico = /^[\w\sáéíóúÁÉÍÓÚñÑ-]+$/; // Para nombres - solo letras, números, espacios y guiones
    const textoDescriptivo = /^[\w\sáéíóúÁÉÍÓÚñÑ.,;:()\-\/&%$#@!¿?¡+*="']+$/; // Para ubicaciones - permite puntuación común

    if (!formData.nombre.trim()) {
      nuevosErrores.nombre = "Este campo es obligatorio";
    } else if (!textoBasico.test(formData.nombre.trim())) {
      nuevosErrores.nombre = "No se permiten símbolos especiales en el nombre";
    }

    if (!formData.ubicacion.trim()) {
      nuevosErrores.ubicacion = "Este campo es obligatorio";
    } else if (!textoDescriptivo.test(formData.ubicacion.trim())) {
      nuevosErrores.ubicacion = "Solo se permiten caracteres alfanuméricos y puntuación básica";
    }

    // Mostrar errores si existen
    setErrores(nuevosErrores);
    if (Object.keys(nuevosErrores).length > 0) {
      toast.warn("Corrige los campos marcados.");
      return;
    }

    try {
      let polizaRes: AxiosResponse<any, any>;
      // Preparar datos para envío al backend
      const payloadPol = {
        nombre: formData.nombre.trim(),
        ubicacion: formData.ubicacion.trim(),
        coordinador: formData.coordinador || null,
      };

      // Determinar si es edición o creación
      if (modoEdicion && idEditando) {
        // Actualizar póliza existente
        polizaRes = await api.put(`/polizas/${idEditando}`, payloadPol);
        // Actualizar estados locales con datos actualizados
        const polizasActualizadas = polizas.map((p) =>
          p._id === idEditando ? { ...p, ...polizaRes.data, resaltado: true } : { ...p, resaltado: false }
        );
        setPolizas(polizasActualizadas);
        setPolizasFiltradas(polizasActualizadas);

        // Ir a la página donde está la póliza editada
        const paginaPoliza = calcularPaginaParaPoliza(idEditando, polizasActualizadas);
        setPaginaActual(paginaPoliza);

        // Quitar el resaltado después de 3 segundos
        setTimeout(() => {
          const polizasSinResaltar = polizasActualizadas.map(p => ({ ...p, resaltado: false }));
          setPolizas(polizasSinResaltar);
          setPolizasFiltradas(polizasSinResaltar);
        }, 3000);

        toast.success("Póliza actualizada exitosamente.");
      } else {
        // Crear nueva póliza
        polizaRes = await api.post("/polizas", payloadPol);
        // Agregar nueva póliza a ambos estados con resaltado
        const nuevaPoliza = { ...polizaRes.data, resaltado: true };
        const polizasActualizadas = [...polizas.map(p => ({ ...p, resaltado: false })), nuevaPoliza];
        setPolizas(polizasActualizadas);
        setPolizasFiltradas(polizasActualizadas);

        // Ir a la ÚLTIMA página donde se encuentra la nueva póliza (al final de la lista)
        const totalPolizas = polizasActualizadas.length;
        const ultimaPagina = Math.ceil(totalPolizas / CARDS_POR_PAGINA);
        setPaginaActual(ultimaPagina);

        // Quitar el resaltado después de 3 segundos
        setTimeout(() => {
          const polizasSinResaltar = polizasActualizadas.map(p => ({ ...p, resaltado: false }));
          setPolizas(polizasSinResaltar);
          setPolizasFiltradas(polizasSinResaltar);
        }, 3000);

        toast.success("Póliza creada exitosamente.");
      }

      // Limpiar formulario y cerrar modal
      setFormData({ nombre: "", ubicacion: "", coordinador: "" });
      setMostrarModal(false);
      setModoEdicion(false);
      setIdEditando(null);
      setErrores({});
    } catch (err) {
      console.error("Error al guardar póliza:", err);
      if (axios.isAxiosError(err) && err.response) {
        // Error específico del servidor
        const mensaje = err.response.data.message || "Error del servidor";
        toast.error(`Error: ${mensaje}`);
        setError(mensaje);
      } else {
        // Error genérico
        toast.error("Error al guardar la póliza. Intente nuevamente.");
        setError("Error al guardar la póliza. Intente nuevamente.");
      }
    }
  };

  // Función para manejar edición de póliza
  // Prellenar formulario con datos existentes y abrir modal en modo edición
  const handleEditar = (poliza: Poliza) => {
    setFormData({
      nombre: poliza.nombre,
      ubicacion: poliza.ubicacion,
      coordinador: typeof poliza.coordinador === "string" ? poliza.coordinador : poliza.coordinador?._id || "",
    });
    setIdEditando(poliza._id);
    setModoEdicion(true);
    setMostrarModal(true);
    setErrores({});
  };

  // Función para formatear coordinador (utilidad para selects)
  const formatCoordinador = (coord: Coordinador) => {
    return `${coord.nombre} ${coord.apellido_paterno} ${coord.apellido_materno || ""}`.trim();
  };

  // Función para manejar clic en overlay del modal
  // Cerrar modal si se hace clic fuera del contenido
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLDivElement).classList.contains("modal-poliza-container")) {
      setMostrarModal(false);
    }
  };

  // Función para manejar eliminación de póliza
  // Incluye confirmación del usuario y actualización de ambos estados
  const handleEliminar = async (id: string | undefined) => {
    if (!id) return;
    if (confirm("¿Estás seguro de que deseas eliminar esta póliza?")) {
      try {
        await api.delete(`/polizas/${id}`);
        // Actualizar ambos estados para mantener sincronización
        setPolizas(polizas.filter((p) => p._id !== id));
        setPolizasFiltradas(polizasFiltradas.filter((p) => p._id !== id));
        toast.success("Póliza eliminada exitosamente.");
      } catch (err) {
        toast.error("Error al eliminar la póliza.");
        console.error("Error al eliminar la póliza:", err);
      }
    }
  };

  // Renderizado del componente principal
  return (
    <div className="poliza-container">
      {error && <div className="error-message">{error}</div>}

      {/* Nueva sección de vista previa con diseño de cards y búsqueda integrada */}
      <div className="preview-section-poliza">
        {/* Header con título y controles de búsqueda */}
        <div className="section-header-poliza">
          <div className="section-title-poliza">
            <i className="bi bi-shield-check"></i> {/* Icono representativo de pólizas */}
            <h3>Pólizas</h3>
          </div>
          {/* Controles de búsqueda con input y botones */}
          <div className="section-controls-poliza">
            <div className="search-container-poliza">
              <input
                type="text"
                placeholder="Buscar en pólizas, ubicaciones, coordinadores..."
                className="search-input-poliza"
                value={terminoBusqueda}
                onChange={handleSearchChange} // Búsqueda en tiempo real
              />
              {/* Botón dinámico: lupa cuando no hay búsqueda, X cuando hay texto */}
              <button
                className="search-button-poliza"
                type="button"
                onClick={terminoBusqueda ? limpiarBusqueda : handleSearchClick}
                title={terminoBusqueda ? "Limpiar búsqueda" : "Buscar"}
              >
                <i className={`bi ${terminoBusqueda ? 'bi-x' : 'bi-search'}`}></i>
              </button>
            </div>
            {/* Botón para abrir modal de registro/creación */}
            <button
              className="btn-registrar-poliza"
              onClick={() => {
                setMostrarModal(true);
                setModoEdicion(false); // Modo creación
                setIdEditando(null);
                // Limpiar formulario para nueva póliza
                setFormData({ nombre: "", ubicacion: "", coordinador: "" });
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
              {polizasFiltradas.length} resultado(s) encontrado(s) para "{terminoBusqueda}"
            </span>
            {/* Mensaje cuando no hay resultados */}
            {polizasFiltradas.length === 0 && (
              <span className="no-results">
                <i className="bi bi-exclamation-triangle"></i>
                No se encontraron pólizas. La búsqueda incluye nombres, ubicaciones, coordinadores y es tolerante a errores.
              </span>
            )}
          </div>
        )}

        {/* Contenedor principal para las cards de pólizas */}
        <div className="preview-container-poliza">
          <PreviewPoliza
            polizas={polizasPaginadas} // Usar pólizas paginadas (máximo 8 por página)
            coordinadores={coordinadores}
            onEditar={handleEditar} // Callback para edición
            onEliminar={(id: string) => handleEliminar(id)} // Callback para eliminación
            isLoading={false}
          />
        </div>
      </div>

      {/* Contenedor de paginación - Solo mostrar si hay más de 8 pólizas */}
      {totalPaginas > 1 && (
        <div className="pagination-container">
          <div className="pagination">
            {/* Botón "Página 1" - Solo aparece desde página 3 en adelante */}
            {paginaActual >= 3 && totalPaginas > 3 && (
              <button
                className="pagination-btn go-to-first"
                onClick={() => cambiarPagina(1)}
                title="Ir a página 1"
              >
                <i className="bi bi-arrow-return-left"></i>
                Página 1
              </button>
            )}

            {/* Botón anterior */}
            <button
              className="pagination-btn prev"
              onClick={paginaAnterior}
              disabled={paginaActual === 1}
              title="Página anterior"
            >
              <i className="bi bi-chevron-left"></i>
            </button>

            {/* Números de página - solo mostrar página actual */}
            <div className="pagination-numbers">
              <button className="pagination-btn number active">
                {paginaActual}
              </button>
            </div>

            {/* Botón siguiente */}
            <button
              className="pagination-btn next"
              onClick={paginaSiguiente}
              disabled={paginaActual === totalPaginas}
              title="Página siguiente"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        </div>
      )}

      {/* Modal para creación y edición de pólizas */}
      {mostrarModal && (
        <div className="modal-poliza-container" onClick={handleOverlayClick}>
          <div className="modal-content-poliza">
            {/* Título dinámico según modo */}
            <h3>{modoEdicion ? "Editar Póliza" : "Nueva Póliza"}</h3>
            <form onSubmit={handleSubmit}>
              {/* Campo nombre de póliza con validación */}
              <label>Nombre:</label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                className={errores.nombre ? "input-error" : ""}
              />
              {errores.nombre && <span className="mensaje-error-poliza">{errores.nombre}</span>}

              {/* Campo ubicación con validación */}
              <label>Ubicación:</label>
              <input
                type="text"
                name="ubicacion"
                value={formData.ubicacion}
                onChange={handleChange}
                className={errores.ubicacion ? "input-error" : ""}
              />
              {errores.ubicacion && <span className="mensaje-error-poliza">{errores.ubicacion}</span>}

              {/* Selección de coordinador */}
              <label>Coordinador (opcional):</label>
              <select
                name="coordinador"
                value={formData.coordinador}
                onChange={handleChange}
              >
                <option value="">Sin asignar</option>
                {coordinadores.map((coord) => (
                  <option key={coord._id} value={coord._id}>
                    {formatCoordinador(coord)}
                  </option>
                ))}
              </select>

              {/* Botones de acción del modal */}
              <div className="modal-buttons">
                <button type="submit" className="btn-guardar-poliza">
                  Guardar
                </button>
                <button
                  type="button"
                  className="btn-cancelar-poliza"
                  onClick={() => {
                    // Limpiar todos los estados y cerrar modal
                    setMostrarModal(false);
                    setModoEdicion(false);
                    setIdEditando(null);
                    setFormData({ nombre: "", ubicacion: "", coordinador: "" });
                  }}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Polizas;