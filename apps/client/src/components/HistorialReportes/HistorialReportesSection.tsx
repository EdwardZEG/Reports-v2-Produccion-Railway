// Componente memoizado para la sección de historial del colaborador - RÉPLICA EXACTA de InicioSection
import React, { memo, useState } from 'react';
import SearchColaboradorForm from '../SearchColaboradorForm/SearchColaboradorForm';
import PreviewDoc from '../Previewdoc/PreviewDoc';

/**
 * Componente memoizado para la sección de historial del colaborador
 * RÉPLICA EXACTA de InicioSection adaptada para colaboradores con estados internos
 */
const HistorialReportesSection: React.FC = () => {
    // Estados internos del componente - IGUALES a InicioSection
    const [dispositivos, setDispositivos] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [showModal, setShowModal] = useState<boolean>(false);
    const [isPreviewExpanded, setIsPreviewExpanded] = useState<boolean>(false);

    // Handlers internos del componente
    const handleSearch = (devices: any[]) => {
        setDispositivos(devices);
    };

    const handleReporteGenerado = (nombre: string, url: string) => {
        // No generamos reportes para colaboradores, pero mantenemos la estructura
        console.log('Reporte generado:', nombre, url);
    };

    const handleShowModal = () => {
        setShowModal(true);
    };

    const handleLoadingStart = () => {
        setIsLoading(true);
    };

    const handleLoadingEnd = () => {
        setIsLoading(false);
    };

    const handleProgressUpdate = (progress: number, message: string, timeRemaining?: number) => {
        // Mantener estructura para compatibilidad
        console.log('Progress:', progress, message, timeRemaining);
    };

    const handlePreviewExpanded = (expanded: boolean) => {
        setIsPreviewExpanded(expanded);
    };



    const handleCloseModal = () => {
        setShowModal(false);
    };
    // Usar directamente los dispositivos sin procesamiento costoso adicional
    // Las imágenes ya vienen procesadas desde el SearchForm
    return (
        <div className={`inicio-section ${isPreviewExpanded ? 'preview-expanded' : ''}`}>
            {/* Header combinado con formulario y estadísticas */}
            <div className={`inicio-header-combined ${isPreviewExpanded ? 'hidden-below' : ''}`}>
                {/* Formulario de búsqueda a la izquierda */}
                <div className="search-header-section">
                    <div className="section-header-compact">
                        <div className="section-title-compact">
                            <i className="bi bi-search"></i>
                            <h3>Buscar Reportes</h3>
                        </div>
                        <p className="section-description-compact">
                            Revisa y edita tus reportes por especialidad y período
                        </p>
                    </div>

                    <div className="search-form-header">
                        <SearchColaboradorForm
                            onSearch={handleSearch}
                            onReporteGenerado={handleReporteGenerado}
                            onShowModal={handleShowModal}
                            hasResults={dispositivos.length > 0}
                            onLoadingStart={handleLoadingStart}
                            onLoadingEnd={handleLoadingEnd}
                            onProgressUpdate={handleProgressUpdate}
                        />
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
                                <span className="stat-label-compact">DISPOSITIVOS</span>
                                <span className="stat-value-compact">{dispositivos.length}</span>
                            </div>
                        </div>

                        <div className="stat-item-compact">
                            <div className="stat-icon-compact secondary">
                                <i className="bi bi-pencil-square"></i>
                            </div>
                            <div className="stat-info-compact">
                                <span className="stat-label-compact">EDITABLES</span>
                                <span className="stat-value-compact">{dispositivos.length}</span>
                            </div>
                        </div>

                        {isLoading && (
                            <div className="stat-item-compact generating">
                                <div className="stat-icon-compact loading">
                                    <i className="bi bi-arrow-repeat"></i>
                                </div>
                                <div className="stat-info-compact">
                                    <span className="stat-label-compact">BUSCANDO...</span>
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
                        <h3>Vista Previa</h3>
                    </div>

                    {/* Botón de expandir/contraer - solo visible cuando hay resultados */}
                    {dispositivos.length > 0 && (
                        <button
                            className="expand-preview-btn"
                            onClick={() => handlePreviewExpanded(!isPreviewExpanded)}
                            title={isPreviewExpanded ? 'Contraer vista previa' : 'Expandir vista previa'}
                        >
                            <i className={`bi ${isPreviewExpanded ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'}`}></i>
                        </button>
                    )}
                </div>
                {/* Contenedor principal con scroll optimizado y distribución de espacio mejorada */}
                <div className="preview-container-full">
                    <PreviewDoc
                        dispositivos={dispositivos}
                        isLoading={isLoading}
                    />
                </div>
            </div>

            {/* Modal de resultados */}
            {showModal && (
                <div className="modal-overlay-dashboard">
                    <div className="modal-content-dashboard">
                        <div className="modal-header-dashboard">
                            <h4>
                                <i className="bi bi-person-workspace"></i>
                                Información de Dispositivos
                            </h4>
                            <button
                                className="modal-close-dashboard"
                                onClick={handleCloseModal}
                            >
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                        <div className="modal-body-dashboard">
                            <div className="colaborador-stats-table">
                                <div className="stats-table-header">
                                    <div className="stats-header-cell colaborador-col">Dispositivo</div>
                                    <div className="stats-header-cell reportes-col">Ubicación</div>
                                    <div className="stats-header-cell porcentaje-col">Estado</div>
                                </div>
                                <div className={`stats-table-body ${dispositivos && dispositivos.length > 2 ? 'with-scroll' : ''}`}>
                                    {dispositivos && dispositivos.map((dispositivo: any, index: number) => (
                                        <div key={index} className="stats-table-row">
                                            <div className="stats-cell colaborador-info">
                                                <div className="colaborador-avatar">
                                                    {dispositivo.type?.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="colaborador-nombre">{dispositivo.identifier}</span>
                                            </div>
                                            <div className="stats-cell reportes-count">{dispositivo.ubication}</div>
                                            <div className="stats-cell porcentaje-value">Activo</div>
                                        </div>
                                    ))}
                                </div>
                                {(!dispositivos || dispositivos.length === 0) && (
                                    <div className="stats-table-row">
                                        <div className="stats-cell colaborador-info">
                                            <div className="colaborador-avatar">
                                                DV
                                            </div>
                                            <span className="colaborador-nombre">Sin dispositivos</span>
                                        </div>
                                        <div className="stats-cell reportes-count">-</div>
                                        <div className="stats-cell porcentaje-value">-</div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer-dashboard">
                            <button
                                className="btn-secondary-dashboard"
                                onClick={handleCloseModal}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Nombre para debugging
HistorialReportesSection.displayName = 'HistorialReportesSection';

export default memo(HistorialReportesSection);