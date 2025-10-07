import "../styles/coordinadores.css";
import { useState, useEffect } from "react";
import { CiEdit, CiTrash } from "react-icons/ci";
import { toast } from "react-toastify";
import { useCoordinadores } from "../hooks/Coordinador/useCoordinadorData";

interface CoordinadorForm {
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  correo: string;
  contraseña: string;
  telefono: string;
  poliza: string;
  estado: string;
}

const Coordinadores = () => {
  const {
    coordinadores,
    polizas,
    crearCoordinador,
    actualizarCoordinador,
    eliminarCoordinador,
    getPolizaNombre,
    error,
    setError,
  } = useCoordinadores();

  const [showModalRegistro, setShowModalRegistro] = useState(false);
  const [showModalEdicion, setShowModalEdicion] = useState(false);
  const [idEditando, setIdEditando] = useState<string | null>(null);
  const [erroresCampo, setErroresCampo] = useState<{ [key: string]: string }>({});

  // Estados para búsqueda inteligente - exacto como especialidades
  const [terminoBusqueda, setTerminoBusqueda] = useState("");
  const [coordinadoresFiltrados, setCoordinadoresFiltrados] = useState<any[]>([]);

  // Estados para paginación - igual que Polizas
  const [paginaActual, setPaginaActual] = useState(1);
  const CARDS_POR_PAGINA = 5; // 5 coordinadores por página para mejor proporción visual

  // Estados para modal de confirmación de desactivar
  const [showModalDesactivar, setShowModalDesactivar] = useState(false);
  const [coordinadorADesactivar, setCoordinadorADesactivar] = useState<any>(null);

  // Estados para modal de confirmación de eliminar
  const [showModalEliminar, setShowModalEliminar] = useState(false);
  const [coordinadorAEliminar, setCoordinadorAEliminar] = useState<any>(null);

  // Estado para prevenir clicks múltiples en switches
  const [switchesEnProceso, setSwitchesEnProceso] = useState<Set<string>>(new Set());

  const [nuevoCoordinador, setNuevoCoordinador] = useState<CoordinadorForm>({
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    correo: "",
    contraseña: "",
    telefono: "",
    poliza: "",
    estado: "Activo"
  });

  // ===== FUNCIONES PARA BÚSQUEDA INTELIGENTE - EXACTO COMO ESPECIALIDADES =====

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

  // Efecto para filtrar coordinadores - exacto como especialidades
  useEffect(() => {
    if (!terminoBusqueda.trim()) {
      setCoordinadoresFiltrados(coordinadores);
    } else {
      const filtrados = coordinadores.filter((coord) => {
        const terminoOriginal = terminoBusqueda.trim();
        const terminoNormalizado = normalizarTexto(terminoOriginal);

        // Crear contenido completo searchable
        const contenidoCompleto = [
          coord.nombre,
          coord.apellido_paterno,
          coord.apellido_materno,
          coord.correo,
          coord.telefono || "",
          coord.estado || "Activo",
          getPolizaNombre(coord.poliza as string) || ""
        ].join(' ');

        const contenidoNormalizado = normalizarTexto(contenidoCompleto);

        // 1. Búsqueda exacta normalizada
        if (contenidoNormalizado.includes(terminoNormalizado)) return true;

        // 2. Búsqueda por palabras individuales
        const palabrasBusqueda = terminoNormalizado.split(' ').filter(palabra => palabra.length > 2);
        if (palabrasBusqueda.length > 1) {
          const todasCoinciden = palabrasBusqueda.every(palabra =>
            contenidoNormalizado.includes(palabra) ||
            coincidenciaDifusa(palabra, contenidoCompleto, 1)
          );
          if (todasCoinciden) return true;
        }

        // 3. Búsqueda difusa (tolerante a errores)
        if (terminoNormalizado.length >= 4) {
          if (coincidenciaDifusa(terminoOriginal, coord.nombre, 2)) return true;
          if (coincidenciaDifusa(terminoOriginal, coord.apellido_paterno, 2)) return true;
          if (coincidenciaDifusa(terminoOriginal, coord.correo, 2)) return true;
        }

        // 4. Búsqueda parcial flexible
        if (terminoNormalizado.length >= 3) {
          const palabrasContenido = contenidoNormalizado.split(' ');
          return palabrasContenido.some(palabra =>
            palabra.includes(terminoNormalizado) ||
            (palabra.length >= 4 && terminoNormalizado.includes(palabra))
          );
        }

        return false;
      });
      setCoordinadoresFiltrados(filtrados);
    }
  }, [terminoBusqueda, coordinadores]);

  // Resetear búsqueda cuando cambian los datos - igual que Polizas
  useEffect(() => {
    if (terminoBusqueda.trim() !== '') {
      setPaginaActual(1); // Resetear a primera página al buscar
    }
  }, [coordinadoresFiltrados]);

  // ===== FUNCIONES DE PAGINACIÓN - EXACTO COMO POLIZAS =====

  // Calcular total de páginas
  const totalPaginas = Math.ceil(coordinadoresFiltrados.length / CARDS_POR_PAGINA);

  // Calcular índices para la página actual
  const indiceInicio = (paginaActual - 1) * CARDS_POR_PAGINA;
  const indiceFin = indiceInicio + CARDS_POR_PAGINA;

  // Obtener coordinadores para la página actual
  const coordinadoresPaginados = coordinadoresFiltrados.slice(indiceInicio, indiceFin);

  // Función para cambiar de página
  const cambiarPagina = (numeroPagina: number) => {
    if (numeroPagina >= 1 && numeroPagina <= totalPaginas) {
      setPaginaActual(numeroPagina);
    }
  };

  // Función para ir a página anterior
  const paginaAnterior = () => {
    if (paginaActual > 1) {
      setPaginaActual(paginaActual - 1);
    }
  };

  /**
   * Función para calcular en qué página debería estar un coordinador específico
   * Utilizada para navegación automática después de crear/editar
   * Igual funcionalidad que polizas para consistencia de UX
   */
  const calcularPaginaParaCoordinador = (coordinadorId: string, listaCoord: any[]) => {
    const indice = listaCoord.findIndex(c => c._id === coordinadorId);
    if (indice === -1) return 1;
    return Math.ceil((indice + 1) / CARDS_POR_PAGINA);
  };

  // Función para ir a página siguiente
  const paginaSiguiente = () => {
    if (paginaActual < totalPaginas) {
      setPaginaActual(paginaActual + 1);
    }
  };



  // ===== FUNCIONES PARA CAMBIO DE ESTADO =====
  const manejarCambioEstado = (coordinador: any, nuevoEstado: boolean) => {
    // Prevenir clicks múltiples mientras se procesa
    if (switchesEnProceso.has(coordinador._id)) {
      return;
    }

    // Marcar como en proceso
    setSwitchesEnProceso(prev => new Set(prev).add(coordinador._id));

    if (!nuevoEstado) {
      // Si se está desactivando, mostrar modal de confirmación
      setCoordinadorADesactivar(coordinador);
      setShowModalDesactivar(true);
      // No removemos de switchesEnProceso aquí porque el modal maneja la finalización
    } else {
      // Si se está activando, cambiar directamente
      actualizarEstadoCoordinador(coordinador._id, "Activo").finally(() => {
        // Remover de switches en proceso cuando termine
        setSwitchesEnProceso(prev => {
          const newSet = new Set(prev);
          newSet.delete(coordinador._id);
          return newSet;
        });
      });
    }
  };

  const confirmarDesactivacion = async () => {
    if (coordinadorADesactivar) {
      // Agregar clase de animación de salida
      const modalContent = document.querySelector('.modal-content-coordinadores');
      if (modalContent) {
        modalContent.classList.add('closing');
        // Esperar a que termine la animación antes de cerrar
        setTimeout(() => {
          setShowModalDesactivar(false);
          setCoordinadorADesactivar(null);
        }, 300);
      } else {
        setShowModalDesactivar(false);
        setCoordinadorADesactivar(null);
      }

      await actualizarEstadoCoordinador(coordinadorADesactivar._id, "Inactivo");
      // Remover de switches en proceso
      setSwitchesEnProceso(prev => {
        const newSet = new Set(prev);
        newSet.delete(coordinadorADesactivar._id);
        return newSet;
      });
    }
  };

  const cancelarDesactivacion = () => {
    // Agregar clase de animación de salida
    const modalContent = document.querySelector('.modal-content-coordinadores');
    if (modalContent) {
      modalContent.classList.add('closing');
      // Esperar a que termine la animación antes de cerrar
      setTimeout(() => {
        setShowModalDesactivar(false);
        setCoordinadorADesactivar(null);
      }, 300);
    } else {
      setShowModalDesactivar(false);
      setCoordinadorADesactivar(null);
    }

    // Remover de switches en proceso al cancelar
    if (coordinadorADesactivar) {
      setSwitchesEnProceso(prev => {
        const newSet = new Set(prev);
        newSet.delete(coordinadorADesactivar._id);
        return newSet;
      });
    }
  };

  // ===== FUNCIONES PARA MODAL DE ELIMINAR =====
  const confirmarEliminacion = async () => {
    if (coordinadorAEliminar) {
      // Agregar clase de animación de salida
      const modalContent = document.querySelector('.modal-content-coordinadores');
      if (modalContent) {
        modalContent.classList.add('closing');
        // Esperar a que termine la animación antes de cerrar
        setTimeout(() => {
          setShowModalEliminar(false);
          setCoordinadorAEliminar(null);
        }, 300);
      } else {
        setShowModalEliminar(false);
        setCoordinadorAEliminar(null);
      }

      await eliminarCoordinador(coordinadorAEliminar._id);
    }
  };

  const cancelarEliminacion = () => {
    // Agregar clase de animación de salida
    const modalContent = document.querySelector('.modal-content-coordinadores');
    if (modalContent) {
      modalContent.classList.add('closing');
      // Esperar a que termine la animación antes de cerrar
      setTimeout(() => {
        setShowModalEliminar(false);
        setCoordinadorAEliminar(null);
      }, 300);
    } else {
      setShowModalEliminar(false);
      setCoordinadorAEliminar(null);
    }
  };

  const actualizarEstadoCoordinador = async (id: string, nuevoEstado: string) => {
    try {
      await actualizarCoordinador(id, { estado: nuevoEstado });
      // Toast messages removed as requested
    } catch (error) {
      toast.error("Error al actualizar el estado del coordinador");
      console.error("Error:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setNuevoCoordinador(prev => ({ ...prev, [name]: value }));

    if (value.trim() === "") {
      setErroresCampo(prev => ({ ...prev, [name]: "Este campo es requerido." }));
    } else {
      setErroresCampo(prev => {
        const { [name]: omit, ...rest } = prev;
        return rest;
      });
    }
  };

  const validarCampos = (datos: CoordinadorForm): boolean => {
    const errores: { [key: string]: string } = {};
    const hasSymbols = (text: string) => /[!@#$%^&*(),.?":{}|<>]/.test(text);

    if (!datos.nombre) errores.nombre = "Nombre requerido.";
    else if (hasSymbols(datos.nombre)) errores.nombre = "No uses símbolos.";

    if (!datos.apellido_paterno) errores.apellido_paterno = "Apellido paterno requerido.";
    else if (hasSymbols(datos.apellido_paterno)) errores.apellido_paterno = "No uses símbolos.";

    if (!datos.apellido_materno) errores.apellido_materno = "Apellido materno requerido.";
    else if (hasSymbols(datos.apellido_materno)) errores.apellido_materno = "No uses símbolos.";

    if (!datos.correo) errores.correo = "Correo requerido.";

    if (idEditando === null && datos.contraseña.length < 8)
      errores.contraseña = "La contraseña debe tener al menos 8 caracteres.";

    if (!datos.telefono.match(/^\d{10}$/)) errores.telefono = "Debe tener 10 dígitos.";

    setErroresCampo(errores);
    return Object.keys(errores).length === 0;
  };

  /**
   * Manejar envío del formulario de coordinador
   * Incluye navegación automática al coordinador creado/editado con resaltado temporal
   * Funcionalidad idéntica a polizas para mantener consistencia UX
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!validarCampos(nuevoCoordinador)) {
      toast.warning("Corrige los campos resaltados.");
      return;
    }

    if (idEditando) {
      // Actualizar coordinador existente
      const resultado = await actualizarCoordinador(idEditando, { ...nuevoCoordinador, contraseña: undefined! });
      if (resultado.success && resultado.coordinadores) {
        // Ir a la página donde está el coordinador editado
        const paginaCoordinador = calcularPaginaParaCoordinador(idEditando, resultado.coordinadores);
        setPaginaActual(paginaCoordinador);

        setShowModalRegistro(false);
        setShowModalEdicion(false);
        setIdEditando(null);
        resetForm();
      }
    } else {
      // Crear nuevo coordinador
      const resultado = await crearCoordinador(nuevoCoordinador);
      if (resultado.success && resultado.coordinadores) {
        // Ir a la ÚLTIMA página donde se encuentra el nuevo coordinador (al final de la lista)
        const totalCoordinadores = resultado.coordinadores.length;
        const ultimaPagina = Math.ceil(totalCoordinadores / CARDS_POR_PAGINA);
        setPaginaActual(ultimaPagina);

        setShowModalRegistro(false);
        setShowModalEdicion(false);
        setIdEditando(null);
        resetForm();
      }
    }
  };

  const abrirModalEdicion = (coordinador: any) => {
    setNuevoCoordinador({
      nombre: coordinador.nombre,
      apellido_paterno: coordinador.apellido_paterno,
      apellido_materno: coordinador.apellido_materno,
      correo: coordinador.correo,
      contraseña: "",
      telefono: coordinador.telefono || "",
      poliza: typeof coordinador.poliza === 'string' ? coordinador.poliza : coordinador.poliza?._id || "",
      estado: coordinador.estado || "Activo"
    });
    setErroresCampo({});
    setIdEditando(coordinador._id);
    setShowModalEdicion(true);
  };

  const resetForm = () => {
    setNuevoCoordinador({
      nombre: "",
      apellido_paterno: "",
      apellido_materno: "",
      correo: "",
      contraseña: "",
      telefono: "",
      poliza: "",
      estado: "Activo"
    });
    setErroresCampo({});
  };

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLDivElement).classList.contains("modal-overlay")) {
      setShowModalRegistro(false);
      setShowModalEdicion(false);
    }
  };

  // Funciones para búsqueda - exacto como especialidades
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTerminoBusqueda(e.target.value);
  };

  const handleSearchClick = () => {
    console.log("Buscando:", terminoBusqueda);
  };

  const limpiarBusqueda = () => {
    setTerminoBusqueda("");
  };

  const renderInput = (label: string, name: keyof CoordinadorForm, type = "text") => (
    <div className="form-group">
      <label>{label}</label>
      <input
        type={type}
        name={name}
        value={nuevoCoordinador[name]}
        onChange={handleInputChange}
        className={erroresCampo[name] ? "input-error" : ""}
        required
      />
      {erroresCampo[name] && <span className="error-text">{erroresCampo[name]}</span>}
    </div>
  );

  return (
    <div className="coordinadores-container">
      {error && <div className="error-message">{error}</div>}

      {/* DISEÑO EXACTO DE ESPECIALIDADES - Vista previa con cards y búsqueda integrada */}
      <div className="preview-section-coordinadores">
        {/* Header con título y controles de búsqueda - exacto como especialidades */}
        <div className="section-header-coordinadores">
          <div className="section-title-coordinadores">
            <i className="bi bi-people"></i>
            <h3>Coordinadores</h3>
          </div>
          {/* Controles de búsqueda con input y botones - exacto como especialidades */}
          <div className="section-controls-coordinadores">
            <div className="search-container-coordinadores">
              <input
                type="text"
                placeholder="Buscar en coordinadores, nombres, emails, pólizas..."
                className="search-input-coordinadores"
                value={terminoBusqueda}
                onChange={handleSearchChange}
              />
              {/* Botón dinámico: lupa cuando no hay búsqueda, X cuando hay texto */}
              <button
                className="search-button-coordinadores"
                type="button"
                onClick={terminoBusqueda ? limpiarBusqueda : handleSearchClick}
                title={terminoBusqueda ? "Limpiar búsqueda" : "Buscar"}
              >
                <i className={`bi ${terminoBusqueda ? 'bi-x' : 'bi-search'}`}></i>
              </button>
            </div>
            {/* Botón para abrir modal de registro */}
            <button
              className="btn-registrar-coordinadores"
              onClick={() => setShowModalRegistro(true)}
            >
              <i className="bi bi-plus-circle"></i>
              Registrar
            </button>
          </div>
        </div>

        {/* Indicador de resultados de búsqueda - exacto como especialidades */}
        {terminoBusqueda && (
          <div className="search-results-indicator">
            <i className="bi bi-funnel"></i>
            <span>
              {coordinadoresFiltrados.length} resultado(s) encontrado(s) para "{terminoBusqueda}"
            </span>
            {coordinadoresFiltrados.length === 0 && (
              <span className="no-results">
                <i className="bi bi-exclamation-triangle"></i>
                No se encontraron coordinadores. La búsqueda incluye nombres, emails, pólizas y es tolerante a errores.
              </span>
            )}
          </div>
        )}

        {/* Lista de coordinadores - FORMATO TABLA/LISTA SIMPLE */}
        <div className="preview-container-coordinadores">
          <div className="coordinadores-tabla">
            {/* Header de la tabla */}
            <div className="tabla-header">
              <div className="columna-nombre">
                <i className="bi bi-person-badge"></i>
                Nombre
              </div>
              <div className="columna-contacto">
                <i className="bi bi-envelope-at"></i>
                Contacto
              </div>
              <div className="columna-poliza">
                <i className="bi bi-shield-check"></i>
                Póliza
              </div>
              <div className="columna-estado">
                <i className="bi bi-check-circle"></i>
                Estado
              </div>
              <div className="columna-acciones">
                <i className="bi bi-gear"></i>
                Acciones
              </div>
            </div>

            {/* Filas de coordinadores */}
            <div className="tabla-body">
              {coordinadoresPaginados.map((coordinador) => (
                <div key={coordinador._id} className={`tabla-fila ${coordinador.resaltado ? 'resaltado' : ''}`}>
                  <div className="columna-nombre">
                    <div className="coordinador-info">
                      <i className="bi bi-person-badge coordinador-icon"></i>
                      <div className="coordinador-nombre">
                        <span className="nombre-completo">
                          {coordinador.nombre} {coordinador.apellido_paterno} {coordinador.apellido_materno}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="columna-contacto">
                    <div className="contacto-info">
                      <div className="contacto-item">
                        <i className="bi bi-envelope-at"></i>
                        <span>{coordinador.correo}</span>
                      </div>
                      <div className="contacto-item">
                        <i className="bi bi-telephone"></i>
                        <span>{coordinador.telefono || 'No especificado'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="columna-poliza">
                    {(() => {
                      const polizaText = typeof coordinador.poliza === 'object' && coordinador.poliza ?
                        coordinador.poliza.nombre :
                        getPolizaNombre(coordinador.poliza as string) || 'No asignada';

                      const tienePoliza = polizaText !== 'Sin póliza' && polizaText !== 'No asignada';

                      return (
                        <>
                          <i className={`bi bi-shield-check ${tienePoliza ? 'poliza-asignada' : 'poliza-no-asignada'}`}></i>
                          <span className={tienePoliza ? 'poliza-asignada' : 'poliza-no-asignada'}>
                            {polizaText}
                          </span>
                        </>
                      );
                    })()}
                  </div>

                  <div className="columna-estado">
                    <div className="estado-switch-container">
                      <label className="estado-switch">
                        <input
                          type="checkbox"
                          checked={(coordinador.estado || "activo").toLowerCase() === 'activo'}
                          onChange={(e) => manejarCambioEstado(coordinador, e.target.checked)}
                          disabled={switchesEnProceso.has(coordinador._id)}
                        />
                        <span className="switch-slider"></span>
                      </label>
                      <span className={`estado-texto ${(coordinador.estado || "activo").toLowerCase()}`}>
                        <i className={`bi ${(coordinador.estado || "activo").toLowerCase() === 'activo' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                        {(coordinador.estado || "activo").toLowerCase() === 'activo' ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>

                  <div className="columna-acciones">
                    <button
                      className="btn-accion editar"
                      onClick={() => abrirModalEdicion(coordinador)}
                      title="Editar"
                    >
                      <CiEdit />
                    </button>
                    <button
                      className="btn-accion eliminar"
                      onClick={() => {
                        setCoordinadorAEliminar(coordinador);
                        setShowModalEliminar(true);
                      }}
                      title="Eliminar"
                    >
                      <CiTrash />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Contenedor de paginación - FUERA DE LA SECCIÓN como en polizas */}
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

      {/* MODAL - manteniendo funcionalidad original */}
      {(showModalRegistro || showModalEdicion) && (
        <div className="modal-overlay" onClick={handleOverlayClick}>
          <div className="modal-main-container">
            <form onSubmit={handleSubmit} className="modal-coordinadores-container">
              <h3>{showModalRegistro ? "Registrar Coordinador" : "Editar Coordinador"}</h3>

              {renderInput("Nombre:", "nombre")}
              {renderInput("Apellido Paterno:", "apellido_paterno")}
              {renderInput("Apellido Materno:", "apellido_materno")}
              {renderInput("Correo:", "correo", "email")}
              {showModalRegistro && renderInput("Contraseña:", "contraseña", "password")}
              {renderInput("Teléfono:", "telefono")}

              <div className="form-group">
                <label>Póliza:</label>
                <select
                  name="poliza"
                  value={nuevoCoordinador.poliza}
                  onChange={handleInputChange}
                  className={erroresCampo.poliza ? "input-error" : ""}
                >
                  <option value="">Selecciona una póliza</option>
                  {polizas.map((poliza) => (
                    <option key={poliza._id} value={poliza._id}>{poliza.nombre}</option>
                  ))}
                </select>
                {erroresCampo.poliza && <span className="error-text">{erroresCampo.poliza}</span>}
              </div>

              <div className="form-group">
                <label>Estado:</label>
                <select
                  name="estado"
                  value={nuevoCoordinador.estado}
                  onChange={handleInputChange}
                >
                  <option value="Activo">Activo</option>
                  <option value="Inactivo">Inactivo</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="submit" className="submit-btn">Guardar</button>
                <button type="button" className="close-btn" onClick={() => {
                  setShowModalRegistro(false);
                  setShowModalEdicion(false);
                }}>Cancelar</button>
              </div>
            </form>
            {error && <div className="error-message-coordinador">{error}</div>}
          </div>
        </div>
      )}

      {/* Modal de confirmación para desactivar */}
      {showModalDesactivar && coordinadorADesactivar && (
        <div className="modal-overlay-coordinadores">
          <div className="modal-content-coordinadores">
            <button className="modal-close" onClick={cancelarDesactivacion}>
              ×
            </button>

            <div className="modal-title">
              ¿Seguro que quieres <strong>desactivar</strong> este Coordinador?
            </div>

            <div className="modal-user-info">
              <p><strong>Coordinador:</strong> {coordinadorADesactivar.nombre} {coordinadorADesactivar.apellido_paterno} {coordinadorADesactivar.apellido_materno}</p>
              <p><strong>Correo:</strong> {coordinadorADesactivar.correo}</p>
              {coordinadorADesactivar.poliza && (
                <div className="modal-warning">
                  <i className="bi bi-exclamation-triangle"></i>
                  <span>Al desactivar este coordinador, perderá la póliza asignada.</span>
                </div>
              )}
            </div>

            <div className="modal-buttons">
              <button className="modal-btn modal-btn-cancelar" onClick={cancelarDesactivacion}>
                <i className="bi bi-x-circle"></i>
                Cancelar
              </button>
              <button className="modal-btn modal-btn-confirmar" onClick={confirmarDesactivacion}>
                <i className="bi bi-check-circle"></i>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar */}
      {showModalEliminar && coordinadorAEliminar && (
        <div className="modal-overlay-coordinadores">
          <div className="modal-content-coordinadores">
            <button className="modal-close" onClick={cancelarEliminacion}>
              ×
            </button>

            <div className="modal-title">
              ¿Seguro que quieres <strong>eliminar</strong> este Coordinador?
            </div>

            <div className="modal-user-info">
              <p><strong>Coordinador:</strong> {coordinadorAEliminar.nombre} {coordinadorAEliminar.apellido_paterno} {coordinadorAEliminar.apellido_materno}</p>
              <p><strong>Correo:</strong> {coordinadorAEliminar.correo}</p>
              <div className="modal-warning">
                <i className="bi bi-exclamation-triangle"></i>
                <span>Al eliminar este coordinador, su información asociada se perderá.</span>
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

export default Coordinadores;