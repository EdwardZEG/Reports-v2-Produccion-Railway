/**
 * Componente principal de la aplicación Reports-v2
 */

import React, { JSX, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/login';
import Register from './pages/Register';
import { useAuth } from './auth/useAuth';
import { DVDProvider } from './context/DVDContext';
import { DataProvider } from './context/DataContext';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { isTokenExpired, formatTimeUntilExpiration, getTimeUntilExpiration } from './utils/tokenUtils';
import logoAltaR from './assets/logo_alta_r.svg';
import './styles/Dashboard.css';
import './styles/coordinadores.css';
import './styles/SessionModal.css';

/**
 * Componente de ruta protegida
 * Redirige al login si el usuario no está autenticado
 */
const ProtectedRoute = ({ isAuthenticated, children }: { isAuthenticated: boolean, children: JSX.Element }) => {
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

/**
 * Componente principal con enrutamiento y autenticación
 */
const App: React.FC = () => {
  const { isAuthenticated, setIsAuthenticated, isLoading } = useAuth();
  const [showExpirationModal, setShowExpirationModal] = useState(false);
  const [isHandlingExpiration, setIsHandlingExpiration] = useState(false);

  // Función para manejar el cierre de sesión desde el modal
  const handleLogout = () => {
    console.log('🚪 Cerrando sesión desde modal');

    // Desbloquear el body antes de cerrar
    document.body.classList.remove('session-modal-active');

    // Reset de todos los estados
    setShowExpirationModal(false);
    setIsHandlingExpiration(false);
    setIsAuthenticated(false);

    // Limpiar localStorage
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
    localStorage.removeItem('nombre');

    // Redirigir al login
    window.location.href = '/login';
  };

  // Bloquear/desbloquear el body cuando el modal se muestra/oculta
  useEffect(() => {
    if (showExpirationModal) {
      document.body.classList.add('session-modal-active');
    } else {
      document.body.classList.remove('session-modal-active');
    }

    // Cleanup al desmontar el componente
    return () => {
      document.body.classList.remove('session-modal-active');
    };
  }, [showExpirationModal]);

  // Escuchar evento de token expirado desde el interceptor API
  useEffect(() => {
    const handleTokenExpired = (event: any) => {
      console.log('🚨 Evento tokenExpired recibido:', event.detail);

      // Solo mostrar modal si no se está manejando ya la expiración
      if (!isHandlingExpiration && !showExpirationModal && isAuthenticated) {
        console.log('🔴 Mostrando modal por evento de API');
        setIsHandlingExpiration(true);
        setShowExpirationModal(true);
      }
    };

    window.addEventListener('tokenExpired', handleTokenExpired);

    return () => {
      window.removeEventListener('tokenExpired', handleTokenExpired);
    };
  }, [isHandlingExpiration, showExpirationModal, isAuthenticated]);

  // Sistema de verificación de token expirado (configurable)
  useEffect(() => {
    const verificarTokenExpirado = () => {
      const token = localStorage.getItem('token');

      if (token && isAuthenticated) {
        if (isTokenExpired(token)) {
          // Solo manejar la expiración una vez
          if (!isHandlingExpiration && !showExpirationModal) {
            console.log('🔴 Token expirado - mostrando modal de sesión expirada');
            setIsHandlingExpiration(true);
            setShowExpirationModal(true);
          }
        } else {
          // Log del tiempo restante para debug
          const timeLeft = formatTimeUntilExpiration(token);
          console.log(`🟢 Token válido - expira en: ${timeLeft}`);

          // Reset de banderas si el token es válido
          if (isHandlingExpiration) {
            setIsHandlingExpiration(false);
          }
        }
      }
    };

    // Verificar inmediatamente al cargar
    verificarTokenExpirado();

    // Determinar intervalo de verificación basado en el tiempo de expiración del token
    let intervaloTiempo = 1000; // Para testing, verificar cada segundo

    const token = localStorage.getItem('token');
    if (token && isAuthenticated) {
      const timeLeft = getTimeUntilExpiration(token);
      console.log(`⏰ Tiempo restante del token: ${timeLeft}ms (${Math.floor(timeLeft / 1000)}s)`);
    }

    // Verificar periódicamente si el token sigue válido
    const intervalo = setInterval(verificarTokenExpirado, intervaloTiempo);

    return () => clearInterval(intervalo);
  }, [isAuthenticated, setIsAuthenticated, isHandlingExpiration, showExpirationModal]);

  // La verificación de token se maneja completamente en el useEffect principal

  return (
    <DataProvider>
      <DVDProvider>
        <BrowserRouter>
          {isLoading ? (
            <div style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              height: '100vh',
              background: '#FCEDED',
              fontFamily: 'Open Sans, sans-serif'
            }}>
              <div>Cargando...</div>
            </div>
          ) : (
            <Routes>
              {/* Rutas públicas - Login y Registro */}
              <Route path="/login" element={<Login onLogin={() => setIsAuthenticated(true)} />} />
              <Route path="/register" element={<Register onLogin={() => setIsAuthenticated(true)} />} />

              {/* Ruta protegida principal - Dashboard integrado */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute isAuthenticated={isAuthenticated}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
            </Routes>
          )}

          {/* Modal de sesión expirada - COMPLETAMENTE BLOQUEANTE */}
          {showExpirationModal && (
            <div className="session-expired-overlay">
              <div className="session-expired-content">
                <div className="session-expired-header">
                  <img src={logoAltaR} alt="Logo Rowan" className="session-expired-logo" />
                </div>

                <div className="session-expired-info">
                  <i className="bi bi-exclamation-triangle" style={{ fontSize: '2.5rem', color: '#E9383B', marginBottom: '15px' }}></i>
                  <p className="session-expired-message-main">
                    Tu sesión ha expirado por seguridad.
                  </p>
                  <p className="session-expired-message-sub">
                    Por favor, inicia sesión nuevamente para continuar.
                  </p>
                </div>

                <div className="session-expired-buttons">
                  <button
                    className="session-expired-btn"
                    onClick={handleLogout}
                  >
                    <i className="bi bi-box-arrow-right"></i>
                    Aceptar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sistema de notificaciones toast global */}
          <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} theme="dark" />
        </BrowserRouter>
      </DVDProvider>
    </DataProvider>
  );
};

export default App;
