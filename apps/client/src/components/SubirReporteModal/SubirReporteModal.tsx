// Modal de subir reporte tipo carrusel con 4 secciones
import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-toastify';
import { jwtDecode } from 'jwt-decode';
import CollaborativeWorkSelector from '../CollaborativeWorkSelector';
import { useEncargadosData } from '../../hooks/Colaborador/useColaborador';
import { getBaseApiUrl } from '../../utils/apiUrl';
import './SubirReporteModal.css';

interface DispositivoInfo {
    deviceId: string;
    deviceIdentifier: string;
    deviceType: string;
    deviceUbication: string;
    deviceBuilding: string;
    deviceLevel: string;
    deviceNote: string;
    periodoId: string;
    colaboradorId: string;
    isMultipleAssignment: boolean;
    collaborators: any[];
}

interface SubirReporteModalProps {
    isOpen: boolean;
    onClose: () => void;
    dispositivoInfo: DispositivoInfo | null;
    onSuccess: () => void;
}

const SubirReporteModal: React.FC<SubirReporteModalProps> = ({
    isOpen,
    onClose,
    dispositivoInfo,
    onSuccess
}) => {
    // Estados para el formulario
    const [pasoActual, setPasoActual] = useState(1);
    const [deviceData, setDeviceData] = useState({
        type: '',
        identifier: '',
        ubication: '',
        building: '',
        level: '',
        note: ''
    });
    const [especialidadSeleccionada, setEspecialidadSeleccionada] = useState('');
    const [especialidades, setEspecialidades] = useState<{ _id: string; nombre: string }[]>([]);

    // Estados para evidencias - carrusel de 3 cards
    const [evidenciaActual, setEvidenciaActual] = useState(0);
    const [evidencias, setEvidencias] = useState<(File | null)[]>([null, null, null]);
    const evidenciasTitulos = ['Foto del Área', 'Foto del Equipo', 'Foto del Trabajo'];
    const [isAnimating, setIsAnimating] = useState(false); // Estado para controlar animación

    // Estados para trabajo colaborativo
    const [isCollaborativeWork, setIsCollaborativeWork] = useState<boolean | null>(null);
    const [selectedColaboradores, setSelectedColaboradores] = useState<string[]>([]);
    const [tipoParticipacion, setTipoParticipacion] = useState<any[]>([]);
    const [showCollaborativeSelector, setShowCollaborativeSelector] = useState(false);
    const [showCollaboratorsList, setShowCollaboratorsList] = useState(false);

    // Estado para mostrar validaciones (solo después de intentar submit)
    const [showValidationErrors, setShowValidationErrors] = useState(false);

    // Estados para el proceso de subida
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitStatus, setSubmitStatus] = useState<'idle' | 'uploading' | 'completed' | 'error'>('idle');
    const [reportId, setReportId] = useState<string | null>(null);


    // Hook para cargar colaboradores
    const { encargados, fetchEncargados } = useEncargadosData();

    // Estado para datos del usuario
    const [currentUser, setCurrentUser] = useState<any>(null);

    // Cargar especialidades al montar el componente (solo una vez)
    useEffect(() => {
        loadEspecialidades();
    }, []);

    // Filtrar colaboradores por la póliza del usuario actual y excluir al propio usuario
    const colaboradoresFiltrados = currentUser?.poliza?._id
        ? encargados.filter(encargado =>
            encargado.poliza?._id === currentUser.poliza._id &&
            encargado._id !== currentUser._id
        )
        : encargados.filter(encargado => encargado._id !== currentUser?._id);

    // Cargar datos del usuario actual desde la API
    useEffect(() => {
        const loadCurrentUser = async () => {
            try {
                const token = localStorage.getItem('token');
                if (token) {
                    // Verificar si el token ha expirado
                    const { isTokenExpired } = await import('../../utils/tokenUtils');
                    if (isTokenExpired(token)) {
                        console.log('🔴 SubirReporteModal: Token expirado, no cargando usuario');
                        return;
                    }

                    const decodedToken: any = jwtDecode(token);
                    console.log('🔍 Token decodificado:', decodedToken);

                    // Usar userId del token
                    const userId = decodedToken.userId || decodedToken.colaboradorId;
                    if (!userId) {
                        console.error('❌ No se encontró userId ni colaboradorId en el token');
                        return;
                    }

                    const response = await fetch(`${getBaseApiUrl()}/colaboradores/${userId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                    if (response.ok) {
                        const userData = await response.json();
                        setCurrentUser(userData);
                    }
                }
            } catch (error) {
                // Suprimir logs si el token ha expirado
                const token = localStorage.getItem('token');
                if (token) {
                    const { isTokenExpired } = await import('../../utils/tokenUtils');
                    if (!isTokenExpired(token)) {
                        console.error('Error cargando datos del usuario:', error);
                    }
                }
            }
        };

        if (isOpen) {
            loadCurrentUser();
        }
    }, [isOpen]);

    // Cargar colaboradores cuando se selecciona trabajo colaborativo
    useEffect(() => {
        if (isCollaborativeWork) {
            fetchEncargados();
            setShowCollaboratorsList(true);
        } else {
            setShowCollaboratorsList(false);
            setSelectedColaboradores([]);
        }
    }, [isCollaborativeWork]);

    // Estados para cámara
    const [showCamera, setShowCamera] = useState(false);
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const TOTAL_PASOS = 4;

    // Cargar datos iniciales cuando se abre el modal
    useEffect(() => {
        if (isOpen && dispositivoInfo) {
            // Autocompletar con datos del dispositivo
            setDeviceData({
                type: dispositivoInfo.deviceType,
                identifier: dispositivoInfo.deviceIdentifier,
                ubication: dispositivoInfo.deviceUbication,
                building: dispositivoInfo.deviceBuilding,
                level: dispositivoInfo.deviceLevel,
                note: dispositivoInfo.deviceNote
            });

            // Si es asignación múltiple, configurar trabajo colaborativo
            if (dispositivoInfo.isMultipleAssignment && dispositivoInfo.collaborators.length > 0) {
                setIsCollaborativeWork(true);
                const otherCollaborators = dispositivoInfo.collaborators.filter(
                    col => col._id !== dispositivoInfo.colaboradorId
                );
                setSelectedColaboradores(otherCollaborators.map(col => col._id));
            }

            // Autocompletar especialidad inmediatamente
            if (currentUser?.especialidad && currentUser.especialidad.length > 0) {
                setEspecialidadSeleccionada(currentUser.especialidad[0]._id);
            }
        }
    }, [isOpen, dispositivoInfo, currentUser]);

    const loadEspecialidades = async () => {
        // Si ya tenemos especialidades cargadas, no volver a cargar
        if (especialidades.length > 0) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${getBaseApiUrl()}/especialidades`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setEspecialidades(data);
            }
        } catch (error) {
            console.error('Error cargando especialidades:', error);
        }
    };

    // Funciones de navegación
    const siguientePaso = () => {
        if (pasoActual < TOTAL_PASOS) {
            if (pasoActual === 1 && !validarPaso1()) return;
            setPasoActual(prev => prev + 1);
        }
    };

    const pasoAnterior = () => {
        if (pasoActual > 1) {
            setPasoActual(prev => prev - 1);
        }
    };

    const irAPaso = (paso: number) => {
        if (paso <= pasoActual || paso === pasoActual + 1) {
            setPasoActual(paso);
        }
    };

    // Validaciones
    const validarPaso1 = () => {
        if (!deviceData.type || !deviceData.identifier || !deviceData.ubication ||
            !deviceData.building || !deviceData.level || !especialidadSeleccionada) {
            toast.error('Por favor completa todos los campos obligatorios');
            return false;
        }
        return true;
    };

    // Funciones para evidencias con animación
    const siguienteEvidencia = () => {
        if (evidenciaActual < evidencias.length - 1 && !isAnimating) {
            setIsAnimating(true);
            setTimeout(() => {
                setEvidenciaActual(prev => prev + 1);
                setTimeout(() => setIsAnimating(false), 50);
            }, 150);
        }
    };

    const anteriorEvidencia = () => {
        if (evidenciaActual > 0 && !isAnimating) {
            setIsAnimating(true);
            setTimeout(() => {
                setEvidenciaActual(prev => prev - 1);
                setTimeout(() => setIsAnimating(false), 50);
            }, 150);
        }
    };

    const handleFileUpload = (file: File) => {
        setEvidencias(prev => {
            const updated = [...prev];
            updated[evidenciaActual] = file;

            // Si ahora TODAS las evidencias están completas y el tipo de trabajo está seleccionado, resetear validaciones
            const todasCompletas = updated.every(evidencia => evidencia !== null);
            if (todasCompletas && isCollaborativeWork !== null) {
                setShowValidationErrors(false);
            }

            return updated;
        });
    };

    // Función para resetear el modal
    const resetModal = () => {
        setPasoActual(1);
        setDeviceData({
            type: '',
            identifier: '',
            ubication: '',
            building: '',
            level: '',
            note: ''
        });
        setEspecialidadSeleccionada('');
        setEvidenciaActual(0);
        setEvidencias([null, null, null]);
        setIsCollaborativeWork(null); // Sin selección por defecto
        setSelectedColaboradores([]);
        setTipoParticipacion([]);
        setShowCollaborativeSelector(false);
        setShowCollaboratorsList(false);
        setIsAnimating(false);
        setShowValidationErrors(false); // Resetear validaciones
        setIsSubmitting(false); // Resetear estado de subida
        setSubmitStatus('idle');
        setReportId(null);
    };

    // Función personalizada para cerrar el modal
    const handleClose = () => {
        resetModal();
        onClose();
    };

    // Funciones de cámara
    const abrirCamara = async () => {
        setShowCamera(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'environment' }
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
            }
        } catch (error) {
            toast.error('No se pudo acceder a la cámara');
        }
    };

    const capturarFoto = () => {
        if (videoRef.current && canvasRef.current) {
            const context = canvasRef.current.getContext('2d');
            if (context) {
                canvasRef.current.width = videoRef.current.videoWidth;
                canvasRef.current.height = videoRef.current.videoHeight;
                context.drawImage(videoRef.current, 0, 0);
                canvasRef.current.toBlob((blob) => {
                    if (blob) {
                        const file = new File([blob], `evidencia-${evidenciaActual + 1}.jpg`, {
                            type: 'image/jpeg'
                        });
                        handleFileUpload(file);
                        cerrarCamara();
                    }
                });
            }
        }
    };

    const cerrarCamara = () => {
        if (videoRef.current?.srcObject) {
            const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
            tracks.forEach(track => track.stop());
        }
        setShowCamera(false);
    };

    // Función para trabajo colaborativo
    const handleCollaborativeSelectionChange = (
        isCollaborative: boolean,
        colaboradores: string[],
        participacion: any[]
    ) => {
        setIsCollaborativeWork(isCollaborative);
        setSelectedColaboradores(colaboradores);
        setTipoParticipacion(participacion);
    };

    // Función para enviar reporte
    const handleSubmit = async () => {
        console.log('🔥 handleSubmit ejecutado!');
        console.log('isCollaborativeWork:', isCollaborativeWork);
        console.log('evidencias:', evidencias);
        console.log('showValidationErrors antes:', showValidationErrors);

        try {
            // Activar el estado de validación para mostrar errores
            setShowValidationErrors(true);
            console.log('showValidationErrors después:', true);

            // Validar que se haya seleccionado tipo de trabajo
            if (isCollaborativeWork === null) {
                toast.error('Debes seleccionar el tipo de trabajo (Individual o Colaborativo)');
                setPasoActual(3); // Ir al paso de Tipo de Trabajo
                return;
            }

            // Validar que estén TODAS las evidencias fotográficas (las 3)
            const todasLasEvidencias = evidencias.every(evidencia => evidencia !== null);
            if (!todasLasEvidencias) {
                const evidenciasFaltantes = evidencias.filter(evidencia => evidencia === null).length;
                toast.error(`Debes agregar todas las evidencias fotográficas. Faltan ${evidenciasFaltantes} foto(s)`);
                setPasoActual(4); // Ir al paso de Evidencias Fotográficas
                return;
            }

            // Iniciar proceso de subida
            setIsSubmitting(true);
            setSubmitStatus('uploading');

            toast.info('Subiendo reporte...');

            const token = localStorage.getItem('token');
            if (!token) {
                toast.error('No hay token de autenticación');
                return;
            }

            const decodedToken: any = jwtDecode(token);

            // Paso 1: Crear o buscar dispositivo en catálogo
            const deviceCatalogData = {
                type: deviceData.type,
                ubication: deviceData.ubication,
                identifier: deviceData.identifier,
                building: deviceData.building,
                level: deviceData.level
            };

            const catalogResponse = await fetch(`${getBaseApiUrl()}/device-catalog`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(deviceCatalogData)
            });

            if (!catalogResponse.ok) {
                throw new Error('Error al procesar dispositivo en catálogo');
            }

            const catalogResult = await catalogResponse.json();
            const deviceCatalogId = catalogResult.data._id;

            // Paso 2: Crear reporte con evidencias usando FormData
            const formData = new FormData();

            // Datos básicos del reporte
            formData.append('deviceCatalogId', deviceCatalogId);
            formData.append('colaborador', decodedToken.userId || decodedToken.id);
            formData.append('especialidad', especialidadSeleccionada);
            formData.append('note', deviceData.note);
            formData.append('manualUploadReason', `Dispositivo: ${deviceData.type} - ${deviceData.identifier} en ${deviceData.ubication}, ${deviceData.building}, Nivel ${deviceData.level}`);

            // Evidencias como archivos
            if (evidencias[0]) formData.append('WorkEvidence', evidencias[0]);
            if (evidencias[1]) formData.append('DeviceEvidence', evidencias[1]);
            if (evidencias[2]) formData.append('ViewEvidence', evidencias[2]);

            // Trabajo colaborativo - incluir al usuario actual en la lista
            formData.append('esColaborativo', isCollaborativeWork.toString());
            if (isCollaborativeWork) {
                const usuarioActual = decodedToken.userId || decodedToken.id;
                const todosColaboradores = [...selectedColaboradores];

                // Agregar el usuario actual si no está en la lista
                if (!todosColaboradores.includes(usuarioActual)) {
                    todosColaboradores.push(usuarioActual);
                }

                // Agregar cada colaborador por separado
                todosColaboradores.forEach((colaboradorId, index) => {
                    formData.append(`colaboradores[${index}]`, colaboradorId);
                });

                // Agregar tipos de participación
                tipoParticipacion.forEach((tipo, index) => {
                    formData.append(`tipoParticipacion[${index}][colaborador]`, tipo.colaborador);
                    formData.append(`tipoParticipacion[${index}][tipo]`, tipo.tipo);
                });
            }



            const reportResponse = await fetch(`${getBaseApiUrl()}/device-reports`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                    // No incluir Content-Type para que el navegador lo establezca automáticamente con boundary
                },
                body: formData
            });

            if (!reportResponse.ok) {
                throw new Error('Error al subir reporte');
            }

            const reportResp = await reportResponse.json();
            const newReportId = reportResp.data._id;
            setReportId(newReportId);

            // Completar dispositivo en período MP (solo después de que la subida esté al 100%)
            if (dispositivoInfo) {
                try {
                    const url = `${getBaseApiUrl()}/periodos-mp/${dispositivoInfo.periodoId}/complete-device/${dispositivoInfo.deviceId}/${dispositivoInfo.colaboradorId}`;
                    await fetch(url, {
                        method: 'PATCH',
                        headers: {
                            Authorization: `Bearer ${token}`,
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            deviceReportId: reportResp.data._id,
                            notas: `Reporte completado: ${deviceData.identifier}`,
                            esColaborativo: isCollaborativeWork,
                            colaboradores: selectedColaboradores,
                            tipoParticipacion: tipoParticipacion
                        })
                    });
                } catch (error) {
                    console.warn('Error al actualizar estado del dispositivo');
                }
            }

            // Esperar un momento para que el usuario vea el 100%, luego marcar como completado
            setTimeout(() => {
                setSubmitStatus('completed');
                toast.success('¡Reporte completado exitosamente!');
            }, 500);

            // Esperar 3 segundos para que el usuario vea el estado completado, luego cerrar
            setTimeout(() => {
                setSubmitStatus('idle');
                setIsSubmitting(false);
                setReportId(null);
                onSuccess();
                handleClose(); // Usar handleClose para resetear el modal
            }, 3000);

        } catch (error) {
            setSubmitStatus('error');
            setIsSubmitting(false);
            toast.error('Error al subir el reporte');
        }
    };

    // Función para verificar si un paso está completo
    const isPasoCompleto = (paso: number) => {
        let result;
        switch (paso) {
            case 3: // Tipo de Trabajo
                result = isCollaborativeWork !== null;
                console.log(`🔍 isPasoCompleto(${paso}): isCollaborativeWork=${isCollaborativeWork}, result=${result}`);
                return result;
            case 4: // Evidencias Fotográficas - TODAS las 3 evidencias son obligatorias
                result = evidencias.every(evidencia => evidencia !== null);
                console.log(`🔍 isPasoCompleto(${paso}): evidencias=${evidencias.map(e => e ? 'file' : 'null')}, result=${result}`);
                return result;
            default:
                return true;
        }
    };

    const getTituloPaso = () => {
        const baseTitle = (() => {
            switch (pasoActual) {
                case 1: return 'Información del Dispositivo';
                case 2: return 'Notas y Observaciones';
                case 3: return 'Tipo de Trabajo';
                case 4: return 'Evidencias Fotográficas';
                default: return '';
            }
        })();

        // Agregar indicador si el paso es obligatorio y no está completo
        const shouldShowRequired = showValidationErrors && (pasoActual === 3 || pasoActual === 4) && !isPasoCompleto(pasoActual);
        console.log(`📝 getTituloPaso: pasoActual=${pasoActual}, showValidationErrors=${showValidationErrors}, shouldShowRequired=${shouldShowRequired}`);

        if (shouldShowRequired) {
            return `${baseTitle} *`;
        }

        return baseTitle;
    };

    // Función para renderizar el estado de subida
    const renderSubmitStatus = () => {
        const statusMessages: Record<string, any> = {
            uploading: {
                icon: 'bi-arrow-repeat', // Círculo de flechas (carga)
                title: 'Subiendo Reporte',
                message: 'Subiendo evidencias y datos del reporte...',
                spinning: true
            },
            completed: {
                icon: 'bi-check-circle-fill',
                title: '¡Completado!',
                message: 'Reporte subido y procesado exitosamente',
                spinning: false
            },
            error: {
                icon: 'bi-x-circle-fill',
                title: 'Error al subir reporte',
                message: 'No se pudo subir el reporte. Verifica tu conexión e inténtalo de nuevo.',
                spinning: false
            }
        };

        const status = statusMessages[submitStatus];
        if (!status || submitStatus === 'idle') return null;

        return (
            <div className="submit-status-container">
                <div className="submit-status-content">
                    <div
                        className={`submit-status-icon ${status.spinning ? 'spinning' : ''} ${submitStatus === 'completed' ? 'completed' : ''}`}
                    >
                        <i className={`bi ${status.icon}`}></i>
                    </div>
                    <h3>{status.title}</h3>
                    <p>{status.message}</p>

                    {reportId && (
                        <small>ID: {reportId}</small>
                    )}
                    {submitStatus === 'error' && (
                        <div style={{ marginTop: '20px' }}>
                            <button
                                type="button"
                                className="modal-btn modal-btn-confirmar-poliza"
                                onClick={() => {
                                    setSubmitStatus('idle');
                                    setIsSubmitting(false);
                                    setReportId(null);
                                }}
                                style={{ marginRight: '10px' }}
                            >
                                <i className="bi bi-arrow-clockwise"></i>
                                Reintentar
                            </button>
                            <button
                                type="button"
                                className="modal-btn modal-btn-cancelar"
                                onClick={handleClose}
                            >
                                <i className="bi bi-x-circle"></i>
                                Cerrar
                            </button>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderPasoActual = () => {

        switch (pasoActual) {
            case 1:
                return (
                    <div className="paso-contenido">
                        <div className="form-grid">
                            {/* Tipo */}
                            <div className="form-group">
                                <label>Tipo</label>
                                <div className="autocomplete-wrapper">
                                    <input
                                        type="text"
                                        value={deviceData.type}
                                        readOnly
                                        disabled
                                        placeholder="Tipo de dispositivo"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Identificador */}
                            <div className="form-group">
                                <label>Identificador</label>
                                <div className="autocomplete-wrapper">
                                    <input
                                        type="text"
                                        value={deviceData.identifier}
                                        readOnly
                                        disabled
                                        placeholder="Identificador único"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Ubicación */}
                            <div className="form-group">
                                <label>Ubicación</label>
                                <div className="autocomplete-wrapper">
                                    <input
                                        type="text"
                                        value={deviceData.ubication}
                                        readOnly
                                        disabled
                                        placeholder="Ubicación"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Edificio */}
                            <div className="form-group">
                                <label>Edificio</label>
                                <input
                                    type="text"
                                    value={deviceData.building}
                                    readOnly
                                    disabled
                                    placeholder="Edificio"
                                    required
                                />
                            </div>

                            {/* Nivel */}
                            <div className="form-group">
                                <label>Nivel</label>
                                <input
                                    type="text"
                                    value={deviceData.level}
                                    readOnly
                                    disabled
                                    placeholder="Nivel o piso"
                                    required
                                />
                            </div>

                            {/* Especialidad */}
                            <div className="form-group">
                                <label>Especialidad</label>
                                <input
                                    type="text"
                                    value={especialidades.find(esp => esp._id === especialidadSeleccionada)?.nombre || 'No seleccionada'}
                                    readOnly
                                    disabled
                                    placeholder="Especialidad"
                                    required
                                />
                            </div>
                        </div>
                    </div>
                );

            case 2:
                return (
                    <div className="paso-contenido">
                        <div className="form-group">
                            <label>Notas y Observaciones</label>
                            <textarea
                                value={deviceData.note}
                                onChange={(e) => setDeviceData(prev => ({ ...prev, note: e.target.value }))}
                                placeholder="Describe el trabajo realizado, observaciones importantes, etc."
                                rows={4}
                                style={{ resize: 'none', height: '100px' }}
                            />
                        </div>
                    </div>
                );

            case 3:
                return (
                    <div className="paso-contenido">
                        <div className="collaborative-section">
                            {!showCollaboratorsList ? (
                                <>
                                    <h4>Tipo de Trabajo</h4>
                                    <div className="work-type-options">
                                        <label className="work-option">
                                            <input
                                                type="radio"
                                                name="workType"
                                                checked={isCollaborativeWork === false}
                                                onChange={() => {
                                                    setIsCollaborativeWork(false);
                                                    // Si ambos pasos están completos (TODAS las evidencias), resetear validaciones
                                                    if (evidencias.every(evidencia => evidencia !== null)) {
                                                        setShowValidationErrors(false);
                                                    }
                                                }}
                                            />
                                            <span className="work-option-content">
                                                <i className="bi bi-person"></i>
                                                <strong>Trabajo Individual</strong>
                                                <p>Realizado únicamente por mí</p>
                                            </span>
                                        </label>
                                        <label className="work-option">
                                            <input
                                                type="radio"
                                                name="workType"
                                                checked={isCollaborativeWork === true}
                                                onChange={() => {
                                                    setIsCollaborativeWork(true);
                                                    // Si ambos pasos están completos (TODAS las evidencias), resetear validaciones
                                                    if (evidencias.every(evidencia => evidencia !== null)) {
                                                        setShowValidationErrors(false);
                                                    }
                                                }}
                                            />
                                            <span className="work-option-content">
                                                <i className="bi bi-people"></i>
                                                <strong>Trabajo Colaborativo</strong>
                                                <p>Realizado con otros técnicos</p>
                                            </span>
                                        </label>
                                    </div>
                                </>
                            ) : (
                                <div className="colaboradores-selection">
                                    <div className="colaboradores-header">
                                        <h4>Seleccionar Colaboradores</h4>
                                        <button
                                            type="button"
                                            className="btn-back-selection"
                                            onClick={() => {
                                                setShowCollaboratorsList(false);
                                                setIsCollaborativeWork(null); // Regresar a sin selección
                                                setSelectedColaboradores([]);
                                            }}
                                        >
                                            <i className="bi bi-x"></i>
                                        </button>
                                    </div>

                                    <div className="colaboradores-list">
                                        {colaboradoresFiltrados.map((colaborador) => (
                                            <label key={colaborador._id} className="colaborador-item">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedColaboradores.includes(colaborador._id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setSelectedColaboradores(prev => [...prev, colaborador._id]);
                                                        } else {
                                                            setSelectedColaboradores(prev => prev.filter(id => id !== colaborador._id));
                                                        }
                                                    }}
                                                />
                                                <div className="colaborador-info">
                                                    <strong>{colaborador.nombre} {colaborador.apellido_paterno}</strong>
                                                    <p>{colaborador.correo}</p>
                                                </div>
                                            </label>
                                        ))}
                                    </div>

                                    {selectedColaboradores.length > 0 && (
                                        <p className="colaboradores-count">
                                            {selectedColaboradores.length} colaborador(es) seleccionado(s)
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                );

            case 4:
                return (
                    <div className="paso-contenido">
                        <div className="evidencias-carrusel">
                            {/* Contenedor con flechas laterales para navegar evidencias */}
                            <div className="evidencias-navigator">
                                {/* Flecha izquierda */}
                                <button
                                    className="evidencia-nav-btn prev"
                                    onClick={anteriorEvidencia}
                                    disabled={evidenciaActual === 0}
                                >
                                    <i className="bi bi-chevron-left"></i>
                                </button>

                                {/* Card de evidencia actual con animación */}
                                <div className={`evidencia-card-carrusel ${isAnimating ? 'entering' : ''}`}>
                                    <h5>{evidenciasTitulos[evidenciaActual]}</h5>
                                    <div className="evidencia-content">
                                        {evidencias[evidenciaActual] ? (
                                            <div className="evidencia-preview">
                                                <div className="imagen-wrapper">
                                                    <img
                                                        src={URL.createObjectURL(evidencias[evidenciaActual]!)}
                                                        alt={evidenciasTitulos[evidenciaActual]}
                                                    />
                                                    <button
                                                        className="btn-remove-evidencia"
                                                        onClick={() => {
                                                            setEvidencias(prev => {
                                                                const updated = [...prev];
                                                                updated[evidenciaActual] = null;
                                                                return updated;
                                                            });
                                                        }}
                                                    >
                                                        <i className="bi bi-trash"></i>
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="evidencia-upload">
                                                <i className="bi bi-camera"></i>
                                                <p>Agregar evidencia</p>
                                                <div className="upload-buttons">
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        onChange={(e) => {
                                                            const file = e.target.files?.[0];
                                                            if (file) handleFileUpload(file);
                                                        }}
                                                        style={{ display: 'none' }}
                                                        id={`file-upload-${evidenciaActual}`}
                                                    />
                                                    <button
                                                        type="button"
                                                        className="btn-upload-option"
                                                        onClick={() => document.getElementById(`file-upload-${evidenciaActual}`)?.click()}
                                                    >
                                                        <i className="bi bi-upload"></i>
                                                        Subir Foto
                                                    </button>
                                                    <button
                                                        type="button"
                                                        className="btn-upload-option"
                                                        onClick={abrirCamara}
                                                    >
                                                        <i className="bi bi-camera"></i>
                                                        Tomar Foto
                                                    </button>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Flecha derecha */}
                                <button
                                    className="evidencia-nav-btn next"
                                    onClick={siguienteEvidencia}
                                    disabled={evidenciaActual === evidencias.length - 1}
                                >
                                    <i className="bi bi-chevron-right"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                );

            default:
                return null;
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Modal principal de subir reporte */}
            <div className="modal-overlay-coordinadores">
                <div className="modal-content-coordinadores with-steps subir-reporte">
                    <button
                        className="modal-close"
                        onClick={handleClose}
                        disabled={isSubmitting}
                        style={{ opacity: isSubmitting ? 0.5 : 1 }}
                    >
                        ×
                    </button>

                    <div className="modal-title" style={{ fontWeight: 'bold' }}>
                        Subir Reporte - {dispositivoInfo?.deviceIdentifier}
                    </div>

                    {/* Mostrar estado de subida o contenido normal */}
                    {isSubmitting ? (
                        renderSubmitStatus()
                    ) : (
                        <>
                            {/* Título del paso */}
                            <div className={`step-title ${showValidationErrors && (pasoActual === 3 || pasoActual === 4) && !isPasoCompleto(pasoActual) ? 'required' : ''}`}>
                                {getTituloPaso()}
                            </div>
                            <div className="step-info">{pasoActual} de {TOTAL_PASOS}</div>

                            {/* Contenido del paso actual */}
                            <div className="step-content">
                                {renderPasoActual()}
                            </div>
                        </>
                    )}

                    {/* Indicadores de pasos y botones solo cuando NO se está subiendo */}
                    {!isSubmitting && (
                        <>
                            {/* Indicadores de pasos (círculos pequeños) - POSICIÓN FIJA */}
                            <div className="step-indicators-coordinadores">
                                {Array.from({ length: TOTAL_PASOS }, (_, index) => {
                                    const stepNumber = index + 1;
                                    const isActive = pasoActual === stepNumber;
                                    const isIncomplete = showValidationErrors && (stepNumber === 3 || stepNumber === 4) && !isPasoCompleto(stepNumber);
                                    return (
                                        <button
                                            key={stepNumber}
                                            type="button"
                                            className={`step-indicator ${isActive ? 'active' : ''} ${isIncomplete ? 'incomplete' : ''}`}
                                            onClick={() => irAPaso(stepNumber)}
                                            title={`Ir al paso ${stepNumber}${isIncomplete ? ' (Obligatorio)' : ''}`}
                                        />
                                    );
                                })}
                            </div>

                            {/* Botones de acción del modal - POSICIÓN FIJA */}
                            <div className="modal-buttons-coordinadores">
                                <button
                                    type="button"
                                    className="modal-btn modal-btn-cancelar"
                                    onClick={handleClose}
                                >
                                    <i className="bi bi-x-circle"></i>
                                    Cancelar
                                </button>

                                {/* Botón Anterior (visible desde paso 2) */}
                                {pasoActual > 1 && (
                                    <button
                                        type="button"
                                        className="modal-btn modal-btn-secondary"
                                        onClick={pasoAnterior}
                                    >
                                        <i className="bi bi-arrow-left"></i>
                                        Anterior
                                    </button>
                                )}

                                {pasoActual === TOTAL_PASOS ? (
                                    <button
                                        type="button"
                                        className="modal-btn modal-btn-confirmar-poliza"
                                        onClick={handleSubmit}
                                    >
                                        <i className="bi bi-check-circle"></i>
                                        Subir Reporte
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        className="modal-btn modal-btn-confirmar modal-btn-subir-reporte"
                                        onClick={siguientePaso}
                                    >
                                        <i className="bi bi-arrow-right"></i>
                                        Siguiente
                                    </button>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Modal de cámara */}
            {showCamera && (
                <div className="camera-modal-overlay">
                    <div className="camera-modal">
                        <div className="camera-header">
                            <h4>Capturar Evidencia</h4>
                            <button onClick={cerrarCamara} className="close-camera">
                                <i className="bi bi-x"></i>
                            </button>
                        </div>
                        <div className="camera-body">
                            <video ref={videoRef} autoPlay className="camera-video" />
                            <canvas ref={canvasRef} style={{ display: 'none' }} />
                        </div>
                        <div className="camera-actions">
                            <button onClick={capturarFoto} className="capture-btn">
                                <i className="bi bi-camera"></i>
                                Capturar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Selector de trabajo colaborativo */}
            <CollaborativeWorkSelector
                isVisible={showCollaborativeSelector}
                currentColaboradorId={currentUser?._id || ''}
                onSelectionChange={handleCollaborativeSelectionChange}
                onClose={() => setShowCollaborativeSelector(false)}
            />
        </>
    );
};

export default SubirReporteModal;