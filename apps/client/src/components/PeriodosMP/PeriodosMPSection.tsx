import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { jwtDecode } from 'jwt-decode';
import { CiEdit, CiTrash } from 'react-icons/ci';
import { formatDateRangeUTC, formatDateUTC, inputDateToUTC } from '../../utils/dateUtils';
import { getBaseApiUrl } from '../../utils/apiUrl';
import SubirReporteModal from '../SubirReporteModal';
import './PeriodosMPSection.css';
import '../../styles/Periodos MP.css'; // Importar estilos consistentes con Colaboradores
import '../../styles/Polizas.css'; // Importar estilos del carrusel de pólizas
import '../../styles/coordinadores.css'; // Importar estilos de coordinadores

interface Colaborador {
  _id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno?: string;
  correo: string;
  telefono?: string;
  rol: string;
  estado?: string;
  poliza?: {
    _id: string;
    nombre: string;
  };
}

interface DeviceCatalog {
  _id: string;
  type: string;
  ubication: string;
  identifier: string;
  building?: string;
  level?: string;
  poliza?: string | { _id: string; nombre: string;[key: string]: any };
  especialidad?: string | { _id: string; nombre: string;[key: string]: any };
}

interface DeviceCatalogConDisponibilidad extends DeviceCatalog {
  disponible: boolean;
  yaAsignado: boolean;
}

interface DispositivoAsignado {
  deviceCatalogId: string;
  colaboradorId: string;
}

interface PeriodoMP {
  _id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
  especialidad?: string | { _id: string; nombre: string }; // Puede ser ID o objeto completo
  dispositivos: Array<{
    deviceCatalog: DeviceCatalog;
    colaboradorAsignado: Colaborador;
    estado: 'pendiente' | 'en_progreso' | 'completado';
    fechaAsignacion: string;
    fechaCompletado?: string;
    asignacionMultiple?: boolean;
    completadoPor?: Colaborador;
    esColaborativo?: boolean;
    colaboradores?: Colaborador[];
    colaboradoresElegibles?: Colaborador[];
  }>;
  totalDispositivos: number;
  dispositivosCompletados: number;
  porcentajeCompletado: number;
}

const PeriodosMPSection: React.FC = () => {
  const [periodos, setPeriodos] = useState<PeriodoMP[]>([]);
  const [allPeriodos, setAllPeriodos] = useState<PeriodoMP[]>([]); // Estado para todos los períodos sin filtrar
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [dispositivos, setDispositivos] = useState<DeviceCatalog[]>([]);
  const [especialidades, setEspecialidades] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Estado para crear/editar período
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPeriodoId, setEditingPeriodoId] = useState<string | null>(null);
  const [newPeriodo, setNewPeriodo] = useState({
    especialidad: '',
    fechaInicio: '',
    fechaFin: ''
  });

  // Estados para modales de crear/editar
  const [showModalCrearPeriodo, setShowModalCrearPeriodo] = useState(false);
  const [showModalEditarPeriodo, setShowModalEditarPeriodo] = useState(false);
  const [periodoAEditar, setPeriodoAEditar] = useState<PeriodoMP | null>(null);

  // Estado para asignar dispositivos
  const [showAssignForm, setShowAssignForm] = useState<string | null>(null);
  const [deviceAssignments, setDeviceAssignments] = useState<DispositivoAsignado[]>([]);

  // Estados para nuevo modal de asignar dispositivos (carrusel simple)
  const [showModalAsignarDispositivos, setShowModalAsignarDispositivos] = useState(false);
  const [periodoParaAsignar, setPeriodoParaAsignar] = useState<PeriodoMP | null>(null);

  // Estados para la selección de dispositivos
  const [dispositivosSeleccionados, setDispositivosSeleccionados] = useState<string[]>([]);

  // Estados para el carrusel de dispositivos
  const [carruselDispositivosIndex, setCarruselDispositivosIndex] = useState(0);
  const DISPOSITIVOS_POR_PAGINA = 1; // 1 dispositivo a la vez como en el carrusel de pólizas

  // Estados para validación y errores
  const [dispositivosDisponibles, setDispositivosDisponibles] = useState<DeviceCatalogConDisponibilidad[]>([]);



  // Estado para mantener el orden de dispositivos por período
  const [deviceOrder, setDeviceOrder] = useState<{ [periodoId: string]: { [deviceKey: string]: number } }>({});

  // Estados para el modal de subir reporte
  const [showSubirReporteModal, setShowSubirReporteModal] = useState(false);
  const [dispositivoSeleccionadoParaReporte, setDispositivoSeleccionadoParaReporte] = useState<{
    deviceId: string;
    deviceIdentifier: string;
    deviceType: string;
    deviceUbication: string;
    deviceBuilding: string;
    deviceLevel: string;
    deviceNote: string;
    periodoId: string;
    colaboradorId: string;
    isMultipleAssignment: boolean;
    collaborators: any[];
  } | null>(null);

  const [coordinadorId, setCoordinadorId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserPoliza, setCurrentUserPoliza] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  // Estados para modales de confirmación de eliminación
  const [showModalEliminarPeriodo, setShowModalEliminarPeriodo] = useState(false);
  const [periodoAEliminar, setPeriodoAEliminar] = useState<PeriodoMP | null>(null);
  const [showModalEliminarDispositivo, setShowModalEliminarDispositivo] = useState(false);
  const [dispositivoAEliminar, setDispositivoAEliminar] = useState<{
    periodoId: string;
    deviceId: string;
    deviceIdentifier: string;
    tipo: 'asignacion' | 'reporte';
  } | null>(null);

  // Estado para deshabilitar botones de delete específicos durante eliminación
  const [dispositivosEliminandose, setDispositivosEliminandose] = useState<Set<string>>(new Set());

  // Estado específico para el modal de eliminación
  const [eliminandoDispositivo, setEliminandoDispositivo] = useState(false);

  // Estado para el carrusel
  const [currentPeriodoIndex, setCurrentPeriodoIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [animationClass, setAnimationClass] = useState('');

  useEffect(() => {
    // Obtener ID del coordinador y rol del token
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('rol')?.toLowerCase() || '';

    setUserRole(role);
    console.log('🔍 Rol del usuario:', role);

    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        setCoordinadorId(decoded.userId);
        setCurrentUserId(decoded.userId);

        // Para auxiliares técnicos, obtener la póliza del token
        if (decoded.polizaId) {
          setCurrentUserPoliza(decoded.polizaId);
          console.log('🏢 Póliza del usuario auxiliar:', decoded.polizaId);
        }
      } catch (error) {
        console.error('Error decodificando token:', error);
      }
    }

    console.log('🚀 Inicializando PeriodosMPSection para coordinador:', coordinadorId);
    fetchPeriodos();
    fetchColaboradores();
    fetchDispositivos();
    fetchEspecialidades();
  }, [currentUserId]); // Dependencia para recargar cuando cambie el usuario

  // Verificar si el usuario es colaborador (encargado o auxiliar)
  const isColaborador = userRole === 'encargado' || userRole === 'auxiliar';
  const esAuxiliarTecnico = userRole === 'auxiliar'; // Solo auxiliares tienen filtrado por póliza

  // useEffect separado para cargar datos cuando el coordinadorId esté disponible
  useEffect(() => {
    if (coordinadorId && !isColaborador) {
      fetchPeriodos();
    }
  }, [coordinadorId, isColaborador]);

  // Funciones del carrusel
  const nextPeriodo = () => {
    if (isAnimating || periodos.length === 0 || currentPeriodoIndex >= periodos.length - 1) return;

    setIsAnimating(true);
    setAnimationClass('slide-in-left');

    // Cambiar al siguiente período (más reciente) - SIN CICLO
    setCurrentPeriodoIndex((prev) => prev + 1);

    setTimeout(() => {
      setIsAnimating(false);
      setAnimationClass('');
    }, 500);
  };

  const prevPeriodo = () => {
    if (isAnimating || periodos.length === 0 || currentPeriodoIndex <= 0) return;

    setIsAnimating(true);
    setAnimationClass('slide-in-right');

    // Cambiar al período anterior (más antiguo) - SIN CICLO
    setCurrentPeriodoIndex((prev) => prev - 1);

    setTimeout(() => {
      setIsAnimating(false);
      setAnimationClass('');
    }, 500);
  };

  // Resetear índice cuando cambien los períodos
  useEffect(() => {
    if (periodos.length > 0 && currentPeriodoIndex >= periodos.length) {
      setCurrentPeriodoIndex(0);
    }
  }, [periodos.length, currentPeriodoIndex]);

  // useEffect para limpiar estados cuando cambia el período activo
  useEffect(() => {
    clearStatesOnPeriodChange();
  }, [currentPeriodoIndex]);

  // useEffect adicional para limpiar estados específicos cuando se actualiza la lista de períodos
  useEffect(() => {
    // Solo limpiar si hay un período activo y ha cambiado
    if (periodos.length > 0 && currentPeriodoIndex < periodos.length) {
      const currentPeriodo = periodos[currentPeriodoIndex];
      if (currentPeriodo) {
        // Limpiar solo estados que podrían estar "atascados" en el período anterior
        setShowAssignForm(null);
      }
    }
  }, [periodos, currentPeriodoIndex]);

  // useEffect adicional para recargar colaboradores cuando currentUserId esté disponible
  useEffect(() => {
    if (currentUserId && isColaborador) {
      fetchColaboradores();
    }
  }, [currentUserId, isColaborador]);

  // Cargar períodos cuando cambie la póliza del usuario auxiliar
  useEffect(() => {
    if (currentUserPoliza && esAuxiliarTecnico) {
      console.log('🔄 Recargando períodos MP para auxiliar con póliza:', currentUserPoliza);
      fetchPeriodos();
    }
  }, [currentUserPoliza, esAuxiliarTecnico]);

  const fetchPeriodos = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsRefreshing(true);
      }

      const token = localStorage.getItem('token');
      // Agregar timestamp para evitar cache si es refresh forzado
      const cacheParam = forceRefresh ? `&_t=${Date.now()}` : '';

      // Construir URL según el rol del usuario
      let url = '';
      if (esAuxiliarTecnico && currentUserPoliza) {
        // Para auxiliares técnicos: filtrar por póliza
        url = `${getBaseApiUrl()}/periodos-mp?poliza=${currentUserPoliza}${cacheParam}`;
        console.log('🔧 Cargando períodos MP para auxiliar técnico con póliza:', currentUserPoliza);
      } else if (isColaborador) {
        // Para encargados/colaboradores regulares: sin filtros (verán períodos donde están asignados)
        url = `${getBaseApiUrl()}/periodos-mp${cacheParam}`;
        console.log('👥 Cargando períodos MP para colaborador/encargado sin filtros');
      } else {
        // Para coordinadores: usar coordinadorId como antes
        if (!coordinadorId) {
          console.log('⚠️ coordinadorId no disponible aún, saltando fetch');
          return;
        }
        url = `${getBaseApiUrl()}/periodos-mp?coordinador=${coordinadorId}${cacheParam}`;
        console.log('👨‍💼 Cargando períodos MP para coordinador:', coordinadorId);
      }

      console.log('📡 URL de períodos MP:', url);

      const response = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📅 Períodos MP recibidos:', data);
        console.log('📅 Array de períodos:', data.data || []);

        if (data.data && data.data.length > 0) {
          console.log('📅 Primer período completo:', data.data[0]);
          if (data.data[0].dispositivos) {
            console.log('📱 Dispositivos del primer período:', data.data[0].dispositivos);
          }
        }

        // Capturar el orden inicial de dispositivos para cada período
        const newDeviceOrder: { [periodoId: string]: { [deviceKey: string]: number } } = {};

        data.data?.forEach((periodo: PeriodoMP) => {
          if (periodo.dispositivos && periodo.dispositivos.length > 0) {
            newDeviceOrder[periodo._id] = {};
            periodo.dispositivos.forEach((dispositivo, index) => {
              // Crear clave única para cada dispositivo
              const deviceKey = dispositivo.asignacionMultiple
                ? `${dispositivo.deviceCatalog._id}-multiple`
                : `${dispositivo.deviceCatalog._id}-${dispositivo.colaboradorAsignado?._id || 'no-assigned'}`;

              newDeviceOrder[periodo._id][deviceKey] = index;
            });
          }
        });

        // Actualizar el orden de dispositivos
        setDeviceOrder(prev => ({
          ...prev,
          ...newDeviceOrder
        }));

        // Guardar todos los períodos sin filtrar
        setAllPeriodos(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching períodos:', error);
    } finally {
      if (forceRefresh) {
        setIsRefreshing(false);
      }
    }
  };

  // Función para refresh completo de TODA la sección de Períodos MP
  const refreshFullSection = async (delay = 300) => {
    // Limpiar estados antes de actualizar
    clearStatesOnPeriodChange();

    // Mostrar indicador de actualización
    setIsRefreshing(true);

    setTimeout(async () => {
      try {
        console.log('🔄 Actualizando TODA la sección de Períodos MP...');

        // Actualizar todos los datos de la sección en paralelo para mayor eficiencia
        await Promise.all([
          fetchPeriodos(true),
          fetchColaboradores(),
          fetchDispositivos(),
          fetchEspecialidades()
        ]);

        console.log('✅ Sección completa actualizada exitosamente');

        // Pequeña demora adicional para mostrar el indicador visual
        setTimeout(() => {
          setIsRefreshing(false);
        }, 200);
      } catch (error) {
        console.error('❌ Error actualizando sección completa:', error);
        setIsRefreshing(false);
      }
    }, delay);
  };

  // Función para refresh total como si fuera refresh del navegador (solo para eliminaciones de períodos)
  const refreshLikeBrowser = async (delay = 500) => {
    console.log('🔄 Reiniciando completamente la sección de Períodos MP...');

    // Mostrar indicador de actualización
    setIsRefreshing(true);

    setTimeout(async () => {
      try {
        // 1. Resetear TODOS los estados a sus valores iniciales
        setCurrentPeriodoIndex(0);
        setPeriodos([]);
        setColaboradores([]);
        setDispositivos([]);
        setEspecialidades([]);
        setLoading(false);
        setShowCreateForm(false);
        setShowAssignForm(null);
        setIsEditMode(false);
        setEditingPeriodoId(null);
        setNewPeriodo({
          especialidad: '',
          fechaInicio: '',
          fechaFin: ''
        });
        setDeviceAssignments([]);
        setDeviceOrder({});
        setIsAnimating(false);
        setAnimationClass('');

        console.log('🧹 Estados reseteados completamente');

        // 2. Pequeña pausa para simular reinicio completo
        await new Promise(resolve => setTimeout(resolve, 200));

        // 3. Recargar TODOS los datos desde cero como en el useEffect inicial
        await Promise.all([
          fetchPeriodos(true),
          fetchColaboradores(),
          fetchDispositivos(),
          fetchEspecialidades()
        ]);

        console.log('✅ Sección completamente reiniciada - como refresh de navegador');

        // 4. Finalizar indicador
        setTimeout(() => {
          setIsRefreshing(false);
        }, 300);
      } catch (error) {
        console.error('❌ Error reiniciando sección completa:', error);
        setIsRefreshing(false);
      }
    }, delay);
  };

  // Función para limpiar estados cuando se cambia de período
  const clearStatesOnPeriodChange = () => {
    // Cerrar cualquier modal o formulario abierto
    setShowCreateForm(false);
    setShowAssignForm(null);
    setIsEditMode(false);
    setEditingPeriodoId(null);

    // Limpiar formularios
    setNewPeriodo({
      especialidad: '',
      fechaInicio: '',
      fechaFin: ''
    });

    // Limpiar asignaciones de dispositivos
    setDeviceAssignments([]);

    // Limpiar estados de carga si existen
    setLoading(false);
  };

  // Función para calcular estadísticas reales basadas en dispositivos filtrados
  const calculateRealStats = (periodo: PeriodoMP) => {
    const dispositivos = periodo.dispositivos;
    const total = dispositivos.length;
    const completados = dispositivos.filter(d => d.estado === 'completado').length;
    const porcentaje = total > 0 ? Math.round((completados / total) * 100) : 0;

    return {
      totalDispositivos: total,
      dispositivosCompletados: completados,
      porcentajeCompletado: porcentaje
    };
  };

  // useEffect separado para filtrar períodos según el rol del usuario
  useEffect(() => {
    if (allPeriodos.length === 0) return;

    let filteredPeriodos = allPeriodos;

    if (isColaborador && currentUserId) {
      filteredPeriodos = allPeriodos.map((periodo: PeriodoMP) => ({
        ...periodo,
        dispositivos: periodo.dispositivos.filter(dispositivo => {
          // Incluir si es asignación múltiple o si está asignado específicamente a este colaborador
          return dispositivo.asignacionMultiple ||
            dispositivo.colaboradorAsignado?._id === currentUserId;
        })
      })).filter((periodo: PeriodoMP) => periodo.dispositivos.length > 0); // Solo mostrar períodos con dispositivos asignados
    }

    // Ordenar períodos por fecha de creación (del más antiguo al más nuevo en términos de creación)
    const sortedPeriodos = [...filteredPeriodos].sort((a, b) => {
      // Extraer timestamp del ObjectId (los primeros 8 caracteres contienen el timestamp de creación)
      const createdAtA = new Date(parseInt(a._id.substring(0, 8), 16) * 1000).getTime();
      const createdAtB = new Date(parseInt(b._id.substring(0, 8), 16) * 1000).getTime();
      return createdAtA - createdAtB; // Más antiguo primero (creado antes = primero)
    });

    console.log('📅 Períodos ordenados por CREACIÓN (del más antiguo al más nuevo):');
    sortedPeriodos.forEach((p, index) => {
      const createdTimestamp = new Date(parseInt(p._id.substring(0, 8), 16) * 1000);
      console.log(`  ${index}: ${p._id}`);
      console.log(`    - Nombre: ${p.nombre || 'Sin nombre'}`);
      console.log(`    - Creado: ${createdTimestamp.toLocaleString('es-ES')} (del ObjectId)`);
      console.log(`    - Fecha inicio período: ${new Date(p.fechaInicio).toLocaleDateString('es-ES')}`);
    });

    setPeriodos(sortedPeriodos);
  }, [allPeriodos, isColaborador, currentUserId]);

  // useEffect para resetear al período más antiguo (índice 0) cuando se cargan períodos
  useEffect(() => {
    if (periodos.length > 0) {
      console.log('🔄 Reseteando al período más antiguo (índice 0). Total períodos:', periodos.length);
      setCurrentPeriodoIndex(0); // Siempre empezar desde el más antiguo
    }
  }, [periodos.length]); // Solo cuando cambia la cantidad de períodos

  // Función para ordenar dispositivos por orden personalizado (manteniendo posiciones originales)
  const sortDevicesByCustomOrder = (dispositivos: PeriodoMP['dispositivos'], periodoId: string) => {
    const periodOrder = deviceOrder[periodoId] || {};

    return [...dispositivos].sort((a, b) => {
      // Crear claves para buscar en el orden guardado
      const keyA = a.asignacionMultiple
        ? `${a.deviceCatalog._id}-multiple`
        : `${a.deviceCatalog._id}-${a.colaboradorAsignado?._id || 'no-assigned'}`;

      const keyB = b.asignacionMultiple
        ? `${b.deviceCatalog._id}-multiple`
        : `${b.deviceCatalog._id}-${b.colaboradorAsignado?._id || 'no-assigned'}`;

      const orderA = periodOrder[keyA] ?? 9999; // Si no existe, ponerlo al final
      const orderB = periodOrder[keyB] ?? 9999;

      return orderA - orderB;
    });
  };

  const fetchColaboradores = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBaseApiUrl()}/colaboradores`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('📋 Colaboradores recibidos:', data);
        console.log('📋 Tipo de data:', typeof data, Array.isArray(data));

        // Verificar si data es un array o tiene una propiedad data
        const colaboradoresArray = Array.isArray(data) ? data : (data.data || data.colaboradores || []);
        console.log('📋 Array de colaboradores:', colaboradoresArray);
        console.log('📋 Cantidad de colaboradores:', colaboradoresArray.length);

        if (colaboradoresArray.length > 0) {
          console.log('📋 Primer colaborador:', colaboradoresArray[0]);
        }

        // Buscar el usuario actual para obtener su póliza
        const currentUser = colaboradoresArray.find((colab: Colaborador) => colab._id === currentUserId);
        if (currentUser && currentUser.poliza) {
          setCurrentUserPoliza(currentUser.poliza._id);
          console.log('📋 Póliza del usuario actual:', currentUser.poliza._id, currentUserPoliza);

          // Filtrar colaboradores por la misma póliza
          const colaboradoresMismaPoliza = colaboradoresArray.filter((colab: Colaborador) =>
            colab.poliza && colab.poliza._id === currentUser.poliza._id
          );
          setColaboradores(colaboradoresMismaPoliza);
          console.log('📋 Colaboradores de la misma póliza:', colaboradoresMismaPoliza.length);
        } else {
          // Si no se encuentra el usuario o no tiene póliza, mostrar todos
          setColaboradores(colaboradoresArray);
        }

        console.log('✅ Colaboradores procesados y guardados en estado');
      } else {
        console.error('❌ Error en respuesta:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error fetching colaboradores:', error);
    }
  };

  const fetchDispositivos = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBaseApiUrl()}/all-catalog-devices`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setDispositivos(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching dispositivos:', error);
    }
  };

  const fetchEspecialidades = async () => {
    try {
      const token = localStorage.getItem('token');
      console.log('🔍 Cargando especialidades...');
      const response = await fetch(`${getBaseApiUrl()}/especialidades`, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        console.log('✅ Especialidades recibidas:', data);

        // La respuesta es directamente un array, no tiene propiedad .data
        const especialidadesArray = Array.isArray(data) ? data : (data.data || []);
        console.log('📋 Array final de especialidades:', especialidadesArray);
        console.log('📋 Cantidad de especialidades:', especialidadesArray.length);

        if (especialidadesArray.length > 0) {
          console.log('📋 Primera especialidad:', especialidadesArray[0]);
        }

        setEspecialidades(especialidadesArray);
      } else {
        console.error('❌ Error en respuesta de especialidades:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error fetching especialidades:', error);
    }
  };

  // Función para obtener dispositivos ya asignados en períodos activos
  const getDispositivosAsignadosEnPeriodosActivos = () => {
    const dispositivosAsignados = new Set<string>();

    // Revisar todos los períodos activos Y que realmente existan
    const periodosActivos = periodos.filter(p => p && p._id && p.activo);

    periodosActivos.forEach(periodo => {
      // Verificación adicional de que el período existe
      if (!periodo || !periodo._id) {
        return;
      }

      if (periodo.dispositivos && Array.isArray(periodo.dispositivos)) {
        periodo.dispositivos.forEach(dispositivo => {
          // Extraer el identifier del deviceCatalog
          if (dispositivo.deviceCatalog && dispositivo.deviceCatalog.identifier) {
            dispositivosAsignados.add(dispositivo.deviceCatalog.identifier);
          }
        });
      }
    });
    console.log('🚫 DEBUG - Dispositivos asignados encontrados:', Array.from(dispositivosAsignados));
    return dispositivosAsignados;
  };

  // Función para filtrar dispositivos según póliza del coordinador y especialidad del período
  const getFilteredDispositivos = (periodoId?: string) => {
    if (!dispositivos.length) return [];

    // Obtener la póliza del coordinador del token
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        const userPoliza = decoded.polizaId;

        console.log('🔍 Información del token decodificado:', {
          decoded,
          userPoliza,
          tipoUserPoliza: typeof userPoliza
        });

        // Obtener la especialidad del período
        let especialidadPeriodo = null;

        if (periodoId) {
          // Si estamos asignando a un período existente, buscar su especialidad
          const periodo = periodos.find(p => p._id === periodoId) || allPeriodos.find(p => p._id === periodoId);
          if (periodo && periodo.especialidad) {
            especialidadPeriodo = periodo.especialidad;
            console.log('🎯 Período encontrado:', periodo.nombre, 'Especialidad completa:', periodo.especialidad);
            console.log('🎯 Tipo de especialidad:', typeof periodo.especialidad);

            // Si la especialidad es un objeto, extraer el ID
            if (typeof periodo.especialidad === 'object' && periodo.especialidad._id) {
              especialidadPeriodo = periodo.especialidad._id;
              console.log('🎯 Extrayendo ID de especialidad:', especialidadPeriodo);
            }
          }
        } else {
          // Si estamos creando un nuevo período, usar la especialidad del formulario
          if (newPeriodo.especialidad) {
            especialidadPeriodo = newPeriodo.especialidad;
            console.log('🎯 Usando especialidad del formulario:', especialidadPeriodo);
          }
        }

        console.log('🔍 Filtrando dispositivos por:', {
          userPoliza,
          especialidadPeriodo: typeof especialidadPeriodo === 'object' ? JSON.stringify(especialidadPeriodo) : especialidadPeriodo,
          periodoId,
          totalDispositivos: dispositivos.length
        });

        if (userPoliza) {
          // Analizar primer dispositivo para debugging
          const firstDevice = dispositivos[0];
          const firstDevicePolizaId = typeof firstDevice?.poliza === 'object' && firstDevice.poliza?._id
            ? firstDevice.poliza._id
            : firstDevice?.poliza;
          const firstDeviceEspecialidadId = typeof firstDevice?.especialidad === 'object' && firstDevice.especialidad?._id
            ? firstDevice.especialidad._id
            : firstDevice?.especialidad;

          console.log('🔍 Analizando primer dispositivo como ejemplo:', {
            identifier: firstDevice?.identifier,
            polizaOriginal: firstDevice?.poliza,
            polizaId: firstDevicePolizaId,
            especialidadOriginal: firstDevice?.especialidad,
            especialidadId: firstDeviceEspecialidadId,
            userPoliza: userPoliza,
            especialidadBuscada: especialidadPeriodo,
            matchPoliza: firstDevicePolizaId === userPoliza,
            matchEspecialidad: especialidadPeriodo ? firstDeviceEspecialidadId === especialidadPeriodo : true
          });

          const filtered = dispositivos.filter(device => {
            // Extraer IDs para comparación correcta
            const devicePolizaId = typeof device.poliza === 'object' && device.poliza?._id
              ? device.poliza._id
              : device.poliza;

            const deviceEspecialidadId = typeof device.especialidad === 'object' && device.especialidad?._id
              ? device.especialidad._id
              : device.especialidad;

            const matchPoliza = devicePolizaId === userPoliza;
            const matchEspecialidad = especialidadPeriodo ? deviceEspecialidadId === especialidadPeriodo : true;

            // Log detallado solo para los primeros 3 dispositivos para no saturar
            if (dispositivos.indexOf(device) < 3) {
              console.log(`📱 Dispositivo ${device.identifier} (detallado):`, {
                polizaDevice: device.poliza,
                polizaDeviceId: devicePolizaId,
                polizaUser: userPoliza,
                especialidadDevice: device.especialidad,
                especialidadDeviceId: deviceEspecialidadId,
                especialidadPeriodo: especialidadPeriodo,
                matchPoliza: matchPoliza,
                matchEspecialidad: matchEspecialidad,
                incluido: matchPoliza && matchEspecialidad,
                comparacionPoliza: `${devicePolizaId} === ${userPoliza} = ${matchPoliza}`,
                comparacionEspecialidad: `${deviceEspecialidadId} === ${especialidadPeriodo} = ${matchEspecialidad}`
              });
            }

            return matchPoliza && matchEspecialidad;
          });

          console.log('✅ Dispositivos filtrados:', filtered.length, 'de', dispositivos.length);
          if (filtered.length === 0) {
            console.log('⚠️ No se encontraron dispositivos que coincidan con los filtros');
          }
          return filtered;
        }
      } catch (error) {
        console.error('Error decodificando token para filtrar dispositivos:', error);
      }
    }

    // Si no hay filtros específicos, mostrar todos
    console.log('🔍 Sin filtros aplicados, mostrando todos los dispositivos:', dispositivos.length);
    return dispositivos;
  };

  // Función para obtener dispositivos con información de disponibilidad
  const getDispositivosConDisponibilidad = (periodoId?: string) => {
    const dispositivosBase = getFilteredDispositivos(periodoId);
    const dispositivosAsignados = getDispositivosAsignadosEnPeriodosActivos();

    return dispositivosBase.map(dispositivo => {
      const yaAsignado = dispositivosAsignados.has(dispositivo.identifier);

      return {
        ...dispositivo,
        disponible: !yaAsignado,
        yaAsignado: yaAsignado
      };
    });
  };

  // Función helper para mostrar dispositivos (ahora sin agrupamiento, cada dispositivo se muestra como es)
  const groupDevicesForDisplay = (dispositivos: PeriodoMP['dispositivos'], periodoId: string) => {
    // Validación inicial de entrada
    if (!dispositivos || !Array.isArray(dispositivos)) {
      console.warn('⚠️ groupDevicesForDisplay recibió datos inválidos:', dispositivos);
      return [];
    }

    // Ordenar dispositivos por orden personalizado para mantener consistencia
    const sortedDispositivos = sortDevicesByCustomOrder(dispositivos, periodoId);

    const grouped: Array<{
      id: string;
      deviceCatalog: DeviceCatalog;
      colaborador: string;
      estado: string;
      fechaAsignacion: string;
      fechaCompletado?: string;
      isGroup: boolean;
      totalColaboradores?: number;
      completadoPor?: string;
      colaboradores?: Colaborador[];
      // Agregando campos necesarios para eliminación
      colaboradorAsignado?: Colaborador;
      asignacionMultiple?: boolean;
      dispositivoOriginal?: any; // Referencia al dispositivo original
      originalIndex?: number; // Índice en el array original
    }> = [];

    sortedDispositivos.forEach((dispositivo, index) => {
      // Validar que deviceCatalog existe antes de proceder
      if (!dispositivo.deviceCatalog || !dispositivo.deviceCatalog._id) {
        console.warn('⚠️ Dispositivo sin deviceCatalog válido:', dispositivo);
        return; // Saltar este dispositivo si no tiene deviceCatalog
      }

      const deviceId = dispositivo.deviceCatalog._id;
      const timestamp = new Date(dispositivo.fechaAsignacion).getTime();

      if (dispositivo.asignacionMultiple) {
        // Para asignaciones múltiples, mostrar una sola entrada
        const totalColaboradores = dispositivo.colaboradoresElegibles?.length || 0;

        // Construir texto del colaborador - LÓGICA CORREGIDA
        let colaboradorTexto = '';
        if (dispositivo.estado === 'completado') {
          if (dispositivo.esColaborativo === true && dispositivo.colaboradores && dispositivo.colaboradores.length > 0) {
            // CASO 1: Trabajo colaborativo - mostrar responsable + seleccionados
            const nombresColaboradores = dispositivo.colaboradores
              .map(c => `${c.nombre || 'Sin nombre'} ${c.apellido_paterno || ''}`)
              .join(', ');
            colaboradorTexto = `Trabajo colaborativo: ${nombresColaboradores}`;
          } else if (dispositivo.completadoPor) {
            // CASO 2: Trabajo individual - solo el responsable
            colaboradorTexto = `Completado por: ${dispositivo.completadoPor.nombre || 'Sin nombre'} ${dispositivo.completadoPor.apellido_paterno || ''}`;
          } else {
            colaboradorTexto = 'Completado';
          }
        } else {
          colaboradorTexto = `Asignado para todos (${totalColaboradores} personas)`;
        }

        grouped.push({
          id: `multiple-${deviceId}-${timestamp}-${index}`,
          deviceCatalog: dispositivo.deviceCatalog,
          colaborador: colaboradorTexto,
          estado: dispositivo.estado || 'pendiente',
          fechaAsignacion: dispositivo.fechaAsignacion,
          fechaCompletado: dispositivo.fechaCompletado,
          isGroup: true,
          totalColaboradores: totalColaboradores,
          completadoPor: dispositivo.completadoPor
            ? `${dispositivo.completadoPor.nombre || 'Sin nombre'} ${dispositivo.completadoPor.apellido_paterno || ''}`
            : undefined,
          colaboradores: dispositivo.colaboradores,
          // Campos adicionales para eliminación
          colaboradorAsignado: dispositivo.colaboradorAsignado,
          asignacionMultiple: dispositivo.asignacionMultiple || false,
          dispositivoOriginal: dispositivo,
          originalIndex: index
        });
      } else {
        // Asignaciones individuales - LÓGICA CORREGIDA
        let colaboradorTextoIndividual = '';
        if (dispositivo.esColaborativo === true && dispositivo.colaboradores && dispositivo.colaboradores.length > 0) {
          // CASO 1: Trabajo colaborativo - mostrar responsable + seleccionados
          const nombresColaboradores = dispositivo.colaboradores
            .map(c => `${c.nombre || 'Sin nombre'} ${c.apellido_paterno || ''}`)
            .join(', ');
          colaboradorTextoIndividual = `Trabajo colaborativo: ${nombresColaboradores}`;
        } else if (dispositivo.estado === 'completado' && dispositivo.completadoPor) {
          // CASO 2: Trabajo individual - solo el responsable
          colaboradorTextoIndividual = `Completado por: ${dispositivo.completadoPor.nombre || 'Sin nombre'} ${dispositivo.completadoPor.apellido_paterno || ''}`;
        } else if (dispositivo.colaboradorAsignado) {
          // CASO 3: Asignado pero no completado
          colaboradorTextoIndividual = `${dispositivo.colaboradorAsignado.nombre || 'Sin nombre'} ${dispositivo.colaboradorAsignado.apellido_paterno || ''}`;
        } else {
          colaboradorTextoIndividual = 'Sin asignar';
        }

        const colaboradorId = dispositivo.colaboradorAsignado?._id || 'no-assigned';
        grouped.push({
          id: `individual-${deviceId}-${colaboradorId}-${timestamp}-${index}`,
          deviceCatalog: dispositivo.deviceCatalog,
          colaborador: colaboradorTextoIndividual,
          estado: dispositivo.estado || 'pendiente',
          fechaAsignacion: dispositivo.fechaAsignacion,
          fechaCompletado: dispositivo.fechaCompletado,
          isGroup: false,
          completadoPor: dispositivo.completadoPor
            ? `${dispositivo.completadoPor.nombre || 'Sin nombre'} ${dispositivo.completadoPor.apellido_paterno || ''}`
            : undefined,
          colaboradores: dispositivo.colaboradores,
          // Campos adicionales para eliminación  
          colaboradorAsignado: dispositivo.colaboradorAsignado,
          asignacionMultiple: dispositivo.asignacionMultiple || false,
          dispositivoOriginal: dispositivo,
          originalIndex: index
        });
      }
    });

    return grouped;
  };

  const handleCreatePeriodo = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const token = localStorage.getItem('token');

      // Determinar endpoint y método según el modo
      const isEditing = isEditMode && editingPeriodoId;
      const url = isEditing
        ? `${getBaseApiUrl()}/periodos-mp/${editingPeriodoId}`
        : `${getBaseApiUrl()}/periodos-mp`;
      const method = isEditing ? 'PATCH' : 'POST';

      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          ...newPeriodo,
          fechaInicio: inputDateToUTC(newPeriodo.fechaInicio),
          fechaFin: inputDateToUTC(newPeriodo.fechaFin),
          coordinador: coordinadorId,
          dispositivos: []
        }),
      });

      if (response.ok) {
        const successMessage = isEditing
          ? 'Período MP actualizado exitosamente'
          : 'Período MP creado exitosamente';
        toast.success(successMessage);

        // Limpiar formulario y estados
        setShowCreateForm(false);
        setIsEditMode(false);
        setEditingPeriodoId(null);
        setNewPeriodo({
          especialidad: '',
          fechaInicio: '',
          fechaFin: ''
        });
        refreshFullSection(); // Actualización completa de toda la sección
      } else {
        const errorData = await response.json();
        const errorMessage = isEditing
          ? 'Error actualizando período'
          : 'Error creando período';
        toast.error(errorData.message || errorMessage);
      }
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = isEditMode
        ? 'Error actualizando período MP'
        : 'Error creando período MP';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDevices = async (periodoId: string) => {
    if (deviceAssignments.length === 0) {
      toast.error('Debe asignar al menos un dispositivo');
      return;
    }

    // Validar que todos los campos estén completos
    const invalidAssignments = deviceAssignments.filter(assignment =>
      !assignment.deviceCatalogId || !assignment.colaboradorId
    );

    if (invalidAssignments.length > 0) {
      toast.error('Por favor complete todos los campos obligatorios (Dispositivo y Colaborador)');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');

      // Procesar asignaciones
      const processedAssignments = deviceAssignments.map(assignment => {
        if (assignment.colaboradorId === 'ALL_COLLABORATORS') {
          return {
            deviceCatalogId: assignment.deviceCatalogId,
            colaboradorId: null,
            assignToAll: true
          };
        }
        return assignment;
      });

      const requestBody = {
        dispositivos: processedAssignments,
        colaboradores: colaboradores.map(c => c._id)
      };

      console.log('📋 Enviando asignaciones procesadas:', requestBody);

      const response = await fetch(`${getBaseApiUrl()}/periodos-mp/${periodoId}/assign-devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        toast.success('Dispositivos asignados exitosamente');
        setShowAssignForm(null);
        setDeviceAssignments([]);

        // Actualizar orden para nuevos dispositivos creados
        const currentPeriod = periodos.find(p => p._id === periodoId);
        if (currentPeriod) {
          const currentDeviceCount = currentPeriod.dispositivos.length;

          // Agregar orden para los nuevos dispositivos
          setDeviceOrder(prev => {
            const newOrder = { ...prev };
            if (!newOrder[periodoId]) {
              newOrder[periodoId] = {};
            }

            processedAssignments.forEach((assignment, index) => {
              const deviceKey = assignment.colaboradorId === null
                ? `${assignment.deviceCatalogId}-multiple`
                : `${assignment.deviceCatalogId}-${assignment.colaboradorId}`;

              newOrder[periodoId][deviceKey] = currentDeviceCount + index;
            });

            return newOrder;
          });
        }

        refreshFullSection(); // Actualización completa de toda la sección
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error asignando dispositivos');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error asignando dispositivos');
    } finally {
      setLoading(false);
    }
  };

  const addDeviceAssignment = () => {
    setDeviceAssignments([
      ...deviceAssignments,
      {
        deviceCatalogId: '',
        colaboradorId: ''
      }
    ]);
  };

  const updateDeviceAssignment = (index: number, field: keyof DispositivoAsignado, value: string) => {
    const updated = [...deviceAssignments];
    updated[index] = { ...updated[index], [field]: value };
    setDeviceAssignments(updated);
  };

  const removeDeviceAssignment = (index: number) => {
    setDeviceAssignments(deviceAssignments.filter((_, i) => i !== index));
  };

  const closeAssignModal = () => {
    setShowAssignForm(null);
    setDeviceAssignments([]);
  };

  // ===== FUNCIONES PARA MODALES DE ELIMINACIÓN =====

  // Funciones para modal de eliminar período
  const abrirModalEliminarPeriodo = (periodo: PeriodoMP) => {
    setPeriodoAEliminar(periodo);
    setShowModalEliminarPeriodo(true);
  };

  const cancelarEliminacionPeriodo = () => {
    setPeriodoAEliminar(null);
    setShowModalEliminarPeriodo(false);
  };

  const confirmarEliminacionPeriodo = async () => {
    if (!periodoAEliminar) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBaseApiUrl()}/periodos-mp/${periodoAEliminar._id}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.reportCount > 0) {
          // Si hay reportes, preguntar si quiere forzar la eliminación
          const confirmacionForzada = window.confirm(
            `No se puede eliminar el período porque tiene ${data.reportCount} reporte(s) asociado(s).\n\n¿Deseas forzar la eliminación? ESTO ELIMINARÁ TODOS LOS REPORTES ASOCIADOS DE FORMA PERMANENTE.`
          );

          if (confirmacionForzada) {
            const forceResponse = await fetch(`${getBaseApiUrl()}/periodos-mp/${periodoAEliminar._id}?force=true`, {
              method: 'DELETE',
              headers: {
                Authorization: token ? `Bearer ${token}` : '',
              },
            });

            if (forceResponse.ok) {
              toast.success(`Período "${periodoAEliminar.nombre}" eliminado exitosamente (forzado)`);
              refreshLikeBrowser();
            } else {
              const forceData = await forceResponse.json();
              toast.error(forceData.message || 'Error al forzar eliminación del período');
            }
          }
        } else {
          toast.error(data.message || 'Error al eliminar período');
        }
      } else {
        toast.success(`Período "${periodoAEliminar.nombre}" eliminado exitosamente`);
        refreshLikeBrowser();
      }
    } catch (error) {
      console.error('Error al eliminar período:', error);
      toast.error('Error al eliminar período');
    } finally {
      setLoading(false);
      cancelarEliminacionPeriodo();
    }
  };

  // Funciones para modal de eliminar dispositivo
  const abrirModalEliminarDispositivo = (
    periodoId: string,
    deviceId: string,
    deviceIdentifier: string,
    tipo: 'asignacion' | 'reporte'
  ) => {
    setDispositivoAEliminar({
      periodoId,
      deviceId,
      deviceIdentifier,
      tipo
    });
    setShowModalEliminarDispositivo(true);
  };

  const cancelarEliminacionDispositivo = () => {
    // No permitir cerrar el modal si hay una eliminación en proceso
    if (eliminandoDispositivo) {
      return;
    }
    setDispositivoAEliminar(null);
    setShowModalEliminarDispositivo(false);
  };

  const confirmarEliminacionDispositivo = async () => {
    if (!dispositivoAEliminar) return;

    let eliminacionExitosa = false; // Flag para controlar el finally

    try {
      setLoading(true);
      setEliminandoDispositivo(true); // Estado específico para el modal
      // Marcar este dispositivo como eliminándose para deshabilitar su botón
      const deviceKey = `${dispositivoAEliminar.periodoId}-${dispositivoAEliminar.deviceId}`;
      setDispositivosEliminandose(prev => new Set(prev).add(deviceKey));
      const token = localStorage.getItem('token');

      if (dispositivoAEliminar.tipo === 'asignacion') {
        // Eliminar asignación (tanto múltiple como individual)
        const response = await fetch(`${getBaseApiUrl()}/periodos-mp/${dispositivoAEliminar.periodoId}/dispositivos/${dispositivoAEliminar.deviceId}/multiple`, {
          method: 'DELETE',
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });

        if (response.ok) {
          eliminacionExitosa = true; // Marcar como exitosa para evitar finally
          toast.success(`Asignación del dispositivo "${dispositivoAEliminar.deviceIdentifier}" eliminada`);

          // Guardar referencia local para evitar problemas de scope
          const dispositivoEliminado = dispositivoAEliminar;

          // Iniciar el refresh
          refreshFullSection(1000);

          // Función para verificar si el dispositivo ya desapareció del frontend
          const verificarEliminacion = async () => {
            try {
              // Obtener datos frescos del servidor
              const response = await fetch(`${getBaseApiUrl()}/periodos-mp/${dispositivoEliminado.periodoId}`, {
                headers: {
                  Authorization: token ? `Bearer ${token}` : '',
                },
              });

              if (!response.ok) {
                // Si el período ya no existe, cerrar modal
                console.log('🔄 Período eliminado, cerrando modal');
                cerrarModalDespuesDeEliminacion(dispositivoEliminado);
                return;
              }

              const periodoActual = await response.json();

              // Verificar si el dispositivo ya no está en el período
              const dispositivoAunExiste = periodoActual.dispositivos?.some((dispositivo: any) =>
                dispositivo.deviceCatalog._id === dispositivoEliminado.deviceId
              );

              if (!dispositivoAunExiste) {
                // El dispositivo ya no está, cerrar modal
                console.log('🔄 Dispositivo eliminado del frontend, cerrando modal');
                cerrarModalDespuesDeEliminacion(dispositivoEliminado);
              } else {
                // Dispositivo aún existe, volver a verificar en 500ms
                console.log('⏳ Dispositivo aún visible, verificando de nuevo...');
                setTimeout(verificarEliminacion, 500);
              }
            } catch (error) {
              console.error('Error verificando eliminación:', error);
              // En caso de error, cerrar modal después de un tiempo prudencial
              setTimeout(() => cerrarModalDespuesDeEliminacion(dispositivoEliminado), 2000);
            }
          };

          // Función helper para cerrar modal
          const cerrarModalDespuesDeEliminacion = (dispositivo: any) => {
            console.log('🔄 Cerrando modal después de verificar eliminación');
            setLoading(false);
            setEliminandoDispositivo(false);
            setDispositivoAEliminar(null);
            setShowModalEliminarDispositivo(false);
            // Limpiar estado de botón de tabla
            const deviceKey = `${dispositivo.periodoId}-${dispositivo.deviceId}`;
            setDispositivosEliminandose(prev => {
              const newSet = new Set(prev);
              newSet.delete(deviceKey);
              return newSet;
            });
          };

          // Iniciar verificación después de un delay inicial para el refresh
          setTimeout(verificarEliminacion, 1500);
          return; // IMPORTANTE: Salir aquí para evitar el bloque finally
        } else {
          const data = await response.json();
          toast.error(data.message || 'Error al eliminar asignación');
        }
      } else {
        // Eliminar reporte
        const response = await fetch(`${getBaseApiUrl()}/device-reports/periodo/${dispositivoAEliminar.periodoId}/device/${dispositivoAEliminar.deviceId}`, {
          method: 'DELETE',
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });

        if (response.ok) {
          eliminacionExitosa = true; // Marcar como exitosa para evitar finally
          toast.success(`Reporte del dispositivo "${dispositivoAEliminar.deviceIdentifier}" eliminado`);

          // Guardar referencia local para evitar problemas de scope
          const dispositivoEliminado = dispositivoAEliminar;

          // Iniciar el refresh
          refreshFullSection(1000);

          // Función para verificar si el dispositivo se actualizó en el frontend
          const verificarActualizacion = async () => {
            try {
              // Obtener datos frescos del servidor
              const response = await fetch(`${getBaseApiUrl()}/periodos-mp/${dispositivoEliminado.periodoId}`, {
                headers: {
                  Authorization: token ? `Bearer ${token}` : '',
                },
              });

              if (!response.ok) {
                // Si el período ya no existe, cerrar modal
                console.log('🔄 Período eliminado, cerrando modal');
                cerrarModalDespuesDeEliminacion(dispositivoEliminado);
                return;
              }

              const periodoActual = await response.json();

              // Verificar si el dispositivo aún tiene reporte (estado completado)
              const dispositivoConReporte = periodoActual.dispositivos?.find((dispositivo: any) =>
                dispositivo.deviceCatalog._id === dispositivoEliminado.deviceId
              );

              const reporteEliminado = dispositivoConReporte?.estado !== 'completado';

              if (reporteEliminado) {
                // El reporte ya no está, cerrar modal
                console.log('🔄 Reporte eliminado del frontend, cerrando modal');
                cerrarModalDespuesDeEliminacion(dispositivoEliminado);
              } else {
                // Reporte aún existe, volver a verificar en 500ms
                console.log('⏳ Reporte aún visible, verificando de nuevo...');
                setTimeout(verificarActualizacion, 500);
              }
            } catch (error) {
              console.error('Error verificando actualización de reporte:', error);
              // En caso de error, cerrar modal después de un tiempo prudencial
              setTimeout(() => cerrarModalDespuesDeEliminacion(dispositivoEliminado), 2000);
            }
          };

          // Función helper para cerrar modal
          const cerrarModalDespuesDeEliminacion = (dispositivo: any) => {
            console.log('🔄 Cerrando modal después de verificar eliminación de reporte');
            setLoading(false);
            setEliminandoDispositivo(false);
            setDispositivoAEliminar(null);
            setShowModalEliminarDispositivo(false);
            // Limpiar estado de botón de tabla
            const deviceKey = `${dispositivo.periodoId}-${dispositivo.deviceId}`;
            setDispositivosEliminandose(prev => {
              const newSet = new Set(prev);
              newSet.delete(deviceKey);
              return newSet;
            });
          };

          // Iniciar verificación después de un delay inicial para el refresh
          setTimeout(verificarActualizacion, 1500);
          return; // IMPORTANTE: Salir aquí para evitar el bloque finally
        } else {
          const data = await response.json();
          toast.error(data.message || 'Error al eliminar reporte');
        }
      }
    } catch (error) {
      console.error('Error al eliminar:', error);
      toast.error('Error al eliminar');
    } finally {
      // Este bloque solo se ejecuta en caso de error (cuando eliminacionExitosa = false)
      if (!eliminacionExitosa) {
        console.log('⚠️ Limpiando estados por error en eliminación');
        setLoading(false);
        setEliminandoDispositivo(false);
        if (dispositivoAEliminar) {
          const deviceKey = `${dispositivoAEliminar.periodoId}-${dispositivoAEliminar.deviceId}`;
          setDispositivosEliminandose(prev => {
            const newSet = new Set(prev);
            newSet.delete(deviceKey);
            return newSet;
          });
        }
      }
    }
  };

  // ===== FUNCIONES PARA MODALES DE CREAR/EDITAR =====

  // Funciones para modal de crear período
  const abrirModalCrearPeriodo = () => {
    setNewPeriodo({
      especialidad: '',
      fechaInicio: '',
      fechaFin: ''
    });
    setShowModalCrearPeriodo(true);
  };

  const cancelarCreacionPeriodo = () => {
    setNewPeriodo({
      especialidad: '',
      fechaInicio: '',
      fechaFin: ''
    });
    setShowModalCrearPeriodo(false);
  };

  // Funciones para modal de editar período
  const abrirModalEditarPeriodo = (periodo: PeriodoMP) => {
    // Obtener el ID de la especialidad
    let especialidadId = '';
    if (periodo.especialidad) {
      if (typeof periodo.especialidad === 'string') {
        especialidadId = periodo.especialidad;
      } else if (periodo.especialidad._id) {
        especialidadId = periodo.especialidad._id;
      }
    }

    // Autocompletar el formulario con los datos del período
    setNewPeriodo({
      especialidad: especialidadId,
      fechaInicio: formatDateForInput(periodo.fechaInicio),
      fechaFin: formatDateForInput(periodo.fechaFin)
    });

    setPeriodoAEditar(periodo);
    setShowModalEditarPeriodo(true);
  };

  const cancelarEdicionPeriodo = () => {
    setNewPeriodo({
      especialidad: '',
      fechaInicio: '',
      fechaFin: ''
    });
    setPeriodoAEditar(null);
    setShowModalEditarPeriodo(false);
  };

  // Función para confirmar creación desde modal
  const confirmarCreacionPeriodo = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await fetch(`${getBaseApiUrl()}/periodos-mp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          ...newPeriodo,
          fechaInicio: inputDateToUTC(newPeriodo.fechaInicio),
          fechaFin: inputDateToUTC(newPeriodo.fechaFin),
          coordinador: coordinadorId,
          dispositivos: []
        }),
      });

      if (response.ok) {
        toast.success('Período MP creado exitosamente');
        refreshFullSection();
        cancelarCreacionPeriodo();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error creando período');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error creando período MP');
    } finally {
      setLoading(false);
    }
  };

  // Función para confirmar edición desde modal
  const confirmarEdicionPeriodo = async () => {
    if (!periodoAEditar) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await fetch(`${getBaseApiUrl()}/periodos-mp/${periodoAEditar._id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          ...newPeriodo,
          fechaInicio: inputDateToUTC(newPeriodo.fechaInicio),
          fechaFin: inputDateToUTC(newPeriodo.fechaFin),
          coordinador: coordinadorId,
          dispositivos: []
        }),
      });

      if (response.ok) {
        toast.success('Período MP actualizado exitosamente');
        refreshFullSection();
        cancelarEdicionPeriodo();
      } else {
        const errorData = await response.json();
        toast.error(errorData.message || 'Error actualizando período');
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error actualizando período MP');
    } finally {
      setLoading(false);
    }
  };

  // ===== FUNCIONES PARA MODAL DE ASIGNAR DISPOSITIVOS =====

  // Funciones del carrusel de dispositivos (1 a la vez como pólizas)
  const irAnteriorDispositivo = () => {
    setCarruselDispositivosIndex(prev => Math.max(0, prev - 1));
  };

  const irSiguienteDispositivo = () => {
    if (!periodoParaAsignar) return;
    const dispositivosDisponiblesCalculados = getDispositivosParaAsignar(periodoParaAsignar);
    setCarruselDispositivosIndex(prev =>
      prev < dispositivosDisponiblesCalculados.length - 1 ? prev + 1 : prev
    );
  };

  // Abrir modal de asignar dispositivos
  const abrirModalAsignarDispositivos = (periodo: PeriodoMP) => {
    setPeriodoParaAsignar(periodo);
    setDispositivosSeleccionados([]);
    setCarruselDispositivosIndex(0);

    // Cargar dispositivos disponibles
    const dispositivosDisponiblesCalculados = getDispositivosParaAsignar(periodo);
    setDispositivosDisponibles(dispositivosDisponiblesCalculados);

    setShowModalAsignarDispositivos(true);
  };

  // Cancelar asignación
  const cancelarAsignacionDispositivos = () => {
    setPeriodoParaAsignar(null);
    setDispositivosSeleccionados([]);
    setCarruselDispositivosIndex(0);
    setDispositivosDisponibles([]);
    setShowModalAsignarDispositivos(false);
  };

  // Obtener dispositivos filtrados para el período (usar filtro completo que incluye póliza y especialidad)
  const getDispositivosParaAsignar = (periodo: PeriodoMP) => {
    // Usar el filtro completo que ya incluye póliza, especialidad y disponibilidad
    return getDispositivosConDisponibilidad(periodo._id);
  };

  // Alternar selección de dispositivo
  const toggleDispositivoSeleccion = (deviceId: string) => {
    // Verificar si el dispositivo está disponible - SIN TOAST
    const dispositivo = dispositivosDisponibles.find(d => d._id === deviceId);
    if (dispositivo && !dispositivo.disponible) {
      return; // Solo return, sin mensaje
    }

    setDispositivosSeleccionados(prev =>
      prev.includes(deviceId)
        ? prev.filter(id => id !== deviceId)
        : [...prev, deviceId]
    );
  };

  // Confirmar asignación de dispositivos
  const confirmarAsignacionDispositivos = async () => {
    if (!periodoParaAsignar || dispositivosSeleccionados.length === 0) {
      toast.error('Debe seleccionar al menos un dispositivo');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      if (!token) {
        toast.error('Token no disponible');
        return;
      }

      // Obtener información del usuario para filtrar por póliza
      const decoded: any = jwtDecode(token);

      // Intentar obtener la póliza de diferentes campos posibles
      const userPoliza = decoded.polizaId ||
        (typeof decoded?.poliza === 'object' ? decoded.poliza._id : decoded?.poliza);

      console.log('🔍 Token decodificado completo:', decoded);
      console.log('🎯 Póliza extraída:', userPoliza);

      // Obtener ID de especialidad del período
      const especialidadId = typeof periodoParaAsignar.especialidad === 'object'
        ? periodoParaAsignar.especialidad._id
        : periodoParaAsignar.especialidad;

      console.log('🎯 Filtrando colaboradores por:', {
        userPoliza,
        especialidadId,
        totalColaboradores: colaboradores.length
      });

      // Filtrar colaboradores que tengan la misma póliza
      const colaboradoresDePoliza = colaboradores.filter(colaborador => {
        const colaboradorPolizaId = typeof colaborador.poliza === 'object'
          ? colaborador.poliza._id
          : colaborador.poliza;

        console.log('👤 Colaborador análisis:', {
          nombre: colaborador.nombre,
          colaboradorPolizaId,
          userPoliza,
          match: colaboradorPolizaId === userPoliza
        });

        const matchPoliza = colaboradorPolizaId === userPoliza;
        return matchPoliza;
      });

      console.log('👥 Colaboradores filtrados:', {
        total: colaboradoresDePoliza.length,
        colaboradores: colaboradoresDePoliza.map(c => ({
          id: c._id,
          nombre: c.nombre,
          poliza: c.poliza
        }))
      });

      if (colaboradoresDePoliza.length === 0) {
        toast.error('No hay colaboradores disponibles con esta póliza');
        return;
      }

      // Crear el formato correcto que espera el servidor
      const requestBody = {
        dispositivos: dispositivosSeleccionados.map(deviceId => ({
          deviceCatalogId: deviceId,
          assignToAll: true,
          notas: ''
        })),
        assignToAll: true,
        colaboradores: colaboradoresDePoliza.map(c => c._id)
      };

      console.log('📤 Enviando asignaciones:', requestBody);

      const response = await fetch(`${getBaseApiUrl()}/periodos-mp/${periodoParaAsignar._id}/assign-devices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (response.ok) {
        toast.success(`${dispositivosSeleccionados.length} dispositivos asignados a ${colaboradoresDePoliza.length} colaboradores`);
        refreshFullSection();
        cancelarAsignacionDispositivos();
      } else {
        const errorData = await response.json();
        console.error('❌ Error del servidor:', errorData);
        toast.error(errorData.message || 'Error asignando dispositivos');
      }
    } catch (error) {
      console.error('❌ Error:', error);
      toast.error('Error asignando dispositivos');
    } finally {
      setLoading(false);
    }
  };

  // Función para convertir fecha UTC a formato input (YYYY-MM-DD)
  const formatDateForInput = (dateString: string): string => {
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch (error) {
      console.error('Error formatteando fecha:', error);
      return '';
    }
  };

  // Función para editar período (abrir modal con datos autocompletados)
  const handleEditarPeriodo = (periodo: PeriodoMP) => {
    console.log('✏️ Editando período:', periodo);
    abrirModalEditarPeriodo(periodo);
    toast.info(`Editando período: ${periodo.nombre}`);
  };



  // Función para eliminar reporte completado y revertir estado del dispositivo
  const handleEliminarReporte = async (periodoId: string, deviceId: string, deviceIdentifier: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el reporte del dispositivo "${deviceIdentifier}"?\n\nEsta acción:\n- Eliminará el reporte completado\n- Cambiará el estado del dispositivo de "completado" a "pendiente"\n- Habilitará la opción de subir reporte nuevamente\n\nEsta acción no se puede deshacer.`)) {
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      console.log('🗑️ Eliminando reporte:', { periodoId, deviceId, deviceIdentifier });

      const response = await fetch(`${getBaseApiUrl()}/device-reports/periodo/${periodoId}/device/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
          'Content-Type': 'application/json'
        }
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Reporte del dispositivo "${deviceIdentifier}" eliminado exitosamente. El dispositivo está ahora pendiente.`);
        refreshFullSection(400); // Delay para asegurar procesamiento en servidor
      } else {
        toast.error(data.message || 'Error eliminando reporte');
      }
    } catch (error) {
      console.error('Error eliminando reporte:', error);
      toast.error('Error eliminando reporte');
    } finally {
      setLoading(false);
    }
  };

  // Función para abrir modal de edición de dispositivo usando el modal de asignación


  const openAssignModal = (periodoId: string) => {
    console.log('🔧 Abriendo modal de asignación para período:', periodoId);

    // Buscar información del período
    const periodo = periodos.find(p => p._id === periodoId) || allPeriodos.find(p => p._id === periodoId);
    if (periodo) {
      console.log('📋 Información del período:', {
        nombre: periodo.nombre,
        especialidad: periodo.especialidad,
        periodoCompleto: periodo
      });
      abrirModalAsignarDispositivos(periodo);
    } else {
      console.log('⚠️ No se encontró información del período');
      toast.error('No se pudo encontrar la información del período');
    }
  };

  // Función para manejar subir reporte desde Períodos MP - ahora abre modal
  const handleSubirReporte = (periodoId: string, dispositivo: any) => {
    const deviceInfo = {
      deviceId: dispositivo.deviceCatalog._id,
      deviceIdentifier: dispositivo.deviceCatalog.identifier,
      deviceType: dispositivo.deviceCatalog.type,
      deviceUbication: dispositivo.deviceCatalog.ubication,
      deviceBuilding: dispositivo.deviceCatalog.building,
      deviceLevel: dispositivo.deviceCatalog.level,
      deviceNote: dispositivo.deviceCatalog.note || "",
      periodoId: periodoId,
      colaboradorId: currentUserId,
      // Información adicional para trabajo colaborativo
      isMultipleAssignment: dispositivo.asignacionMultiple || false,
      collaborators: dispositivo.colaboradoresElegibles || [],
      completedBy: dispositivo.completadoPor || null
    };

    console.log('🔄 Abriendo modal de subir reporte:', {
      deviceInfo,
      dispositivoCompleto: dispositivo
    });

    // Configurar datos para el modal
    setDispositivoSeleccionadoParaReporte(deviceInfo);
    setShowSubirReporteModal(true);

    toast.info(`Preparando reporte para ${dispositivo.deviceCatalog.identifier}`);
  };

  // Función para manejar el éxito del reporte
  const handleReporteSuccess = () => {
    // Recargar datos de los períodos
    fetchPeriodos(true);

    // Cerrar modal y limpiar estado
    setShowSubirReporteModal(false);
    setDispositivoSeleccionadoParaReporte(null);

    toast.success('¡Reporte subido exitosamente!');
  };

  return (
    <div className="periodosmp-container">
      {/* DISEÑO EXACTO DE COLABORADORES - Vista previa con header y controles */}
      <div className="preview-section-periodosmp">
        {/* Header con título y controles - exacto como colaboradores */}
        <div className="section-header-periodosmp">
          <div className="section-title-periodosmp">
            <i className="bi bi-calendar-event"></i>
            <h3>Períodos de Mantenimiento Preventivo</h3>
          </div>
          {/* Controles con botón de crear período */}
          <div className="section-controls-periodosmp">
            {isRefreshing && (
              <div className="refresh-indicator" style={{ marginRight: '10px', color: '#27ae60', fontSize: '14px' }}>
                <i className="bi bi-arrow-clockwise" style={{ animation: 'spin 1s linear infinite' }}></i>
                Actualizando...
              </div>
            )}
            {!isColaborador && (
              <button
                className="btn-crear-periodo"
                onClick={() => {
                  console.log('🔍 Abriendo modal crear período. Especialidades disponibles:', especialidades.length, especialidades);
                  abrirModalCrearPeriodo();
                }}
              >
                <i className="bi bi-plus-circle"></i>
                Crear Nuevo Período
              </button>
            )}
          </div>
        </div>

        {/* Contenido principal de períodos MP */}
        <div className="periodosmp-main-content">
          {/* Formulario crear período - solo para coordinadores */}
          {showCreateForm && !isColaborador && (
            <div className="modal-overlay">
              <div className="modal-content">
                <div className="modal-header">
                  <h3>{isEditMode ? 'Editar Período MP' : 'Crear Nuevo Período MP'}</h3>
                  <button
                    className="btn-close"
                    onClick={() => {
                      setShowCreateForm(false);
                      setIsEditMode(false);
                      setEditingPeriodoId(null);
                      setNewPeriodo({
                        especialidad: '',
                        fechaInicio: '',
                        fechaFin: ''
                      });
                    }}
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleCreatePeriodo}>
                  <div className="form-group">
                    <label>Especialidad {isEditMode && '(No editable)'}</label>
                    <select
                      value={newPeriodo.especialidad}
                      onChange={(e) => setNewPeriodo({ ...newPeriodo, especialidad: e.target.value })}
                      required
                      disabled={isEditMode}
                      style={{
                        backgroundColor: isEditMode ? '#f5f5f5' : 'white',
                        cursor: isEditMode ? 'not-allowed' : 'pointer',
                        opacity: isEditMode ? 0.7 : 1
                      }}
                    >
                      <option value="">Seleccionar especialidad</option>
                      {especialidades.length === 0 ? (
                        <option value="" disabled>Cargando especialidades...</option>
                      ) : (
                        especialidades.map((especialidad) => (
                          <option key={especialidad._id} value={especialidad._id}>
                            {especialidad.nombre}
                          </option>
                        ))
                      )}
                    </select>
                    {especialidades.length === 0 && (
                      <small style={{ color: '#666', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        No se han cargado especialidades aún. Total: {especialidades.length}
                      </small>
                    )}
                    {isEditMode && (
                      <small style={{ color: '#888', fontSize: '12px', marginTop: '4px', display: 'block' }}>
                        La especialidad no puede ser modificada una vez creado el período
                      </small>
                    )}
                  </div>

                  <div className="form-row">
                    <div className="form-group">
                      <label>Fecha Inicio</label>
                      <input
                        type="date"
                        value={newPeriodo.fechaInicio}
                        onChange={(e) => setNewPeriodo({ ...newPeriodo, fechaInicio: e.target.value })}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label>Fecha Fin</label>
                      <input
                        type="date"
                        value={newPeriodo.fechaFin}
                        onChange={(e) => setNewPeriodo({ ...newPeriodo, fechaFin: e.target.value })}
                        required
                      />
                    </div>
                  </div>

                  <div className="modal-actions">
                    <button type="button" onClick={() => {
                      setShowCreateForm(false);
                      setIsEditMode(false);
                      setEditingPeriodoId(null);
                      setNewPeriodo({
                        especialidad: '',
                        fechaInicio: '',
                        fechaFin: ''
                      });
                    }}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={loading}>
                      {loading
                        ? (isEditMode ? 'Actualizando...' : 'Creando...')
                        : (isEditMode ? 'Actualizar Período' : 'Crear Período')
                      }
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Carrusel de períodos */}
          <div className="periodos-carousel">
            {periodos.length > 0 ? (
              <>
                {/* Contenedor del carrusel */}
                <div className="carousel-container">
                  {/* Flecha izquierda - solo mostrar si hay más de un período */}
                  {periodos.length > 1 && (
                    <button
                      className={`carousel-arrow left ${currentPeriodoIndex === 0 ? 'disabled' : ''}`}
                      onClick={prevPeriodo}
                      disabled={isAnimating}
                    >
                      <i className="bi bi-chevron-left"></i>
                    </button>
                  )}

                  {/* Contenido del período actual */}
                  <div className="carousel-content">
                    {(() => {
                      const periodo = periodos[currentPeriodoIndex];
                      if (!periodo) return null;

                      return (
                        <div
                          key={periodo._id}
                          className={`periodo-wrapper ${animationClass}`}
                        >
                          {/* Contenido del período */}
                          <div className="periodo-card">
                            {/* CONTENEDOR SUPERIOR CON INFORMACIÓN, ESTADÍSTICAS Y BOTONES */}
                            <div className="periodo-stats-top">
                              {/* INFORMACIÓN DEL PERÍODO (izquierda) */}
                              <div className="periodo-info-inline">
                                <h3>{periodo.nombre}</h3>
                                <p>{formatDateRangeUTC(periodo.fechaInicio, periodo.fechaFin)}</p>
                                <span className={`status ${periodo.activo ? 'active' : 'inactive'}`}>
                                  {periodo.activo ? 'Activo' : 'Inactivo'}
                                </span>
                              </div>

                              {/* ESTADÍSTICAS (centro) */}
                              <div className="stats-container">
                                <div className="stat">
                                  <span className="number">{calculateRealStats(periodo).dispositivosCompletados}</span>
                                  <span className="label">completados</span>
                                </div>
                                <div className="stat">
                                  <span className="number">{calculateRealStats(periodo).totalDispositivos}</span>
                                  <span className="label">total</span>
                                </div>
                                <div className="stat">
                                  <span className="number">{calculateRealStats(periodo).porcentajeCompletado}%</span>
                                  <span className="label">progreso</span>
                                </div>
                              </div>

                              {/* BOTONES DE ACCIÓN (derecha) */}
                              {!isColaborador && (
                                <div className="periodo-actions-inline">
                                  <button
                                    className="btn-action-periodo btn-assign-periodo"
                                    onClick={() => openAssignModal(periodo._id)}
                                    title="Asignar Dispositivos"
                                  >
                                    <i className="bi bi-plus-square"></i>
                                  </button>

                                  <button
                                    className="btn-action-periodo btn-edit-periodo"
                                    onClick={() => handleEditarPeriodo(periodo)}
                                    disabled={loading}
                                    title="Editar período MP"
                                  >
                                    <CiEdit />
                                  </button>

                                  <button
                                    className="btn-action-periodo btn-delete-periodo"
                                    onClick={() => abrirModalEliminarPeriodo(periodo)}
                                    disabled={loading}
                                    title="Eliminar período MP"
                                  >
                                    <CiTrash />
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* Dispositivos asignados con tabla scrollable */}
                            {periodo.dispositivos.length > 0 && (
                              <div className="dispositivos-asignados">
                                <h4>Dispositivos Asignados</h4>
                                <div className="dispositivos-table-container">
                                  <table className="dispositivos-table">
                                    <thead>
                                      <tr>
                                        <th>
                                          <i className="bi bi-cpu me-2"></i>
                                          Dispositivo
                                        </th>
                                        <th>
                                          <i className="bi bi-person me-2"></i>
                                          Colaborador
                                        </th>
                                        <th>
                                          <i className="bi bi-calendar-event me-2"></i>
                                          Asignación
                                        </th>
                                        <th>
                                          <i className="bi bi-circle-fill me-2"></i>
                                          Estado
                                        </th>
                                        <th>
                                          <i className="bi bi-gear me-2"></i>
                                          Acciones
                                        </th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {groupDevicesForDisplay(periodo.dispositivos, periodo._id).map((item) => (
                                        <tr key={item.id}>
                                          <td>
                                            <div className="device-info">
                                              <strong>{item.deviceCatalog.identifier}</strong>
                                              <small>{item.deviceCatalog.type} - {item.deviceCatalog.building} - {item.deviceCatalog.ubication}</small>
                                            </div>
                                          </td>
                                          <td>
                                            <div>
                                              {item.colaborador}
                                              {item.completadoPor && !item.colaborador.includes('Trabajo colaborativo:') && !item.colaborador.includes('Completado por:') && (
                                                <small style={{ display: 'block', color: '#666', marginTop: '2px' }}>
                                                  Completado por: {item.completadoPor}
                                                </small>
                                              )}
                                            </div>
                                          </td>
                                          <td>
                                            {/* Solo mostrar fecha de asignación aquí */}
                                            {formatDateUTC(item.fechaAsignacion)}
                                          </td>
                                          <td>
                                            {/* Estado con fecha de completado si aplica */}
                                            <div>
                                              <span className={`status ${item.estado}`}>
                                                {item.estado}
                                              </span>
                                              {item.estado === 'completado' && item.fechaCompletado && (
                                                <small style={{ display: 'block', color: '#666', marginTop: '4px', fontSize: '0.65rem' }}>
                                                  {formatDateUTC(item.fechaCompletado)}
                                                </small>
                                              )}
                                            </div>
                                          </td>
                                          <td>
                                            <div className="table-actions">
                                              {/* Botones de acción - solo para coordinadores */}
                                              {!isColaborador && (
                                                <>
                                                  <button
                                                    className="btn-accion eliminar"
                                                    title="Eliminar dispositivo"
                                                    style={{ marginRight: '8px' }}
                                                    onClick={() => {
                                                      abrirModalEliminarDispositivo(
                                                        periodo._id,
                                                        item.deviceCatalog._id,
                                                        item.deviceCatalog.identifier,
                                                        'asignacion'
                                                      );
                                                    }}
                                                    disabled={loading || dispositivosEliminandose.has(`${periodo._id}-${item.deviceCatalog._id}`)}
                                                  >
                                                    <CiTrash />
                                                  </button>
                                                </>
                                              )}

                                              {/* Botones funcionales existentes */}
                                              {!item.asignacionMultiple && item.colaboradorAsignado?._id && (
                                                <>
                                                  {/* Botón de Subir Reporte para colaboradores en asignaciones individuales */}
                                                  {isColaborador && (item.estado === 'pendiente' || item.estado === 'en_progreso') && (
                                                    <button
                                                      className="btn-success-small"
                                                      onClick={() => handleSubirReporte(periodo._id, item)}
                                                      title="Subir Reporte"
                                                      disabled={loading}
                                                      style={{ marginRight: '8px' }}
                                                    >
                                                      <i className="bi bi-cloud-upload"></i>&nbsp;Subir Reporte
                                                    </button>
                                                  )}

                                                  {/* Botón especial para eliminar reporte de dispositivos completados */}
                                                  {item.estado === 'completado' && (
                                                    <button
                                                      className="btn-accion revertir"
                                                      onClick={() => handleEliminarReporte(
                                                        periodo._id,
                                                        item.deviceCatalog._id,
                                                        item.deviceCatalog.identifier
                                                      )}
                                                      title="Eliminar reporte y revertir a pendiente"
                                                      disabled={loading}
                                                      style={{ marginRight: '8px' }}
                                                    >
                                                      <i className="bi bi-arrow-counterclockwise"></i>
                                                    </button>
                                                  )}
                                                </>
                                              )}
                                              {/* Botón para asignaciones múltiples */}
                                              {item.asignacionMultiple && (
                                                <>
                                                  {/* Botón de Subir Reporte para colaboradores en asignaciones múltiples */}
                                                  {isColaborador && (item.estado === 'pendiente' || item.estado === 'en_progreso') && (
                                                    <button
                                                      className="btn-success-small"
                                                      onClick={() => handleSubirReporte(periodo._id, item)}
                                                      title="Subir Reporte"
                                                      disabled={loading}
                                                      style={{ marginRight: '8px' }}
                                                    >
                                                      <i className="bi bi-cloud-upload"></i>&nbsp;Subir Reporte
                                                    </button>
                                                  )}

                                                  {/* Botón especial para eliminar reporte de dispositivos múltiples completados */}
                                                  {item.estado === 'completado' && (
                                                    <button
                                                      className="btn-accion revertir"
                                                      onClick={() => abrirModalEliminarDispositivo(
                                                        periodo._id,
                                                        item.deviceCatalog._id,
                                                        item.deviceCatalog.identifier,
                                                        'reporte'
                                                      )}
                                                      title="Eliminar reporte y revertir a pendiente"
                                                      disabled={loading || dispositivosEliminandose.has(`${periodo._id}-${item.deviceCatalog._id}`)}
                                                      style={{ marginRight: '8px' }}
                                                    >
                                                      <i className="bi bi-arrow-counterclockwise"></i>
                                                    </button>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Flecha derecha - solo mostrar si hay más de un período */}
                  {periodos.length > 1 && (
                    <button
                      className={`carousel-arrow right ${currentPeriodoIndex === periodos.length - 1 ? 'disabled' : ''}`}
                      onClick={nextPeriodo}
                      disabled={isAnimating}
                    >
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  )}
                </div>

              </>
            ) : (
              <div className="periodosmp-empty-state">
                <i className={loading ? "bi bi-arrow-clockwise loading-spin" : "bi bi-calendar-event"}></i>
                <p>{loading ? "Cargando períodos de mantenimiento..." : "Crea tu primer período de mantenimiento"}</p>
              </div>
            )}
          </div>

          {/* Modal asignar dispositivos - solo para coordinadores */}
          {showAssignForm && !isColaborador && (
            <div className="modal-overlay">
              <div className="modal-content large">
                <div className="modal-header">
                  <h3>Asignar Dispositivos</h3>
                  <button
                    className="btn-close"
                    onClick={closeAssignModal}
                  >
                    ×
                  </button>
                </div>

                <div className="assignments-list">
                  {deviceAssignments.map((assignment, index) => (
                    <div key={index} className="assignment-row">
                      <div className="form-group">
                        <label>Dispositivo</label>
                        <select
                          value={assignment.deviceCatalogId}
                          onChange={(e) => updateDeviceAssignment(index, 'deviceCatalogId', e.target.value)}
                          required
                        >
                          <option value="">Seleccionar dispositivo</option>
                          {getFilteredDispositivos(showAssignForm || undefined).map((device) => (
                            <option key={device._id} value={device._id}>
                              {device.identifier} - {device.type} ({device.ubication})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>
                          Colaborador {colaboradores.length > 0 && `(${colaboradores.length} disponibles)`}
                        </label>
                        <select
                          value={assignment.colaboradorId}
                          onChange={(e) => updateDeviceAssignment(index, 'colaboradorId', e.target.value)}
                          required
                        >
                          <option value="">
                            {colaboradores.length === 0
                              ? "Cargando colaboradores..."
                              : "Trabajo Colaborativo"
                            }
                          </option>
                          {colaboradores.length > 0 && (
                            <option value="ALL_COLLABORATORS">
                              Todos los colaboradores ({colaboradores.length})
                            </option>
                          )}
                          {colaboradores.map((colaborador) => (
                            <option key={colaborador._id} value={colaborador._id}>
                              {colaborador.nombre} {colaborador.apellido_paterno} {colaborador.correo && `(${colaborador.correo})`}
                            </option>
                          ))}
                        </select>
                        {colaboradores.length === 0 && (
                          <p className="text-sm text-red-500 mt-1">
                            No se encontraron colaboradores disponibles
                          </p>
                        )}
                        {assignment.colaboradorId === 'ALL_COLLABORATORS' && (
                          <p className="text-sm text-blue-600 mt-1">

                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        className="btn-danger"
                        onClick={() => removeDeviceAssignment(index)}
                      >
                        Eliminar
                      </button>
                    </div>
                  ))}
                </div>

                <div className="modal-actions">
                  <button type="button" onClick={addDeviceAssignment}>
                    Agregar Dispositivo
                  </button>
                  <button type="button" onClick={closeAssignModal}>
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAssignDevices(showAssignForm)}
                    disabled={loading}
                  >
                    {loading ? 'Asignando...' : 'Asignar Dispositivos'}
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>

      {/* Modal de crear período */}
      {showModalCrearPeriodo && (
        <div className="modal-overlay-coordinadores">
          <div className="modal-content-coordinadores">
            <button className="modal-close" onClick={cancelarCreacionPeriodo}>
              ×
            </button>

            <div className="modal-title">
              <strong>Crear</strong> Nuevo Período MP
            </div>

            <div className="modal-user-info">
              <div className="form-group">
                <label><strong>Especialidad:</strong></label>
                <select
                  value={newPeriodo.especialidad}
                  onChange={(e) => setNewPeriodo({ ...newPeriodo, especialidad: e.target.value })}
                  required
                >
                  <option value="">Seleccionar especialidad</option>
                  {especialidades.map((esp) => (
                    <option key={esp._id} value={esp._id}>
                      {esp.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label><strong>Fecha de Inicio:</strong></label>
                  <input
                    type="date"
                    value={newPeriodo.fechaInicio}
                    onChange={(e) => setNewPeriodo({ ...newPeriodo, fechaInicio: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label><strong>Fecha de Fin:</strong></label>
                  <input
                    type="date"
                    value={newPeriodo.fechaFin}
                    onChange={(e) => setNewPeriodo({ ...newPeriodo, fechaFin: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="modal-buttons">
              <button className="modal-btn modal-btn-cancelar" onClick={cancelarCreacionPeriodo}>
                <i className="bi bi-x-circle"></i>
                Cancelar
              </button>
              <button className="modal-btn modal-btn-confirmar-poliza" onClick={confirmarCreacionPeriodo} disabled={loading}>
                <i className="bi bi-check-circle"></i>
                {loading ? 'Creando...' : 'Crear Período'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de editar período */}
      {showModalEditarPeriodo && periodoAEditar && (
        <div className="modal-overlay-coordinadores">
          <div className="modal-content-coordinadores">
            <button className="modal-close" onClick={cancelarEdicionPeriodo}>
              ×
            </button>

            <div className="modal-title">
              <strong>Editar</strong> Período MP
            </div>

            <div className="modal-user-info">
              <div className="form-group">
                <label><strong>Especialidad (No editable):</strong></label>
                <select
                  value={newPeriodo.especialidad}
                  disabled
                >
                  <option value="">Seleccionar especialidad</option>
                  {especialidades.map((esp) => (
                    <option key={esp._id} value={esp._id}>
                      {esp.nombre}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label><strong>Fecha de Inicio:</strong></label>
                  <input
                    type="date"
                    value={newPeriodo.fechaInicio}
                    onChange={(e) => setNewPeriodo({ ...newPeriodo, fechaInicio: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label><strong>Fecha de Fin:</strong></label>
                  <input
                    type="date"
                    value={newPeriodo.fechaFin}
                    onChange={(e) => setNewPeriodo({ ...newPeriodo, fechaFin: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>

            <div className="modal-buttons">
              <button className="modal-btn modal-btn-cancelar" onClick={cancelarEdicionPeriodo}>
                <i className="bi bi-x-circle"></i>
                Cancelar
              </button>
              <button className="modal-btn modal-btn-confirmar-poliza" onClick={confirmarEdicionPeriodo} disabled={loading}>
                <i className="bi bi-check-circle"></i>
                {loading ? 'Actualizando...' : 'Actualizar Período'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de asignar dispositivos */}
      {showModalAsignarDispositivos && periodoParaAsignar && (
        <div className="modal-overlay-coordinadores">
          <div className="modal-content-asignar-dispositivos">{/* Clase específica para este modal */}
            <button className="modal-close" onClick={cancelarAsignacionDispositivos}>
              ×
            </button>

            <div className="modal-title" style={{ fontWeight: 'bold' }}>
              Asignar Dispositivos al Período MP
            </div>

            <div className="step-title">Dispositivos Disponibles</div>
            <div className="step-info">
              <strong>{periodoParaAsignar.nombre}</strong> | {formatDateRangeUTC(periodoParaAsignar.fechaInicio, periodoParaAsignar.fechaFin)}
            </div>

            {/* Contenedor principal con altura controlada */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
              maxHeight: 'calc(75vh - 200px)', // Ajustar al tamaño original
              minHeight: 'calc(75vh - 200px)',
              overflow: 'hidden'
            }}>



              {/* Mensaje de dispositivos no disponibles - SOLO SI EL DISPOSITIVO ACTUAL ESTÁ NO DISPONIBLE */}
              {(() => {
                // Solo verificar el dispositivo actual (el que está en el centro del carrusel)
                const dispositivoActual = dispositivosDisponibles[carruselDispositivosIndex];
                const dispositivoActualNoDisponible = dispositivoActual && !dispositivoActual.disponible;

                if (dispositivoActualNoDisponible) {
                  return (
                    <div style={{
                      flexShrink: 0,
                      marginBottom: '12px',
                      padding: '8px 12px',
                      backgroundColor: '#fff3cd',
                      borderRadius: '6px',
                      fontSize: '12px',
                      color: '#856404',
                      border: '1px solid #ffeaa7'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="bi bi-exclamation-triangle" style={{ color: '#856404' }}></i>
                        <span>Dispositivo ya asignado en período activo</span>
                      </div>
                    </div>
                  );
                }
                return null;
              })()}

              {/* Carrusel de dispositivos - RÉPLICA EXACTA del carrusel de pólizas */}
              <div className="form-group" style={{ flexShrink: 0, marginBottom: '8px' }}>
                <label style={{ marginBottom: '5px', fontSize: '14px' }}>Dispositivos Disponibles:</label>
                <div className="polizas-carrusel" style={{
                  padding: '8px',
                  margin: 0,
                  minHeight: '74px',
                  maxHeight: '84px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '6px',
                  border: '1px solid #e9ecef',
                  display: 'flex',
                  alignItems: 'center', // Centrar verticalmente
                  justifyContent: 'center' // Centrar horizontalmente también
                }}>
                  <div className="carrusel-navegacion" style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center', // CENTRO como el diseño original
                    gap: '20px', // Gap mayor para dar más espacio a la card
                    height: '58px',
                    padding: '2px 0'
                  }}>
                    {/* Flecha izquierda - solo mostrar si hay más de un dispositivo */}
                    {dispositivosDisponibles.length > 1 && (
                      <button
                        type="button"
                        className="pagination-btn prev"
                        onClick={irAnteriorDispositivo}
                        disabled={carruselDispositivosIndex === 0}
                        title="Dispositivos anteriores"
                        style={{
                          width: '32px', // Botón más pequeño
                          height: '32px',
                          minWidth: '32px',
                          padding: '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <i className="bi bi-chevron-left"></i>
                      </button>
                    )}

                    <div className="carrusel-poliza-contenido" style={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      maxWidth: '360px', // Reducir 10% (400px * 0.9 = 360px)
                      minWidth: '270px', // Reducir 10% (300px * 0.9 = 270px)
                      minHeight: '54px',
                      maxHeight: '54px',
                      overflow: 'visible',
                      padding: '2px 0',
                      margin: '0 auto' // Centrar horizontalmente
                    }}>
                      {(() => {
                        console.log('🔍 Debug Dispositivos - Estado del carrusel:', {
                          totalDispositivos: dispositivosDisponibles.length,
                          carruselIndex: carruselDispositivosIndex,
                          DISPOSITIVOS_POR_PAGINA: DISPOSITIVOS_POR_PAGINA,
                          dispositivosSeleccionados: dispositivosSeleccionados,
                          dispositivosDisponibles: dispositivosDisponibles.map(d => ({ id: d._id, nombre: d.identifier }))
                        });

                        // Mostrar solo 1 dispositivo a la vez como en el carrusel de pólizas
                        const dispositivosParaMostrar = dispositivosDisponibles.slice(carruselDispositivosIndex, carruselDispositivosIndex + 1);

                        if (dispositivosParaMostrar.length === 0) {
                          return (
                            <div className="poliza-card" style={{
                              backgroundColor: '#f8f9fa',
                              cursor: 'default',
                              flexDirection: 'row', // Ícono al lado del texto
                              height: 'auto',
                              minHeight: '50px', // Altura reducida
                              padding: '10px 15px',
                              gap: '10px',
                              alignItems: 'center',
                              justifyContent: 'center'
                              // NO forzar width - dejar que use el ancho del contenedor
                            }}>
                              <i className="bi bi-exclamation-circle" style={{
                                color: '#6c757d',
                                fontSize: '18px', // Tamaño de ícono consistente
                                flexShrink: 0 // No permitir que se encoja
                              }}></i>
                              <span style={{
                                color: '#6c757d',
                                fontSize: '14px',
                                lineHeight: '1.2'
                              }}>No hay dispositivos disponibles</span>
                            </div>
                          );
                        }

                        return dispositivosParaMostrar.map((dispositivo) => {
                          const estaSeleccionado = dispositivosSeleccionados.includes(dispositivo._id);
                          const estaDisponible = dispositivo.disponible;

                          return (
                            <div
                              key={dispositivo._id}
                              className={`poliza-card ${estaSeleccionado ? 'poliza-selected' : ''} ${!estaDisponible ? 'device-unavailable' : ''}`}
                              onClick={() => toggleDispositivoSeleccion(dispositivo._id)}
                              style={{
                                display: 'flex', // Asegurar flex
                                flexDirection: 'row', // Ícono al lado del texto
                                height: 'auto',
                                minHeight: '50px', // Altura reducida
                                padding: '10px 15px',
                                alignItems: 'center',
                                justifyContent: 'center', // Centrar el grupo ícono+texto
                                position: 'relative',
                                opacity: estaDisponible ? 1 : 0.5,
                                backgroundColor: estaDisponible ? '' : '#f8f9fa',
                                cursor: estaDisponible ? 'pointer' : 'not-allowed'
                                // NO forzar width - dejar que use el ancho del contenedor
                              }}
                            >
                              {/* Contenedor para ícono + texto juntos */}
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px', // Espacio mínimo entre ícono y texto
                                justifyContent: 'center'
                              }}>
                                <i className="bi bi-hdd-rack" style={{
                                  fontSize: '18px',
                                  flexShrink: 0,
                                  color: estaSeleccionado ? 'inherit' : '#495057'
                                }}></i>
                                <span style={{
                                  fontSize: '14px',
                                  lineHeight: '1.2',
                                  whiteSpace: 'nowrap'
                                }}>{dispositivo.identifier}</span>
                              </div>
                              {estaSeleccionado && estaDisponible && (
                                <i className="bi bi-check-circle-fill poliza-check" style={{
                                  position: 'absolute',
                                  right: '10px',
                                  fontSize: '16px'
                                }}></i>
                              )}
                            </div>
                          );
                        });
                      })()}
                    </div>

                    {/* Flecha derecha - solo mostrar si hay más de un dispositivo */}
                    {dispositivosDisponibles.length > 1 && (
                      <button
                        type="button"
                        className="pagination-btn next"
                        onClick={irSiguienteDispositivo}
                        disabled={carruselDispositivosIndex + 1 >= dispositivosDisponibles.length}
                        title="Dispositivos siguientes"
                        style={{
                          width: '32px', // Botón más pequeño
                          height: '32px',
                          minWidth: '32px',
                          padding: '0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}
                      >
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Resumen de selección */}
              <div className="form-group" style={{ flexShrink: 0 }}>
                <label><strong>Dispositivos Seleccionados: {dispositivosSeleccionados.length}</strong></label>
                <div
                  className="dispositivos-seleccionados-container"
                  style={{
                    height: 'calc(75vh - 400px)', // ALTURA RESPONSIVA que estaba funcionando
                    minHeight: '180px',
                    maxHeight: '300px',
                    overflowY: 'scroll', // SIEMPRE scroll
                    overflowX: 'hidden',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    padding: '8px 8px 0px 8px', // Sin padding bottom para permitir scroll completo
                    marginTop: '8px',
                    backgroundColor: dispositivosSeleccionados.length === 0 ? '#f8f9fa' : 'white',
                    scrollbarWidth: 'thin',
                    scrollbarColor: '#333 #f1f1f1',
                    scrollBehavior: 'smooth',
                    boxSizing: 'border-box',
                    position: 'relative',
                    // IMPORTANTE: Quitar el espaciador automático que agregué
                    display: 'flex',
                    flexDirection: 'column'
                  }}>
                  {dispositivosSeleccionados.length === 0 ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      height: '100%',
                      color: '#6c757d',
                      textAlign: 'center',
                      flexDirection: 'column',
                      gap: '8px'
                    }}>
                      <i className="bi bi-inbox" style={{ fontSize: '24px' }}></i>
                      <span style={{ fontSize: '14px' }}>No hay dispositivos seleccionados</span>
                    </div>
                  ) : (
                    dispositivosSeleccionados.map(deviceId => {
                      const device = dispositivosDisponibles.find(d => d._id === deviceId);
                      return device ? (
                        <div key={deviceId} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center', // Centrar verticalmente todos los elementos
                          paddingTop: '10px',
                          paddingLeft: '6px',
                          paddingRight: '6px',
                          paddingBottom: deviceId === dispositivosSeleccionados[dispositivosSeleccionados.length - 1] ? '40px' : '10px', // Condicional para último elemento
                          borderBottom: deviceId === dispositivosSeleccionados[dispositivosSeleccionados.length - 1] ? 'none' : '1px solid #eee',
                          marginBottom: '4px', // Margen uniforme para TODOS los elementos
                          minHeight: '44px', // Altura consistente
                          boxSizing: 'border-box' // Incluir padding en el cálculo de altura
                        }}>
                          <span style={{
                            fontSize: '12px',
                            flex: 1,
                            paddingRight: '10px',
                            lineHeight: '1.3', // Mejor espaciado de línea
                            wordWrap: 'break-word', // Permitir salto de línea si es necesario
                            overflow: 'hidden' // Prevenir desbordamiento
                          }}>
                            <strong>{device.identifier}</strong> - {device.type} ({device.ubication})
                          </span>
                          <button
                            type="button"
                            onClick={() => toggleDispositivoSeleccion(deviceId)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#dc3545',
                              cursor: 'pointer',
                              padding: '8px',
                              borderRadius: '4px',
                              transition: 'background-color 0.2s',
                              fontSize: '14px',
                              lineHeight: '1',
                              width: '32px',
                              height: '32px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                            title="Quitar de selección"
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8f9fa'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <i className="bi bi-x" style={{
                              fontSize: '18px',
                              lineHeight: '1'
                            }}></i>
                          </button>
                        </div>
                      ) : null;
                    }).concat([
                      // Espaciador invisible al final para garantizar scroll completo
                      <div key="spacer" style={{ height: '20px', width: '100%' }}></div>
                    ])
                  )}
                </div>
              </div>

            </div> {/* Cerrar contenedor principal */}

            {/* Botones de acción del modal */}
            <div className="modal-buttons-coordinadores">
              <button
                type="button"
                className="modal-btn modal-btn-cancelar"
                onClick={cancelarAsignacionDispositivos}
              >
                <i className="bi bi-x-circle"></i>
                Cancelar
              </button>
              <button
                type="button"
                className="modal-btn modal-btn-confirmar-poliza"
                onClick={confirmarAsignacionDispositivos}
                disabled={loading || dispositivosSeleccionados.length === 0}
              >
                <i className="bi bi-check-circle"></i>
                {loading ? 'Asignando...' : `Asignar ${dispositivosSeleccionados.length} Dispositivos`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar período */}
      {showModalEliminarPeriodo && periodoAEliminar && (
        <div className="modal-overlay-coordinadores">
          <div className="modal-content-coordinadores">
            <button className="modal-close" onClick={cancelarEliminacionPeriodo}>
              ×
            </button>

            <div className="modal-title">
              ¿Seguro que quieres <strong>eliminar</strong> este Período MP?
            </div>

            <div className="modal-user-info">
              <p><strong>Especialidad:</strong> {periodoAEliminar.nombre}</p>
              <p><strong>Fechas:</strong> {formatDateRangeUTC(periodoAEliminar.fechaInicio, periodoAEliminar.fechaFin)}</p>
              <p><strong>Estado:</strong> {periodoAEliminar.activo ? 'Activo' : 'Inactivo'}</p>
              <div className="modal-warning">
                <i className="bi bi-exclamation-triangle"></i>
                <span>Al eliminar este período, toda la información asociada se perderá permanentemente.</span>
              </div>
            </div>

            <div className="modal-buttons">
              <button className="modal-btn modal-btn-cancelar" onClick={cancelarEliminacionPeriodo}>
                <i className="bi bi-x-circle"></i>
                Cancelar
              </button>
              <button className="modal-btn modal-btn-confirmar" onClick={confirmarEliminacionPeriodo}>
                <i className="bi bi-check-circle"></i>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación para eliminar dispositivo */}
      {showModalEliminarDispositivo && dispositivoAEliminar && (
        <div className="modal-overlay-coordinadores">
          <div className="modal-content-coordinadores">
            <button className="modal-close" onClick={cancelarEliminacionDispositivo} disabled={eliminandoDispositivo}>
              ×
            </button>

            <div className="modal-title">
              ¿Seguro que quieres <strong>eliminar</strong> este {dispositivoAEliminar.tipo === 'reporte' ? 'Reporte' : 'Dispositivo'}?
            </div>

            <div className="modal-user-info">
              <p><strong>Dispositivo:</strong> {dispositivoAEliminar.deviceIdentifier}</p>
              <p><strong>Acción:</strong> {dispositivoAEliminar.tipo === 'reporte' ? 'Eliminar reporte y revertir a pendiente' : 'Eliminar asignación del dispositivo'}</p>
              <div className="modal-warning">
                <i className="bi bi-exclamation-triangle"></i>
                <span>
                  {dispositivoAEliminar.tipo === 'reporte'
                    ? 'Al eliminar el reporte, el dispositivo volverá al estado "pendiente" y se habilitará para subir un nuevo reporte.'
                    : 'Al eliminar la asignación, el dispositivo se desasignará de todos los colaboradores.'
                  }
                </span>
              </div>
            </div>

            <div className="modal-buttons">
              <button className="modal-btn modal-btn-cancelar" onClick={cancelarEliminacionDispositivo} disabled={eliminandoDispositivo}>
                <i className="bi bi-x-circle"></i>
                {eliminandoDispositivo ? 'Procesando...' : 'Cancelar'}
              </button>
              <button className="modal-btn modal-btn-confirmar" onClick={confirmarEliminacionDispositivo} disabled={eliminandoDispositivo}>
                <i className="bi bi-check-circle"></i>
                {eliminandoDispositivo ? 'Eliminando...' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de subir reporte */}
      <SubirReporteModal
        isOpen={showSubirReporteModal}
        onClose={() => {
          setShowSubirReporteModal(false);
          setDispositivoSeleccionadoParaReporte(null);
        }}
        dispositivoInfo={dispositivoSeleccionadoParaReporte}
        onSuccess={handleReporteSuccess}
      />

    </div>
  );
};

export default PeriodosMPSection;