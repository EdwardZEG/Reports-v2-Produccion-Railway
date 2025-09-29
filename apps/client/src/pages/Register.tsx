/**
 * @fileoverview Página de registro de usuarios
 * Permite crear nuevas cuentas de usuario con validación completa del formulario
 * Incluye funcionalidades de UX mejoradas como DVD background y animaciones
 */

import "../styles/Register.css";
import logoRowan from '../assets/logo_rwnet.png';
import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useDVD } from '../context/DVDContext';
import DVDBackground from '../components/DVDBackground/DVDBackground';
import { useResourcesReady } from '../hooks/useResourcesReady';

import api from '../api';

/**
 * Componente de página de registro
 * Maneja el registro de nuevos usuarios con validación completa
 * 
 * Características principales:
 * - Validación en tiempo real de formularios
 * - Mostrar/ocultar contraseñas con toggle visual
 * - Integración con sistema de animación DVD
 * - Manejo de errores y loading states
 * - Redirección automática después del registro exitoso
 * 
 * @param onLogin - Callback que se ejecuta cuando el registro es exitoso
 * @returns Componente de página de registro
 */
const Register = ({ onLogin }: { onLogin: () => void }) => {
  const navigate = useNavigate();

  // Estados del formulario
  const [nombre, setUsername] = useState('');
  const [correo, setEmail] = useState('');
  const [contraseña, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  // Estados para mostrar/ocultar contraseñas
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Contextos y hooks personalizados
  const { toggleDVD } = useDVD();
  const isResourcesReady = useResourcesReady();

  // Estado de errores de validación
  const [errors, setErrors] = useState({
    nombre: '',
    correo: '',
    contraseña: '',
    confirmPassword: '',
  });

  /**
   * Alterna la visibilidad de la contraseña principal
   */
  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  /**
   * Alterna la visibilidad de la confirmación de contraseña
   */
  const toggleConfirmPassword = () => {
    setShowConfirmPassword(!showConfirmPassword);
  };

  /**
   * Limpia el error de un campo específico cuando el usuario comienza a escribir
   * Mejora la UX al dar feedback inmediato
   * 
   * @param field - Nombre del campo del cual limpiar el error
   */
  const clearError = (field: string) => {
    if (errors[field as keyof typeof errors]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  /**
   * Maneja el envío del formulario de registro
   * Realiza validación completa del lado del cliente antes de enviar al servidor
   * 
   * Validaciones implementadas:
   * - Nombre de usuario requerido
   * - Email válido con formato correcto
   * - Contraseña con al menos 8 caracteres y una mayúscula
   * - Confirmación de contraseña debe coincidir
   * 
   * @param e - Evento del formulario
   */
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();

    let valid = true;
    let newErrors = { nombre: '', correo: '', contraseña: '', confirmPassword: '' };

    // Validación del nombre de usuario
    if (!nombre) {
      newErrors.nombre = 'Por favor ingresa un nombre de usuario.';
      valid = false;
    }

    // Validación del correo electrónico
    if (!correo) {
      newErrors.correo = 'Por favor ingresa un correo electrónico.';
      valid = false;
    } else if (!/\S+@\S+\.\S+/.test(correo)) {
      newErrors.correo = 'El correo electrónico debe contener un "@".';
      valid = false;
    }

    // Validación de la contraseña con criterios de seguridad
    if (!contraseña) {
      newErrors.contraseña = 'Por favor ingresa una contraseña.';
      valid = false;
    } else if (!/[A-Z]/.test(contraseña)) {
      newErrors.contraseña = 'La contraseña debe tener al menos una letra mayúscula.';
      valid = false;
    } else if (contraseña.length < 8) {
      newErrors.contraseña = 'La contraseña debe tener al menos 8 caracteres.';
      valid = false;
    }

    // Validación de confirmación de contraseña
    if (contraseña !== confirmPassword) {
      newErrors.confirmPassword = 'Las contraseñas no coinciden.';
      valid = false;
    }

    setErrors(newErrors);
    if (!valid) return;

    setLoading(true);
    try {
      // Registro del usuario con rol de administrador por defecto
      const response = await api.post('/auth/register', {
        nombre,
        correo,
        contraseña,
        rol: 'administrador'
      });

      const { token, user } = response.data;

      // Guardar información de sesión en localStorage
      localStorage.setItem('token', token);
      localStorage.setItem('nombre', user.nombre);
      localStorage.setItem('rol', user.rol);

      // Ejecutar callback de login exitoso y redirigir
      onLogin();
      navigate('/');
    } catch (error: any) {
      // Manejo de errores del servidor
      if (error.response?.data?.message) {
        setErrors(prev => ({ ...prev, correo: error.response.data.message }));
      } else {
        setErrors(prev => ({ ...prev, correo: 'Error al registrar usuario' }));
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Navega a la página de login
   */
  const goToLogin = () => {
    navigate('/login');
  };

  return (
    <>
      {/* Componente de fondo animado DVD */}
      <DVDBackground />

      {/* Contenedor principal del formulario con animación de entrada */}
      <div className={`login-container ${isResourcesReady ? 'ready' : ''}`}>
        <div className="login-card">
          {/* Logo con funcionalidad easter egg para activar DVD */}
          <div className="logo-container">
            <img
              src={logoRowan}
              alt="Logo"
              className="logo-image"
              onClick={toggleDVD}
            />
          </div>

          <h3 className="login-title">Registro de Usuario</h3>

          {/* Formulario de registro con validación */}
          <form onSubmit={handleRegister} className="login-form" noValidate>
            {/* Campo de nombre de usuario */}
            <div className="form-group">
              <div className={`input-container ${errors.nombre ? 'error' : ''}`}>
                <i className="fas fa-user input-icon"></i>
                <input
                  id="username"
                  type="text"
                  value={nombre}
                  onInput={() => clearError('nombre')}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Introduce tu nombre de usuario"
                  className={`form-input ${errors.nombre ? 'error' : ''}`}
                  autoComplete="username"
                />
              </div>
              {errors.nombre && <div className="error-message">{errors.nombre}</div>}
            </div>

            {/* Campo de correo electrónico */}
            <div className="form-group">
              <div className={`input-container ${errors.correo ? 'error' : ''}`}>
                <i className="fas fa-envelope input-icon"></i>
                <input
                  id="email"
                  type="email"
                  value={correo}
                  onInput={() => clearError('correo')}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Introduce tu correo electrónico"
                  className={`form-input ${errors.correo ? 'error' : ''}`}
                  autoComplete="email"
                />
              </div>
              {errors.correo && <div className="error-message">{errors.correo}</div>}
            </div>

            {/* Campo de contraseña con toggle de visibilidad */}
            <div className="form-group">
              <div className={`input-container ${errors.contraseña ? 'error' : ''}`}>
                <i className="fas fa-lock input-icon"></i>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={contraseña}
                  onInput={() => clearError('contraseña')}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Introduce tu contraseña"
                  className={`form-input ${errors.contraseña ? 'error' : ''}`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={`toggle-password ${showPassword ? 'fas fa-eye-slash active' : 'fas fa-eye'}`}
                  onClick={togglePassword}
                  aria-label="Mostrar/ocultar contraseña"
                />
              </div>
              {errors.contraseña && <div className="error-message">{errors.contraseña}</div>}
            </div>

            {/* Campo de confirmación de contraseña con toggle de visibilidad */}
            <div className="form-group">
              <div className={`input-container ${errors.confirmPassword ? 'error' : ''}`}>
                <i className="fas fa-lock input-icon"></i>
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onInput={() => clearError('confirmPassword')}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirma tu contraseña"
                  className={`form-input ${errors.confirmPassword ? 'error' : ''}`}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className={`toggle-password ${showConfirmPassword ? 'fas fa-eye-slash active' : 'fas fa-eye'}`}
                  onClick={toggleConfirmPassword}
                  aria-label="Mostrar/ocultar confirmación de contraseña"
                />
              </div>
              {errors.confirmPassword && <div className="error-message">{errors.confirmPassword}</div>}
            </div>

            {/* Botón de envío con estado de carga */}
            <button type="submit" className="login-submit-btn submit-btn" disabled={loading}>
              {loading ? (
                <i className="btn-icon fas fa-spinner fa-spin"></i>
              ) : (
                <>
                  <span className="btn-text">Registrarse</span>
                  <i className="btn-icon fas fa-user-plus"></i>
                </>
              )}
            </button>

            {/* Enlace para ir al login si ya tiene cuenta */}
            <div className="register-section">
              <span className="register-text">¿Ya tienes cuenta?</span>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  goToLogin();
                }}
                className="register-link"
              >
                Inicia sesión aquí
              </a>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default Register;