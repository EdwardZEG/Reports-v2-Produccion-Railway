import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { jwtDecode } from 'jwt-decode';
import { formatDateRangeUTC, formatDateUTC, inputDateToUTC } from '../../utils/dateUtils';
import { getBaseApiUrl } from '../../utils/apiUrl';
import './PeriodosMPSection.css';

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

  const [coordinadorId, setCoordinadorId] = useState<string>('');

  useEffect(() => {
    // Obtener ID del coordinador del token
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        setCoordinadorId(decoded.userId);
      } catch (error) {
        console.error('Error decodificando token:', error);
      }
    }

    console.log('🚀 Inicializando PeriodosMPSection para coordinador:', coordinadorId);
    fetchPeriodos();
    fetchColaboradores();
    fetchDispositivos();
  }, []);

  const fetchPeriodos = async () => {
    try {
      const token = localStorage.getItem('token');
      // ✅ REVERTIDO: Volviendo al sistema original que funcionaba
      const response = await fetch(`${getBaseApiUrl()}/periodos-mp?coordinador=${coordinadorId}`, {
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

        setPeriodos(data.data || []);
      }
    } catch (error) {
      console.error('Error fetching períodos:', error);
    }
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

        setColaboradores(colaboradoresArray);

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
  const groupDevicesForDisplay = (dispositivos: PeriodoMP['dispositivos']) => {
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
    }> = [];

    dispositivos.forEach((dispositivo) => {
      const deviceId = dispositivo.deviceCatalog._id;

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
          id: `multiple-${deviceId}`,
          deviceCatalog: dispositivo.deviceCatalog,
          colaborador: colaboradorTexto,
          estado: dispositivo.estado,
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
          asignacionMultiple: dispositivo.asignacionMultiple,
          dispositivoOriginal: dispositivo
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

        grouped.push({
          id: `${deviceId}-${dispositivo.colaboradorAsignado?._id || 'no-assigned'}`,
          deviceCatalog: dispositivo.deviceCatalog,
          colaborador: colaboradorTextoIndividual,
          estado: dispositivo.estado,
          fechaAsignacion: dispositivo.fechaAsignacion,
          fechaCompletado: dispositivo.fechaCompletado,
          isGroup: false,
          completadoPor: dispositivo.completadoPor
            ? `${dispositivo.completadoPor.nombre || 'Sin nombre'} ${dispositivo.completadoPor.apellido_paterno || ''}`
            : undefined,
          colaboradores: dispositivo.colaboradores,
          // Campos adicionales para eliminación  
          colaboradorAsignado: dispositivo.colaboradorAsignado,
          asignacionMultiple: dispositivo.asignacionMultiple,
          dispositivoOriginal: dispositivo
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

        const response = await fetch(`${getBaseApiUrl()}/periodos-mp/${periodoId}/devices/${editingAssignment.deviceId}/collaborator`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : '',
          },
          body: JSON.stringify({
            oldColaboradorId: editingAssignment.colaboradorId,
            newColaboradorId: assignment.colaboradorId,
            notas: assignment.notas
          }),
        });

        if (response.ok) {
          toast.success('Asignación actualizada exitosamente');
          setShowAssignForm(null);
          setDeviceAssignments([]);
          setEditingAssignment(null);
          fetchPeriodos();
        } else {
          const errorData = await response.json();
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
          fetchPeriodos();
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

  // Función para eliminar dispositivo asignado específico
  const eliminarDispositivoAsignado = async (periodoId: string, deviceCatalogId: string, colaboradorId: string, deviceIdentifier: string) => {
    // Verificar si el dispositivo está completado
    const periodo = periodos.find(p => p._id === periodoId);
    const dispositivo = periodo?.dispositivos.find(d =>
      d.deviceCatalog._id === deviceCatalogId &&
      d.colaboradorAsignado?._id === colaboradorId
    );

    const esCompletado = dispositivo?.estado === 'completado';

    const mensaje = esCompletado
      ? `⚠️ ATENCIÓN: El dispositivo "${deviceIdentifier}" está COMPLETADO.\n\n¿Estás seguro de que deseas eliminar la asignación?\n\nEsto también eliminará el reporte asociado y NO se puede deshacer.`
      : `¿Estás seguro de que deseas eliminar la asignación del dispositivo "${deviceIdentifier}"?\n\nEsta acción no se puede deshacer.`;

    const confirmacion = window.confirm(mensaje);

    if (!confirmacion) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${getBaseApiUrl()}/periodos-mp/${periodoId}/dispositivos/${deviceCatalogId}/${colaboradorId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: token ? `Bearer ${token}` : '',
          },
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success('Dispositivo desasignado exitosamente');
        fetchPeriodos(); // Recargar períodos para mostrar cambios
      } else {
        toast.error(data.message || 'Error eliminando dispositivo asignado');
      }
    } catch (error) {
      console.error('Error eliminando dispositivo asignado:', error);
      toast.error('Error eliminando dispositivo asignado');
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
        fetchPeriodos(); // Recargar períodos para mostrar cambios
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

  // Función para editar asignación de dispositivo
  const handleEditarAsignacion = (periodoId: string, deviceId: string, colaboradorId: string, periodo: PeriodoMP) => {
    console.log('✏️ Editando asignación:', { periodoId, deviceId, colaboradorId });

    // Encontrar el dispositivo específico para la edición
    const deviceAssignment = periodo.dispositivos.find(d =>
      d.deviceCatalog._id === deviceId &&
      d.colaboradorAsignado?._id === colaboradorId
    );

    if (deviceAssignment) {
      setEditingAssignment({
        periodoId,
        deviceId,
        colaboradorId,
        periodo
      });

      // Precargar los datos existentes en el modal de asignación
      setDeviceAssignments([{
        deviceCatalogId: deviceId,
        colaboradorId: colaboradorId,
        notas: deviceAssignment.notas || ''
      }]);

      // Abrir el modal de asignación en modo edición
      setShowAssignForm(periodoId);

      toast.info(`Editando asignación de dispositivo: ${deviceAssignment.deviceCatalog.identifier}`);
    } else {
      toast.error('No se pudo encontrar la asignación para editar');
    }
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
        fetchPeriodos(); // Recargar períodos para mostrar cambios
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

  const openAssignModal = (periodoId: string) => {
    setShowAssignForm(periodoId);
    setDeviceAssignments([{
      deviceCatalogId: '',
      colaboradorId: '',
      notas: ''
    }]);
  };

  return (
    <div className="periodos-mp-section">
      <div className="section-header">
        <h2>Períodos de Mantenimiento Preventivo</h2>
        <button
          className="btn-primary"
          onClick={() => setShowCreateForm(true)}
        >
          Crear Nuevo Período
        </button>
      </div>

      {/* Formulario crear período */}
      {showCreateForm && (
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
          <div key={periodo._id} className="periodo-card">
            <div className="periodo-header">
              <div className="periodo-info">
                <h3>{periodo.nombre}</h3>
                <p>{formatDateRangeUTC(periodo.fechaInicio, periodo.fechaFin)}</p>
                <span className={`status ${periodo.activo ? 'active' : 'inactive'}`}>
                  {periodo.activo ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              <div className="periodo-stats">
                <div className="stat">
                  <span className="number">{periodo.dispositivosCompletados}</span>
                  <span className="label">Completados</span>
                </div>
                <div className="stat">
                  <span className="number">{periodo.totalDispositivos}</span>
                  <span className="label">Total</span>
                </div>
                <div className="stat">
                  <span className="number">{periodo.porcentajeCompletado}%</span>
                  <span className="label">Progreso</span>
                </div>
              </div>
            </div>

            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${periodo.porcentajeCompletado}%` }}
              />
            </div>

            <div className="periodo-actions">
              <button
                className="btn-secondary"
                onClick={() => openAssignModal(periodo._id)}
              >
                Asignar Dispositivos
              </button>
              <button
                className="btn-primary"
                onClick={() => handleEditarPeriodo(periodo)}
                disabled={loading}
                title="Editar período MP"
              >
                Editar Período
              </button>
              <button
                className="btn-danger"
                onClick={() => eliminarPeriodo(periodo._id, periodo.nombre)}
                disabled={loading}
                title="Eliminar período MP"
              >
                {loading ? 'Eliminando...' : 'Eliminar'}
              </button>
            </div>

            {/* Dispositivos asignados */}
            {periodo.dispositivos.length > 0 && (
              <div className="assigned-devices">
                <h4>Dispositivos Asignados</h4>
                <div className="devices-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Dispositivo</th>
                        <th>Colaborador</th>
                        <th>Estado</th>
                        <th>Fecha Asignación</th>
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groupDevicesForDisplay(periodo.dispositivos).map((item) => (
                        <tr key={item.id}>
                          <td>
                            <div className="device-info">
                              <strong>{item.deviceCatalog.identifier}</strong>
                              <small>{item.deviceCatalog.type} - {item.deviceCatalog.ubication}</small>
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
                            <span className={`status ${item.estado}`}>
                              {item.estado}
                            </span>
                          </td>
                          <td>
                            {formatDateUTC(item.fechaAsignacion)}
                            {item.fechaCompletado && (
                              <small style={{ display: 'block', color: '#666', marginTop: '2px' }}>
                                Completado: {formatDateUTC(item.fechaCompletado)}
                              </small>
                            )}
                          </td>
                          <td>
                            {/* Botón para asignaciones individuales */}
                            {!item.asignacionMultiple && item.colaboradorAsignado?._id && (
                              <>
                                {item.estado !== 'completado' && (
                                  <button
                                    className="btn-edit-small"
                                    onClick={() => handleEditarAsignacion(
                                      periodo._id,
                                      item.deviceCatalog._id,
                                      item.colaboradorAsignado!._id,
                                      periodo
                                    )}
                                    title="Editar asignación de dispositivo"
                                    disabled={loading}
                                    style={{ marginRight: '5px' }}
                                  >
                                    ✏️
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
                                    🔄
                                  </button>
                                )}
                                <button
                                  className="btn-danger-small"
                                  onClick={() => eliminarDispositivoAsignado(
                                    periodo._id,
                                    item.deviceCatalog._id,
                                    item.colaboradorAsignado!._id,
                                    item.deviceCatalog.identifier
                                  )}
                                  title={`Eliminar asignación individual${item.estado === 'completado' ? ' (también eliminará el reporte)' : ''}`}
                                  disabled={loading}
                                >
                                  🗑️
                                </button>
                              </>
                            )}
                            {/* Botón para asignaciones múltiples */}
                            {item.asignacionMultiple && (
                              <>
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
                                    🔄
                                  </button>
                                )}
                                <button
                                  className="btn-danger-small"
                                  onClick={() => eliminarDispositivoAsignacionMultiple(
                                    periodo._id,
                                    item.deviceCatalog._id,
                                    item.deviceCatalog.identifier
                                  )}
                                  title={`Eliminar asignación múltiple${item.estado === 'completado' ? ' (también eliminará los reportes)' : ''}`}
                                  disabled={loading}
                                >
                                  🗑️
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modal asignar dispositivos */}
      {showAssignForm && (
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
                          ? "⏳ Cargando colaboradores..."
                          : "👤 Seleccionar colaborador"
                        }
                      </option>
                      {colaboradores.length > 0 && (
                        <option value="ALL_COLLABORATORS">
                          👥 Todos los colaboradores ({colaboradores.length})
                        </option>
                      )}
                      {colaboradores.map((colaborador) => (
                        <option key={colaborador._id} value={colaborador._id}>
                          👤 {colaborador.nombre} {colaborador.apellido_paterno} {colaborador.correo && `(${colaborador.correo})`}
                        </option>
                      ))}
                    </select>
                    {colaboradores.length === 0 && (
                      <p className="text-sm text-red-500 mt-1">
                        ⚠️ No se encontraron colaboradores disponibles
                      </p>
                    )}
                    {assignment.colaboradorId === 'ALL_COLLABORATORS' && (
                      <p className="text-sm text-blue-600 mt-1">
                        ℹ️ Este dispositivo se asignará a todos los colaboradores ({colaboradores.length} personas)
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
  );
};

export default PeriodosMPSection;