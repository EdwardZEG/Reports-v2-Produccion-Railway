// Componente para vista previa de especialidades con el estilo visual de PreviewDoc
import React from "react";
import { CiTrash, CiEdit } from "react-icons/ci";
// Eliminado: import generateStandardDescription - ahora usamos descripción de BD directamente
import "./PreviewEspecialidad.css";

// Interface para especialidades - mantiene compatibilidad con backend existente
interface Especialidad {
    _id: string;
    nombre: string;
    descripcion: string;
    poliza?: string[] | string | Poliza[] | Poliza; // Soporte para múltiples formatos de pólizas
    resaltado?: boolean;
    reporte?: string | Reporte;
}

interface Poliza {
    _id: string;
    nombre: string;
}

interface Reporte {
    _id: string;
}

// Props del componente - interfaz limpia y reutilizable
interface PreviewEspecialidadProps {
    especialidades: Especialidad[];
    polizas: Poliza[];
    onEditar: (esp: Especialidad) => void;
    onEliminar: (id: string) => void;
    isLoading?: boolean;
    isCoordinador?: boolean; // Nueva prop para identificar si es coordinador
}

const PreviewEspecialidad: React.FC<PreviewEspecialidadProps> = ({
    especialidades,
    polizas,
    onEditar,
    onEliminar,
    isLoading = false,
    isCoordinador = false // Default a false si no se proporciona
}) => {
    // Verificar si hay especialidades para mostrar - manejo de estados vacíos
    const hasEspecialidades = especialidades && especialidades.length > 0;

    // Función para obtener nombres de pólizas - maneja múltiples formatos de datos
    const getPolizasNombres = (especialidadPoliza: any) => {
        if (Array.isArray(especialidadPoliza)) {
            // Array de objetos o IDs - mapeo inteligente
            return especialidadPoliza.map((p: any) =>
                typeof p === "object" ? p.nombre : polizas.find(x => x._id === p)?.nombre
            ).join(", ");
        } else if (typeof especialidadPoliza === "object" && especialidadPoliza !== null) {
            // Objeto póliza directo
            return especialidadPoliza.nombre;
        } else if (typeof especialidadPoliza === "string") {
            // ID de póliza - buscar en array de pólizas
            return polizas.find(p => p._id === especialidadPoliza)?.nombre || "No asignada";
        }
        return "No asignada";
    };

    return (
        <div className="preview-especialidad">
            {/* Contenedor principal con scroll optimizado - reemplaza tabla HTML */}
            <div className="preview-especialidad__wrapper">
                {hasEspecialidades ? (
                    // Grid de cards - nueva arquitectura visual
                    <div className="preview-especialidad__cards-grid">
                        {especialidades.map((item) => {
                            return (
                                <div
                                    key={item._id}
                                    className={`preview-especialidad__card ${item.resaltado ? 'resaltado' : ''}`}
                                >
                                    {/* Header de la card con icono representativo - diseño negro uniforme */}
                                    <div className="preview-especialidad__card-header">
                                        <div className="preview-especialidad__card-title-section">
                                            {/* Icono global para todas las especialidades - representando tecnología */}
                                            <i className="bi bi-cpu preview-especialidad__card-icon"></i>
                                            <h4 className="preview-especialidad__card-title">{item.nombre}</h4>
                                        </div>
                                        {/* Botones de acción - editar y eliminar */}
                                        {/* Botones de acción - solo para administradores */}
                                        {!isCoordinador && (
                                            <div className="preview-especialidad__card-actions">
                                                <button
                                                    className="btn-editar-card"
                                                    onClick={() => onEditar(item)}
                                                    title="Editar especialidad"
                                                >
                                                    <CiEdit size={16} />
                                                </button>
                                                <button
                                                    className="btn-eliminar-card"
                                                    onClick={() => onEliminar(item._id)}
                                                    title="Eliminar especialidad"
                                                >
                                                    <CiTrash size={16} />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Contenido principal de la card - layout estructurado */}
                                    <div className="preview-especialidad__card-content">
                                        {/* Descripción directa de la base de datos */}
                                        <div className="preview-especialidad__description-section">
                                            <p className="preview-especialidad__descripcion">
                                                {/* Usa descripción directa de la base de datos */}
                                                {item.descripcion || 'Descripción no disponible'}
                                            </p>
                                        </div>

                                        {/* Sección de pólizas (siempre visible) - información contextual */}
                                        <div className="preview-especialidad__section">
                                            <div className="preview-especialidad__section-header">
                                                <i className="bi bi-file-text"></i>
                                                <span>Pólizas Asociadas</span>
                                            </div>
                                            <div className="preview-especialidad__section-content">
                                                <div className="preview-especialidad__polizas">
                                                    {getPolizasNombres(item.poliza)}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Sección de plantilla (siempre visible) - estado visual claro */}
                                        <div className="preview-especialidad__section">
                                            <div className="preview-especialidad__section-header">
                                                <i className="bi bi-file-earmark"></i>
                                                <span>Estado de Plantilla</span>
                                            </div>
                                            <div className="preview-especialidad__section-content">
                                                <div className="preview-especialidad__plantilla-status">
                                                    {/* Badge visual para estado de plantilla */}
                                                    {item.reporte ? (
                                                        <span className="preview-especialidad__status-badge activo">
                                                            <i className="bi bi-check-circle"></i>
                                                            Plantilla cargada
                                                        </span>
                                                    ) : (
                                                        <span className="preview-especialidad__status-badge inactivo">
                                                            <i className="bi bi-exclamation-circle"></i>
                                                            Sin plantilla
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // Estado vacío cuando no hay especialidades para mostrar - UX mejorada
                    <div className="preview-especialidad__empty-state">
                        <i className={isLoading ? "bi bi-arrow-clockwise loading-spin" : "bi bi-search"}></i>
                        <p>{isLoading ? "Cargando especialidades..." : "No hay especialidades registradas"}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PreviewEspecialidad;