import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { jwtDecode } from 'jwt-decode';
import { CiEdit, CiTrash } from 'react-icons/ci';
import { formatDateRangeUTC, formatDateUTC, inputDateToUTC } from '../../utils/dateUtils';
import { getBaseApiUrl } from '../../utils/apiUrl';
import './PeriodosMPSection.css';
import '../../styles/Periodos MP.css'; // Importar estilos consistentes con Colaboradores

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
}

interface DispositivoAsignado {
  deviceCatalogId: string;
  colaboradorId: string;
  notas?: string;
}

interface PeriodoMP {
  _id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
  dispositivos: Array<{
    deviceCatalog: DeviceCatalog;
    colaboradorAsignado: Colaborador;
    estado: 'pendiente' | 'en_progreso' | 'completado';
    fechaAsignacion: string;
    fechaCompletado?: string;
    notas?: string;
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
  const [loading, setLoading] = useState(false);

  // Estado para crear/editar período
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPeriodoId, setEditingPeriodoId] = useState<string | null>(null);
  const [newPeriodo, setNewPeriodo] = useState({
    nombre: '',
    fechaInicio: '',
    fechaFin: '',
    descripcion: ''
  });

  // Estado para asignar dispositivos
  const [showAssignForm, setShowAssignForm] = useState<string | null>(null);
  const [deviceAssignments, setDeviceAssignments] = useState<DispositivoAsignado[]>([]);

  // Estado para editar asignaciones de dispositivos
  const [editingAssignment, setEditingAssignment] = useState<{
    periodoId: string;
    deviceId: string;
    colaboradorId: string;
    periodo: PeriodoMP;
  } | null>(null);

  // Estado para mantener el orden de dispositivos por período
  const [deviceOrder, setDeviceOrder] = useState<{ [periodoId: string]: { [deviceKey: string]: number } }>({});

  const [coordinadorId, setCoordinadorId] = useState<string>('');
  const [userRole, setUserRole] = useState<string>('');
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [currentUserPoliza, setCurrentUserPoliza] = useState<string>('');
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  useEffect(() => {
    // Obtener ID del coordinador y rol del token
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('rol')?.toLowerCase() || '';

    setUserRole(role);

    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        setCoordinadorId(decoded.userId);
        setCurrentUserId(decoded.userId);
      } catch (error) {
        console.error('Error decodificando token:', error);
      }
    }

    console.log('🚀 Inicializando PeriodosMPSection para coordinador:', coordinadorId);
    fetchPeriodos();
    fetchColaboradores();
    fetchDispositivos();
  }, [currentUserId]); // Dependencia para recargar cuando cambie el usuario

  // Verificar si el usuario es colaborador (encargado o auxiliar)
  const isColaborador = userRole === 'encargado' || userRole === 'auxiliar';

  // useEffect adicional para recargar colaboradores cuando currentUserId esté disponible
  useEffect(() => {
    if (currentUserId && isColaborador) {
      fetchColaboradores();
    }
  }, [currentUserId, isColaborador]);

  const fetchPeriodos = async (forceRefresh = false) => {
    try {
      if (forceRefresh) {
        setIsRefreshing(true);
      }

      const token = localStorage.getItem('token');
      // Agregar timestamp para evitar cache si es refresh forzado
      const cacheParam = forceRefresh ? `&_t=${Date.now()}` : '';
      const response = await fetch(`${getBaseApiUrl()}/periodos-mp?coordinador=${coordinadorId}${cacheParam}`, {
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

  // Función para refresh optimizado solo de la sección
  const refreshSectionOnly = async (delay = 300) => {
    setIsRefreshing(true);

    setTimeout(async () => {
      try {
        await fetchPeriodos(true);
        // Pequeña demora adicional para mostrar el indicador visual
        setTimeout(() => {
          setIsRefreshing(false);
        }, 200);
      } catch (error) {
        setIsRefreshing(false);
      }
    }, delay);
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

    setPeriodos(filteredPeriodos);
  }, [allPeriodos, isColaborador, currentUserId]);

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
      const response = await fetch(`${getBaseApiUrl()}/all-catalog-devices`);

      if (response.ok) {
        const data = await response.json();
        setDispositivos(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching dispositivos:', error);
    }
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

        // Construir texto del colaborador - lógica simplificada
        let colaboradorTexto = '';
        if (dispositivo.estado === 'completado') {
          if (dispositivo.esColaborativo && dispositivo.colaboradores && dispositivo.colaboradores.length > 1) {
            // CASO 1: Trabajo colaborativo (múltiples personas)
            const nombresColaboradores = dispositivo.colaboradores
              .map(c => `${c.nombre || 'Sin nombre'} ${c.apellido_paterno || ''}`)
              .join(', ');
            colaboradorTexto = `Trabajo colaborativo: ${nombresColaboradores}`;
          } else if (dispositivo.completadoPor) {
            // CASO 2: Completado por una sola persona
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
        // Asignaciones individuales - lógica simplificada
        let colaboradorTextoIndividual = '';
        if (dispositivo.esColaborativo && dispositivo.colaboradores && dispositivo.colaboradores.length > 1) {
          // CASO 1: Trabajo colaborativo (múltiples personas)
          const nombresColaboradores = dispositivo.colaboradores
            .map(c => `${c.nombre || 'Sin nombre'} ${c.apellido_paterno || ''}`)
            .join(', ');
          colaboradorTextoIndividual = `Trabajo colaborativo: ${nombresColaboradores}`;
        } else if (dispositivo.estado === 'completado' && dispositivo.completadoPor) {
          // CASO 2: Completado por una sola persona
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
          nombre: '',
          fechaInicio: '',
          fechaFin: '',
          descripcion: ''
        });
        fetchPeriodos();
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

      // Si estamos editando una asignación existente
      if (editingAssignment) {
        const assignment = deviceAssignments[0]; // Solo hay una asignación en modo edición

        // Para ediciones, usar la estrategia de eliminar y recrear
        console.log('🔄 Editando asignación:', { editingAssignment, assignment });

        // Paso 1: Eliminar la asignación actual
        // IMPORTANTE: La URL de eliminación debe basarse en el TIPO ORIGINAL de la asignación
        let deleteUrl;
        if (editingAssignment.colaboradorId === 'ALL_COLLABORATORS') {
          // La asignación ORIGINAL era múltiple
          deleteUrl = `${getBaseApiUrl()}/periodos-mp/${periodoId}/dispositivos/${editingAssignment.deviceId}/multiple`;
        } else {
          // La asignación ORIGINAL era individual
          deleteUrl = `${getBaseApiUrl()}/periodos-mp/${periodoId}/dispositivos/${editingAssignment.deviceId}/${editingAssignment.colaboradorId}`;
        }

        console.log('🗑️ Eliminando asignación anterior:', deleteUrl);

        const deleteResponse = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        });

        if (!deleteResponse.ok) {
          console.warn('⚠️ No se pudo eliminar la asignación anterior (puede que no exista)');
        }

        // Paso 2: Crear nueva asignación con los datos editados
        let newAssignment;

        if (assignment.colaboradorId === 'ALL_COLLABORATORS') {
          // Asignación múltiple
          newAssignment = {
            deviceCatalogId: assignment.deviceCatalogId,
            colaboradorId: null,
            notas: assignment.notas || '',
            assignToAll: true
          };
        } else {
          // Asignación individual
          newAssignment = {
            deviceCatalogId: assignment.deviceCatalogId,
            colaboradorId: assignment.colaboradorId,
            notas: assignment.notas || ''
          };
        }

        const requestBody = {
          dispositivos: [newAssignment],
          colaboradores: colaboradores.map(c => c._id)
        };

        console.log('📝 Creando nueva asignación:', requestBody);

        const assignResponse = await fetch(`${getBaseApiUrl()}/periodos-mp/${periodoId}/assign-devices`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify(requestBody),
        });

        if (assignResponse.ok) {
          toast.success('Asignación actualizada exitosamente');
          setShowAssignForm(null);
          setDeviceAssignments([]);
          setEditingAssignment(null);
          fetchPeriodos(true);
        } else {
          const errorData = await assignResponse.json();
          toast.error(errorData.message || 'Error actualizando asignación');
        }
      } else {
        // Modo creación normal
        const processedAssignments = deviceAssignments.map(assignment => {
          if (assignment.colaboradorId === 'ALL_COLLABORATORS') {
            return {
              deviceCatalogId: assignment.deviceCatalogId,
              colaboradorId: null,
              notas: assignment.notas,
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

          fetchPeriodos(true);
        } else {
          const errorData = await response.json();
          toast.error(errorData.message || 'Error asignando dispositivos');
        }
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error(editingAssignment ? 'Error actualizando asignación' : 'Error asignando dispositivos');
    } finally {
      setLoading(false);
    }
  };

  const addDeviceAssignment = () => {
    setDeviceAssignments([
      ...deviceAssignments,
      {
        deviceCatalogId: '',
        colaboradorId: '',
        notas: ''
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
    setEditingAssignment(null);
  };

  // Función para eliminar período MP (con verificación de reportes)
  const eliminarPeriodo = async (periodoId: string, periodoNombre: string) => {
    const confirmacion = window.confirm(
      `¿Estás seguro de que deseas eliminar el período "${periodoNombre}"?\n\nSi hay reportes asociados, la eliminación fallará.`
    );

    if (!confirmacion) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBaseApiUrl()}/periodos-mp/${periodoId}`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Período eliminado exitosamente');
        fetchPeriodos();
      } else if (response.status === 409) {
        // Hay reportes asociados
        const respuestaForzar = window.confirm(
          `No se puede eliminar el período porque tiene ${data.reportCount} reporte(s) asociado(s).\n\n¿Deseas forzar la eliminación? ESTO ELIMINARÁ TODOS LOS REPORTES ASOCIADOS DE FORMA PERMANENTE.`
        );

        if (respuestaForzar) {
          await forzarEliminacionPeriodo(periodoId, periodoNombre);
        }
      } else {
        toast.error(data.message || 'Error eliminando período');
      }
    } catch (error) {
      console.error('Error eliminando período:', error);
      toast.error('Error eliminando período');
    } finally {
      setLoading(false);
    }
  };

  const eliminarDispositivoAsignacionMultiple = async (periodoId: string, deviceCatalogId: string, deviceIdentifier: string) => {
    // Verificar si el dispositivo está completado
    const periodo = periodos.find(p => p._id === periodoId);
    const dispositivo = periodo?.dispositivos.find(d =>
      d.deviceCatalog._id === deviceCatalogId &&
      d.asignacionMultiple === true
    );

    const esCompletado = dispositivo?.estado === 'completado';

    const mensaje = esCompletado
      ? `⚠️ ATENCIÓN: El dispositivo "${deviceIdentifier}" está COMPLETADO.\n\n¿Estás seguro de que deseas eliminar la asignación múltiple?\n\nEsto eliminará la asignación para todos los colaboradores y también eliminará TODOS los reportes asociados. Esta acción NO se puede deshacer.`
      : `¿Estás seguro de que deseas eliminar la asignación múltiple del dispositivo "${deviceIdentifier}"?\n\nEsta acción eliminará la asignación para todos los colaboradores. Esta acción no se puede deshacer.`;

    const confirmacion = window.confirm(mensaje);

    if (!confirmacion) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${getBaseApiUrl()}/periodos-mp/${periodoId}/dispositivos/${deviceCatalogId}/multiple`,
        {
          method: 'DELETE',
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success('Dispositivo con asignación múltiple desasignado exitosamente');
        refreshSectionOnly(); // Refresh optimizado solo de la sección
      } else {
        toast.error(data.message || 'Error eliminando dispositivo con asignación múltiple');
      }
    } catch (error) {
      console.error('Error eliminando dispositivo con asignación múltiple:', error);
      toast.error('Error eliminando dispositivo con asignación múltiple');
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

    // Autocompletar el formulario con los datos del período
    setNewPeriodo({
      nombre: periodo.nombre,
      fechaInicio: formatDateForInput(periodo.fechaInicio),
      fechaFin: formatDateForInput(periodo.fechaFin),
      descripcion: '' // Por ahora no hay descripción en el tipo
    });

    // Activar modo edición
    setIsEditMode(true);
    setEditingPeriodoId(periodo._id);
    setShowCreateForm(true);

    toast.info(`Editando período: ${periodo.nombre}`);
  };

  // Función para forzar eliminación (borra reportes asociados)
  const forzarEliminacionPeriodo = async (periodoId: string, periodoNombre: string) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`${getBaseApiUrl()}/periodos-mp/${periodoId}/force`, {
        method: 'DELETE',
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Período "${periodoNombre}" y ${data.reportesEliminados} reporte(s) eliminados exitosamente`);
        fetchPeriodos();
      } else {
        toast.error(data.message || 'Error forzando eliminación');
      }
    } catch (error) {
      console.error('Error forzando eliminación:', error);
      toast.error('Error forzando eliminación');
    } finally {
      setLoading(false);
    }
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
        refreshSectionOnly(); // Refresh optimizado solo de la sección
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
  const handleEditarDispositivo = (periodoId: string, item: any) => {
    console.log('✏️ Editando dispositivo:', { periodoId, item });

    // Encontrar el período
    const periodo = periodos.find(p => p._id === periodoId);
    if (!periodo) {
      toast.error('No se pudo encontrar el período');
      return;
    }

    // Para asignaciones múltiples, usar la nueva lógica de edición simple
    if (item.asignacionMultiple) {
      // Precargar los datos en el modal de asignación para edición múltiple
      setDeviceAssignments([{
        deviceCatalogId: item.deviceCatalog._id,
        colaboradorId: 'ALL_COLLABORATORS', // Indicar que es para todos
        notas: item.dispositivoOriginal?.notas || ''
      }]);

      // Configurar el modo de edición para asignación múltiple
      setEditingAssignment({
        periodoId,
        deviceId: item.deviceCatalog._id,
        colaboradorId: 'ALL_COLLABORATORS',
        periodo
      });

      // Abrir el modal de asignación en modo edición
      setShowAssignForm(periodoId);

      toast.info(`Editando dispositivo múltiple: ${item.deviceCatalog.identifier}`);
    } else {
      // Para asignaciones individuales, usar la lógica normal
      if (!item.colaboradorAsignado?._id) {
        toast.error('No se pudo encontrar el colaborador asignado');
        return;
      }

      // Precargar los datos existentes en el modal de asignación
      setDeviceAssignments([{
        deviceCatalogId: item.deviceCatalog._id,
        colaboradorId: item.colaboradorAsignado._id,
        notas: item.dispositivoOriginal?.notas || ''
      }]);

      // Configurar el modo de edición
      setEditingAssignment({
        periodoId,
        deviceId: item.deviceCatalog._id,
        colaboradorId: item.colaboradorAsignado._id,
        periodo
      });

      // Abrir el modal de asignación en modo edición
      setShowAssignForm(periodoId);

      toast.info(`Editando dispositivo: ${item.deviceCatalog.identifier}`);
    }
  };

  const openAssignModal = (periodoId: string) => {
    setShowAssignForm(periodoId);
    setDeviceAssignments([{
      deviceCatalogId: '',
      colaboradorId: '',
      notas: ''
    }]);
  };

  // Función para manejar subir reporte desde Períodos MP
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

    console.log('🔄 Preparando datos para subir reporte desde Períodos MP:', {
      deviceInfo,
      dispositivoCompleto: dispositivo
    });

    localStorage.setItem('selectedDeviceForReport', JSON.stringify(deviceInfo));

    // Disparar evento personalizado para notificar al Dashboard
    const event = new CustomEvent('navigateToSubirReporte', {
      detail: deviceInfo
    });
    window.dispatchEvent(event);

    toast.success(`Preparando reporte para ${dispositivo.deviceCatalog.identifier}`);
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
                onClick={() => setShowCreateForm(true)}
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
                        nombre: '',
                        fechaInicio: '',
                        fechaFin: '',
                        descripcion: ''
                      });
                    }}
                  >
                    ×
                  </button>
                </div>

                <form onSubmit={handleCreatePeriodo}>
                  <div className="form-group">
                    <label>Nombre del Período</label>
                    <input
                      type="text"
                      value={newPeriodo.nombre}
                      onChange={(e) => setNewPeriodo({ ...newPeriodo, nombre: e.target.value })}
                      placeholder="Ej: Mantenimiento Octubre 2025"
                      required
                    />
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

                  <div className="form-group">
                    <label>Descripción (Opcional)</label>
                    <textarea
                      value={newPeriodo.descripcion}
                      onChange={(e) => setNewPeriodo({ ...newPeriodo, descripcion: e.target.value })}
                      placeholder="Descripción del período de mantenimiento..."
                      rows={3}
                    />
                  </div>

                  <div className="modal-actions">
                    <button type="button" onClick={() => {
                      setShowCreateForm(false);
                      setIsEditMode(false);
                      setEditingPeriodoId(null);
                      setNewPeriodo({
                        nombre: '',
                        fechaInicio: '',
                        fechaFin: '',
                        descripcion: ''
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

          {/* Lista de períodos */}
          <div className="periodos-list">
            {periodos.map((periodo) => (
              <div key={periodo._id} className="periodo-wrapper">
                {/* Flecha izquierda */}
                <div className="periodo-arrow left">
                  <i className="bi bi-chevron-left"></i>
                </div>

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
                          onClick={() => eliminarPeriodo(periodo._id, periodo.nombre)}
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
                                    {/* Botones principales de editar y eliminar - solo para coordinadores */}
                                    {!isColaborador && (
                                      <>
                                        <button
                                          className="btn-accion editar"
                                          title="Editar dispositivo"
                                          style={{ marginRight: '8px' }}
                                          onClick={() => handleEditarDispositivo(periodo._id, item)}
                                          disabled={loading}
                                        >
                                          <CiEdit />
                                        </button>

                                        <button
                                          className="btn-accion eliminar"
                                          title="Eliminar dispositivo"
                                          style={{ marginRight: '8px' }}
                                          onClick={() => {
                                            if (item.asignacionMultiple) {
                                              eliminarDispositivoAsignacionMultiple(
                                                periodo._id,
                                                item.deviceCatalog._id,
                                                item.deviceCatalog.identifier
                                              );
                                            } else {
                                              // Para asignaciones individuales, usar la función correcta
                                              const deleteUrl = `${getBaseApiUrl()}/periodos-mp/${periodo._id}/dispositivos/${item.deviceCatalog._id}/${item.colaboradorAsignado?._id || ''}`;

                                              const confirmacion = window.confirm(
                                                `¿Estás seguro de que deseas eliminar la asignación del dispositivo "${item.deviceCatalog.identifier}"?\n\nEsta acción no se puede deshacer.`
                                              );

                                              if (confirmacion) {
                                                fetch(deleteUrl, {
                                                  method: 'DELETE',
                                                  headers: {
                                                    Authorization: localStorage.getItem('token') ? `Bearer ${localStorage.getItem('token')}` : '',
                                                  },
                                                })
                                                  .then(response => response.json())
                                                  .then(data => {
                                                    if (data.success !== false) {
                                                      toast.success('Dispositivo desasignado exitosamente');
                                                      refreshSectionOnly();
                                                    } else {
                                                      toast.error(data.message || 'Error eliminando dispositivo asignado');
                                                    }
                                                  })
                                                  .catch(error => {
                                                    console.error('Error:', error);
                                                    toast.error('Error eliminando dispositivo asignado');
                                                  });
                                              }
                                            }
                                          }}
                                          disabled={loading}
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
                                            <i className="bi bi-cloud-upload"></i> Subir Reporte
                                          </button>
                                        )}

                                        {/* Botón especial para eliminar reporte de dispositivos completados */}
                                        {item.estado === 'completado' && (
                                          <button
                                            className="btn-warning-small"
                                            onClick={() => handleEliminarReporte(
                                              periodo._id,
                                              item.deviceCatalog._id,
                                              item.deviceCatalog.identifier
                                            )}
                                            title="Eliminar reporte y revertir a pendiente"
                                            disabled={loading}
                                            style={{ marginRight: '5px' }}
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
                                            <i className="bi bi-cloud-upload"></i> Subir Reporte
                                          </button>
                                        )}

                                        {/* Botón especial para eliminar reporte de dispositivos múltiples completados */}
                                        {item.estado === 'completado' && (
                                          <button
                                            className="btn-warning-small"
                                            onClick={() => handleEliminarReporte(
                                              periodo._id,
                                              item.deviceCatalog._id,
                                              item.deviceCatalog.identifier
                                            )}
                                            title="Eliminar reporte y revertir a pendiente"
                                            disabled={loading}
                                            style={{ marginRight: '5px' }}
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

                {/* Flecha derecha */}
                <div className="periodo-arrow right">
                  <i className="bi bi-chevron-right"></i>
                </div>
              </div>
            ))}
          </div>

          {/* Modal asignar dispositivos - solo para coordinadores */}
          {showAssignForm && !isColaborador && (
            <div className="modal-overlay">
              <div className="modal-content large">
                <div className="modal-header">
                  <h3>{editingAssignment ? 'Editar Asignación de Dispositivo' : 'Asignar Dispositivos'}</h3>
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
                          {dispositivos.map((device) => (
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

                      <div className="form-group">
                        <label>Notas</label>
                        <input
                          type="text"
                          value={assignment.notas || ''}
                          onChange={(e) => updateDeviceAssignment(index, 'notas', e.target.value)}
                          placeholder="Notas adicionales..."
                        />
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
                    {loading
                      ? (editingAssignment ? 'Actualizando...' : 'Asignando...')
                      : (editingAssignment ? 'Actualizar Asignación' : 'Asignar Dispositivos')
                    }
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default PeriodosMPSection;