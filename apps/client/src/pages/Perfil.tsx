/**
 * Página de perfil del usuario
 * Muestra y permite editar la información del perfil del usuario
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import api from '../api';
import { getToken, decodeJWT } from '../auth/authService';
import '../styles/PerfilNew.css';

interface UserProfile {
  _id: string;
  nombre: string;
  apellido_paterno?: string;
  apellido_materno?: string;
  correo: string;
  telefono?: string;
  rol: string;
  tipo: 'admin' | 'colaborador' | 'coordinador';
  estado: string;
  poliza?: {
    _id: string;
    nombre: string;
  };
  especialidades?: Array<{
    _id: string;
    nombre: string;
  }>;
  createdAt: string;
}

const Perfil: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingPhone, setEditingPhone] = useState(false);
  const [phoneValue, setPhoneValue] = useState('');

  // Obtener información del usuario del token
  const token = getToken();
  // const rol = getRol(); // Future use for role-based features
  const decodedToken = token ? decodeJWT(token) : null;

  useEffect(() => {
    loadUserProfile();
  }, []);

  const loadUserProfile = async () => {
    try {
      setLoading(true);

      if (!decodedToken) {
        toast.error('Token inválido');
        navigate('/login');
        return;
      }

      // Usar el nuevo endpoint unificado de perfil
      const response = await api.get('/auth/perfil');
      const userData = response.data;

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
        poliza: userData.polizas?.[0] || null, // La API devuelve array de polizas
        especialidades: userData.especialidades || [],
        createdAt: userData.fecha_creacion
      };

      setProfile(profileData);
      setPhoneValue(profileData.telefono || '');
    } catch (error) {
      console.error('Error cargando perfil:', error);
      toast.error('Error al cargar la información del perfil');
    } finally {
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
    // Navegar a la primera sección del sidebar según el tipo de usuario
    if (decodedToken?.tipo === 'colaborador') {
      // Para colaboradores, ir a Períodos MP
      navigate('/dashboard', { state: { activeSection: 'periodos' } });
    } else {
      // Para coordinadores y administradores, ir a Inicio
      navigate('/dashboard', { state: { activeSection: 'inicio' } });
    }
  };

  const getInitials = (nombre: string, apellido?: string) => {
    const firstInitial = nombre ? nombre.charAt(0).toUpperCase() : '';
    const lastInitial = apellido ? apellido.charAt(0).toUpperCase() : '';
    return firstInitial + lastInitial;
  };

  const getFullName = () => {
    if (!profile) return '';
    const parts = [profile.nombre, profile.apellido_paterno, profile.apellido_materno].filter(Boolean);
    return parts.join(' ');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getRoleDisplayName = (tipo: string, rol: string) => {
    switch (tipo) {
      case 'admin':
        return 'Administrador';
      case 'coordinador':
        return 'Coordinador';
      case 'colaborador':
        return rol === 'encargado' ? 'Encargado Técnico' : 'Auxiliar Técnico';
      default:
        return rol;
    }
  };

  if (loading) {
    return (
      <div className="perfil-loading">
        <div className="spinner-border text-primary" role="status">
          <span className="visually-hidden">Cargando...</span>
        </div>
        <p>Cargando información del perfil...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="perfil-error">
        <i className="bi bi-exclamation-triangle"></i>
        <h3>Error al cargar el perfil</h3>
        <button className="btn btn-primary" onClick={loadUserProfile}>
          Intentar de nuevo
        </button>
      </div>
    );
  }

  return (
    <div className="perfil-container">
      {/* Header con flecha de regreso */}
      <div className="perfil-header">
        <button className="btn-back" onClick={handleGoBack}>
          <i className="bi bi-arrow-left"></i>
        </button>
        <h1>Información del perfil</h1>
      </div>

      <div className="perfil-content">
        {/* Sección de foto de perfil */}
        <div className="perfil-section">
          <h2>Foto de perfil</h2>
          <div className="perfil-avatar-section">
            <div className="perfil-avatar-large">
              {getInitials(profile.nombre, profile.apellido_paterno)}
            </div>
            <div className="avatar-info">
              <p className="avatar-title">Foto de perfil</p>
              <p className="avatar-subtitle">Las iniciales se generan automáticamente desde tu nombre</p>
              <p className="avatar-formats">Basado en: {profile.nombre} {profile.apellido_paterno}</p>
            </div>
          </div>
        </div>

        {/* Grid de información */}
        <div className="perfil-grid">
          {/* ID de Usuario */}
          <div className="perfil-field">
            <label>ID de Usuario</label>
            <div className="field-value id-field">
              {profile._id}
            </div>
          </div>

          {/* Perfil/Rol */}
          <div className="perfil-field">
            <label>Perfil</label>
            <div className="field-value role-field">
              <i className="bi bi-person-badge"></i>
              {getRoleDisplayName(profile.tipo, profile.rol)}
            </div>
          </div>

          {/* Estado */}
          <div className="perfil-field">
            <label>Estado</label>
            <div className="field-value status-field">
              <span className={`status-badge ${profile.estado === 'Activo' ? 'active' : 'inactive'}`}>
                <i className={`bi ${profile.estado === 'Activo' ? 'bi-check-circle' : 'bi-x-circle'}`}></i>
                {profile.estado}
              </span>
            </div>
          </div>

          {/* Correo electrónico */}
          <div className="perfil-field">
            <label>Correo electrónico</label>
            <div className="field-value email-field">
              {profile.correo}
            </div>
          </div>
        </div>

        {/* Información editable */}
        <div className="perfil-section">
          <h2>Información editable</h2>

          {/* Nombre completo - Solo lectura */}
          <div className="perfil-field">
            <label>Nombre completo</label>
            <div className="field-value readonly">
              {getFullName()}
            </div>
          </div>

          {/* Teléfono - Editable */}
          <div className="perfil-field">
            <label>Número telefónico</label>
            <div className="field-value editable">
              {editingPhone ? (
                <div className="edit-phone-container">
                  <input
                    type="tel"
                    value={phoneValue}
                    onChange={(e) => setPhoneValue(e.target.value)}
                    placeholder="Ingresa tu número de teléfono"
                    className="phone-input"
                  />
                  <div className="edit-buttons">
                    <button className="btn btn-success btn-sm" onClick={handlePhoneSave}>
                      <i className="bi bi-check"></i>
                    </button>
                    <button className="btn btn-secondary btn-sm" onClick={handlePhoneCancel}>
                      <i className="bi bi-x"></i>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="phone-display">
                  <span>{profile.telefono || 'No especificado'}</span>
                  <button className="btn btn-link btn-edit" onClick={handlePhoneEdit}>
                    <i className="bi bi-pencil"></i>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Póliza asignada */}
          {profile.poliza && (
            <div className="perfil-field">
              <label>Póliza asignada</label>
              <div className="field-value readonly">
                {profile.poliza.nombre}
              </div>
            </div>
          )}

          {/* Especialidades asignadas */}
          {profile.especialidades && profile.especialidades.length > 0 && (
            <div className="perfil-field">
              <label>Especialidades asignadas</label>
              <div className="field-value readonly">
                <div className="especialidades-list">
                  {profile.especialidades.map((esp) => (
                    <span key={esp._id} className="especialidad-tag">
                      {esp.nombre}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Fecha de creación */}
          <div className="perfil-field">
            <label>Fecha de creación de cuenta</label>
            <div className="field-value readonly">
              <i className="bi bi-calendar-event me-2"></i>
              {formatDate(profile.createdAt)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Perfil;