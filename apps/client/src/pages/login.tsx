/**
 * Página de inicio de sesión con validación y recordar sesión
 */

import "../styles/login.css";
import logoRowan from '../assets/logo_rwnet.png';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { useDVD } from '../context/DVDContext';
import DVDBackground from '../components/DVDBackground/DVDBackground';
import { useResourcesReady } from '../hooks/useResourcesReady';

import api from '../api';
import { login as authLogin } from '../auth/authService';

/**
 * Componente de login con funcionalidades avanzadas
 */
const Login = ({ onLogin }: { onLogin: () => void }) => {
  const navigate = useNavigate();

  // Estados del formulario
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  // Estados de errores específicos por campo
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');

  // Contextos y hooks personalizados
  const { toggleDVD } = useDVD();
  const isResourcesReady = useResourcesReady();

  /**
   * Efecto para cargar credenciales recordadas al iniciar el componente
   * Restaura email, contraseña y estado de "recordar sesión" si fueron guardados previamente
   */
  useEffect(() => {
    const rememberedEmail = localStorage.getItem("rememberedEmail");
    const rememberedPassword = localStorage.getItem("rememberedPassword");
    const rememberSession = localStorage.getItem("rememberSession");

    if (rememberedEmail && rememberSession === "true") {
      setEmail(rememberedEmail);
      setRememberMe(true);
      if (rememberedPassword) {
        setPassword(rememberedPassword);
      }
    }
  }, []);

  /**
   * Valida el formato del email usando expresión regular
   * Proporciona feedback inmediato al usuario sobre la validez del email
   * 
   * @returns true si el email es válido, false en caso contrario
   */
  const validateEmail = () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email.trim()) {
      setEmailError('');
      return false;
    }

    if (!emailRegex.test(email)) {
      setEmailError('Ingrese una dirección de correo electrónico válida.');
      return false;
    }

    setEmailError('');
    return true;
  };

  /**
   * Limpia el error del campo email cuando el usuario comienza a escribir
   * Mejora la UX al dar feedback inmediato
   */
  const clearEmailError = () => {
    if (emailError) {
      setEmailError('');
    }
  };

  /**
   * Limpia el error del campo contraseña cuando el usuario comienza a escribir
   */
  const clearPasswordError = () => {
    if (passwordError) {
      setPasswordError('');
    }
  };

  /**
   * Alterna la visibilidad de la contraseña
   * Mejora la UX permitiendo al usuario verificar lo que está escribiendo
   */
  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  /**
   * Maneja el envío del formulario de login
   * Realiza validación del lado del cliente y se comunica con el servidor
   * 
   * Funcionalidades:
   * - Validación de email y contraseña
   * - Autenticación con el servidor
   * - Manejo de la funcionalidad "Recordar sesión"
   * - Almacenamiento de datos de usuario en localStorage
   * - Redirección automática después del login exitoso
   * 
   * @param e - Evento del formulario
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Limpiar errores previos
    setEmailError('');
    setPasswordError('');

    let hasErrors = false;

    // Validación del email
    if (!email.trim()) {
      setEmailError('Ingrese una dirección de correo electrónico válida.');
      hasErrors = true;
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setEmailError('Ingrese una dirección de correo electrónico válida.');
        hasErrors = true;
      }
    }

    // Validación de la contraseña
    if (!password.trim()) {
      setPasswordError('Ingrese su contraseña.');
      hasErrors = true;
    }

    if (hasErrors) return;

    setLoading(true);
    try {
      // Autenticación con el servidor
      const response = await api.post('/auth/login', {
        correo: email,
        contraseña: password
      });

      // Verificar si la respuesta tiene 'colaborador' o 'user'
      const userData = response.data.colaborador || response.data.user;
      const token = response.data.token;

      // Usar authService para almacenar datos consistentemente
      authLogin(token, userData);

      // También guardar email para recordar sesión
      localStorage.setItem("email", email);

      // Funcionalidad "Recordar Sesión" - guarda/elimina credenciales según la preferencia
      if (rememberMe) {
        localStorage.setItem("rememberedEmail", email);
        localStorage.setItem("rememberedPassword", password);
        localStorage.setItem("rememberSession", "true");
      } else {
        localStorage.removeItem("rememberedEmail");
        localStorage.removeItem("rememberedPassword");
        localStorage.removeItem("rememberSession");
      }

      // Ejecutar callback de login exitoso y redirigir al dashboard
      onLogin();
      navigate('/');
    } catch (error: any) {
      // Manejo de errores del servidor
      const msg = error?.response?.data?.message || 'Error al iniciar sesión';
      setPasswordError(msg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Navega a la página de registro
   */
  const goToRegister = () => {
    navigate('/register');
  };

  /**
   * Placeholder para funcionalidad de recuperación de contraseña
   * TODO: Implementar página de recuperación de contraseña
   */
  const goToForgotPassword = () => {
    // Implementar navegación a página de recuperación de contraseña si existe
    console.log('Navegando a recuperación de contraseña');
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

          <h3 className="login-title">Iniciar Sesión</h3>

          {/* Formulario de login con validación */}
          <form onSubmit={handleSubmit} className="login-form" noValidate>
            {/* Campo de email con validación en tiempo real */}
            <div className="form-group">
              <div className={`input-container ${emailError ? 'error' : ''}`}>
                <i className="fas fa-envelope input-icon"></i>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onBlur={validateEmail}
                  onInput={clearEmailError}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Introduce tu correo electrónico"
                  className={`form-input ${emailError ? 'error' : ''}`}
                  autoComplete="email"
                />
              </div>
              {emailError && <div className="error-message">{emailError}</div>}
            </div>

            {/* Campo de contraseña con toggle de visibilidad y opciones adicionales */}
            <div className="form-group">
              <div className={`input-container ${passwordError ? 'error' : ''}`}>
                <i className="fas fa-lock input-icon"></i>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onBlur={() => {
                    if (!password.trim()) {
                      setPasswordError('Ingrese su contraseña.');
                    }
                  }}
                  onInput={() => {
                    clearPasswordError();
                    if (!password.trim()) {
                      setPasswordError('Ingrese su contraseña.');
                    }
                  }}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Introduce tu contraseña"
                  className={`form-input ${passwordError ? 'error' : ''}`}
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className={`toggle-password ${showPassword ? 'fas fa-eye-slash active' : 'fas fa-eye'}`}
                  onClick={togglePassword}
                  aria-label="Mostrar/ocultar contraseña"
                />
              </div>
              {passwordError && <div className="error-message">{passwordError}</div>}

              {/* Opciones de contraseña: recordar sesión y recuperación */}
              <div className="password-options">
                <label className="checkbox-container">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="checkbox-input"
                  />
                  <span className="checkbox-custom"></span>
                  <span className="checkbox-label">Recordar sesión</span>
                </label>
                <div className="forgot-password">
                  <a
                    href="#"
                    onClick={(e) => {
                      e.preventDefault();
                      goToForgotPassword();
                    }}
                    className="forgot-password-link"
                  >
                    ¿Olvidaste tu contraseña?
                  </a>
                </div>
              </div>
            </div>

            {/* Botón de envío con estado de carga */}
            <button type="submit" className="login-submit-btn submit-btn" disabled={loading}>
              {loading ? (
                <i className="btn-icon fas fa-spinner fa-spin"></i>
              ) : (
                <>
                  <span className="btn-text">Iniciar Sesión</span>
                  <i className="btn-icon fas fa-arrow-right"></i>
                </>
              )}
            </button>

            {/* Enlace para ir al registro si no tiene cuenta */}
            <div className="register-section">
              <span className="register-text">¿Aún no tienes cuenta?</span>
              <a
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  goToRegister();
                }}
                className="register-link"
              >
                Regístrate aquí
              </a>
            </div>
          </form>
        </div>
      </div>
    </>
  );
};

export default Login;
