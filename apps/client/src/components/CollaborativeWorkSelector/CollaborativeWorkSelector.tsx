import React, { useState, useEffect } from 'react';
import { useEncargadosData, Encargado } from '../../hooks/Colaborador/useColaborador';
import './CollaborativeWorkSelector.css';

interface CollaborativeWorkSelectorProps {
    isVisible: boolean;
    currentColaboradorId: string;
    onSelectionChange: (isCollaborative: boolean, colaboradores: string[], participacion: any[]) => void;
    onClose: () => void;
}

const CollaborativeWorkSelector: React.FC<CollaborativeWorkSelectorProps> = ({
    isVisible,
    currentColaboradorId,
    onSelectionChange,
    onClose
}) => {
    const { encargados, fetchEncargados } = useEncargadosData();
    const [colaboradores, setColaboradores] = useState<Encargado[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedColaboradores, setSelectedColaboradores] = useState<string[]>([]);
    const [isCollaborative, setIsCollaborative] = useState(false);

    useEffect(() => {
        if (isVisible) {
            const loadColaboradores = async () => {
                try {
                    setLoading(true);
                    console.log('🤝 Cargando colaboradores para trabajo colaborativo...');
                    await fetchEncargados(); // Usar endpoint básico
                } catch (error) {
                    console.error('Error cargando colaboradores:', error);
                    setLoading(false);
                }
            };
            loadColaboradores();
        }
    }, [isVisible]);

    useEffect(() => {
        // Filtrar al colaborador actual cuando cambien los encargados
        const otrosColaboradores = encargados.filter((col) => col._id !== currentColaboradorId);
        setColaboradores(otrosColaboradores);
        setLoading(false);
    }, [encargados, currentColaboradorId]);

    const handleColaboradorToggle = (colaboradorId: string) => {
        setSelectedColaboradores(prev => {
            if (prev.includes(colaboradorId)) {
                // Remover colaborador
                return prev.filter(id => id !== colaboradorId);
            } else {
                // Agregar colaborador
                return [...prev, colaboradorId];
            }
        });
    };

    const handleToggleCollaborative = () => {
        const newIsCollaborative = !isCollaborative;
        setIsCollaborative(newIsCollaborative);

        if (!newIsCollaborative) {
            // Si se desactiva el trabajo colaborativo, limpiar selecciones
            setSelectedColaboradores([]);
        }
    };

    const handleConfirm = () => {
        if (isCollaborative && selectedColaboradores.length === 0) {
            alert('Debe seleccionar al menos un colaborador para trabajo colaborativo');
            return;
        }

        // Preparar datos de participación
        const participacion = [
            // El colaborador actual siempre es el principal
            {
                colaborador: currentColaboradorId,
                rol: 'principal',
                descripcion: 'Responsable principal del reporte'
            },
            // Los colaboradores seleccionados
            ...selectedColaboradores.map(colId => ({
                colaborador: colId,
                rol: 'colaborador',
                descripcion: 'Colaboró en el trabajo'
            }))
        ];

        onSelectionChange(
            isCollaborative,
            isCollaborative ? [currentColaboradorId, ...selectedColaboradores] : [],
            isCollaborative ? participacion : []
        );
        onClose();
    };

    const handleCancel = () => {
        // Resetear estado
        setIsCollaborative(false);
        setSelectedColaboradores([]);
        onSelectionChange(false, [], []);
        onClose();
    };

    if (!isVisible) return null;

    return (
        <div className="collaborative-work-overlay">
            <div className="collaborative-work-modal">
                <div className="modal-header">
                    <h3>Configurar Trabajo Colaborativo</h3>
                    <button className="close-btn" onClick={handleCancel}>×</button>
                </div>

                <div className="modal-content">
                    <div className="collaborative-toggle">
                        <label className="toggle-label">
                            <input
                                type="checkbox"
                                checked={isCollaborative}
                                onChange={handleToggleCollaborative}
                            />
                            <span className="toggle-text">
                                {isCollaborative ? <><i className="bi bi-people-fill"></i> Trabajo Colaborativo Activado</> : <><i className="bi bi-people"></i> Trabajo Colaborativo</>}
                            </span>
                        </label>
                    </div>

                    {isCollaborative && (
                        <div className="collaborators-section">
                            <h4>Seleccionar Colaboradores</h4>

                            {loading ? (
                                <div className="loading">Cargando colaboradores...</div>
                            ) : (
                                <div className="collaborators-list">
                                    {colaboradores.map(colaborador => (
                                        <div key={colaborador._id} className="collaborator-item">
                                            <div className="collaborator-header">
                                                <label className="collaborator-checkbox">
                                                    <input
                                                        type="checkbox"
                                                        checked={selectedColaboradores.includes(colaborador._id)}
                                                        onChange={() => handleColaboradorToggle(colaborador._id)}
                                                    />
                                                    <span className="collaborator-name">
                                                        {colaborador.nombre} {colaborador.apellido_paterno}
                                                    </span>
                                                    <span className="collaborator-email">
                                                        ({colaborador.correo})
                                                    </span>
                                                </label>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn-cancel" onClick={handleCancel}>
                        Cancelar
                    </button>
                    <button className="btn-confirm" onClick={handleConfirm}>
                        {isCollaborative ? 'Configurar Trabajo Colaborativo' : 'Continuar Individual'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CollaborativeWorkSelector;