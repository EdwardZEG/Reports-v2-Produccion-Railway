// Componente SubirReporte con el mismo estilo que la sección de inicio
import React, { memo } from 'react';
import SubirReporteForm from '../../components/FormUser/SubirReporteForm';
import './SubirReporteSection.css';

// Interface para datos de dispositivo subido
interface DispositivoSubido {
    _id?: string;
    type: string;
    ubication: string;
    identifier: string;
    building: string;
    level: string;
    note: string;
    images?: any[];
    colaborador?: any;
    especialidad?: any;
}

// Props del componente
interface SubirReporteSectionProps {
    dispositivos: DispositivoSubido[];
    isLoading: boolean;
    onDeviceAdded: (device: DispositivoSubido) => void;
    onLoadingStart: () => void;
    onLoadingEnd: () => void;
}

/**
 * Componente para la sección de subir reportes con el mismo layout que inicio
 */
const SubirReporteSection: React.FC<SubirReporteSectionProps> = ({
    dispositivos,
    isLoading,
    onDeviceAdded,
    onLoadingStart,
    onLoadingEnd,
}) => {
    return (
        <div className="inicio-section">
            {/* Header combinado con formulario y estadísticas */}
            <div className="inicio-header-combined">
                {/* Formulario de subir reporte a la izquierda */}
                <div className="search-header-section">
                    <div className="section-header-compact">
                        <div className="section-title-compact">
                            <i className="bi bi-upload"></i>
                            <h3>Subir Reporte</h3>
                        </div>
                        <p className="section-description-compact">
                            Completa la información del dispositivo y adjunta las evidencias necesarias
                        </p>
                    </div>

                    <div className="search-form-header">
                        <SubirReporteForm
                            onDeviceAdded={onDeviceAdded}
                            onLoadingStart={onLoadingStart}
                            onLoadingEnd={onLoadingEnd}
                        />
                    </div>
                </div>

                {/* Estadísticas a la derecha */}
                <div className="stats-header-section">
                    <div className="stats-bar-compact">
                        <div className="stat-item-compact">
                            <div className="stat-icon-compact primary">
                                <i className="bi bi-device-hdd"></i>
                            </div>
                            <div className="stat-info-compact">
                                <span className="stat-label-compact">DISPOSITIVOS</span>
                                <span className="stat-value-compact">{dispositivos.length}</span>
                            </div>
                        </div>

                        <div className="stat-item-compact">
                            <div className="stat-icon-compact secondary">
                                <i className="bi bi-images"></i>
                            </div>
                            <div className="stat-info-compact">
                                <span className="stat-label-compact">EVIDENCIAS</span>
                                <span className="stat-value-compact">
                                    {dispositivos.reduce((total, device) => total + (device.images?.length || 0), 0)}
                                </span>
                            </div>
                        </div>

                        {isLoading && (
                            <div className="stat-item-compact generating">
                                <div className="stat-icon-compact loading">
                                    <i className="bi bi-arrow-repeat"></i>
                                </div>
                                <div className="stat-info-compact">
                                    <span className="stat-label-compact">SUBIENDO...</span>
                                </div>
                            </div>
                        )}

                        {!isLoading && dispositivos.length > 0 && (
                            <div className="stat-item-compact generated">
                                <div className="stat-icon-compact success">
                                    <i className="bi bi-check-circle"></i>
                                </div>
                                <div className="stat-info-compact">
                                    <span className="stat-label-compact">COMPLETADO</span>
                                    <span className="stat-value-compact">
                                        <span className="success-text">
                                            <i className="bi bi-check-circle-fill me-2"></i>
                                            Listo
                                        </span>
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default memo(SubirReporteSection);