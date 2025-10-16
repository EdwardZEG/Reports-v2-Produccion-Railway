import "../styles/Encargados.css";
import { useState, useEffect } from "react";
import { CiEdit, CiTrash } from "react-icons/ci";
import CrearColaboradorModal from "../components/FormUser/crearUsuario";
import { getRol, getToken, decodeJWT } from "../auth/authService";
import { toast } from "react-toastify";
import {
  useEncargadosData,
  Encargado,
} from "../hooks/Colaborador/useColaborador";

const Encargados = () => {
  const {
    encargados,
    polizas,
    especialidades,
    fetchEncargados,
    actualizarEncargado,
    eliminarEncargado,
    marcarColaboradorCreado, // Nueva función para resaltado
    getPolizaNombre,
  } = useEncargadosData();

  const [modalOpen, setModalOpen] = useState(false);
  const [encargadoEditando, setEncargadoEditando] = useState<Encargado | null>(null);

  // Estados para búsqueda inteligente - exacto como coordinadores
  const [terminoBusqueda, setTerminoBusqueda] = useState("");
  const [encargadosFiltrados, setEncargadosFiltrados] = useState<any[]>([]);

  // Estados para paginación - igual que coordinadores
  const [paginaActual, setPaginaActual] = useState(1);
  const CARDS_POR_PAGINA = 5; // 5 colaboradores por página para mejor proporción visual

  // Estados para modal de confirmación de desactivar
  const [showModalDesactivar, setShowModalDesactivar] = useState(false);
  const [encargadoADesactivar, setEncargadoADesactivar] = useState<any>(null);

  // Estados para modal de confirmación de eliminar
  const [showModalEliminar, setShowModalEliminar] = useState(false);
  const [encargadoAEliminar, setEncargadoAEliminar] = useState<any>(null);

  // Estado para prevenir clicks múltiples en switches
  const [switchesEnProceso, setSwitchesEnProceso] = useState<Set<string>>(new Set());

  // Estados para información del usuario logueado
  const [userPolizaId, setUserPolizaId] = useState<string | null>(null);

  // ===== FUNCIONES PARA BÚSQUEDA INTELIGENTE - EXACTO COMO COORDINADORES =====
  // Sistema de búsqueda avanzada con normalización de texto, coincidencias difusas
  // y tolerancia a errores ortográficos para mejorar la experiencia del usuario

  /**
   * Normaliza texto eliminando acentos, caracteres especiales y convirtiendo a minúsculas
   * Utilizada para búsquedas más permisivas y tolerantes a diferencias de formato
   * @param texto - El texto a normalizar
   * @returns El texto normalizado sin acentos y en minúsculas
   */
  const normalizarTexto = (texto: string): string => {
    return texto
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Elimina acentos
      .replace(/[^\w\s]/g, ' ') // Reemplaza caracteres especiales por espacios
      .replace(/\s+/g, ' ') // Normaliza espacios múltiples
      .trim();
  };

  /**
   * Calcula la distancia de Levenshtein entre dos cadenas de texto
   * Determina el número mínimo de ediciones necesarias para transformar una cadena en otra
   * Utilizada para búsquedas tolerantes a errores de escritura
   * @param a - Primera cadena de texto
   * @param b - Segunda cadena de texto  
   * @returns Número de ediciones necesarias (menor número = mayor similitud)
   */
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

  /**
   * Verifica si existe una coincidencia difusa entre el término de búsqueda y el texto
   * Combina normalización de texto con cálculo de distancia de Levenshtein
   * Permite encontrar resultados aunque haya errores tipográficos menores
   * @param busqueda - Término que el usuario está buscando
   * @param texto - Texto donde buscar coincidencias
   * @param tolerancia - Número máximo de errores permitidos (default: 2)
   * @returns true si encuentra una coincidencia dentro de la tolerancia especificada
   */
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

  /**
   * Efecto que ejecuta el filtrado de colaboradores cada vez que cambia el término de búsqueda
   * Implementa búsqueda en tiempo real con múltiples estrategias:
   * 1. Búsqueda exacta normalizada
   * 2. Búsqueda por palabras individuales  
   * 3. Búsqueda difusa con tolerancia a errores
   * 4. Búsqueda parcial flexible
   */

  // useEffect para obtener información del usuario logueado
  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const decodedToken = decodeJWT(token);
        if (decodedToken?.polizaId) {
          setUserPolizaId(decodedToken.polizaId);
        }
      } catch (error) {
        console.error("Error decodificando token:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (!terminoBusqueda.trim()) {
      setEncargadosFiltrados(encargados);
    } else {
      const filtrados = encargados.filter((encargado) => {
        const terminoOriginal = terminoBusqueda.trim();
        const terminoNormalizado = normalizarTexto(terminoOriginal);

        // Crear contenido completo searchable
        const contenidoCompleto = [
          encargado.nombre,
          encargado.apellido_paterno || "",
          encargado.apellido_materno || "",
          encargado.correo || "",
          encargado.telefono || "",
          encargado.estado || "Activo",
          encargado.rol || "",
          encargado.poliza?.nombre || "",
          (encargado.especialidad ?? []).map((es: any) => es.nombre).join(' ') || ""
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
          if (coincidenciaDifusa(terminoOriginal, encargado.nombre, 2)) return true;
          if (coincidenciaDifusa(terminoOriginal, encargado.apellido_paterno || "", 2)) return true;
          if (coincidenciaDifusa(terminoOriginal, encargado.correo || "", 2)) return true;
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
      setEncargadosFiltrados(filtrados);
    }
  }, [terminoBusqueda, encargados]);

  // Resetear búsqueda cuando cambian los datos - igual que coordinadores
  useEffect(() => {
    if (terminoBusqueda.trim() !== '') {
      setPaginaActual(1); // Resetear a primera página al buscar
    }
  }, [encargadosFiltrados]);

  // ===== FUNCIONES DE PAGINACIÓN - EXACTO COMO COORDINADORES =====

  // Calcular total de páginas
  const totalPaginas = Math.ceil(encargadosFiltrados.length / CARDS_POR_PAGINA);

  // Calcular índices para la página actual
  const indiceInicio = (paginaActual - 1) * CARDS_POR_PAGINA;
  const indiceFin = indiceInicio + CARDS_POR_PAGINA;

  // Obtener colaboradores para la página actual
  const encargadosPaginados = encargadosFiltrados.slice(indiceInicio, indiceFin);

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
   * Función para calcular en qué página debería estar un colaborador específico
   * Utilizada para navegación automática después de crear/editar
   * Igual funcionalidad que coordinadores para consistencia de UX
   * Disponible para implementación futura de navegación automática
   */
  const calcularPaginaParaEncargado = (encargadoId: string, listaEnc: any[]) => {
    const indice = listaEnc.findIndex(c => c._id === encargadoId);
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
  const manejarCambioEstado = (encargado: any, nuevoEstado: boolean) => {
    // Prevenir clicks múltiples mientras se procesa
    if (switchesEnProceso.has(encargado._id)) {
      return;
    }

    // Marcar como en proceso
    setSwitchesEnProceso(prev => new Set(prev).add(encargado._id));

    if (!nuevoEstado) {
      // Si se está desactivando, mostrar modal de confirmación
      setEncargadoADesactivar(encargado);
      setShowModalDesactivar(true);
      // No removemos de switchesEnProceso aquí porque el modal maneja la finalización
    } else {
      // Si se está activando, cambiar directamente
      actualizarEstadoEncargado(encargado._id, "Activo").finally(() => {
        // Remover de switches en proceso cuando termine
        setSwitchesEnProceso(prev => {
          const newSet = new Set(prev);
          newSet.delete(encargado._id);
          return newSet;
        });
      });
    }
  };

  const confirmarDesactivacion = async () => {
    if (encargadoADesactivar) {
      // Agregar clase de animación de salida
      const modalContent = document.querySelector('.modal-content-coordinadores');
      if (modalContent) {
        modalContent.classList.add('closing');
        // Esperar a que termine la animación antes de cerrar
        setTimeout(() => {
          setShowModalDesactivar(false);
          setEncargadoADesactivar(null);
        }, 300);
      } else {
        setShowModalDesactivar(false);
        setEncargadoADesactivar(null);
      }

      await actualizarEstadoEncargado(encargadoADesactivar._id, "Inactivo");
      // Remover de switches en proceso
      setSwitchesEnProceso(prev => {
        const newSet = new Set(prev);
        newSet.delete(encargadoADesactivar._id);
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
        setEncargadoADesactivar(null);
      }, 300);
    } else {
      setShowModalDesactivar(false);
      setEncargadoADesactivar(null);
    }

    // Remover de switches en proceso al cancelar
    if (encargadoADesactivar) {
      setSwitchesEnProceso(prev => {
        const newSet = new Set(prev);
        newSet.delete(encargadoADesactivar._id);
        return newSet;
      });
    }
  };

  // ===== FUNCIONES PARA MODAL DE ELIMINAR =====
  const confirmarEliminacion = async () => {
    if (encargadoAEliminar) {
      // Agregar clase de animación de salida
      const modalContent = document.querySelector('.modal-content-coordinadores');
      if (modalContent) {
        modalContent.classList.add('closing');
        // Esperar a que termine la animación antes de cerrar
        setTimeout(() => {
          setShowModalEliminar(false);
          setEncargadoAEliminar(null);
        }, 300);
      } else {
        setShowModalEliminar(false);
        setEncargadoAEliminar(null);
      }

      try {
        await eliminarEncargado(encargadoAEliminar._id);
      } catch (err) {
        toast.error("Error al eliminar colaborador");
      }
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
        setEncargadoAEliminar(null);
      }, 300);
    } else {
      setShowModalEliminar(false);
      setEncargadoAEliminar(null);
    }
  };

  const actualizarEstadoEncargado = async (id: string, nuevoEstado: string) => {
    try {
      // Encontrar el encargado actual
      const encargado = encargados.find(e => e._id === id);
      if (encargado) {
        // Actualizar solo el estado, manteniendo todos los demás datos
        const datosActualizados = {
          ...encargado,
          estado: nuevoEstado
        };

        // El hook ahora maneja la actualización optimista internamente
        await actualizarEncargado(datosActualizados);
      }
      // Toast messages removed as requested
    } catch (error) {
      toast.error("Error al actualizar el estado del encargado");
      console.error("Error:", error);
    }
  };



  // Funciones para búsqueda - exacto como coordinadores
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTerminoBusqueda(e.target.value);
  };

  const handleSearchClick = () => {
    console.log("Buscando:", terminoBusqueda);
  };

  const limpiarBusqueda = () => {
    setTerminoBusqueda("");
  };

  /**
   * Función para manejar el éxito de crear un nuevo colaborador
   * Incluye navegación automática al colaborador creado con resaltado temporal
   * Funcionalidad idéntica a coordinadores para mantener consistencia UX
   */
  const handleColaboradorCreado = async (colaboradorCreado?: Encargado) => {
    if (colaboradorCreado) {
      // Marcar el colaborador como creado con resaltado temporal
      const resultado = await marcarColaboradorCreado(colaboradorCreado);

      if (resultado.success && resultado.encargados) {
        // Ir a la ÚLTIMA página donde se encuentra el nuevo colaborador (al final de la lista)
        const totalColaboradores = resultado.encargados.length;
        const ultimaPagina = Math.ceil(totalColaboradores / CARDS_POR_PAGINA);
        setPaginaActual(ultimaPagina);
      }
    } else {
      // Fallback para cuando no se recibe el colaborador (ediciones)
      await fetchEncargados();
    }

    setModalOpen(false);
  };

  // Evitar warning de lint para función disponible para uso futuro
  if (false) {
    calcularPaginaParaEncargado("", []);
  }

  const handleDeleteColaborador = (encargado: any) => {
    setEncargadoAEliminar(encargado);
    setShowModalEliminar(true);
  };

  const abrirModal = (encargado: Encargado) => {
    setEncargadoEditando({ ...encargado });
    setModalOpen(true);
  };

  return (
    <div className="encargados-container">
      {/* DISEÑO EXACTO DE COORDINADORES - Vista previa con cards y búsqueda integrada */}
      <div className="preview-section-encargados">
        {/* Header con título y controles de búsqueda - exacto como coordinadores */}
        <div className="section-header-encargados">
          <div className="section-title-encargados">
            <i className="bi bi-person-workspace"></i>
            <h3>Colaboradores</h3>
          </div>
          {/* Controles de búsqueda con input y botones - exacto como coordinadores */}
          <div className="section-controls-encargados">
            <div className="search-container-encargados">
              <input
                type="text"
                placeholder="Buscar en colaboradores, nombres, emails, pólizas, especialidades..."
                className="search-input-encargados"
                value={terminoBusqueda}
                onChange={handleSearchChange}
              />
              {/* Botón dinámico: lupa cuando no hay búsqueda, X cuando hay texto */}
              <button
                className="search-button-encargados"
                type="button"
                onClick={terminoBusqueda ? limpiarBusqueda : handleSearchClick}
                title={terminoBusqueda ? "Limpiar búsqueda" : "Buscar"}
              >
                <i className={`bi ${terminoBusqueda ? 'bi-x' : 'bi-search'}`}></i>
              </button>
            </div>
            {/* Botón para abrir modal de registro */}
            <button
              className="btn-registrar-encargados"
              onClick={() => setModalOpen(true)}
            >
              <i className="bi bi-plus-circle"></i>
              Registrar
            </button>
          </div>
        </div>

        {/* Indicador de resultados de búsqueda - exacto como coordinadores */}
        {terminoBusqueda && (
          <div className="search-results-indicator">
            <i className="bi bi-funnel"></i>
            <span>
              {encargadosFiltrados.length} resultado(s) encontrado(s) para "{terminoBusqueda}"
            </span>
            {encargadosFiltrados.length === 0 && (
              <span className="no-results">
                <i className="bi bi-exclamation-triangle"></i>
                No se encontraron colaboradores. La búsqueda incluye nombres, emails, pólizas, especialidades y es tolerante a errores.
              </span>
            )}
          </div>
        )}

        {/* Lista de colaboradores - FORMATO TABLA/LISTA SIMPLE */}
        <div className="preview-container-encargados">
          <div className="encargados-tabla">
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

            {/* Filas de colaboradores */}
            <div className="tabla-body">
              {encargadosPaginados.map((encargado) => (
                <div key={encargado._id} className={`tabla-fila ${encargado.resaltado ? 'resaltado' : ''}`}>
                  <div className="columna-nombre">
                    <div className="coordinador-info">
                      <i className="bi bi-person-badge coordinador-icon"></i>
                      <div className="coordinador-nombre">
                        <span className="nombre-completo">
                          {encargado.nombre} {encargado.apellido_paterno || ""} {encargado.apellido_materno || ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="columna-contacto">
                    <div className="contacto-info">
                      <div className="contacto-item">
                        <i className="bi bi-envelope-at"></i>
                        <span>{encargado.correo}</span>
                      </div>
                      <div className="contacto-item">
                        <i className="bi bi-telephone"></i>
                        <span>{encargado.telefono || 'No especificado'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="columna-poliza">
                    {(() => {
                      const polizaText = typeof encargado.poliza === 'object' && encargado.poliza ?
                        encargado.poliza.nombre :
                        getPolizaNombre(encargado.poliza as string) || 'No asignada';

                      const tienePoliza = polizaText !== 'Sin póliza' && polizaText !== 'No asignada';

                      return (
                        <div className="poliza-info-container">
                          <div className="poliza-principal">
                            <i className={`bi bi-shield-check ${tienePoliza ? 'poliza-asignada' : 'poliza-no-asignada'}`}></i>
                            <span className={tienePoliza ? 'poliza-asignada' : 'poliza-no-asignada'}>
                              {polizaText}
                            </span>
                          </div>

                          {/* Mostrar especialidades del colaborador debajo de la póliza */}
                          {encargado.especialidad && encargado.especialidad.length > 0 && (
                            <div className="colaborador-especialidades">
                              <div className="especialidades-chips-tabla">
                                {encargado.especialidad.map((esp: any) => (
                                  <span key={esp._id} className="especialidad-chip-tabla">
                                    <i className="bi bi-cpu"></i>
                                    {esp.nombre}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  <div className="columna-estado">
                    <div className="estado-switch-container">
                      <label className="estado-switch">
                        <input
                          type="checkbox"
                          checked={(encargado.estado || "activo").toLowerCase() === 'activo'}
                          onChange={(e) => manejarCambioEstado(encargado, e.target.checked)}
                          disabled={switchesEnProceso.has(encargado._id)}
                        />
                        <span className="switch-slider"></span>
                      </label>
                      <span className={`estado-texto ${(encargado.estado || "activo").toLowerCase()}`}>
                        <i className={`bi ${(encargado.estado || "activo").toLowerCase() === 'activo' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                        {(encargado.estado || "activo").toLowerCase() === 'activo' ? 'Activo' : 'Inactivo'}
                      </span>
                    </div>
                  </div>

                  <div className="columna-acciones">
                    <button
                      className="btn-accion editar"
                      onClick={() => abrirModal(encargado)}
                      title="Editar"
                    >
                      <CiEdit />
                    </button>
                    <button
                      className="btn-accion eliminar"
                      onClick={() => handleDeleteColaborador(encargado)}
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

      {/* Contenedor de paginación - FUERA DE LA SECCIÓN como en coordinadores */}
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

      {/* Modal para crear y editar colaborador */}
      <CrearColaboradorModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEncargadoEditando(null);
        }}
        onSuccess={handleColaboradorCreado} // Nueva función con navegación automática
        polizas={polizas}
        especialidades={especialidades}
        rolUsuario={getRol() || undefined}
        polizaUsuarioId={userPolizaId || undefined}
        colaboradorEditando={encargadoEditando || undefined}
      />

      {/* Modal de confirmación para desactivar */}
      {showModalDesactivar && encargadoADesactivar && (
        <div className="modal-overlay-coordinadores">
          <div className="modal-content-coordinadores">
            <button className="modal-close" onClick={cancelarDesactivacion}>
              ×
            </button>

            <div className="modal-title">
              ¿Seguro que quieres <strong>desactivar</strong> este Colaborador?
            </div>

            <div className="modal-user-info">
              <p><strong>Colaborador:</strong> {encargadoADesactivar.nombre} {encargadoADesactivar.apellido_paterno} {encargadoADesactivar.apellido_materno}</p>
              <p><strong>Correo:</strong> {encargadoADesactivar.correo}</p>
              {encargadoADesactivar.poliza && (
                <div className="modal-warning">
                  <i className="bi bi-exclamation-triangle"></i>
                  <span>Al desactivar este colaborador, perderá la póliza asignada.</span>
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
      {showModalEliminar && encargadoAEliminar && (
        <div className="modal-overlay-coordinadores">
          <div className="modal-content-coordinadores">
            <button className="modal-close" onClick={cancelarEliminacion}>
              ×
            </button>

            <div className="modal-title">
              ¿Seguro que quieres <strong>eliminar</strong> este Colaborador?
            </div>

            <div className="modal-user-info">
              <p><strong>Colaborador:</strong> {encargadoAEliminar.nombre} {encargadoAEliminar.apellido_paterno} {encargadoAEliminar.apellido_materno}</p>
              <p><strong>Correo:</strong> {encargadoAEliminar.correo}</p>
              <div className="modal-warning">
                <i className="bi bi-exclamation-triangle"></i>
                <span>Al eliminar este colaborador, su información asociada se perderá.</span>
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

export default Encargados;
