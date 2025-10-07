// Componente memoizado para la sección de inicio del Dashboard
import React, { memo } from 'react';
import SearchReportForm from '../SearchForm/SearchReportForm';
import PreviewDoc from '../Previewdoc/PreviewDoc';
import { getToken } from '../../auth/authService';
import logoAltaR from '../../assets/logo_alta_r.svg';





// Interface para datos de reporte
interface ReporteData {
    nombre: string;
    url: string;
}

// Props del componente
interface InicioSectionProps {
    dispositivos: any[]; // Usamos any[] para compatibilidad con Dashboard
    reporte: ReporteData;
    isLoading: boolean;
    isPreviewExpanded: boolean;
    isReportDownloaded: boolean;
    hasSearched: boolean; // Nueva prop para controlar visibilidad de contadores
    onSearch: (devices: any[]) => void; // Cambiado a any[]
    onReporteGenerado: (nombre: string, url: string) => void;
    onLoadingStart: () => void;
    onLoadingEnd: () => void;
    onProgressUpdate: (progress: number, message: string, timeRemaining?: number) => void;
    onPreviewExpanded: (expanded: boolean) => void;
    onReportDownloaded: (downloaded: boolean) => void;
    showMejorasModal: boolean;
    onShowMejorasModal: () => void;
    onCloseMejorasModal: () => void;
}

/**
 * Componente memoizado para la sección de inicio
 * Previene re-renders innecesarios cuando se navega entre secciones
 */
const InicioSection: React.FC<InicioSectionProps> = ({
    dispositivos,
    reporte,
    isLoading,
    isPreviewExpanded,
    isReportDownloaded,
    hasSearched,
    onSearch,
    onReporteGenerado,
    onLoadingStart,
    onLoadingEnd,
    onProgressUpdate,
    onPreviewExpanded,
    onReportDownloaded,
    showMejorasModal,
    onShowMejorasModal,
    onCloseMejorasModal,
}) => {
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
                            <h3>Buscar Mantenimientos</h3>
                        </div>
                        <p className="section-description-compact">
                            Filtra y genera reportes de mantenimientos por póliza, especialidad y período
                        </p>
                    </div>

                    <div className="search-form-header">
                        <SearchReportForm
                            onSearch={onSearch}
                            onReporteGenerado={onReporteGenerado}
                            hasResults={dispositivos.length > 0}
                            onLoadingStart={onLoadingStart}
                            onLoadingEnd={onLoadingEnd}
                            onProgressUpdate={onProgressUpdate}
                            onShowMejorasModal={onShowMejorasModal}
                        />
                    </div>
                </div>

                {/* Estadísticas a la derecha */}
                <div className="stats-header-section">
                    {/* Contenedor de estadísticas que muestra solo resultados */}
                    {hasSearched && !isLoading && dispositivos.length > 0 && (
                        <div className="stats-bar-compact">
                            {/* Contadores de estadísticas con animación de entrada */}
                            <div className="stats-content-transition">
                                <div className="stat-item-compact">
                                    <div className="stat-icon-compact primary">
                                        <i className="bi bi-clipboard-data"></i>
                                    </div>
                                    <div className="stat-info-compact">
                                        <span className="stat-label-compact">MANTENIMIENTOS</span>
                                        <span className="stat-value-compact">{dispositivos.length}</span>
                                    </div>
                                </div>

                                {reporte.nombre && (
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
                                                            // Descarga segura con autorización JWT
                                                            const response = await fetch(reporte.url, {
                                                                method: 'GET',
                                                                headers: {
                                                                    'Authorization': `Bearer ${getToken()}`,
                                                                }
                                                            });

                                                            if (!response.ok) {
                                                                throw new Error(`Error: ${response.status}`);
                                                            }

                                                            // Procesamiento del archivo descargado
                                                            const blob = await response.blob();
                                                            const downloadUrl = window.URL.createObjectURL(blob);

                                                            // Creación y ejecución de descarga automática
                                                            const link = document.createElement('a');
                                                            link.href = downloadUrl;
                                                            link.download = reporte.nombre;
                                                            document.body.appendChild(link);
                                                            link.click();
                                                            document.body.removeChild(link);

                                                            // Limpieza de recursos temporales
                                                            window.URL.revokeObjectURL(downloadUrl);

                                                            // Actualización de estado de descarga
                                                            onReportDownloaded(true);
                                                            // Archivo descargado exitosamente

                                                        } catch (error) {
                                                            console.error('Error al descargar el archivo:', error);
                                                        }
                                                    }}
                                                >
                                                    {isReportDownloaded ? (
                                                        <>
                                                            <i className="bi bi-check-circle-fill me-2"></i>
                                                            <span>Descargado</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <i className="bi bi-file-earmark-word me-2"></i>
                                                            <span>Descargar</span>
                                                        </>
                                                    )}
                                                </button>
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Sección de reporte/carga con el mismo diseño que Vista Previa */}
            <div className={`preview-full-section ${isPreviewExpanded ? 'expanded' : ''}`}>
                {/* Header que muestra estado de carga o vista previa */}
                <div className="section-header-full">
                    <div className="section-title-full">
                        {isLoading ? (
                            <>
                                <i className="bi bi-arrow-repeat loading-spin"></i>
                                <h3>Generando Reporte</h3>
                            </>
                        ) : (
                            <>
                                <i className="bi bi-eye-fill"></i>
                                <h3>Vista Previa</h3>
                            </>
                        )}
                    </div>

                    {/* Botón de expandir/contraer - solo visible cuando hay resultados */}
                    {dispositivos.length > 0 && !isLoading && (
                        <button
                            className="expand-preview-btn"
                            onClick={() => onPreviewExpanded(!isPreviewExpanded)}
                            title={isPreviewExpanded ? 'Contraer vista previa' : 'Expandir vista previa'}
                        >
                            <i className={`bi ${isPreviewExpanded ? 'bi-fullscreen-exit' : 'bi-arrows-fullscreen'}`}></i>
                        </button>
                    )}
                </div>

                {/* Contenedor principal que muestra loading o resultados */}
                <div className="preview-container-full">
                    {isLoading ? (
                        <div className="loading-message-simple">
                            <div className="loading-spinner-simple">
                                <i className="bi bi-arrow-repeat"></i>
                            </div>
                            <div className="loading-text-simple">
                                <span>Procesando datos...</span>
                                <small>Este proceso puede tomar unos momentos</small>
                            </div>
                        </div>
                    ) : (
                        <PreviewDoc
                            dispositivos={dispositivos}
                            isLoading={isLoading}
                        />
                    )}
                </div>
            </div>

            {/* Modal de resultados - COMENTADO TEMPORALMENTE */}
            {/*
            {showModal && (
                <div className="modal-overlay-dashboard">
                    <div className="modal-content-dashboard">
                        <div className="modal-header-dashboard">
                            <h4>
                                <i className="bi bi-person-workspace"></i>
                                Desempeño por Colaborador
                            </h4>
                            <button
                                className="modal-close-dashboard"
                                onClick={onCloseModal}
                            >
                                <i className="bi bi-x-lg"></i>
                            </button>
                        </div>
                        <div className="modal-body-dashboard">
                            <div className="colaborador-stats-table">
                                <div className="stats-table-header">
                                    <div className="stats-header-cell colaborador-col">Colaborador</div>
                                    <div className="stats-header-cell reportes-col">Dispositivos</div>
                                    <div className="stats-header-cell porcentaje-col">Porcentaje</div>
                                </div>
                                <div className={`stats-table-body ${resultadosData.colaboradores && resultadosData.colaboradores.length > 2 ? 'with-scroll' : ''}`}>
                                    {resultadosData.colaboradores && resultadosData.colaboradores.map((colaborador: any, index: number) => (
                                        <div key={index} className="stats-table-row">
                                            <div className="stats-cell colaborador-info">
                                                <div className="colaborador-avatar">
                                                    {colaborador.iniciales || colaborador.nombre?.substring(0, 2).toUpperCase()}
                                                </div>
                                                <span className="colaborador-nombre">{colaborador.nombre}</span>
                                            </div>
                                            <div className="stats-cell reportes-count">{colaborador.dispositivos}</div>
                                            <div className="stats-cell porcentaje-value">{colaborador.porcentaje}</div>
                                        </div>
                                    ))}
                                </div>
                                {(!resultadosData.colaboradores || resultadosData.colaboradores.length === 0) && (
                                    <div className="stats-table-row">
                                        <div className="stats-cell colaborador-info">
                                            <div className="colaborador-avatar">
                                                JP
                                            </div>
                                            <span className="colaborador-nombre">Juan Pérez</span>
                                        </div>
                                        <div className="stats-cell reportes-count">5</div>
                                        <div className="stats-cell porcentaje-value">100 %</div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="modal-footer-dashboard">
                            <button
                                className="btn-secondary-dashboard"
                                onClick={onCloseModal}
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}
            */}

            {/* Modal de mejoras con diseño actualizado */}
            {showMejorasModal && (
                <div className="modal-overlay-coordinadores">
                    <div className="modal-content-coordinadores">
                        <button className="modal-close" onClick={onCloseMejorasModal}>
                            ×
                        </button>

                        <div className="modal-header-coordinador-black">
                            <img src={logoAltaR} alt="Logo Rowan" className="logo-header" />
                        </div>

                        <div className="modal-user-info">
                            <div className="mejoras-info">
                                <i className="bi bi-info-circle" style={{ fontSize: '2rem', color: '#4927F5', marginBottom: '10px' }}></i>
                                <p className="mejoras-message-single">
                                    Estamos trabajando para mejorar esta sección.
                                </p>
                                <p className="mejoras-message-sub">
                                    Gracias por su paciencia.
                                </p>
                            </div>
                        </div>

                        <div className="modal-buttons">
                            <button
                                className="modal-btn modal-btn-confirmar-poliza"
                                onClick={onCloseMejorasModal}
                            >
                                <i className="bi bi-check-circle"></i>
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

/**
 * Función de comparación personalizada para React.memo
 * Optimiza el rendimiento evitando re-renders innecesarios del componente
 * Compara props de manera inteligente para determinar si el componente debe actualizarse
 * @param prevProps - Props anteriores del componente
 * @param nextProps - Nuevas props del componente
 * @returns true si las props son iguales (no re-render), false si son diferentes (re-render)
 */
const arePropsEqual = (prevProps: InicioSectionProps, nextProps: InicioSectionProps) => {
    // Comparar propiedades primitivas que afectan la UI directamente
    if (
        prevProps.isLoading !== nextProps.isLoading ||
        prevProps.isPreviewExpanded !== nextProps.isPreviewExpanded ||
        prevProps.isReportDownloaded !== nextProps.isReportDownloaded ||
        prevProps.showMejorasModal !== nextProps.showMejorasModal
    ) {
        return false;
    }

    // Comparar objetos de reporte
    if (
        prevProps.reporte.nombre !== nextProps.reporte.nombre ||
        prevProps.reporte.url !== nextProps.reporte.url
    ) {
        return false;
    }

    // Comparar dispositivos - solo longitud para evitar deep comparison costosa
    if (prevProps.dispositivos.length !== nextProps.dispositivos.length) {
        return false;
    }

    // Si hay dispositivos, comparar solo los IDs para evitar comparación profunda costosa
    if (prevProps.dispositivos.length > 0) {
        for (let i = 0; i < prevProps.dispositivos.length; i++) {
            if (prevProps.dispositivos[i]._id !== nextProps.dispositivos[i]._id) {
                return false;
            }
        }
    }

    // Si llegamos aquí, todas las props relevantes son iguales - no necesita re-render
    return true;
};

// Nombre para debugging
InicioSection.displayName = 'InicioSection';

export default memo(InicioSection, arePropsEqual);