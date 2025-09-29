// Componente de vista previa para dispositivos subidos en SubirReporte
import React from 'react';

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
    createdAt?: string;
}

interface PreviewSubirReporteProps {
    dispositivos: DispositivoSubido[];
    isLoading: boolean;
}

const PreviewSubirReporte: React.FC<PreviewSubirReporteProps> = ({
    dispositivos,
    isLoading
}) => {
    if (isLoading) {
        return (
            <div className="preview-loading">
                <div className="loading-spinner">
                    <i className="bi bi-arrow-repeat spin"></i>
                </div>
                <p>Subiendo dispositivo...</p>
            </div>
        );
    }

    if (dispositivos.length === 0) {
        return (
            <div className="preview-empty">
                <div className="empty-icon">
                    <i className="bi bi-upload"></i>
                </div>
                <h4>No hay dispositivos subidos</h4>
                <p>Los dispositivos que subas aparecerán aquí para su revisión</p>
            </div>
        );
    }

    return (
        <div className="preview-devices-list">
            <div className="preview-header">
                <h5>
                    <i className="bi bi-list-ul me-2"></i>
                    Dispositivos Subidos ({dispositivos.length})
                </h5>
            </div>

            <div className="devices-grid">
                {dispositivos.map((dispositivo, index) => (
                    <div key={dispositivo._id || index} className="device-card">
                        <div className="device-card-header">
                            <div className="device-type">
                                <i className="bi bi-hdd me-2"></i>
                                <span>{dispositivo.type}</span>
                            </div>
                            <div className="device-status success">
                                <i className="bi bi-check-circle-fill"></i>
                            </div>
                        </div>

                        <div className="device-card-body">
                            <div className="device-info">
                                <div className="info-row">
                                    <span className="label">Identificador:</span>
                                    <span className="value">{dispositivo.identifier}</span>
                                </div>
                                <div className="info-row">
                                    <span className="label">Ubicación:</span>
                                    <span className="value">{dispositivo.ubication}</span>
                                </div>
                                {dispositivo.building && (
                                    <div className="info-row">
                                        <span className="label">Edificio:</span>
                                        <span className="value">{dispositivo.building}</span>
                                    </div>
                                )}
                                {dispositivo.level && (
                                    <div className="info-row">
                                        <span className="label">Nivel:</span>
                                        <span className="value">{dispositivo.level}</span>
                                    </div>
                                )}
                                {dispositivo.especialidad && (
                                    <div className="info-row">
                                        <span className="label">Especialidad:</span>
                                        <span className="value">{dispositivo.especialidad.nombre || dispositivo.especialidad}</span>
                                    </div>
                                )}
                            </div>

                            {dispositivo.images && dispositivo.images.length > 0 && (
                                <div className="device-images">
                                    <div className="images-header">
                                        <i className="bi bi-images me-2"></i>
                                        <span>Evidencias ({dispositivo.images.length})</span>
                                    </div>
                                    <div className="images-grid">
                                        {dispositivo.images.map((image, imgIndex) => (
                                            <div key={imgIndex} className="image-thumb">
                                                <img
                                                    src={image.url || image}
                                                    alt={`Evidencia ${imgIndex + 1}`}
                                                    className="thumb-img"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {dispositivo.note && (
                                <div className="device-note">
                                    <i className="bi bi-sticky me-2"></i>
                                    <span>{dispositivo.note}</span>
                                </div>
                            )}
                        </div>

                        <div className="device-card-footer">
                            <small className="text-muted">
                                <i className="bi bi-clock me-1"></i>
                                {dispositivo.createdAt ?
                                    new Date(dispositivo.createdAt).toLocaleString() :
                                    'Recién subido'
                                }
                            </small>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default PreviewSubirReporte;