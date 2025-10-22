import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api';
import { getToken, decodeJWT } from '../auth/authService';
import '../styles/PerfilNew.css';

interface UserProfile {
  _id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  correo: string;
  telefono: string;
  rol: string;
  tipo: string;
  estado: string;
  poliza: { _id: string; nombre: string; ubicacion?: string } | null;
  especialidades: { _id: string; nombre: string }[];
  createdAt: string;
}

const Perfil: React.FC = () => {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');

  const navigate = useNavigate();

  // Memoizar el token decodificado para evitar recálculos constantes
  const decodedToken = useMemo(() => {
    const token = getToken();
    return token ? decodeJWT(token) : null;
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token || !decodedToken) {
      navigate('/login');
      return;
    }
    loadUserProfile();
  }, [navigate]); // Remover decodedToken de las dependencias

  const loadUserProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const currentToken = getToken();
      if (!currentToken || !decodedToken) {
        console.error('Token no válido en loadUserProfile');
        navigate('/login');
        return;
      }

      console.log('🔄 Cargando perfil del usuario...');

      // Usar el nuevo endpoint unificado de perfil
      const response = await api.get('/auth/perfil');

      if (!response.data) {
        throw new Error('No se recibieron datos del perfil');
      }

      const userData = response.data;
      console.log('✅ Datos del perfil recibidos:', userData);
      console.log('🏢 [FRONTEND] Póliza recibida:', userData.poliza);
      console.log('🔍 [FRONTEND] Tipo de póliza:', typeof userData.poliza);

      const profileData: UserProfile = {
        _id: userData._id,
        nombre: userData.nombre,
        apellido_paterno: userData.apellido_paterno,
        apellido_materno: userData.apellido_materno,
        correo: userData.correo,
        telefono: userData.telefono || '',
        rol: userData.rol,
        tipo: userData.tipo,
        estado: userData.estado || 'Activo',
        poliza: userData.poliza || null, // Usar poliza directamente, no como array
        especialidades: userData.especialidades || [],
        createdAt: userData.createdAt || userData.fecha_creacion
      };

      console.log('📋 [FRONTEND] Profile data mapeado:', profileData);
      console.log('🏢 [FRONTEND] Póliza en profileData:', profileData.poliza);

      setProfile(profileData);
      setPhoneValue(profileData.telefono || '');
      console.log('✅ Perfil configurado exitosamente');
    } catch (error: any) {
      console.error('❌ Error cargando perfil:', error);

      // Manejo específico de errores
      if (error.response?.status === 401) {
        console.error('Token expirado o inválido');
        navigate('/login');
        return;
      }

      const errorMessage = error.response?.data?.message || error.message || 'Error desconocido';
      console.error('Mensaje de error:', errorMessage);

      toast.error(`Error al cargar el perfil: ${errorMessage}`);
      setError(`No se pudo cargar la información del perfil: ${errorMessage}`);
    } finally {
      console.log('🔄 Finalizando carga del perfil, loading = false');
      setLoading(false);
    }
  };

  const handlePhoneEdit = () => {
    setEditingPhone(true);
  };

  const handlePhoneSave = async () => {
    if (!profile || !decodedToken) return;

    try {
      // Usar el nuevo endpoint unificado para actualizar perfil
      await api.put('/auth/perfil', { telefono: phoneValue });

      setProfile({ ...profile, telefono: phoneValue });
      setEditingPhone(false);
      toast.success('Número de teléfono actualizado correctamente');
    } catch (error) {
      console.error('Error actualizando teléfono:', error);
      toast.error('Error al actualizar el número de teléfono');
    }
  };

  const handlePhoneCancel = () => {
    setPhoneValue(profile?.telefono || '');
    setEditingPhone(false);
  };

  const handleGoBack = () => {
    // Forzar navegación a la raíz como cuando inicias sesión
    window.location.href = '/';
  };

  // Función para capitalizar la primera letra del rol
  const capitalizeRole = (role: string) => {
    if (!role) return '';
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase();
  };

  if (!decodedToken) {
    return (
      <div className="perfil-section">
        <div className="perfil-error">
          <p>Acceso no autorizado. Redirigiendo...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="perfil-section">
      <div className="perfil-content">
        <div className="perfil-body">
          <div className="perfil-header-internal">
            <div className="perfil-title-section">
              <h1 className="perfil-title">
                <i className="bi bi-person-circle"></i>
                Mi Perfil
              </h1>
            </div>
            <button className="search-button-perfil" onClick={handleGoBack}>
              <i className="bi bi-x"></i>
            </button>
          </div>
          {loading ? (
            <div className="perfil-loading">
              <i className="bi bi-hourglass-split"></i>
              Cargando información del perfil...
            </div>
          ) : error ? (
            <div className="perfil-error">
              <i className="bi bi-exclamation-triangle"></i>
              <p>{error}</p>
              <button className="btn btn-primary" onClick={loadUserProfile}>
                <i className="bi bi-arrow-clockwise"></i>
                Reintentar
              </button>
            </div>
          ) : profile ? (
            <div className="perfil-info-container">
              <div className="info-section">
                <div className="info-group">
                  <label className="info-label">Nombre Completo</label>
                  <div className="info-value">
                    <i className="bi bi-person-fill"></i>
                    {profile.nombre} {profile.apellido_paterno} {profile.apellido_materno}
                  </div>
                </div>

                {/* Campo de teléfono solo para colaboradores y coordinadores */}
                {profile.tipo !== 'admin' && (
                  <div className="info-group">
                    <label className="info-label">Número Telefónico</label>
                    {editingPhone ? (
                      <div className="phone-edit-mode">
                        <div className="phone-input-container">
                          <i className="bi bi-telephone-fill phone-icon"></i>
                          <input
                            type="text"
                            className="phone-input-clean"
                            value={phoneValue}
                            onChange={(e) => setPhoneValue(e.target.value)}
                            placeholder="Ingrese su número de teléfono"
                            autoFocus
                          />
                          <div className="phone-actions-inline">
                            <button className="btn-inline btn-inline-success" onClick={handlePhoneSave}>
                              <i className="bi bi-check-lg"></i>
                            </button>
                            <button className="btn-inline btn-inline-cancel" onClick={handlePhoneCancel}>
                              <i className="bi bi-x-lg"></i>
                            </button>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="info-value editable" onClick={handlePhoneEdit}>
                        <i className="bi bi-telephone-fill"></i>
                        <span>{profile.telefono || 'No especificado'}</span>
                        <i className="bi bi-pencil-fill edit-icon"></i>
                      </div>
                    )}
                  </div>
                )}

                <div className="info-group">
                  <label className="info-label">Correo Electrónico</label>
                  <div className="info-value">
                    <i className="bi bi-envelope-fill"></i>
                    {profile.correo}
                  </div>
                </div>

                <div className="info-group">
                  <label className="info-label">Perfil</label>
                  <div className="info-value">
                    <i className={`bi ${profile.tipo === 'admin' ? 'bi-shield-fill-check' :
                        profile.tipo === 'coordinador' ? 'bi-diagram-3-fill' :
                          profile.tipo === 'colaborador' ? 'bi-tools' : 'bi-person-fill'
                      }`}></i>
                    {capitalizeRole(profile.rol)}
                  </div>
                </div>

                {/* Campo de póliza solo para colaboradores y coordinadores */}
                {profile.tipo !== 'admin' && (
                  <div className="info-group">
                    <label className="info-label">Póliza Asignada</label>
                    <div className="status-display">
                      {profile.poliza ? (
                        <div className="status-badge-perfil poliza-badge">
                          <i className="bi bi-file-earmark-text-fill"></i>
                          {profile.poliza.nombre}
                        </div>
                      ) : (
                        <div className="status-badge-perfil no-poliza-badge">
                          <i className="bi bi-file-earmark-x"></i>
                          No asignada
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Campo de especialidades solo para colaboradores */}
                {profile.tipo === 'colaborador' && (
                  <div className="info-group">
                    <label className="info-label">Especialidades Asignadas</label>
                    <div className="status-display">
                      {profile.especialidades && profile.especialidades.length > 0 ? (
                        <div className="especialidades-chips-perfil">
                          {profile.especialidades.map((esp) => (
                            <span key={esp._id} className="especialidad-chip-perfil">
                              <i className="bi bi-cpu"></i>
                              {esp.nombre}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <div className="status-badge-perfil no-especialidades-badge">
                          <i className="bi bi-tools"></i>
                          No asignadas
                        </div>
                      )}
                    </div>
                  </div>
                )}

                <div className="info-group">
                  <label className="info-label">Estado</label>
                  <div className="status-display">
                    <div className={`status-badge-perfil ${profile.estado === 'Activo' ? 'active' : 'inactive'}`}>
                      <i className={`bi ${profile.estado === 'Activo' ? 'bi-check-circle-fill' : 'bi-x-circle-fill'}`}></i>
                      {capitalizeRole(profile.estado)}
                    </div>
                  </div>
                </div>

                <div className="info-group full-width">
                  <label className="info-label">ID de Usuario y Fecha de Creación</label>
                  <div className="user-metadata">
                    <div><strong>ID:</strong> {profile._id}</div>
                    <div><strong>Creado:</strong> {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('es-ES', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    }) : 'No disponible'}</div>
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default Perfil;