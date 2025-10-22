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
  const [modalReason, setModalReason] = useState<'TOKEN_EXPIRED' | 'USER_INACTIVE'>('TOKEN_EXPIRED');

  // Función para manejar el cierre de sesión desde el modal (redirección únicamente)
  const handleLogout = async () => {
    console.log('🚪 Usuario hizo clic en Aceptar - redirigiendo a login');
    console.log('ℹ️ La limpieza automática ya se ejecutó en background');

    // Desbloquear el body antes de cerrar
    document.body.classList.remove('session-modal-active');

    // Reset de todos los estados
    setShowExpirationModal(false);
    setIsHandlingExpiration(false);
    setIsAuthenticated(false);

    // Redirigir inmediatamente (la limpieza ya se ejecutó automáticamente)
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
    const handleTokenExpired = async (event: any) => {
      console.log('🚨 Evento tokenExpired recibido:', event.detail);

      // Solo mostrar modal si no se está manejando ya la expiración
      if (!isHandlingExpiration && !showExpirationModal && isAuthenticated) {
        console.log('🔴 Mostrando modal por evento de API y ejecutando limpieza automática');
        setIsHandlingExpiration(true);
        setShowExpirationModal(true);
        setModalReason('TOKEN_EXPIRED'); // Los eventos API siempre son por token expirado

        // 🔄 LIMPIEZA AUTOMÁTICA INMEDIATA: También desde el interceptor API
        try {
          console.log('🧹 Ejecutando limpieza automática desde evento API...');
          const { limpiezaCompletaSesion } = await import('./utils/sessionCleanup');
          await limpiezaCompletaSesion();
          console.log('✅ Limpieza automática desde API completada');
        } catch (error) {
          console.error('❌ Error en limpieza automática desde API:', error);
          // Fallback: limpiar localStorage manualmente
          localStorage.removeItem('token');
          localStorage.removeItem('rol');
          localStorage.removeItem('nombre');
          localStorage.removeItem('polizaId');
        }
      }
    };

    window.addEventListener('tokenExpired', handleTokenExpired);

    return () => {
      window.removeEventListener('tokenExpired', handleTokenExpired);
    };
  }, [isHandlingExpiration, showExpirationModal, isAuthenticated]);

  // Iniciar monitoreo de estado del usuario con verificación ultra rápida
  useEffect(() => {
    if (isAuthenticated) {
      console.log('⚡ Usuario autenticado - iniciando verificación inmediata de estado');

      // Importar dinámicamente el monitor de estado
      import('./utils/userStatusMonitor').then(({ iniciarMonitoreoEstado, detenerMonitoreoEstado, verificacionExpress }) => {
        const handleUserInactive = async () => {
          if (!isHandlingExpiration && !showExpirationModal) {
            console.log('🚫 Usuario inactivo detectado por monitor - mostrando modal y ejecutando limpieza');
            setIsHandlingExpiration(true);
            setShowExpirationModal(true);
            setModalReason('USER_INACTIVE');

            // Ejecutar limpieza automática para usuario inactivo
            try {
              console.log('🧹 Ejecutando limpieza por usuario inactivo desde monitor...');
              const { limpiezaCompletaSesion } = await import('./utils/sessionCleanup');
              await limpiezaCompletaSesion();
              console.log('✅ Limpieza por usuario inactivo completada desde monitor');
            } catch (cleanupError) {
              console.error('❌ Error en limpieza por usuario inactivo desde monitor:', cleanupError);
              // Fallback: limpiar localStorage manualmente
              localStorage.removeItem('token');
              localStorage.removeItem('rol');
              localStorage.removeItem('nombre');
              localStorage.removeItem('polizaId');
            }
          }
        };

        const handleMonitorError = (error: string) => {
          console.error('❌ Error en monitoreo de estado:', error);
        };

        // ⚡ VERIFICACIÓN EXPRESS INMEDIATA (sin esperas)
        verificacionExpress(handleUserInactive, handleMonitorError).then(resultado => {
          console.log('⚡ Resultado verificación express:', resultado);

          // Solo iniciar monitoreo regular si el usuario está activo
          if (resultado === true) {
            iniciarMonitoreoEstado(handleUserInactive, handleMonitorError);
          }
          // Si resultado es false (inactivo), el modal ya se mostró
          // Si resultado es null (error/token expirado), se manejará por otros sistemas
        });

        // Cleanup function
        return () => {
          detenerMonitoreoEstado();
        };
      });
    }
  }, [isAuthenticated, isHandlingExpiration, showExpirationModal]);

  // Sistema de verificación de token expirado (simplificado)
  useEffect(() => {
    const verificarTokenExpirado = async () => {
      const token = localStorage.getItem('token');

      if (token && isAuthenticated) {
        if (isTokenExpired(token)) {
          // Solo manejar la expiración una vez
          if (!isHandlingExpiration && !showExpirationModal) {
            console.log('🔴 Token expirado - iniciando limpieza automática y mostrando modal');
            setIsHandlingExpiration(true);
            setShowExpirationModal(true);
            setModalReason('TOKEN_EXPIRED');

            // 🔄 LIMPIEZA AUTOMÁTICA INMEDIATA: Ejecutar limpieza en background sin esperar clic del usuario
            try {
              console.log('🧹 Ejecutando limpieza automática en background...');
              const { limpiezaCompletaSesion } = await import('./utils/sessionCleanup');
              await limpiezaCompletaSesion();
              console.log('✅ Limpieza automática completada en background');
            } catch (error) {
              console.error('❌ Error en limpieza automática background:', error);
              // Fallback: limpiar localStorage manualmente
              localStorage.removeItem('token');
              localStorage.removeItem('rol');
              localStorage.removeItem('nombre');
              localStorage.removeItem('polizaId');
            }
          }
        } else {
          // Token válido - log del tiempo restante
          const timeLeft = formatTimeUntilExpiration(token);
          console.log(`🟢 Token válido - expira en: ${timeLeft}`);

          // Reset de banderas si el token es válido
          if (isHandlingExpiration && !showExpirationModal) {
            setIsHandlingExpiration(false);
          }
        }
      }
    };

    // Verificar inmediatamente al cargar
    verificarTokenExpirado();

    // Intervalo de verificación solo para token (cada segundo para detección rápida)
    const intervaloTiempo = 1000;

    const token = localStorage.getItem('token');
    if (token && isAuthenticated) {
      const timeLeft = getTimeUntilExpiration(token);
      console.log(`⏰ Tiempo restante del token: ${timeLeft}ms (${Math.floor(timeLeft / 1000)}s)`);
    }

    // Verificar periódicamente solo el token (el estado del usuario se maneja por separado)
    const intervalo = setInterval(verificarTokenExpirado, intervaloTiempo);

    return () => clearInterval(intervalo);
  }, [isAuthenticated, setIsAuthenticated, isHandlingExpiration, showExpirationModal]);

  // Manejar refresh/cierre de página para ejecutar limpieza si hay problemas de sesión
  useEffect(() => {
    const handleBeforeUnload = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        // Verificar token expirado
        if (isTokenExpired(token)) {
          console.log('🔄 Página refrescando con token expirado - ejecutando limpieza rápida');
        } else {
          // Token válido - verificar rápidamente si el usuario está inactivo antes del refresh
          try {
            const { verificarEstadoUsuario } = await import('./utils/sessionCleanup');
            const { isActive, error } = await verificarEstadoUsuario();
            if (!isActive && !error) {
              console.log('🚫 Página refrescando con usuario inactivo - ejecutando limpieza rápida');
            } else {
              return; // Usuario activo o error, no necesita limpieza
            }
          } catch (error) {
            console.log('Error verificando estado en refresh:', error);
            return; // En caso de error, no hacer limpieza
          }
        }

        // Ejecutar limpieza sin esperar respuesta (para que sea rápido)
        try {
          const { limpiarArchivosLogout } = await import('./utils/sessionCleanup');
          limpiarArchivosLogout().catch(err => console.log('Limpieza en refresh falló:', err));
        } catch (error) {
          console.log('Error importando limpieza en refresh:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, []);

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
                    {modalReason === 'TOKEN_EXPIRED'
                      ? 'Tu sesión ha expirado por seguridad.'
                      : 'Tu cuenta ha sido desactivada.'}
                  </p>
                  <p className="session-expired-message-sub">
                    {modalReason === 'TOKEN_EXPIRED'
                      ? 'Por favor, inicia sesión nuevamente para continuar.'
                      : 'Contacta al administrador para más información.'}
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
