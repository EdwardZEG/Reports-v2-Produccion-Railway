/**
 * Componente principal de la aplicación Reports-v2
 */

import React, { JSX } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Login from './pages/login';
import Register from './pages/Register';
import useInactividad from './hooks/Inactivity/useInactividad';
import { useAuth } from './auth/useAuth';
import { DVDProvider } from './context/DVDContext';
import { DataProvider } from './context/DataContext';
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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

  // Hook de inactividad - logout automático después de 30 minutos
  useInactividad(30 * 60 * 1000, () => {
    console.log("Inactividad detectada");
    setIsAuthenticated(false);
    localStorage.removeItem('token');
    localStorage.removeItem('rol');
    localStorage.removeItem('nombre');
    window.location.href = '/login';
  });

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

          {/* Sistema de notificaciones toast global */}
          <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} theme="dark" />
        </BrowserRouter>
      </DVDProvider>
    </DataProvider>
  );
};

export default App;
