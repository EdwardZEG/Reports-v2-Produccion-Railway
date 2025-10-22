import "../styles/coordinadores.css";
import "../styles/Polizas.css";
import { useState, useEffect } from "react";
import { CiEdit, CiTrash } from "react-icons/ci";
import { toast } from "react-toastify";
import { useCoordinadores } from "../hooks/Coordinador/useCoordinadorData";
import { useData } from "../context/DataContext";

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

  // 🚀 Hook para invalidar cache de DataContext cuando se crean coordinadores
  const { invalidateColaboradoresCache } = useData();

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

  // Estados para carrusel de pólizas (igual que especialidades)
  const [carruselIndex, setCarruselIndex] = useState(0);
  const POLIZAS_POR_PAGINA = 1; // Mostrar 1 póliza a la vez

  // Estado para rol del usuario
  const [userRole, setUserRole] = useState<string>('');

  // Estado para rastrear si se ha seleccionado póliza explícitamente
  const [polizaSeleccionadaExplicitamente, setPolizaSeleccionadaExplicitamente] = useState(false);

  // Estados para sistema de pasos del formulario
  const [pasoActual, setPasoActual] = useState(1);
  const TOTAL_PASOS = 3;

  // Estado para mostrar/ocultar contraseña - exacto como login
  const [showPassword, setShowPassword] = useState(false);

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

  // ===== EFECTO PARA OBTENER ROL DEL USUARIO =====
  useEffect(() => {
    const role = localStorage.getItem('rol')?.toLowerCase() || '';
    const roleAlternative = localStorage.getItem('role')?.toLowerCase() || '';
    const finalRole = role || roleAlternative;

    setUserRole(finalRole);
    console.log('👤 Rol del usuario en coordinadores:', {
      rolOriginal: localStorage.getItem('rol'),
      roleAlternativo: localStorage.getItem('role'),
      rolFinal: finalRole,
      esAdmin: finalRole === 'admin',
      localStorageKeys: Object.keys(localStorage)
    });
  }, []);

  // ===== EFECTO PARA SINCRONIZAR CARRUSEL CON PÓLIZA EN EDICIÓN =====
  useEffect(() => {
    // SOLO cuando se abre el modal de edición y se entra al paso 3 por primera vez, posicionar el carrusel
    if (showModalEdicion && pasoActual === 3 && polizas.length > 0) {
      let indiceCarrusel = 0;
      const esAdmin = userRole === 'admin' || userRole === 'administrador' || userRole.includes('admin');

      if (nuevoCoordinador.poliza) {
        // Buscar la póliza en el array
        const indicePoliza = polizas.findIndex(poliza => poliza._id === nuevoCoordinador.poliza);
        if (indicePoliza >= 0) {
          // Si hay opción "Sin asignar" (admin), sumar 1 al índice
          indiceCarrusel = esAdmin ? indicePoliza + 1 : indicePoliza;
        }
      } else if (esAdmin) {
        // Sin póliza asignada y es admin = mostrar "Sin asignar" (índice 0)
        indiceCarrusel = 0;
      }

      setCarruselIndex(indiceCarrusel);
      console.log('🎯 Posicionando carrusel inicial:', {
        polizaId: nuevoCoordinador.poliza,
        userRole: userRole,
        esAdmin: esAdmin,
        indiceCalculado: indiceCarrusel,
        esSinAsignar: !nuevoCoordinador.poliza && esAdmin
      });
    }
  }, [showModalEdicion, pasoActual, polizas.length, userRole]); // Agregado userRole a dependencias

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
    console.log('🔄 useEffect coordinadores triggered:', {
      coordinadores: coordinadores.length,
      terminoBusqueda: terminoBusqueda
    });
    if (!terminoBusqueda.trim()) {
      console.log('🔄 Sin búsqueda, copiando coordinadores:', coordinadores.length);
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

  // Resetear búsqueda cuando cambian los datos - SOLO si hay búsqueda activa
  useEffect(() => {
    if (terminoBusqueda.trim() !== '') {
      setPaginaActual(1); // Resetear a primera página al buscar
    }
    // Si no hay búsqueda y la página actual es mayor al total de páginas, ajustar
    else {
      const totalPaginasActuales = Math.ceil(coordinadoresFiltrados.length / CARDS_POR_PAGINA);
      if (paginaActual > totalPaginasActuales && totalPaginasActuales > 0) {
        setPaginaActual(totalPaginasActuales);
      }
    }
  }, [coordinadoresFiltrados, terminoBusqueda, paginaActual]);

  // ===== FUNCIONES DE PAGINACIÓN - EXACTO COMO POLIZAS =====

  // Calcular total de páginas
  const totalPaginas = Math.ceil(coordinadoresFiltrados.length / CARDS_POR_PAGINA);

  // 🛡️ PROTECCIÓN: Asegurar que la página actual sea válida
  const paginaActualSegura = Math.max(1, Math.min(paginaActual, totalPaginas || 1));

  // Si la página actual no es segura, corregirla
  if (paginaActual !== paginaActualSegura && totalPaginas > 0) {
    console.log('🛡️ Corrigiendo página actual:', { de: paginaActual, a: paginaActualSegura });
    setPaginaActual(paginaActualSegura);
  }

  // Calcular índices para la página actual segura
  const indiceInicio = (paginaActualSegura - 1) * CARDS_POR_PAGINA;
  const indiceFin = indiceInicio + CARDS_POR_PAGINA;

  // Obtener coordinadores para la página actual
  const coordinadoresPaginados = coordinadoresFiltrados.slice(indiceInicio, indiceFin);

  // 🔍 DEBUG: Log para tracking de rendering
  console.log('🎯 Coordinadores - Estado de renderizado:', {
    coordinadoresBase: coordinadores.length,
    coordinadoresFiltrados: coordinadoresFiltrados.length,
    coordinadoresPaginados: coordinadoresPaginados.length,
    paginaActual,
    paginaActualSegura,
    indiceInicio,
    indiceFin,
    primerosCoordinadores: coordinadoresPaginados.slice(0, 2).map(c => ({
      id: c._id,
      nombre: c.nombre,
      resaltado: c.resaltado
    }))
  });

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

  // ===== FUNCIONES PARA CARRUSEL DE PÓLIZAS =====
  const irAnteriorPoliza = () => {
    const esAdmin = userRole === 'admin' || userRole === 'administrador' || userRole.includes('admin');
    const totalOpciones = esAdmin ? polizas.length + 1 : polizas.length;
    setCarruselIndex(prev => prev > 0 ? prev - 1 : Math.max(0, totalOpciones - POLIZAS_POR_PAGINA));
  };

  const irSiguientePoliza = () => {
    const esAdmin = userRole === 'admin' || userRole === 'administrador' || userRole.includes('admin');
    const totalOpciones = esAdmin ? polizas.length + 1 : polizas.length;
    setCarruselIndex(prev => prev < totalOpciones - POLIZAS_POR_PAGINA ? prev + 1 : 0);
  };

  const seleccionarPoliza = (polizaId: string) => {
    console.log('🎯 Seleccionando póliza:', {
      polizaIdAnterior: nuevoCoordinador.poliza,
      polizaIdNueva: polizaId,
      esIgual: nuevoCoordinador.poliza === polizaId,
      esSinAsignar: polizaId === '',
      enModoEdicion: !!idEditando
    });

    setNuevoCoordinador(prev => ({ ...prev, poliza: polizaId }));
    setPolizaSeleccionadaExplicitamente(true); // Marcar que se hizo una selección explícita

    // Limpiar error de póliza si existe
    setErroresCampo(prev => {
      const { poliza: omit, ...rest } = prev;
      return rest;
    });
  };

  // ===== FUNCIONES PARA SISTEMA DE PASOS =====
  const siguientePaso = () => {
    if (pasoActual < TOTAL_PASOS) {
      const nuevoPaso = pasoActual + 1;
      setPasoActual(nuevoPaso);

      // Si llega al paso 3 (Asignación) en modo edición, posicionar carrusel en póliza asignada
      if (nuevoPaso === 3 && showModalEdicion) {
        let indiceCarrusel = 0;
        const esAdmin = userRole === 'admin' || userRole === 'administrador' || userRole.includes('admin');

        if (nuevoCoordinador.poliza) {
          const indicePoliza = polizas.findIndex(poliza => poliza._id === nuevoCoordinador.poliza);
          if (indicePoliza >= 0) {
            indiceCarrusel = esAdmin ? indicePoliza + 1 : indicePoliza;
          }
        } else if (esAdmin) {
          // Sin póliza = "Sin asignar" en posición 0
          indiceCarrusel = 0;
        }

        setCarruselIndex(indiceCarrusel);
      }
    }
  };

  const pasoAnterior = () => {
    if (pasoActual > 1) {
      setPasoActual(prev => prev - 1);
    }
  };

  const irAPaso = (paso: number) => {
    if (paso >= 1 && paso <= TOTAL_PASOS) {
      setPasoActual(paso);

      // Si va al paso 3 (Asignación) en modo edición, asegurar que el carrusel esté en la póliza correcta
      if (paso === 3 && showModalEdicion) {
        let indiceCarrusel = 0;
        const esAdmin = userRole === 'admin' || userRole === 'administrador' || userRole.includes('admin');

        if (nuevoCoordinador.poliza) {
          const indicePoliza = polizas.findIndex(poliza => poliza._id === nuevoCoordinador.poliza);
          if (indicePoliza >= 0) {
            indiceCarrusel = esAdmin ? indicePoliza + 1 : indicePoliza;
          }
        } else if (esAdmin) {
          // Sin póliza = "Sin asignar" en posición 0
          indiceCarrusel = 0;
        }

        setCarruselIndex(indiceCarrusel);
      }
    }
  };

  // Función para mostrar/ocultar contraseña - exacto como login
  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  // Función para obtener el contenido del paso actual
  const renderPasoActual = () => {
    switch (pasoActual) {
      case 1:
        return (
          <>
            <div className="form-group">
              <label>Nombre:</label>
              <input
                type="text"
                name="nombre"
                value={nuevoCoordinador.nombre}
                onChange={handleInputChange}
                className={erroresCampo.nombre ? "input-error" : ""}
                placeholder="Ingrese el nombre"
              />
              {erroresCampo.nombre && <span className="mensaje-error-poliza">{erroresCampo.nombre}</span>}
            </div>

            <div className="form-group">
              <label>Apellido Paterno:</label>
              <input
                type="text"
                name="apellido_paterno"
                value={nuevoCoordinador.apellido_paterno}
                onChange={handleInputChange}
                className={erroresCampo.apellido_paterno ? "input-error" : ""}
                placeholder="Ingrese el apellido paterno"
              />
              {erroresCampo.apellido_paterno && <span className="mensaje-error-poliza">{erroresCampo.apellido_paterno}</span>}
            </div>

            <div className="form-group">
              <label>Apellido Materno:</label>
              <input
                type="text"
                name="apellido_materno"
                value={nuevoCoordinador.apellido_materno}
                onChange={handleInputChange}
                className={erroresCampo.apellido_materno ? "input-error" : ""}
                placeholder="Ingrese el apellido materno"
              />
              {erroresCampo.apellido_materno && <span className="mensaje-error-poliza">{erroresCampo.apellido_materno}</span>}
            </div>
          </>
        );

      case 2:
        return (
          <>
            <div className="form-group">
              <label>Correo:</label>
              <input
                type="email"
                name="correo"
                value={nuevoCoordinador.correo}
                onChange={handleInputChange}
                className={erroresCampo.correo ? "input-error" : ""}
                placeholder="Ingrese el correo electrónico"
              />
              {erroresCampo.correo && <span className="mensaje-error-poliza">{erroresCampo.correo}</span>}
            </div>

            <div className="form-group">
              <label>Teléfono:</label>
              <input
                type="text"
                name="telefono"
                value={nuevoCoordinador.telefono}
                onChange={handleInputChange}
                className={erroresCampo.telefono ? "input-error" : ""}
                placeholder="Ingrese el teléfono"
              />
              {erroresCampo.telefono && <span className="mensaje-error-poliza">{erroresCampo.telefono}</span>}
            </div>

            {showModalRegistro && (
              <div className="form-group">
                <label>Contraseña:</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="contraseña"
                    value={nuevoCoordinador.contraseña}
                    onChange={handleInputChange}
                    className={erroresCampo.contraseña ? "input-error" : ""}
                    placeholder="Ingrese la contraseña"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className={`toggle-password ${showPassword ? 'fas fa-eye-slash active' : 'fas fa-eye'}`}
                    onClick={togglePassword}
                    aria-label="Mostrar/ocultar contraseña"
                  />
                </div>
                {erroresCampo.contraseña && <span className="mensaje-error-poliza">{erroresCampo.contraseña}</span>}
              </div>
            )}

            {showModalEdicion && (
              <div className="form-group">
                <label>Nueva Contraseña (opcional):</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="contraseña"
                    value={nuevoCoordinador.contraseña}
                    onChange={handleInputChange}
                    className={erroresCampo.contraseña ? "input-error" : ""}
                    placeholder="Ingrese la nueva contraseña"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className={`toggle-password ${showPassword ? 'fas fa-eye-slash active' : 'fas fa-eye'}`}
                    onClick={togglePassword}
                    aria-label="Mostrar/ocultar contraseña"
                  />
                </div>
                {erroresCampo.contraseña && <span className="mensaje-error-poliza">{erroresCampo.contraseña}</span>}
              </div>
            )}
          </>
        );

      case 3:
        return (
          <>
            {/* Carrusel de pólizas */}
            <div className="form-group">
              <label>Póliza Asignada:</label>
              <div className="polizas-carrusel">
                <div className="carrusel-navegacion">
                  <button
                    type="button"
                    className="pagination-btn prev"
                    onClick={irAnteriorPoliza}
                    disabled={carruselIndex === 0}
                    title="Poliza anterior"
                  >
                    <i className="bi bi-chevron-left"></i>
                  </button>

                  <div className="carrusel-poliza-contenido">
                    {(() => {
                      console.log('🔍 Debug Coordinadores - Estado del carrusel:', {
                        totalPolizas: polizas.length,
                        carruselIndex: carruselIndex,
                        POLIZAS_POR_PAGINA: POLIZAS_POR_PAGINA,
                        polizaSeleccionada: nuevoCoordinador.poliza,
                        userRole: userRole,
                        esAdmin: userRole === 'admin',
                        polizasDisponibles: polizas.map(p => ({ id: p._id, nombre: p.nombre })),
                        polizasQueSeVan: polizas.slice(carruselIndex, carruselIndex + POLIZAS_POR_PAGINA).map(p => ({ id: p._id, nombre: p.nombre }))
                      });

                      // Crear array con todas las opciones disponibles
                      const opcionesDisponibles: Array<{ _id: string; nombre: string; esSinAsignar?: boolean }> = [];

                      // Agregar opción "Sin asignar" solo para admin
                      const esAdmin = userRole === 'admin' || userRole === 'administrador' || userRole.includes('admin');
                      if (esAdmin) {
                        opcionesDisponibles.push({
                          _id: '',
                          nombre: 'Sin asignar',
                          esSinAsignar: true
                        });
                        console.log('✅ Agregando opción "Sin asignar" para admin');
                      } else {
                        console.log('❌ No es admin, no se agrega "Sin asignar". Rol actual:', userRole);
                      }

                      // Agregar todas las pólizas
                      opcionesDisponibles.push(...polizas.map(poliza => ({
                        _id: poliza._id,
                        nombre: poliza.nombre,
                        esSinAsignar: false
                      })));

                      console.log('📋 Opciones disponibles en carrusel:', opcionesDisponibles.map(op => ({ id: op._id, nombre: op.nombre, esSinAsignar: op.esSinAsignar })));

                      return opcionesDisponibles.slice(carruselIndex, carruselIndex + POLIZAS_POR_PAGINA).map((opcion) => {
                        // Solo marcar como seleccionada si hay una selección explícita
                        const estaSeleccionada = polizaSeleccionadaExplicitamente && (
                          opcion.esSinAsignar
                            ? nuevoCoordinador.poliza === ''
                            : nuevoCoordinador.poliza === opcion._id
                        );

                        return (
                          <div
                            key={opcion._id || 'sin-asignar'}
                            className={`poliza-card ${estaSeleccionada ? 'poliza-selected' : ''} ${opcion.esSinAsignar ? 'sin-asignar' : ''}`}
                            onClick={() => seleccionarPoliza(opcion._id)}
                          >
                            <i className={`bi ${opcion.esSinAsignar ? 'bi-x-circle' : 'bi-shield-check'}`}></i>
                            <span>{opcion.nombre}</span>
                            {estaSeleccionada && (
                              <i className="bi bi-check-circle-fill poliza-check"></i>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>

                  <button
                    type="button"
                    className="pagination-btn next"
                    onClick={irSiguientePoliza}
                    disabled={carruselIndex + POLIZAS_POR_PAGINA >= ((userRole === 'admin' || userRole === 'administrador' || userRole.includes('admin')) ? polizas.length + 1 : polizas.length)}
                    title="Poliza siguiente"
                  >
                    <i className="bi bi-chevron-right"></i>
                  </button>
                </div>
              </div>
              {erroresCampo.poliza && <span className="mensaje-error-poliza">{erroresCampo.poliza}</span>}
            </div>
          </>
        );

      default:
        return null;
    }
  };

  // Función para obtener el título del paso actual
  const getTituloPaso = () => {
    switch (pasoActual) {
      case 1: return "Datos Personales";
      case 2: return "Datos de Contacto";
      case 3: return "Asignación";
      default: return "";
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

    // Validación de contraseña idéntica a colaboradores
    if (idEditando === null && !datos.contraseña) {
      errores.contraseña = "Contraseña es obligatoria.";
    } else if (datos.contraseña && datos.contraseña.length < 6) {
      errores.contraseña = "Contraseña debe tener al menos 6 caracteres.";
    }

    if (!datos.telefono.match(/^\d{10}$/)) errores.telefono = "Debe tener 10 dígitos.";

    // Validación de póliza - NO obligatoria para coordinadores (pueden estar sin asignar)
    // Solo validar si hay una selección explícita y está vacía
    // if (!datos.poliza) errores.poliza = "Debe seleccionar una póliza."; // Comentado - póliza no obligatoria

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
      let payload: any = { ...nuevoCoordinador };

      // ESPECIAL: Si poliza es cadena vacía, probar diferentes enfoques
      if (payload.poliza === '') {
        // Estrategia 1: Enviar null
        payload.poliza = null;
        console.log('🚀 Probando estrategia 1: null');

        // Si estrategia 1 no funciona, probar:
        // Estrategia 2: delete payload.poliza; (omitir campo completamente)
        // Estrategia 3: payload.poliza = undefined;
        // Estrategia 4: payload.poliza = ""; (mantener cadena vacía)
      }

      console.log('🔄 Actualizando coordinador:', {
        id: idEditando,
        payloadOriginal: { ...nuevoCoordinador },
        payloadFinal: payload,
        polizaOriginal: nuevoCoordinador.poliza,
        polizaFinal: payload.poliza,
        polizaEsVacia: nuevoCoordinador.poliza === '',
        polizaEsNull: payload.poliza === null,
        tieneContraseña: !!nuevoCoordinador.contraseña?.trim()
      });

      // Solo incluir contraseña si se proporcionó una nueva
      if (!nuevoCoordinador.contraseña || nuevoCoordinador.contraseña.trim() === "") {
        const { contraseña, ...payloadSinContraseña } = payload;
        console.log('📤 Enviando payload SIN contraseña:', payloadSinContraseña);
        const resultado = await actualizarCoordinador(idEditando, payloadSinContraseña);
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
        console.log('📤 Enviando payload CON contraseña:', payload);
        const resultado = await actualizarCoordinador(idEditando, payload);
        if (resultado.success && resultado.coordinadores) {
          // Ir a la página donde está el coordinador editado
          const paginaCoordinador = calcularPaginaParaCoordinador(idEditando, resultado.coordinadores);
          setPaginaActual(paginaCoordinador);

          setShowModalRegistro(false);
          setShowModalEdicion(false);
          setIdEditando(null);
          resetForm();
        }
      }
    } else {
      // Crear nuevo coordinador - SIEMPRE COMO ACTIVO
      const coordinadorConEstado = { ...nuevoCoordinador, estado: "Activo" };
      const resultado = await crearCoordinador(coordinadorConEstado);
      if (resultado.success && resultado.coordinadores) {
        // 🚀 INVALIDAR CACHE del DataContext para actualizar inmediatamente las búsquedas de colaboradores
        console.log('💥 Coordinadores: Invalidando cache de DataContext tras crear coordinador...');
        invalidateColaboradoresCache();

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
    const polizaId = typeof coordinador.poliza === 'string' ? coordinador.poliza : coordinador.poliza?._id || "";
    const esAdmin = userRole === 'admin' || userRole === 'administrador' || userRole.includes('admin');

    // Encontrar el índice de la póliza en el array de pólizas para posicionar el carrusel
    let carruselInicial = 0;

    if (polizaId) {
      // Tiene póliza asignada
      const indicePoliza = polizas.findIndex(poliza => poliza._id === polizaId);
      if (indicePoliza >= 0) {
        // Si es admin, sumar 1 porque "Sin asignar" está en posición 0
        carruselInicial = esAdmin ? indicePoliza + 1 : indicePoliza;
      }
    } else if (esAdmin) {
      // No tiene póliza y es admin = mostrar "Sin asignar" (posición 0)
      carruselInicial = 0;
    }

    console.log('🔧 Abriendo modal de edición:', {
      coordinadorId: coordinador._id,
      polizaId: polizaId,
      tienePoliza: !!polizaId,
      esAdmin: esAdmin,
      carruselInicial: carruselInicial
    });

    setNuevoCoordinador({
      nombre: coordinador.nombre,
      apellido_paterno: coordinador.apellido_paterno,
      apellido_materno: coordinador.apellido_materno,
      correo: coordinador.correo,
      contraseña: "",
      telefono: coordinador.telefono || "",
      poliza: polizaId,
      estado: coordinador.estado || "Activo"
    });
    setErroresCampo({});
    setIdEditando(coordinador._id);
    setCarruselIndex(carruselInicial); // Posicionar carrusel en la póliza asignada
    setPasoActual(1); // Siempre empezar desde el primer paso
    setShowPassword(false); // Resetear estado de mostrar contraseña
    setPolizaSeleccionadaExplicitamente(true); // En edición, siempre hay una selección (incluso "Sin asignar")
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
    setShowPassword(false);
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
              onClick={() => {
                setShowModalRegistro(true);
                setCarruselIndex(0); // Resetear carrusel al inicio
                setPasoActual(1); // Empezar desde el primer paso
                setPolizaSeleccionadaExplicitamente(false); // Resetear selección explícita
              }}
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

      {/* Modal para creación y edición de coordinadores - ESTILO ESPECIALIDADES */}
      {(showModalRegistro || showModalEdicion) && (
        <div className="modal-overlay-coordinadores">
          <div className="modal-content-coordinadores with-steps">
            <button className="modal-close" onClick={() => {
              setShowModalRegistro(false);
              setShowModalEdicion(false);
              setIdEditando(null);
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
              setCarruselIndex(0);
              setPasoActual(1);
              setErroresCampo({});
              setShowPassword(false);
              setPolizaSeleccionadaExplicitamente(false); // Resetear selección explícita
            }}>
              ×
            </button>

            <div className="modal-title" style={{ fontWeight: 'bold' }}>
              {showModalRegistro ? "Registrar Nuevo Coordinador" : "Editar Coordinador"}
            </div>

            {/* Título del paso */}
            <div className="step-title">{getTituloPaso()}</div>
            <div className="step-info">{pasoActual} de {TOTAL_PASOS}</div>

            {/* Navegación de pasos con flechas a los lados del contenido */}
            <div className="step-navigation-container">
              {/* Flecha izquierda */}
              <button
                type="button"
                className="pagination-btn prev"
                onClick={pasoAnterior}
                disabled={pasoActual === 1}
                title="Paso anterior"
              >
                <i className="bi bi-chevron-left"></i>
              </button>

              {/* Contenido del paso actual */}
              <div className="step-content">
                <form onSubmit={handleSubmit}>
                  {renderPasoActual()}
                </form>
              </div>

              {/* Flecha derecha */}
              <button
                type="button"
                className="pagination-btn next"
                onClick={siguientePaso}
                disabled={pasoActual === TOTAL_PASOS}
                title="Siguiente paso"
              >
                <i className="bi bi-chevron-right"></i>
              </button>
            </div>

            {/* Indicadores de pasos (círculos pequeños) - POSICIÓN FIJA */}
            <div className="step-indicators-coordinadores">
              {Array.from({ length: TOTAL_PASOS }, (_, index) => (
                <button
                  key={index + 1}
                  type="button"
                  className={`step-indicator ${pasoActual === index + 1 ? 'active' : ''}`}
                  onClick={() => irAPaso(index + 1)}
                  title={`Ir al paso ${index + 1}`}
                />
              ))}
            </div>

            {/* Botones de acción del modal - POSICIÓN FIJA */}
            <div className="modal-buttons-coordinadores">
              <button
                type="button"
                className="modal-btn modal-btn-cancelar"
                onClick={() => {
                  setShowModalRegistro(false);
                  setShowModalEdicion(false);
                  setIdEditando(null);
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
                  setCarruselIndex(0);
                  setErroresCampo({});
                  setPasoActual(1);
                  setShowPassword(false);
                }}
              >
                <i className="bi bi-x-circle"></i>
                Cancelar
              </button>
              <button
                type="button"
                className="modal-btn modal-btn-confirmar-poliza"
                onClick={(e) => {
                  e.preventDefault();
                  const form = document.querySelector('form');
                  if (form) {
                    const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                    form.dispatchEvent(submitEvent);
                  }
                }}
              >
                <i className="bi bi-check-circle"></i>
                {showModalRegistro ? "Registrar" : "Actualizar"}
              </button>
            </div>
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