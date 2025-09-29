import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { jwtDecode } from 'jwt-decode';
import { formatDateUTC } from '../../utils/dateUtils';
import { getBaseApiUrl } from '../../utils/apiUrl';
import './DispositivosAsignadosSection.css';

interface DeviceCatalog {
  _id: string;
  identifier: string;
  type: string;
  ubication: string;
  building?: string;
  level?: string;
}

interface PeriodoMP {
  _id: string;
  nombre: string;
  fechaInicio: string;
  fechaFin: string;
  activo: boolean;
}

interface DispositivoAsignado {
  _id: string;
  deviceCatalog: DeviceCatalog;
  periodoMP: PeriodoMP;
  estado: 'pendiente' | 'en_progreso' | 'completado';
  fechaAsignacion: string;
  fechaCompletado?: string;
  notas?: string;
  asignacionMultiple?: boolean;
  colaboradoresElegibles?: any[];
  completadoPor?: {
    _id: string;
    nombre: string;
    apellido_paterno: string;
  };
}

interface Stats {
  total: number;
  pendientes: number;
  enProgreso: number;
  completados: number;
  porcentajeCompletado: number;
}

const DispositivosAsignadosSection: React.FC = () => {
  const [dispositivos, setDispositivos] = useState<DispositivoAsignado[]>([]);
  const [loading, setLoading] = useState(false);
  const [colaboradorId, setColaboradorId] = useState<string | null>(null);

  const [stats, setStats] = useState<Stats>({
    total: 0,
    pendientes: 0,
    enProgreso: 0,
    completados: 0,
    porcentajeCompletado: 0
  });

  useEffect(() => {
    // Obtener ID del colaborador del token
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded: any = jwtDecode(token);
        setColaboradorId(decoded.userId);
      } catch (error) {
        console.error('Error decodificando token:', error);
        toast.error('Error de autenticación');
      }
    }
  }, []);

  useEffect(() => {
    if (colaboradorId) {
      fetchDispositivosAsignados();
    }
  }, [colaboradorId]);

  useEffect(() => {
    // Escuchar evento de dispositivo completado para actualizar la lista
    const handleDeviceCompleted = () => {
      console.log('🔄 Dispositivo completado - actualizando lista...');
      fetchDispositivosAsignados();
    };

    window.addEventListener('deviceCompleted', handleDeviceCompleted);

    return () => {
      window.removeEventListener('deviceCompleted', handleDeviceCompleted);
    };
  }, [colaboradorId]);

  const fetchDispositivosAsignados = async () => {
    if (!colaboradorId) {
      console.log('❌ No hay colaboradorId, cancelando fetch');
      return;
    }

    console.log('🔍 Fetching dispositivos para colaborador:', colaboradorId);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      console.log('🔑 Token disponible:', !!token);

      const apiUrl = import.meta.env.PROD ? '/api' : 'http://localhost:4000/api';
      const url = `${apiUrl}/periodos-mp/colaborador/${colaboradorId}/all-devices`;
      console.log('📡 Llamando a:', url);

      const response = await fetch(url, {
        headers: {
          Authorization: token ? `Bearer ${token}` : '',
        },
      });

      console.log('📨 Respuesta status:', response.status);

      if (response.ok) {
        const data = await response.json();
        const dispositivos = data.data || [];
        setDispositivos(dispositivos);

        // Calcular estadísticas
        const total = dispositivos.length;
        const pendientes = dispositivos.filter((d: DispositivoAsignado) => d.estado === 'pendiente').length;
        const enProgreso = dispositivos.filter((d: DispositivoAsignado) => d.estado === 'en_progreso').length;
        const completados = dispositivos.filter((d: DispositivoAsignado) => d.estado === 'completado').length;
        const porcentajeCompletado = total > 0 ? Math.round((completados / total) * 100) : 0;

        setStats({
          total,
          pendientes,
          enProgreso,
          completados,
          porcentajeCompletado
        });
      } else {
        console.error('❌ Error en respuesta:', response.status);
        toast.error('Error cargando dispositivos asignados');
      }
    } catch (error) {
      console.error('❌ Error fetching dispositivos:', error);
      toast.error('Error conectando con el servidor');
    } finally {
      setLoading(false);
    }
  };

  const handleSubirReporte = (dispositivo: DispositivoAsignado) => {
    // Pasar el ID del dispositivo y los IDs necesarios para actualizar el estado
    const deviceInfo = {
      deviceId: dispositivo.deviceCatalog._id,
      deviceIdentifier: dispositivo.deviceCatalog.identifier, // Para el mensaje
      periodoId: dispositivo.periodoMP._id, // Necesario para actualizar estado
      colaboradorId: colaboradorId, // DEBE ser el colaborador actual (mismo que está logueado)
      // Información adicional para trabajo colaborativo
      isMultipleAssignment: dispositivo.asignacionMultiple || false,
      collaborators: dispositivo.colaboradoresElegibles || [],
      completedBy: dispositivo.completadoPor || null
    };

    console.log('🔄 Preparando datos para subir reporte:', {
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

  const handleEliminarReporte = async (dispositivo: DispositivoAsignado) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar el reporte del dispositivo "${dispositivo.deviceCatalog.identifier}"?\n\nEsta acción:\n- Eliminará el reporte completado\n- Cambiará el estado del dispositivo de "completado" a "pendiente"\n- Habilitará la opción de subir reporte nuevamente\n\nEsta acción no se puede deshacer.`)) {
      return;
    }

    try {
      console.log('�️ Eliminando reporte para:', dispositivo.deviceCatalog.identifier);

      const token = localStorage.getItem('token');
      const response = await fetch(
        `${getBaseApiUrl()}/device-reports/periodo/${dispositivo.periodoMP._id}/device/${dispositivo.deviceCatalog._id}`,
        {
          method: 'DELETE',
          headers: {
            'Authorization': token ? `Bearer ${token}` : '',
            'Content-Type': 'application/json'
          }
        }
      );

      const data = await response.json();

      if (response.ok) {
        toast.success(`Reporte del dispositivo "${dispositivo.deviceCatalog.identifier}" eliminado exitosamente. El dispositivo está ahora pendiente.`);

        // Recargar dispositivos asignados para mostrar cambios
        await fetchDispositivosAsignados();
      } else {
        toast.error(data.message || 'Error eliminando reporte');
      }
    } catch (error) {
      console.error('Error eliminando reporte:', error);
      toast.error('Error eliminando reporte');
    }
  };

  const getStatusColor = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return '#f39c12';
      case 'en_progreso':
        return '#3498db';
      case 'completado':
        return '#27ae60';
      default:
        return '#7f8c8d';
    }
  };

  const getStatusText = (estado: string) => {
    switch (estado) {
      case 'pendiente':
        return 'Pendiente';
      case 'en_progreso':
        return 'En Progreso';
      case 'completado':
        return 'Completado';
      default:
        return estado;
    }
  };

  if (loading) {
    return (
      <div className="dispositivos-asignados-section">
        <div className="loading-spinner">
          <div className="spinner"></div>
          <p>Cargando dispositivos asignados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dispositivos-asignados-section">
      <div className="section-header">
        <h2>Mis Dispositivos Asignados</h2>
        <button className="btn-refresh" onClick={fetchDispositivosAsignados}>
          <i className="bi bi-arrow-clockwise"></i>
          Actualizar
        </button>
      </div>

      {/* Estadísticas */}
      <div className="stats-cards">
        <div className="stat-card">
          <div className="stat-icon total">
            <i className="bi bi-list-task"></i>
          </div>
          <div className="stat-info">
            <h3>{stats.total}</h3>
            <p>Total Asignados</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon pendiente">
            <i className="bi bi-clock"></i>
          </div>
          <div className="stat-info">
            <h3>{stats.pendientes}</h3>
            <p>Pendientes</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon progreso">
            <i className="bi bi-gear"></i>
          </div>
          <div className="stat-info">
            <h3>{stats.enProgreso}</h3>
            <p>En Progreso</p>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon completado">
            <i className="bi bi-check-circle"></i>
          </div>
          <div className="stat-info">
            <h3>{stats.completados}</h3>
            <p>Completados</p>
          </div>
        </div>
      </div>

      {/* Progreso general */}
      <div className="progress-section">
        <div className="progress-header">
          <h3>Progreso General</h3>
          <span className="progress-percentage">{stats.porcentajeCompletado}%</span>
        </div>
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${stats.porcentajeCompletado}%` }}
          />
        </div>
      </div>

      {/* Tabla de dispositivos */}
      {dispositivos.length === 0 ? (
        <div className="empty-state">
          <i className="bi bi-inbox"></i>
          <h3>No tienes dispositivos asignados</h3>
          <p>Cuando tu coordinador te asigne dispositivos para mantenimiento, aparecerán aquí.</p>
        </div>
      ) : (
        <div className="devices-table-container">
          <table className="devices-table">
            <thead>
              <tr>
                <th>Dispositivo</th>
                <th>Ubicación</th>
                <th>Período MP</th>
                <th>Estado</th>
                <th>Fecha Asignación</th>
                <th>Fecha Límite</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {dispositivos.map((dispositivo, index) => (
                <tr key={`${dispositivo.periodoMP?._id || index}-${dispositivo.deviceCatalog?._id || index}`}>
                  <td>
                    <div className="device-info">
                      <strong>{dispositivo.deviceCatalog.identifier}</strong>
                      <small>{dispositivo.deviceCatalog.type}</small>
                    </div>
                  </td>
                  <td>
                    <div className="location-info">
                      <span>{dispositivo.deviceCatalog.ubication}</span>
                      {dispositivo.deviceCatalog.building && (
                        <small>Edificio: {dispositivo.deviceCatalog.building}</small>
                      )}
                      {dispositivo.deviceCatalog.level && (
                        <small>Nivel: {dispositivo.deviceCatalog.level}</small>
                      )}
                    </div>
                  </td>
                  <td>
                    <div className="periodo-info">
                      <strong>{dispositivo.periodoMP?.nombre || 'Sin período'}</strong>
                    </div>
                  </td>
                  <td>
                    <span
                      className="status-badge"
                      style={{ backgroundColor: getStatusColor(dispositivo.estado) }}
                    >
                      {getStatusText(dispositivo.estado)}
                    </span>
                  </td>
                  <td>
                    {formatDateUTC(dispositivo.fechaAsignacion)}
                  </td>
                  <td>
                    {dispositivo.periodoMP?.fechaFin
                      ? formatDateUTC(dispositivo.periodoMP.fechaFin)
                      : 'Sin fecha'
                    }
                  </td>
                  <td>
                    <div className="action-buttons">
                      {dispositivo.estado !== 'completado' && (
                        <button
                          className="btn-action primary"
                          onClick={() => handleSubirReporte(dispositivo)}
                          title="Subir Reporte"
                        >
                          <i className="bi bi-upload"></i>
                          Subir Reporte
                        </button>
                      )}
                      {dispositivo.estado === 'completado' && dispositivo.fechaCompletado && (
                        <div className="completed-actions">
                          <span className="completion-date">
                            Completado: {formatDateUTC(dispositivo.fechaCompletado)}
                          </span>
                          <button
                            className="btn-action danger"
                            onClick={() => handleEliminarReporte(dispositivo)}
                            title="Eliminar Reporte y Revertir a Pendiente"
                          >
                            <i className="bi bi-trash3"></i>
                            Eliminar
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default DispositivosAsignadosSection;