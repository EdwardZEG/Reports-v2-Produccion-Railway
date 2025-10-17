import "../styles/Polizas.css";
import React, { useEffect, useState } from "react";
import axios, { AxiosResponse } from "axios";
import api from "../api";
import { toast } from "react-toastify";
import PreviewPoliza from "../components/PreviewPoliza/PreviewPoliza.tsx"; // Nuevo componente de cards
import { getRol, getToken, decodeJWT } from "../auth/authService";

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

  // Estados para modal de confirmación de eliminar
  const [showModalEliminar, setShowModalEliminar] = useState(false);
  const [polizaAEliminar, setPolizaAEliminar] = useState<Poliza | null>(null);

  const [formData, setFormData] = useState({
    nombre: "",
    ubicacion: "",
    coordinador: "",
  });

  // Estados para búsqueda de coordinadores
  const [busquedaCoordinador, setBusquedaCoordinador] = useState("");
  const [coordinadoresFiltrados, setCoordinadoresFiltrados] = useState<Coordinador[]>([]);
  const [mostrandoSugerencias, setMostrandoSugerencias] = useState(false);

  // Estados para información del usuario logueado
  const [userRole, setUserRole] = useState<string>("");
  const [userPolizaId, setUserPolizaId] = useState<string | null>(null);
  const [isCoordinador, setIsCoordinador] = useState<boolean>(false);

  // useEffect para obtener información del usuario logueado
  useEffect(() => {
    const token = getToken();
    const role = getRol()?.toLowerCase() || "";

    setUserRole(role);
    setIsCoordinador(role === "coordinador");

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
    const obtenerDatos = async () => {
      try {
        // Verificar si el token ha expirado antes de hacer la llamada API
        const token = localStorage.getItem('token');
        if (!token) {
          console.log('🔴 Polizas: No hay token, no cargando datos');
          return;
        }

        // Importar dinámicamente para evitar problemas de circular imports
        const { isTokenExpired } = await import('../utils/tokenUtils');
        if (isTokenExpired(token)) {
          console.log('🔴 Polizas: Token expirado, no cargando datos');
          return;
        }

        const [resCoordinadores, resPolizas] = await Promise.all([
          api.get("/coordinadores"),
          api.get("/polizas"),
        ]);
        setCoordinadores(resCoordinadores.data);

        // Filtrar pólizas para coordinadores: solo mostrar su póliza asignada
        let polizasData = resPolizas.data;
        if (isCoordinador && userPolizaId) {
          polizasData = resPolizas.data.filter((poliza: Poliza) => poliza._id === userPolizaId);
        }

        setPolizas(polizasData);
        setPolizasFiltradas(polizasData); // Inicializar filtradas para búsqueda
      } catch (err) {
        // Suprimir toast si el token ha expirado
        const token = localStorage.getItem('token');
        if (token) {
          const { isTokenExpired } = await import('../utils/tokenUtils');
          if (!isTokenExpired(token)) {
            console.error("Error al obtener datos:", err);
            setError("Error al cargar los datos. Intente nuevamente.");
            toast.error("Error al cargar los datos. Intente nuevamente.");
          }
        }
      }
    };

    // Solo ejecutar si ya tenemos la información del usuario
    if (userRole) {
      obtenerDatos();
    }
  }, [isCoordinador, userPolizaId, userRole]);

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

  // Efecto para filtrar pólizas con búsqueda optimizada y precisa
  useEffect(() => {
    if (!terminoBusqueda.trim()) {
      // Sin término de búsqueda - mostrar todas
      setPolizasFiltradas(polizas);
    } else {
      const filtradas = polizas.filter((pol) => {
        const terminoOriginal = terminoBusqueda.trim();
        const terminoNormalizado = normalizarTexto(terminoOriginal);

        // Crear contenido básico searchable de la card - SIN términos adicionales confusos
        const contenidoCompleto = [
          pol.nombre,
          pol.ubicacion,
          getCoordinadorNombre(pol.coordinador), // Nombre del coordinador
        ].join(' ');

        const contenidoNormalizado = normalizarTexto(contenidoCompleto);

        // 1. Búsqueda exacta normalizada (sin acentos, case-insensitive) - PRIORIDAD ALTA
        if (contenidoNormalizado.includes(terminoNormalizado)) return true;

        // 2. Búsqueda por palabras individuales (para términos con espacios) - PRIORIDAD MEDIA
        const palabrasBusqueda = terminoNormalizado.split(' ').filter(palabra => palabra.length > 2);
        if (palabrasBusqueda.length > 1) {
          const todasCoinciden = palabrasBusqueda.every(palabra =>
            contenidoNormalizado.includes(palabra)
          );
          if (todasCoinciden) return true;
        }

        // 3. Búsqueda difusa MUY RESTRICTIVA (solo para errores ortográficos obvios)
        if (terminoNormalizado.length >= 5) { // Solo para términos de 5+ caracteres
          // Buscar solo en nombre y ubicación directamente
          if (coincidenciaDifusa(terminoOriginal, pol.nombre, 1)) return true; // Tolerancia máxima 1
          if (coincidenciaDifusa(terminoOriginal, pol.ubicacion, 1)) return true; // Tolerancia máxima 1

          // Para coordinador, buscar por partes del nombre
          const coordNombre = getCoordinadorNombre(pol.coordinador);
          if (coordNombre !== "Sin asignar") {
            const partesCoord = coordNombre.split(' ');
            if (partesCoord.some(parte => parte.length >= 4 && coincidenciaDifusa(terminoOriginal, parte, 1))) {
              return true;
            }
          }
        }

        // 4. Búsqueda parcial solo para subcadenas largas y específicas
        if (terminoNormalizado.length >= 4) {
          const palabrasContenido = contenidoNormalizado.split(' ').filter(palabra => palabra.length >= 3);
          return palabrasContenido.some(palabra =>
            palabra.includes(terminoNormalizado) && terminoNormalizado.length >= palabra.length * 0.6 // Al menos 60% de la palabra
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
    const nuevoTermino = e.target.value;
    setTerminoBusqueda(nuevoTermino);

    // Cerrar todas las cards expandidas al empezar a escribir
    window.dispatchEvent(new CustomEvent('closeExpandedCard'));

    // Si se está escribiendo algo nuevo, ir a página 1
    if (nuevoTermino.trim()) {
      setPaginaActual(1);
    }
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

    // Cerrar todas las cards expandidas al limpiar búsqueda
    window.dispatchEvent(new CustomEvent('closeExpandedCard'));
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

      // Hacer scroll suave hacia arriba al cambiar página
      const wrapper = document.querySelector('.preview-poliza__wrapper');
      if (wrapper) {
        wrapper.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  // Función para ir a página anterior
  const paginaAnterior = () => {
    if (paginaActual > 1) {
      setPaginaActual(paginaActual - 1);
      // Cerrar cualquier card expandida al cambiar de página
      window.dispatchEvent(new CustomEvent('closeExpandedCard'));

      // Hacer scroll suave hacia arriba al cambiar página
      const wrapper = document.querySelector('.preview-poliza__wrapper');
      if (wrapper) {
        wrapper.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  // Función para ir a página siguiente
  const paginaSiguiente = () => {
    if (paginaActual < totalPaginas) {
      setPaginaActual(paginaActual + 1);
      // Cerrar cualquier card expandida al cambiar de página
      window.dispatchEvent(new CustomEvent('closeExpandedCard'));

      // Hacer scroll suave hacia arriba al cambiar página
      const wrapper = document.querySelector('.preview-poliza__wrapper');
      if (wrapper) {
        wrapper.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  };

  // Resetear búsqueda cuando cambian los datos
  useEffect(() => {
    if (terminoBusqueda.trim() !== '') {
      setPaginaActual(1); // Resetear a primera página al buscar
    }
  }, [terminoBusqueda]);

  // useEffect para cerrar cards automáticamente al cambiar búsqueda
  useEffect(() => {
    // Cerrar todas las cards expandidas cuando cambia el término de búsqueda
    window.dispatchEvent(new CustomEvent('closeExpandedCard'));
  }, [terminoBusqueda]); // Se ejecuta cada vez que cambia el término de búsqueda

  // ===== FUNCIONES PARA BÚSQUEDA DE COORDINADORES =====

  // Función para filtrar coordinadores
  const filtrarCoordinadores = (termino: string) => {
    if (!termino.trim()) {
      setCoordinadoresFiltrados([]);
      setMostrandoSugerencias(false);
      return;
    }

    const terminoNormalizado = normalizarTexto(termino);
    const coordinadoresCoincidentes = coordinadores.filter(coordinador => {
      const nombreCompleto = `${coordinador.nombre} ${coordinador.apellido_paterno} ${coordinador.apellido_materno || ''}`;
      const nombreNormalizado = normalizarTexto(nombreCompleto);
      return nombreNormalizado.includes(terminoNormalizado) ||
        nombreNormalizado.startsWith(terminoNormalizado);
    });

    setCoordinadoresFiltrados(coordinadoresCoincidentes);
    setMostrandoSugerencias(coordinadoresCoincidentes.length > 0);

    console.log('🔍 Filtro de coordinadores:', {
      termino: termino,
      terminoNormalizado: terminoNormalizado,
      coincidencias: coordinadoresCoincidentes.length,
      coordinadoresEncontrados: coordinadoresCoincidentes.map(c => formatCoordinador(c))
    });
  };

  // Función para manejar la búsqueda
  const manejarBusquedaCoordinador = (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value;
    setBusquedaCoordinador(valor);
    filtrarCoordinadores(valor);
  };

  // Función para seleccionar coordinador de las sugerencias
  const seleccionarCoordinador = (coordinador: Coordinador) => {
    setFormData({ ...formData, coordinador: coordinador._id });
    setBusquedaCoordinador(formatCoordinador(coordinador));
    setMostrandoSugerencias(false);
    setCoordinadoresFiltrados([]);
  };

  // Función para limpiar la búsqueda
  const limpiarBusquedaCoordinador = () => {
    setBusquedaCoordinador("");
    setFormData({ ...formData, coordinador: "" });
    setMostrandoSugerencias(false);
    setCoordinadoresFiltrados([]);
  };

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
        // Actualizar estados locales con datos actualizados - PREVENIR DUPLICADOS
        const polizasActualizadas = polizas.map((p) =>
          p._id === idEditando ? { ...p, ...polizaRes.data, resaltado: true } : { ...p, resaltado: false }
        );
        setPolizas(polizasActualizadas);

        // Recalcular filtradas basado en la búsqueda actual
        if (terminoBusqueda.trim()) {
          const filtradas = polizasActualizadas.filter((pol) => {
            const terminoNormalizado = normalizarTexto(terminoBusqueda.trim());
            const contenidoCompleto = [
              pol.nombre,
              pol.ubicacion,
              getCoordinadorNombre(pol.coordinador),
            ].join(' ');
            const contenidoNormalizado = normalizarTexto(contenidoCompleto);
            return contenidoNormalizado.includes(terminoNormalizado);
          });
          setPolizasFiltradas(filtradas);
          // Ir a la página donde está la póliza editada en los resultados filtrados
          const paginaPoliza = calcularPaginaParaPoliza(idEditando, filtradas);
          setPaginaActual(paginaPoliza);
        } else {
          setPolizasFiltradas(polizasActualizadas);
          // Ir a la página donde está la póliza editada
          const paginaPoliza = calcularPaginaParaPoliza(idEditando, polizasActualizadas);
          setPaginaActual(paginaPoliza);
        }

        // Quitar el resaltado después de 3 segundos
        setTimeout(() => {
          const polizasSinResaltar = polizasActualizadas.map(p => ({ ...p, resaltado: false }));
          setPolizas(polizasSinResaltar);
          // También actualizar filtradas sin resaltado
          if (terminoBusqueda.trim()) {
            const filtradasSinResaltar = polizasSinResaltar.filter((pol) => {
              const terminoNormalizado = normalizarTexto(terminoBusqueda.trim());
              const contenidoCompleto = [
                pol.nombre,
                pol.ubicacion,
                getCoordinadorNombre(pol.coordinador),
              ].join(' ');
              const contenidoNormalizado = normalizarTexto(contenidoCompleto);
              return contenidoNormalizado.includes(terminoNormalizado);
            });
            setPolizasFiltradas(filtradasSinResaltar);
          } else {
            setPolizasFiltradas(polizasSinResaltar);
          }
        }, 3000);

        toast.success("Póliza actualizada exitosamente.");
      } else {
        // Crear nueva póliza
        polizaRes = await api.post("/polizas", payloadPol);
        // Agregar nueva póliza a ambos estados con resaltado - PREVENIR DUPLICADOS
        const nuevaPoliza = { ...polizaRes.data, resaltado: true };
        const polizasActualizadas = [...polizas.map(p => ({ ...p, resaltado: false })), nuevaPoliza];
        setPolizas(polizasActualizadas);

        // Manejar filtradas dependiendo de si hay búsqueda activa
        if (terminoBusqueda.trim()) {
          // Verificar si la nueva póliza coincide con la búsqueda actual
          const terminoNormalizado = normalizarTexto(terminoBusqueda.trim());
          const contenidoCompleto = [
            nuevaPoliza.nombre,
            nuevaPoliza.ubicacion,
            getCoordinadorNombre(nuevaPoliza.coordinador),
          ].join(' ');
          const contenidoNormalizado = normalizarTexto(contenidoCompleto);

          if (contenidoNormalizado.includes(terminoNormalizado)) {
            // La nueva póliza coincide con la búsqueda - agregarla a filtradas
            const filtradasActualizadas = [...polizasFiltradas.map(p => ({ ...p, resaltado: false })), nuevaPoliza];
            setPolizasFiltradas(filtradasActualizadas);
            const ultimaPagina = Math.ceil(filtradasActualizadas.length / CARDS_POR_PAGINA);
            setPaginaActual(ultimaPagina);
          } else {
            // La nueva póliza no coincide - mantener filtradas sin cambios
            setPolizasFiltradas(polizasFiltradas.map(p => ({ ...p, resaltado: false })));
            // No cambiar página ya que la nueva póliza no se muestra
          }
        } else {
          // Sin búsqueda - mostrar toda la lista
          setPolizasFiltradas(polizasActualizadas);
          const ultimaPagina = Math.ceil(polizasActualizadas.length / CARDS_POR_PAGINA);
          setPaginaActual(ultimaPagina);
        }

        // Quitar el resaltado después de 3 segundos
        setTimeout(() => {
          const polizasSinResaltar = polizasActualizadas.map(p => ({ ...p, resaltado: false }));
          setPolizas(polizasSinResaltar);
          // También actualizar filtradas sin resaltado
          if (terminoBusqueda.trim()) {
            const filtradasSinResaltar = polizasFiltradas.map(p => ({ ...p, resaltado: false }));
            setPolizasFiltradas(filtradasSinResaltar);
          } else {
            setPolizasFiltradas(polizasSinResaltar);
          }
        }, 3000);

        toast.success("Póliza creada exitosamente.");
      }

      // Limpiar formulario y cerrar modal
      setFormData({ nombre: "", ubicacion: "", coordinador: "" });
      setBusquedaCoordinador("");
      setMostrandoSugerencias(false);
      setCoordinadoresFiltrados([]);
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
    const coordinadorId = typeof poliza.coordinador === "string" ? poliza.coordinador : poliza.coordinador?._id || "";

    setFormData({
      nombre: poliza.nombre,
      ubicacion: poliza.ubicacion,
      coordinador: coordinadorId,
    });

    // Inicializar búsqueda con el coordinador actual
    if (coordinadorId) {
      const coordinadorActual = coordinadores.find(c => c._id === coordinadorId);
      if (coordinadorActual) {
        setBusquedaCoordinador(formatCoordinador(coordinadorActual));
      }
    } else {
      setBusquedaCoordinador("");
    }

    setIdEditando(poliza._id);
    setModoEdicion(true);
    setMostrarModal(true);
    setErrores({});
    setMostrandoSugerencias(false);
    setCoordinadoresFiltrados([]);
  };

  // Función para formatear coordinador (utilidad para selects)
  const formatCoordinador = (coord: Coordinador) => {
    return `${coord.nombre} ${coord.apellido_paterno} ${coord.apellido_materno || ""}`.trim();
  };

  // ===== FUNCIONES PARA MODAL DE ELIMINAR =====
  const confirmarEliminacion = async () => {
    if (polizaAEliminar) {
      // Agregar clase de animación de salida
      const modalContent = document.querySelector('.modal-content-coordinadores');
      if (modalContent) {
        modalContent.classList.add('closing');
        // Esperar a que termine la animación antes de cerrar
        setTimeout(() => {
          setShowModalEliminar(false);
          setPolizaAEliminar(null);
        }, 300);
      } else {
        setShowModalEliminar(false);
        setPolizaAEliminar(null);
      }

      try {
        await api.delete(`/polizas/${polizaAEliminar._id}`);
        // Actualizar ambos estados para mantener sincronización - ORDEN IMPORTA
        const nuevasPolizas = polizas.filter((p) => p._id !== polizaAEliminar._id);
        setPolizas(nuevasPolizas);

        // Filtrar inmediatamente basado en el término actual para evitar duplicados
        if (terminoBusqueda.trim()) {
          const filtradas = nuevasPolizas.filter((pol) => {
            const terminoNormalizado = normalizarTexto(terminoBusqueda.trim());
            const contenidoCompleto = [
              pol.nombre,
              pol.ubicacion,
              getCoordinadorNombre(pol.coordinador),
            ].join(' ');
            const contenidoNormalizado = normalizarTexto(contenidoCompleto);
            return contenidoNormalizado.includes(terminoNormalizado);
          });
          setPolizasFiltradas(filtradas);
        } else {
          setPolizasFiltradas(nuevasPolizas);
        }

        toast.success("Póliza eliminada exitosamente.");
      } catch (err) {
        toast.error("Error al eliminar la póliza.");
        console.error("Error al eliminar la póliza:", err);
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
        setPolizaAEliminar(null);
      }, 300);
    } else {
      setShowModalEliminar(false);
      setPolizaAEliminar(null);
    }
  };

  // Función simplificada para abrir modal de eliminar
  const handleEliminar = (id: string | undefined) => {
    console.log('handleEliminar llamado con ID:', id);
    if (!id) return;
    const poliza = polizas.find(p => p._id === id);
    console.log('Póliza encontrada:', poliza);
    if (poliza) {
      setPolizaAEliminar(poliza);
      setShowModalEliminar(true);
      console.log('Modal debería abrirse ahora');
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
            {/* Botón para abrir modal de registro/creación - Solo para administradores */}
            {!isCoordinador && (
              <button
                className="btn-registrar-poliza"
                onClick={() => {
                  // Cerrar cualquier card expandida al abrir modal
                  window.dispatchEvent(new CustomEvent('closeExpandedCard'));

                  setMostrarModal(true);
                  setModoEdicion(false); // Modo creación
                  setIdEditando(null);
                  // Limpiar formulario para nueva póliza
                  setFormData({ nombre: "", ubicacion: "", coordinador: "" });
                  setBusquedaCoordinador("");
                  setMostrandoSugerencias(false);
                  setCoordinadoresFiltrados([]);
                }}
              >
                <i className="bi bi-plus-circle"></i>
                Registrar
              </button>
            )}
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
            isCoordinador={isCoordinador} // Pasar información del rol para ocultar botones CRUD
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
        <div className="modal-overlay-coordinadores">
          <div className="modal-content-coordinadores">
            <button className="modal-close" onClick={() => {
              setMostrarModal(false);
              setModoEdicion(false);
              setIdEditando(null);
              setFormData({ nombre: "", ubicacion: "", coordinador: "" });
              setBusquedaCoordinador("");
              setMostrandoSugerencias(false);
              setCoordinadoresFiltrados([]);
              setErrores({});
            }}>
              ×
            </button>

            <div className="modal-title" style={{ fontWeight: 'bold' }}>
              {modoEdicion ? "Editar Póliza" : "Registrar Nueva Póliza"}
            </div>

            <form onSubmit={handleSubmit}>
              <div className="modal-user-info">
                {/* Campo nombre de póliza con validación */}
                <div className="form-group">
                  <label>Nombre de la Póliza:</label>
                  <input
                    type="text"
                    name="nombre"
                    value={formData.nombre}
                    onChange={handleChange}
                    className={errores.nombre ? "input-error" : ""}
                    placeholder="Ingrese el nombre de la póliza"
                  />
                  {errores.nombre && <span className="mensaje-error-poliza">{errores.nombre}</span>}
                </div>

                {/* Campo ubicación con validación */}
                <div className="form-group">
                  <label>Ubicación:</label>
                  <input
                    type="text"
                    name="ubicacion"
                    value={formData.ubicacion}
                    onChange={handleChange}
                    className={errores.ubicacion ? "input-error" : ""}
                    placeholder="Ingrese la ubicación"
                  />
                  {errores.ubicacion && <span className="mensaje-error-poliza">{errores.ubicacion}</span>}
                </div>

                {/* Búsqueda de coordinador */}
                <div className="form-group">
                  <label>Coordinador (opcional):</label>
                  <div className="coordinador-search-container" style={{ position: 'relative' }}>
                    <input
                      type="text"
                      placeholder="Escriba para buscar coordinador o deje vacío para 'Sin asignar'"
                      value={busquedaCoordinador}
                      onChange={manejarBusquedaCoordinador}
                      onFocus={() => {
                        if (busquedaCoordinador.trim()) {
                          filtrarCoordinadores(busquedaCoordinador);
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '8px 30px 8px 12px',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        fontSize: '14px'
                      }}
                    />
                    {busquedaCoordinador && (
                      <button
                        type="button"
                        onClick={limpiarBusquedaCoordinador}
                        className="clear-search-btn"
                        title="Limpiar búsqueda"
                      >
                        ×
                      </button>
                    )}

                    {/* Sugerencias dropdown */}
                    {mostrandoSugerencias && coordinadoresFiltrados.length > 0 && (
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        backgroundColor: 'white',
                        border: '1px solid #ccc',
                        borderTop: 'none',
                        borderRadius: '0 0 4px 4px',
                        maxHeight: '200px',
                        overflowY: 'auto',
                        zIndex: 1000,
                        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                      }}>
                        {coordinadoresFiltrados.slice(0, 5).map((coordinador) => (
                          <div
                            key={coordinador._id}
                            onClick={() => seleccionarCoordinador(coordinador)}
                            style={{
                              padding: '8px 12px',
                              cursor: 'pointer',
                              borderBottom: '1px solid #eee',
                              transition: 'background-color 0.2s'
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.backgroundColor = '#f5f5f5';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.backgroundColor = 'white';
                            }}
                          >
                            {formatCoordinador(coordinador)}
                          </div>
                        ))}
                        {coordinadoresFiltrados.length > 5 && (
                          <div style={{
                            padding: '8px 12px',
                            color: '#666',
                            fontSize: '12px',
                            fontStyle: 'italic'
                          }}>
                            ... y {coordinadoresFiltrados.length - 5} más
                          </div>
                        )}
                      </div>
                    )}
                  </div>
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
                    setFormData({ nombre: "", ubicacion: "", coordinador: "" });
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

      {/* Modal de confirmación para eliminar */}
      {(() => {
        console.log('Renderizando modal - showModalEliminar:', showModalEliminar, 'polizaAEliminar:', polizaAEliminar);
        return showModalEliminar && polizaAEliminar && (
          <div className="modal-overlay-coordinadores">
            <div className="modal-content-coordinadores">
              <button className="modal-close" onClick={cancelarEliminacion}>
                ×
              </button>

              <div className="modal-title">
                ¿Seguro que quieres <strong>eliminar</strong> esta póliza?
              </div>

              <div className="modal-user-info">
                <p><strong>Póliza:</strong> {polizaAEliminar.nombre}</p>
                <p><strong>Ubicación:</strong> {polizaAEliminar.ubicacion}</p>
                <div className="modal-warning">
                  <i className="bi bi-exclamation-triangle"></i>
                  <span>Esta acción es irreversible. Se perderá toda la información asociada, y tanto las personas como las especialidades vinculadas quedarán sin póliza.</span>
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
        );
      })()}
    </div>
  );
};

export default Polizas;