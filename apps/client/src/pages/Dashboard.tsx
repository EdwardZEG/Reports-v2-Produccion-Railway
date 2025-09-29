/**
 * Dashboard principal con sidebar expandible y navegación por roles
 * Combina funcionalidad de búsqueda, vista previa y modal de resultados
 * Optimizado para UX/UI con background unificado y distribución de espacio mejorada
 */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import '../styles/Dashboard.css';
import { getToken, logout } from '../auth/authService';

// Importar páginas existentes para mostrar en las secciones
import InicioSection from '../components/InicioSection';
import Especialidades from './Especialidad';
import Polizas from './Polizas';
import Coordinadores from './Coordinadores';
import Encargados from './Encargados';
import SubirReporteSection from '../components/SubirReporteSection/SubirReporteSection';
import PeriodosMPSection from '../components/PeriodosMP/PeriodosMPSection';
import DispositivosAsignadosSection from '../components/DispositivosAsignados/DispositivosAsignadosSection';
import HistorialReportesSection from '../components/HistorialReportes/HistorialReportesSection';

// Importar logo y contexto DVD
import logoRwnet from '../assets/logo_rwnet.png';
import { useDVD } from '../context/DVDContext';

/**
 * Interface para items del menú de navegación
 * Define estructura de cada elemento del sidebar
 */
interface MenuItem {
  section: string;                    // Identificador único de la sección
  icon: string;                      // Clase de icono Bootstrap
  text: string;                      // Texto a mostrar en el menú
  component?: React.ComponentType;   // Componente a renderizar (opcional)
  roles: string[];                   // Roles que pueden acceder a esta sección
}

/**
 * Dashboard principal con sidebar expandible
 * Combina navegación, autenticación y contenido principal
 * Incluye funcionalidad de búsqueda, vista previa y modal de resultados optimizado
 */
const Dashboard: React.FC = () => {
  // Estados para la funcionalidad del dashboard original - búsqueda y reportes
  const [nombreUsuario, setNombreUsuario] = useState<string>("");
  const [dispositivos, setDispositivos] = useState<any[]>([]);              // Dispositivos encontrados en búsqueda
  const [reporte, setReporte] = useState<{ nombre: string; url: string }>({ // Estado del reporte generado
    nombre: "",
    url: ""
  });
  const [showModal, setShowModal] = useState<boolean>(false);               // Control del modal de resultados
  const [isLoading, setIsLoading] = useState<boolean>(false);               // Estado de carga global
  const [loadingStats, setLoadingStats] = useState<boolean>(false);        // Estado de carga de estadísticas

  // Estados para barra de progreso de generación de reportes
  const [progressIntervalId, setProgressIntervalId] = useState<number | null>(null); // ID del intervalo
  const [isReportDownloaded, setIsReportDownloaded] = useState<boolean>(false); // Control de descarga única

  const [resultadosData, setResultadosData] = useState<{                   // Datos para mostrar en modal
    porcentaje: string;
    distribucion: string;
    colaboradores?: Array<{
      id?: string;
      nombre: string;
      dispositivos: number;
      porcentaje: string;
      iniciales?: string;
      email?: string;
      poliza?: string;
    }>;
    totalUsuarios?: string;
    totalDispositivos?: number;
    colaboradoresActivos?: number;
  }>({
    porcentaje: 'Cargando...',
    distribucion: 'Cargando datos...',
    colaboradores: [],
    totalUsuarios: '0',
    totalDispositivos: 0,
    colaboradoresActivos: 0
  });

  // Estados para el sidebar y navegación
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false);        // Control de expansión del sidebar
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);     // Control del dropdown de usuario
  const [activeSection, setActiveSection] = useState('inicio');            // Sección actualmente activa
  const [isMobile, setIsMobile] = useState(false);                         // Detección de dispositivo móvil

  // Estados para el sistema de slider
  const [sectionTransition, setSectionTransition] = useState('');          // Estado de transición entre secciones

  // Estado para el modo expandido de vista previa
  const [isPreviewExpanded, setIsPreviewExpanded] = useState(false);        // Control del modo expandido de vista previa

  // Estados para SubirReporteSection
  const [dispositivosSubidos, setDispositivosSubidos] = useState<any[]>([]);  // Dispositivos subidos en la sesión
  const [isSubirReporteExpanded, setIsSubirReporteExpanded] = useState(false); // Control del modo expandido para subir reporte

  // Referencias para el DOM y temporizadores
  const sidebarRef = useRef<HTMLDivElement>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  // Obtener datos del usuario desde localStorage
  const role = localStorage.getItem('rol')?.toLowerCase();
  const userEmail = localStorage.getItem('email') || '';
  const { resetDVD } = useDVD();

  // Configuración del menú según roles - ORDEN CORREGIDO: Pólizas antes que Especialidades
  const menuItems: MenuItem[] = [
    {
      section: 'inicio',
      icon: 'house',
      text: 'Inicio',
      roles: ['administrador', 'coordinador']
    },
    {
      section: 'polizas',
      icon: 'shield-check',
      text: 'Pólizas',
      component: Polizas,
      roles: ['administrador', 'coordinador']
    },
    {
      section: 'especialidades',
      icon: 'briefcase',
      text: 'Especialidades',
      component: Especialidades,
      roles: ['administrador', 'coordinador']
    },
    {
      section: 'coordinadores',
      icon: 'people',
      text: 'Coordinadores',
      component: Coordinadores,
      roles: ['administrador']
    },
    {
      section: 'colaboradores',
      icon: 'person-workspace',
      text: 'Colaboradores',
      component: Encargados,
      roles: ['administrador', 'coordinador']
    },
    {
      section: 'periodos',
      icon: 'calendar-range',
      text: 'Periodos MP',
      component: PeriodosMPSection,
      roles: ['coordinador']
    },
    {
      section: 'dispositivosAsignados',
      icon: 'list-task',
      text: 'Mis Dispositivos',
      component: DispositivosAsignadosSection,
      roles: ['encargado', 'auxiliar']
    },
    {
      section: 'historialReportes',
      icon: 'clock-history',
      text: 'Mi Historial',
      component: HistorialReportesSection,
      roles: ['encargado', 'auxiliar']
    },
    {
      section: 'subirReporte',
      icon: 'upload',
      text: 'Subir Reporte',
      roles: ['encargado', 'auxiliar']
    }
  ];

  // Filtrar menú según rol del usuario
  const availableMenuItems = menuItems.filter(item =>
    item.roles.includes(role || '')
  );



  /**
   * Obtener iniciales del nombre de usuario
   */
  const getUserInitials = (fullname: string): string => {
    if (!fullname) return '?';
    return fullname.split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  /**
   * Detectar si es dispositivo móvil
   */
  const checkMobile = () => {
    setIsMobile(window.innerWidth <= 768);
  };

  /**
   * Manejar hover en sidebar (solo desktop)
   */
  const handleMouseEnter = () => {
    if (!isMobile) {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      setIsSidebarExpanded(true);
    }
  };

  const handleMouseLeave = () => {
    if (!isMobile) {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      hoverTimeoutRef.current = setTimeout(() => {
        setIsSidebarExpanded(false);
        setIsUserDropdownOpen(false);
      }, 100) as unknown as number;
    }
  };

  /**
   * Manejar clic en logo (cerrar sidebar en móvil)
   */
  const handleLogoClick = () => {
    if (isMobile) {
      closeSidebar();
    }
  };

  /**
   * Abrir sidebar (móvil)
   */
  const openSidebar = () => {
    setIsSidebarExpanded(true);
  };

  /**
   * Cerrar sidebar (móvil)
   */
  const closeSidebar = () => {
    setIsSidebarExpanded(false);
    setIsUserDropdownOpen(false);
  };

  /**
   * Toggle dropdown de usuario
   */
  const toggleUserDropdown = (event: React.MouseEvent) => {
    event.stopPropagation();
    setIsUserDropdownOpen(!isUserDropdownOpen);
  };

  /**
   * Toggle modo expandido de vista previa
   * Controla si la vista previa ocupa toda la pantalla o comparte espacio con búsqueda
   */
  const togglePreviewExpanded = () => {
    setIsPreviewExpanded(!isPreviewExpanded);
  };

  /**
   * Manejar actualización de progreso desde el componente SearchReportForm
   * Solo logea el progreso - el indicador visual es el icono giratorio en las estadísticas
   */
  const handleProgressUpdate = useCallback((_progressValue: number, _message: string, _timeRemainingValue?: number) => {
    // Progress tracking sin logs para mejor rendimiento
  }, []);



  /**
   * Iniciar indicador de carga
   */
  const startProgressBar = () => {
    // Solo resetear valores, el indicador visual es el icono giratorio
  };

  /**
   * Detener indicador de carga
   */
  const stopProgressBar = useCallback(() => {
    // Limpiar intervalo si existe (compatibilidad)
    if (progressIntervalId) {
      clearInterval(progressIntervalId);
      setProgressIntervalId(null);
    }
  }, [progressIntervalId]);

  // Callbacks optimizados para evitar re-renders innecesarios
  const handleSearch = useCallback((data: any[]) => {
    setDispositivos(data);

    // Calcular distribución real por colaborador
    const total = data.length;
    const conteo = data.reduce(
      (acc, dispositivo) => {
        const nombre = dispositivo.colaborador?.nombre || "Sin nombre";
        acc[nombre] = (acc[nombre] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const distribucionTexto = Object.entries(conteo)
      .map(([nombre, cantidad]) => {
        const porcentaje = (((cantidad as number) / total) * 100).toFixed(2);
        return `${nombre}: ${porcentaje}%`;
      })
      .join(', ');

    setResultadosData({
      porcentaje: `${total} dispositivos encontrados`,
      distribucion: distribucionTexto
    });
  }, []);

  const handleReporteGenerado = useCallback((nombre: string, url: string) => {
    // Resetear estado de descarga para nuevo reporte
    setIsReportDownloaded(false);

    // Reporte recibido sin logs para mejor rendimiento
    setReporte({ nombre, url });
  }, []);

  const handleLoadingStart = useCallback(() => {
    setIsLoading(true);
    startProgressBar(); // Iniciar barra de progreso
  }, []);

  const handleLoadingEnd = useCallback(() => {
    setIsLoading(false);
    stopProgressBar(); // Detener barra de progreso
  }, [stopProgressBar]);

  const handleShowModal = useCallback(() => setShowModal(true), []);

  // Callbacks para SubirReporteSection
  const handleDeviceAdded = useCallback((device: any) => {
    setDispositivosSubidos(prev => [...prev, device]);
  }, []);

  const handleSubirReporteLoadingStart = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleSubirReporteLoadingEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  /**
   * Cargar estadísticas reales de colaboradores desde la API 
   * Obtiene datos reales de reportes y colaboradores para mostrar en el modal
   */
  const cargarEstadisticasReales = useCallback(async () => {
    setLoadingStats(true);
    try {
      // Usar el nuevo endpoint de estadísticas que trae TODA la información necesaria
      const estadisticasResponse = await fetch('/api/reportes/estadisticas', {
        headers: {
          'Authorization': `Bearer ${getToken()}`
        }
      });

      if (!estadisticasResponse.ok) {
        throw new Error('Error al cargar estadísticas');
      }

      const estadisticasData = await estadisticasResponse.json();

      // Los datos ya vienen procesados desde el backend
      const { colaboradores, resumen } = estadisticasData;

      // Calcular porcentajes para cada colaborador
      const colaboradoresConPorcentaje = colaboradores.map((colaborador: any) => ({
        id: colaborador.id,
        nombre: colaborador.nombre,
        dispositivos: colaborador.reportes,
        porcentaje: resumen.totalReportes > 0
          ? ((colaborador.reportes / resumen.totalReportes) * 100).toFixed(1) + '%'
          : '0.0%',
        iniciales: colaborador.nombre.substring(0, 2).toUpperCase(),
        email: colaborador.email,
        poliza: colaborador.poliza
      })).sort((a: any, b: any) => b.reportes - a.reportes);

      // Crear distribución de texto
      const distribucionReal = colaboradoresConPorcentaje
        .filter((colaborador: any) => colaborador.reportes > 0)
        .map((colaborador: any) => {
          const porcentaje = ((colaborador.reportes / resumen.totalReportes) * 100).toFixed(1);
          return `${colaborador.nombre}: ${porcentaje}%`;
        })
        .join(', ');

      // Actualizar datos con estadísticas reales
      setResultadosData({
        totalUsuarios: resumen.totalColaboradores.toString(),
        porcentaje: `${resumen.totalReportes} dispositivos totales`,
        distribucion: distribucionReal || 'Sin dispositivos disponibles',
        colaboradores: colaboradoresConPorcentaje,
        totalDispositivos: resumen.totalReportes,
        colaboradoresActivos: resumen.colaboradoresActivos
      });



    } catch (error) {
      console.error('Error al cargar estadísticas:', error);
      // Mantener datos por defecto en caso de error
      setResultadosData({
        totalUsuarios: '0',
        porcentaje: 'Error al cargar datos',
        distribucion: 'Error de conexión',
        colaboradores: []
      });
    } finally {
      setLoadingStats(false);
    }
  }, []);

  // Cargar estadísticas reales al montar el componente
  useEffect(() => {
    cargarEstadisticasReales();
  }, [cargarEstadisticasReales]);

  // Recargar estadísticas cuando se abre el modal
  useEffect(() => {
    if (showModal) {
      cargarEstadisticasReales();
    }
  }, [showModal, cargarEstadisticasReales]);

  // Memorizar PreviewDoc para evitar re-renders innecesarios
  // const memoizedPreviewDoc = useMemo(() => (
  //   <PreviewDoc dispositivos={dispositivos} isLoading={isLoading} />
  // ), [dispositivos, isLoading]);

  /**
   * Cambiar sección activa con animación
   */
  const setActiveSectionHandler = (section: string) => {
    if (section === activeSection) return;

    setSectionTransition('slide-exit');

    // Después de la animación de salida, cambiar a la nueva sección
    setTimeout(() => {
      setActiveSection(section);
      setSectionTransition('slide-enter');
      resetDVD();

      // Completar la animación de entrada
      setTimeout(() => {
        setSectionTransition('');
      }, 400);
    }, 200);

    if (isMobile) {
      closeSidebar();
    }
  };

  /**
   * Navegación con flechas del teclado
   */
  const handleKeyNavigation = (e: KeyboardEvent) => {
    if (e.altKey) {
      const currentIndex = availableMenuItems.findIndex(item => item.section === activeSection);

      if (e.key === 'ArrowRight' && currentIndex < availableMenuItems.length - 1) {
        e.preventDefault();
        setActiveSectionHandler(availableMenuItems[currentIndex + 1].section);
      } else if (e.key === 'ArrowLeft' && currentIndex > 0) {
        e.preventDefault();
        setActiveSectionHandler(availableMenuItems[currentIndex - 1].section);
      }
    }
  };

  /**
   * Ir a configuración
   */
  const goToConfig = () => {
    // Ir a configuración
    setIsUserDropdownOpen(false);
    // Aquí se puede agregar la navegación a configuración en el futuro
  };

  // Función de cierre de sesión con preservación de credenciales recordadas
  const handleLogout = async () => {
    // Sección: Limpieza del contexto de aplicación
    resetDVD();

    // Sección: Respaldo de credenciales recordadas
    const rememberedEmail = localStorage.getItem("rememberedEmail");
    const rememberedPassword = localStorage.getItem("rememberedPassword");
    const rememberSession = localStorage.getItem("rememberSession");

    // Sección: Ejecución del logout con limpieza de archivos
    await logout();

    // Sección: Restauración de credenciales recordadas
    if (rememberSession === "true" && rememberedEmail) {
      localStorage.setItem("rememberedEmail", rememberedEmail);
      localStorage.setItem("rememberSession", "true");
      if (rememberedPassword) {
        localStorage.setItem("rememberedPassword", rememberedPassword);
      }
    }
  };

  /**
   * Manejar clics fuera del sidebar
   */
  const handleClickOutside = (event: MouseEvent) => {
    if (isUserDropdownOpen && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
      setIsUserDropdownOpen(false);
    }

    if (isSidebarExpanded && sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
      if (isMobile) {
        closeSidebar();
      } else {
        setIsSidebarExpanded(false);
      }
    }
  };

  /**
   * Función para renderizar el contenido principal según la sección activa
   * Maneja la vista de inicio con formulario optimizado y vista previa mejorada
   */
  const renderContent = () => {
    // Vista principal de inicio con componente memoizado para evitar re-montajes
    if (activeSection === 'inicio') {
      return (
        <InicioSection
          dispositivos={dispositivos}
          reporte={reporte}
          isLoading={isLoading}
          showModal={showModal}
          isPreviewExpanded={isPreviewExpanded}
          isReportDownloaded={isReportDownloaded}
          resultadosData={resultadosData}
          onSearch={handleSearch}
          onReporteGenerado={handleReporteGenerado}
          onShowModal={handleShowModal}
          onLoadingStart={handleLoadingStart}
          onLoadingEnd={handleLoadingEnd}
          onProgressUpdate={handleProgressUpdate}
          onPreviewExpanded={setIsPreviewExpanded}
          onReportDownloaded={setIsReportDownloaded}
          onCloseModal={() => setShowModal(false)}
        />
      );
    }

    // Mantener renderizado original para otras secciones
    if (activeSection === 'inicio-old') {
      return (
        <div className={`inicio-section ${isPreviewExpanded ? 'preview-expanded' : ''}`}>
          {/* Header combinado con formulario y estadísticas */}
          <div className={`inicio-header-combined ${isPreviewExpanded ? 'hidden-below' : ''}`}>
            {/* Formulario de búsqueda a la izquierda */}
            <div className="search-header-section">
              <div className="section-header-compact">
                <div className="section-title-compact">
                  <i className="bi bi-search"></i>
                  <h3>Buscar Dispositivos</h3>
                </div>
                <p className="section-description-compact">
                  Filtra y genera reportes de dispositivos por póliza, especialidad y período
                </p>
              </div>

              <div className="search-form-header">
                {/* SearchReportForm ya está integrado en InicioSection */}
                <div>Componente de búsqueda (integrado en nueva implementación)</div>
              </div>
            </div>

            {/* Estadísticas a la derecha */}
            <div className="stats-header-section">
              <div className="stats-bar-compact">
                <div className="stat-item-compact">
                  <div className="stat-icon-compact primary">
                    <i className="bi bi-clipboard-data"></i>
                  </div>
                  <div className="stat-info-compact">
                    <span className="stat-label-compact">REPORTES</span>
                    <span className="stat-value-compact">{dispositivos.length}</span>
                  </div>
                </div>

                <div className="stat-item-compact">
                  <div className="stat-icon-compact secondary">
                    <i className="bi bi-file-earmark-text"></i>
                  </div>
                  <div className="stat-info-compact">
                    <span className="stat-label-compact">DOCUMENTOS</span>
                    <span className="stat-value-compact">{reporte.nombre ? '1' : '0'}</span>
                  </div>
                </div>

                {isLoading && (
                  <div className="stat-item-compact generating">
                    <div className="stat-icon-compact loading">
                      <i className="bi bi-arrow-repeat"></i>
                    </div>
                    <div className="stat-info-compact">
                      <span className="stat-label-compact">GENERANDO REPORTE...</span>
                    </div>
                  </div>
                )}

                {!isLoading && reporte.nombre && (
                  <div className="stat-item-compact generated">
                    <div className="stat-icon-compact success">
                      <i className="bi bi-download"></i>
                    </div>
                    <div className="stat-info-compact">
                      <span className="stat-label-compact">REPORTE</span>
                      <span className="stat-value-compact">
                        <button
                          className={`download-btn-compact ${isReportDownloaded ? 'downloaded' : ''}`}
                          disabled={isReportDownloaded}
                          onClick={async () => {
                            if (isReportDownloaded) return;

                            try {
                              // Sección: Descarga segura con autorización JWT
                              const response = await fetch(reporte.url, {
                                method: 'GET',
                                headers: {
                                  'Authorization': `Bearer ${getToken()}`,
                                }
                              });

                              if (!response.ok) {
                                throw new Error(`Error: ${response.status}`);
                              }

                              // Sección: Procesamiento del archivo descargado
                              const blob = await response.blob();
                              const downloadUrl = window.URL.createObjectURL(blob);

                              // Sección: Creación y ejecución de descarga automática
                              const link = document.createElement('a');
                              link.href = downloadUrl;
                              link.download = reporte.nombre;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);

                              // Sección: Limpieza de recursos temporales
                              window.URL.revokeObjectURL(downloadUrl);

                              // Sección: Actualización de estado de descarga
                              setIsReportDownloaded(true);
                              // Archivo descargado exitosamente
                            } catch (error) {
                              console.error('Error al descargar archivo:', error);
                              // Mostrar error al usuario
                              alert('Error al descargar el archivo. Por favor, intenta nuevamente.');
                            }
                          }}
                        >
                          <i className={`bi ${isReportDownloaded ? 'bi-check-circle' : 'bi-file-word'} me-2`}></i>
                          {isReportDownloaded ? 'Descargado' : 'Descargar'}
                        </button>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Vista previa expandida con layout optimizado */}
          <div className={`preview-full-section ${isPreviewExpanded ? 'expanded' : ''}`}>
            <div className="section-header-full">
              <div className="section-title-full">
                <i className="bi bi-eye-fill"></i>
                <h3>Vista Previa de Dispositivos</h3>
              </div>

              {/* Botón de expandir/contraer - solo visible cuando hay resultados */}
              {dispositivos.length > 0 && (
                <button
                  className="expand-preview-btn"
                  onClick={togglePreviewExpanded}
                  title={isPreviewExpanded ? 'Contraer vista previa' : 'Expandir vista previa'}
                >
                  <i className={`bi ${isPreviewExpanded ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'}`}></i>
                </button>
              )}
            </div>
            {/* Contenedor principal con scroll optimizado y distribución de espacio mejorada */}
            <div className="preview-container-full">
              {/* Componente PreviewDoc integrado en InicioSection */}
            </div>
          </div>

          {/* Modal de resultados de rendimiento con tabla responsive */}
          {showModal && (
            <div className="modal-overlay" onClick={() => setShowModal(false)}>
              <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h3 className="modal-title">
                    <i className="bi bi-people-fill"></i>
                    Desempeño por Colaborador
                  </h3>
                  <button className="modal-close" onClick={() => setShowModal(false)}>
                    <i className="bi bi-x"></i>
                  </button>
                </div>
                <div className="modal-body">
                  {/* Resumen de estadísticas generales */}
                  <div className="stats-summary">
                    <div className="stat-card">
                      <div className="stat-value">{resultadosData.totalUsuarios || '0'}</div>
                      <div className="stat-label">Total Colaboradores</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{resultadosData.colaboradoresActivos || '0'}</div>
                      <div className="stat-label">Con Dispositivos</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">{resultadosData.totalDispositivos || '0'}</div>
                      <div className="stat-label">Total Dispositivos</div>
                    </div>
                    <div className="stat-card">
                      <div className="stat-value">
                        {resultadosData.totalUsuarios && resultadosData.colaboradoresActivos
                          ? Math.round((resultadosData.colaboradoresActivos / parseInt(resultadosData.totalUsuarios)) * 100)
                          : 0}%
                      </div>
                      <div className="stat-label">Participación</div>
                    </div>
                  </div>

                  {/* Tabla de rendimiento con scroll vertical optimizado */}
                  <div className="performance-table-container">
                    <table className="performance-table">
                      <thead>
                        <tr>
                          {/* Cambio: Headers simplificados sin iconos para diseño más limpio y minimalista */}
                          <th className="th-name">Colaborador</th>
                          <th className="th-reports">Reportes</th>
                          <th className="th-percentage">Participación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Generar filas de la tabla usando datos reales de colaboradores */}
                        {loadingStats ? (
                          <tr>
                            <td colSpan={3} className="loading-stats">
                              <div className="loading-spinner">
                                <i className="bi bi-arrow-repeat spin"></i>
                                Cargando estadísticas...
                              </div>
                            </td>
                          </tr>
                        ) : resultadosData.colaboradores && resultadosData.colaboradores.length > 0 ? (
                          resultadosData.colaboradores.map((colaborador, index) => {
                            // El porcentaje ya viene calculado como string
                            const porcentajeNumerico = colaborador.porcentaje.replace('%', '');

                            return (
                              <tr key={colaborador.id || index} className="performance-row">
                                {/* Columna de colaborador con avatar y nombre */}
                                <td className="td-name">
                                  <div className="collaborator-info">
                                    <div className="collaborator-avatar">
                                      {colaborador.nombre.charAt(0).toUpperCase()}
                                    </div>
                                    <div className="collaborator-details">
                                      <span className="collaborator-name">{colaborador.nombre}</span>
                                      {colaborador.poliza && (
                                        <span className="collaborator-poliza">{colaborador.poliza}</span>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                {/* Columna de número de reportes */}
                                <td className="td-reports">
                                  <span className="reports-count">{colaborador.dispositivos || 0}</span>
                                </td>
                                {/* Columna de porcentaje de participación */}
                                <td className="td-percentage">
                                  <div className="percentage-info">
                                    <span className="percentage-count">{colaborador.porcentaje}</span>
                                    {colaborador.dispositivos > 0 && (
                                      <div className="progress-bar">
                                        <div
                                          className="progress-fill"
                                          style={{ width: `${porcentajeNumerico}%` }}
                                        ></div>
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr>
                            <td colSpan={3} className="no-data">
                              {resultadosData.distribucion === 'Error de conexión'
                                ? 'Error al cargar datos'
                                : 'No hay datos disponibles'}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // Vista de SubirReporte con el mismo layout que inicio
    if (activeSection === 'subirReporte') {
      return (
        <SubirReporteSection
          dispositivos={dispositivosSubidos}
          isLoading={isLoading}
          isPreviewExpanded={isSubirReporteExpanded}
          onDeviceAdded={handleDeviceAdded}
          onLoadingStart={handleSubirReporteLoadingStart}
          onLoadingEnd={handleSubirReporteLoadingEnd}
          onPreviewExpanded={setIsSubirReporteExpanded}
        />
      );
    }

    // Renderizar otras secciones del dashboard según el menú seleccionado
    const menuItem = menuItems.find(item => item.section === activeSection);
    if (menuItem && menuItem.component) {
      const Component = menuItem.component;
      return (
        <div className="section-content">
          <Component />
        </div>
      );
    }

    // Fallback para secciones sin componente específico
    return (
      <div className="section-content">
        <h2>{menuItems.find(item => item.section === activeSection)?.text}</h2>
        <p>Contenido de {activeSection}</p>
      </div>
    );
  };

  // Efecto para manejar la clase del body cuando el sidebar se expande/contrae
  useEffect(() => {
    if (isSidebarExpanded) {
      document.body.classList.add('sidebar-expanded');
    } else {
      document.body.classList.remove('sidebar-expanded');
    }

    // Cleanup al desmontar el componente
    return () => {
      document.body.classList.remove('sidebar-expanded');
    };
  }, [isSidebarExpanded]);

  // Efectos de inicialización y configuración del dashboard
  useEffect(() => {
    // Cargar datos del usuario desde localStorage
    const userData = localStorage.getItem("nombre");
    if (userData) {
      setNombreUsuario(userData);
    }

    // Configurar sección inicial según el rol del usuario
    if (role === 'encargado' || role === 'auxiliar') {
      setActiveSection('subirReporte');
    }

    // Configurar eventos de responsividad y manejo de clics
    checkMobile();
    document.addEventListener('click', handleClickOutside);
    document.addEventListener('keydown', handleKeyNavigation);
    window.addEventListener('resize', checkMobile);

    // Listener para navegación automática a SubirReporte desde Mis Dispositivos
    const handleNavigateToSubirReporte = (event: CustomEvent) => {
      console.log('🔄 Navegando automáticamente a SubirReporte:', event.detail);
      setActiveSection('subirReporte');
    };

    window.addEventListener('navigateToSubirReporte', handleNavigateToSubirReporte as EventListener);

    // Limpieza de eventos y temporizadores al desmontar
    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyNavigation);
      window.removeEventListener('resize', checkMobile);
      window.removeEventListener('navigateToSubirReporte', handleNavigateToSubirReporte as EventListener);
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
      // Limpiar intervalo de barra de progreso si existe
      if (progressIntervalId) {
        clearInterval(progressIntervalId);
      }
    };
  }, [role]);

  return (
    <div className="dashboard-container">
      {/* Nota: Actualmente todos los roles usan el dashboard completo con sidebar */}
      {false ? (
        <div className="simplified-content">
          <div className="simplified-header">
            <img
              src={logoRwnet}
              alt="RWNET Logo"
              className="simplified-logo"
            />
            <div className="simplified-user-info">
              <span>Bienvenido, {nombreUsuario}</span>
              <button className="simplified-logout-btn" onClick={handleLogout}>
                <i className="bi bi-box-arrow-right"></i> Cerrar sesión
              </button>
            </div>
          </div>
          <div className="simplified-main">
            <SubirReporteSection
              dispositivos={dispositivosSubidos}
              isLoading={isLoading}
              isPreviewExpanded={isSubirReporteExpanded}
              onDeviceAdded={handleDeviceAdded}
              onLoadingStart={handleSubirReporteLoadingStart}
              onLoadingEnd={handleSubirReporteLoadingEnd}
              onPreviewExpanded={setIsSubirReporteExpanded}
            />
          </div>
        </div>
      ) : (
        <>
          {/* Fondo semitransparente para móvil */}
          {isSidebarExpanded && isMobile && (
            <div className="sidebar-backdrop" onClick={closeSidebar}></div>
          )}

          {/* Sidebar */}
          <div
            ref={sidebarRef}
            className={`sidebar ${isSidebarExpanded ? 'expanded' : ''}`}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            {/* Logo */}
            <div className="sidebar-logo-container">
              <img
                src={logoRwnet}
                alt="RWNET Logo"
                className="logo"
                onClick={handleLogoClick}
              />
            </div>

            {/* Menu Navigation */}
            <div className="sidebar-menu">
              {availableMenuItems.map((item) => (
                <a
                  key={item.section}
                  href="#"
                  className={`sidebar-link ${activeSection === item.section ? 'active' : ''}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setActiveSectionHandler(item.section);
                  }}
                >
                  <i className={`bi bi-${item.icon} me-2`}></i>
                  <span className="sidebar-link-text">{item.text}</span>
                </a>
              ))}
            </div>

            {/* User Footer */}
            <div className="sidebar-footer">
              <button
                className="sidebar-footer-btn"
                aria-expanded={isUserDropdownOpen}
                onClick={toggleUserDropdown}
              >
                <div className="user-avatar">
                  <span>{getUserInitials(nombreUsuario)}</span>
                </div>
                <span className="user-name">{nombreUsuario}</span>
                <i className={`bi bi-chevron-down arrow ${isUserDropdownOpen ? 'rotated' : ''}`}></i>
              </button>

              {/* User Dropdown */}
              <div className={`sidebar-footer-dropdown ${isUserDropdownOpen ? 'show' : ''}`}>
                <div className="d-flex align-items-center mb-2">
                  <div className="user-avatar me-2">
                    <span>{getUserInitials(nombreUsuario)}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="user-name">{nombreUsuario}</div>
                    <div className="user-email">{userEmail}</div>
                  </div>
                </div>
                <div className="dropdown-divider"></div>
                <div className="dropdown-item" onClick={goToConfig}>
                  <i className="bi bi-gear me-2"></i>Configuración
                </div>
                <div className="dropdown-item" onClick={handleLogout}>
                  <i className="bi bi-box-arrow-right me-2"></i>Cerrar sesión
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className={`content ${isSidebarExpanded ? 'expanded' : ''}`}>
            <div className={`section-content ${sectionTransition}`}>
              {renderContent()}
            </div>
          </div>

          {/* Botón hamburguesa para móvil */}
          {isMobile && !isSidebarExpanded && (
            <button className="mobile-menu-btn" onClick={openSidebar}>
              <i className="bi bi-list"></i>
            </button>
          )}
        </>
      )}
    </div>
  );
};

export default Dashboard;
