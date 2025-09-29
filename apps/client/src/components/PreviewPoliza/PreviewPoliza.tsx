import React, { useState, useRef, useEffect } from "react";
import "./PreviewPoliza.css";
import { CiEdit, CiTrash } from "react-icons/ci";

interface Poliza {
    _id: string;
    nombre: string;
    ubicacion: string;
    coordinador?: string | Coordinador;
    resaltado?: boolean;
}

interface Coordinador {
    _id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno?: string;
}

interface PreviewPolizaProps {
    polizas: Poliza[];
    coordinadores: Coordinador[];
    onEditar: (poliza: Poliza) => void;
    onEliminar: (id: string) => void;
    isLoading: boolean;
}

const PreviewPoliza: React.FC<PreviewPolizaProps> = ({
    polizas,
    coordinadores,
    onEditar,
    onEliminar,
    isLoading
}) => {
    // Estado para manejar qué card está expandida
    const [cardExpandida, setCardExpandida] = useState<string | null>(null);

    // Ref para el contenedor con scroll 
    const wrapperRef = useRef<HTMLDivElement>(null);

    // Ref para mantener la posición de scroll bloqueada
    const lockedScrollPosition = useRef<number | null>(null);

    // Ref para saber si estamos en medio de una transición
    const isTransitioning = useRef<boolean>(false);

    // useEffect para escuchar eventos de cierre de cards expandidas
    useEffect(() => {
        const handleCloseExpandedCard = () => {
            setCardExpandida(null);
            lockedScrollPosition.current = null;
        };

        window.addEventListener('closeExpandedCard', handleCloseExpandedCard);

        return () => {
            window.removeEventListener('closeExpandedCard', handleCloseExpandedCard);
        };
    }, []);

    // Función para toggle de expansión de cards con scroll bloqueado
    const toggleExpansion = (cardId: string) => {
        const wrapper = wrapperRef.current;
        if (!wrapper) return;

        // Marcar que estamos en transición
        isTransitioning.current = true;

        // SIEMPRE guardar la posición actual del scroll antes de cualquier cambio
        const currentScrollTop = wrapper.scrollTop;
        lockedScrollPosition.current = currentScrollTop;

        const wasExpanded = cardExpandida === cardId;
        const newExpandedCard = wasExpanded ? null : cardId;
        setCardExpandida(newExpandedCard);

        // Función para restaurar el scroll
        const forceScrollPosition = () => {
            if (wrapper && lockedScrollPosition.current !== null) {
                wrapper.scrollTop = lockedScrollPosition.current;
            }
        };

        // Solo restaurar durante la transición inicial
        setTimeout(() => {
            forceScrollPosition();

            // Finalizar transición después de que termine la animación
            setTimeout(() => {
                isTransitioning.current = false;

                // Solo liberar el scroll si cerramos completamente todas las cards
                if (wasExpanded && newExpandedCard === null) {
                    lockedScrollPosition.current = null;
                }
            }, 500); // Duración de la animación CSS
        }, 50);
    };

    // Función para resetear el scroll bloqueado cuando el usuario hace scroll manual
    const handleManualScroll = () => {
        // Solo permitir scroll libre cuando no hay transiciones activas
        if (!isTransitioning.current && cardExpandida === null) {
            lockedScrollPosition.current = null;
        }

        // Durante transiciones, permitir que el usuario ajuste manualmente
        if (!isTransitioning.current && lockedScrollPosition.current !== null) {
            // Actualizar la posición bloqueada con el scroll manual del usuario
            const wrapper = wrapperRef.current;
            if (wrapper) {
                lockedScrollPosition.current = wrapper.scrollTop;
            }
        }
    };
    // Función para obtener nombre del coordinador con manejo de diferentes formatos
    const getCoordinadorNombre = (polizaCoordinador: any) => {
        if (typeof polizaCoordinador === "object" && polizaCoordinador !== null) {
            // Objeto coordinador único
            const nombre = polizaCoordinador.nombre || "";
            const apPaterno = polizaCoordinador.apellido_paterno || "";
            const apMaterno = polizaCoordinador.apellido_materno || "";
            return `${nombre} ${apPaterno} ${apMaterno}`.trim();
        } else if (typeof polizaCoordinador === "string") {
            // ID de coordinador como string
            const coord = coordinadores.find(c => c._id === polizaCoordinador);
            return coord ? `${coord.nombre} ${coord.apellido_paterno} ${coord.apellido_materno || ""}`.trim() : "Sin asignar";
        }
        return "Sin asignar";
    };

    // Verificar si hay pólizas disponibles
    const hasPolizas = polizas && polizas.length > 0;

    return (
        <div className="preview-poliza">
            {/* Contenedor principal con scroll optimizado - reemplaza tabla HTML */}
            <div
                className="preview-poliza__wrapper"
                ref={wrapperRef}
                onScroll={handleManualScroll}
            >
                {hasPolizas ? (
                    // Grid de cards - nueva arquitectura visual
                    <div className="preview-poliza__cards-grid">
                        {polizas.map((item) => {
                            return (
                                <div
                                    key={item._id}
                                    className={`preview-poliza__card ${item.resaltado ? 'resaltado' : ''} ${cardExpandida === item._id ? 'expandida' : ''}`}
                                >
                                    {/* Header de la card con icono representativo - diseño negro uniforme */}
                                    <div className="preview-poliza__card-header">
                                        <div className="preview-poliza__card-title-section">
                                            {/* Icono global para todas las pólizas - representando protección */}
                                            <i className="bi bi-shield-check preview-poliza__card-icon"></i>
                                            <h4 className="preview-poliza__card-title">{item.nombre}</h4>
                                        </div>
                                        {/* Botones de acción - expandir, editar y eliminar */}
                                        <div className="preview-poliza__card-actions">
                                            <button
                                                className="btn-expandir-card"
                                                onClick={() => toggleExpansion(item._id)}
                                                title={cardExpandida === item._id ? "Contraer" : "Ver más"}
                                            >
                                                <i className={`bi ${cardExpandida === item._id ? 'bi-chevron-up' : 'bi-chevron-down'}`}></i>
                                            </button>
                                            <button
                                                className="btn-editar-card"
                                                onClick={() => onEditar(item)}
                                                title="Editar póliza"
                                            >
                                                <CiEdit size={16} />
                                            </button>
                                            <button
                                                className="btn-eliminar-card"
                                                onClick={() => onEliminar(item._id)}
                                                title="Eliminar póliza"
                                            >
                                                <CiTrash size={16} />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Contenido de la card con información de la póliza - retráctil */}
                                    <div className={`preview-poliza__card-content ${cardExpandida === item._id ? 'expandido' : ''}`}>
                                        {/* Sección de ubicación - siempre visible cuando está expandida */}
                                        <div className="preview-poliza__ubicacion-section">
                                            <div className="preview-poliza__ubicacion">
                                                <i className="bi bi-geo-alt"></i>
                                                <span>{item.ubicacion}</span>
                                            </div>
                                        </div>

                                        {/* Sección de coordinador */}
                                        <div className="preview-poliza__section">
                                            <div className="preview-poliza__section-header">
                                                <i className="bi bi-person-badge"></i>
                                                <span>Coordinador</span>
                                            </div>
                                            <div className="preview-poliza__section-content">
                                                <div className="preview-poliza__coordinador">
                                                    {getCoordinadorNombre(item.coordinador)}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    // Estado vacío con mensaje informativo
                    <div className="preview-poliza__empty-state">
                        <i className="bi bi-shield-exclamation loading-spin"></i>
                        <p>{isLoading ? "Cargando pólizas..." : "No hay pólizas disponibles"}</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PreviewPoliza;