// Formulario compacto para subir reportes - adaptado del componente principal
import React, { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { jwtDecode } from "jwt-decode";
import CollaborativeWorkSelector from "../CollaborativeWorkSelector";
import "./SubirReporteForm.css";

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
    fechaReporte?: string;
}

interface SubirReporteFormProps {
    onDeviceAdded: (device: DispositivoSubido) => void;
    onLoadingStart: () => void;
    onLoadingEnd: () => void;
}

const SubirReporteForm: React.FC<SubirReporteFormProps> = ({
    onDeviceAdded,
    onLoadingStart,
    onLoadingEnd
}) => {
    const [deviceData, setDeviceData] = useState({
        type: "",
        ubication: "",
        identifier: "",
        building: "",
        level: "",
        note: "",
    });

    const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
    const [selectedPeriodoId, setSelectedPeriodoId] = useState<string | null>(null);
    const [selectedColaboradorId, setSelectedColaboradorId] = useState<string | null>(null);

    // Solo modo de creación - se eliminó la funcionalidad de edición

    const [especialidades, setEspecialidades] = useState<{ _id: string; nombre: string }[]>([]);
    const [especialidadSeleccionada, setEspecialidadSeleccionada] = useState("");

    const [evidencias, setEvidencias] = useState<(File | null)[]>([null, null, null]);
    const [showCameraIndex, setShowCameraIndex] = useState<number | null>(null);

    // Estados para trabajo colaborativo
    const [showCollaborativeSelector, setShowCollaborativeSelector] = useState(false);
    const [isCollaborativeWork, setIsCollaborativeWork] = useState(false);
    const [selectedColaboradores, setSelectedColaboradores] = useState<string[]>([]);
    const [tipoParticipacion, setTipoParticipacion] = useState<any[]>([]);

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const fileRefs = [
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
        useRef<HTMLInputElement>(null),
    ];

    // Se eliminó la funcionalidad de edición - solo modo de creación

    // Función para cargar datos del reporte existente
    // Se eliminó loadExistingReport - solo modo de creación

    // Verificar si viene desde Mis Dispositivos y configurar datos
    useEffect(() => {
        const selectedDevice = localStorage.getItem('selectedDeviceForReport');
        console.log('🔍 Verificando localStorage selectedDeviceForReport:', selectedDevice);

        if (selectedDevice) {
            try {
                const deviceInfo = JSON.parse(selectedDevice);
                console.log('📝 Device info parseado:', deviceInfo);
                console.log('📝 Obteniendo datos del dispositivo con ID:', deviceInfo.deviceId);

                // Obtener los datos frescos del dispositivo desde la API
                const fetchDeviceData = async () => {
                    try {
                        const token = localStorage.getItem('token');
                        const response = await fetch(`http://localhost:4000/api/device-catalog/${deviceInfo.deviceId}`, {
                            headers: {
                                Authorization: token ? `Bearer ${token}` : '',
                            },
                        });

                        if (response.ok) {
                            const result = await response.json();
                            const device = result.data;

                            console.log('✅ Datos del dispositivo obtenidos:', device);

                            // Autocompletar el formulario con los datos actualizados
                            setDeviceData({
                                type: device.type || "",
                                ubication: device.ubication || "",
                                identifier: device.identifier || "",
                                building: device.building || "",
                                level: device.level || "",
                                note: device.note || "",
                            });

                            // Establecer los IDs necesarios para actualización
                            setSelectedDeviceId(deviceInfo.deviceId);
                            setSelectedPeriodoId(deviceInfo.periodoId);
                            setSelectedColaboradorId(deviceInfo.colaboradorId);

                            // Verificar si es asignación múltiple y configurar trabajo colaborativo
                            if (deviceInfo.isMultipleAssignment && deviceInfo.collaborators && deviceInfo.collaborators.length > 0) {
                                console.log('🎯 Detectada asignación múltiple - configurando trabajo colaborativo automáticamente');
                                setIsCollaborativeWork(true);

                                // Configurar colaboradores disponibles (excluir al usuario actual)
                                const otherCollaborators = deviceInfo.collaborators.filter(
                                    (col: any) => col._id !== deviceInfo.colaboradorId
                                );
                                setSelectedColaboradores(otherCollaborators.map((col: any) => col._id));

                                console.log('👥 Colaboradores configurados automáticamente:', otherCollaborators.length);
                            }

                            console.log('✅ IDs configurados para completado:', {
                                selectedDeviceId: deviceInfo.deviceId,
                                selectedPeriodoId: deviceInfo.periodoId,
                                selectedColaboradorId: deviceInfo.colaboradorId,
                                isFromMisDispositivos: true,
                                isMultipleAssignment: deviceInfo.isMultipleAssignment,
                                collaboratorsCount: deviceInfo.collaborators?.length || 0
                            });

                            // Limpiar el localStorage DESPUÉS de configurar los valores
                            localStorage.removeItem('selectedDeviceForReport');

                            // Mostrar mensaje de confirmación
                            toast.success(`Formulario autocompletado para ${device.identifier}`);

                        } else {
                            console.error('❌ Error al obtener datos del dispositivo:', response.status);
                            toast.error('Error al cargar datos del dispositivo');
                        }
                    } catch (error) {
                        console.error('❌ Error en la petición:', error);
                        toast.error('Error al conectar con el servidor');
                    }
                };

                fetchDeviceData();
            } catch (error) {
                console.error('❌ Error parseando device info:', error);
            }
        }
    }, []);

    // Cargar especialidades al montar el componente
    useEffect(() => {
        const fetchEspecialidades = async () => {
            try {
                const token = localStorage.getItem("token");
                const response = await fetch("http://localhost:4000/api/especialidades", {
                    headers: {
                        Authorization: token ? `Bearer ${token}` : "",
                    },
                });
                const data = await response.json();
                setEspecialidades(data);
            } catch (error) {
                console.error("Error al cargar especialidades:", error);
            }
        };
        fetchEspecialidades();
    }, []);

    const handleDeviceChange = (field: string, value: string) => {
        setDeviceData((prev) => ({ ...prev, [field]: value }));

        // NO hacer autocompletado por escritura - solo desde botón "Subir Reporte"
        console.log('🚫 Autocompletado por escritura deshabilitado - solo funciona desde botón "Subir Reporte"');
    };





    const handleFileChange = (index: number, file: File | null) => {
        setEvidencias((prev) => {
            const updated = [...prev];
            updated[index] = file;
            return updated;
        });
    };

    const startCamera = async (index: number) => {
        setShowCameraIndex(index);
        try {
            const constraints = {
                video: { facingMode: { exact: "environment" } },
            };
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }
            streamRef.current = stream;
        } catch (err) {
            try {
                const fallbackStream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                });
                if (videoRef.current) {
                    videoRef.current.srcObject = fallbackStream;
                    videoRef.current.play();
                }
                streamRef.current = fallbackStream;
            } catch (fallbackErr) {
                console.error("No se pudo acceder a ninguna cámara:", fallbackErr);
                toast.error("No se pudo acceder a la cámara de tu dispositivo.");
                setShowCameraIndex(null);
            }
        }
    };

    const stopCamera = () => {
        streamRef.current?.getTracks().forEach((track) => track.stop());
        setShowCameraIndex(null);
    };

    const capturePhoto = () => {
        const index = showCameraIndex;
        if (videoRef.current && canvasRef.current && index !== null) {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;
            const ctx = canvas.getContext("2d");
            ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
            canvas.toBlob((blob) => {
                if (blob) {
                    const file = new File([blob], `evidencia_${index + 1}.jpg`, {
                        type: "image/jpeg",
                    });
                    handleFileChange(index, file);
                    stopCamera();
                }
            }, "image/jpeg", 0.7); // Reducir calidad a 70% para menor tamaño
        }
    };

    // Funciones para trabajo colaborativo
    const handleCollaborativeSelectionChange = (
        isCollaborative: boolean,
        colaboradores: string[],
        participacion: any[]
    ) => {
        setIsCollaborativeWork(isCollaborative);
        setSelectedColaboradores(colaboradores);
        setTipoParticipacion(participacion);
    };

    const openCollaborativeSelector = () => {
        setShowCollaborativeSelector(true);
    };

    const closeCollaborativeSelector = () => {
        setShowCollaborativeSelector(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        onLoadingStart();

        // VALIDACIÓN DE FECHA ACTIVA - Verificar si hay períodos activos
        try {
            const token = localStorage.getItem("token");
            const fechaValidationRes = await fetch("http://localhost:4000/api/periodos-mp/validar-fecha-activa", {
                method: "GET",
                headers: {
                    Authorization: token ? `Bearer ${token}` : "",
                }
            });

            const fechaValidation = await fechaValidationRes.json();

            if (!fechaValidationRes.ok || !fechaValidation.puedeSubirReporte) {
                toast.error(fechaValidation.mensaje || "No hay períodos activos para subir reportes. Contacta al coordinador.");
                onLoadingEnd();
                return;
            }

            console.log('✅ Validación de fecha exitosa:', fechaValidation);
        } catch (error) {
            console.error('Error validando fecha activa:', error);
            toast.error("Error al validar período activo. Intenta nuevamente.");
            onLoadingEnd();
            return;
        }

        // Validaciones de campos
        if (!evidencias.every((f) => f)) {
            toast.error("Debes subir las 3 evidencias");
            onLoadingEnd();
            return;
        }

        if (!especialidadSeleccionada) {
            toast.error("Debes seleccionar una especialidad");
            onLoadingEnd();
            return;
        }

        const token = localStorage.getItem("token");
        let colaboradorId = null;

        if (token) {
            try {
                const decoded: any = jwtDecode(token);
                colaboradorId = decoded.userId;
            } catch (err) {
                console.error("Error al decodificar el token:", err);
            }
        }

        if (!colaboradorId) {
            toast.error("No se pudo obtener el ID del colaborador desde el token");
            onLoadingEnd();
            return;
        }



        try {
            // PASO 1: Asegurar que el dispositivo esté en el catálogo
            const catalogRes = await fetch("http://localhost:4000/api/device-catalog", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: token ? `Bearer ${token}` : "",
                },
                body: JSON.stringify({
                    type: deviceData.type,
                    ubication: deviceData.ubication,
                    identifier: deviceData.identifier,
                    building: deviceData.building,
                    level: deviceData.level
                }),
            });

            const catalogResp = await catalogRes.json();
            if (!catalogRes.ok) {
                throw new Error(catalogResp.message || "Error al procesar dispositivo en catálogo");
            }

            const deviceCatalogId = catalogResp.data._id;

            // PASO 2: Convertir imágenes a base64 optimizadas
            const imagePromises = evidencias.map(async (file) => {
                if (!file) return null;

                // Comprimir imagen antes de convertir a base64
                return new Promise<string>((resolve) => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();

                    img.onload = () => {
                        // Redimensionar si es muy grande
                        const maxWidth = 1200;
                        const maxHeight = 1200;
                        let { width, height } = img;

                        if (width > maxWidth || height > maxHeight) {
                            const ratio = Math.min(maxWidth / width, maxHeight / height);
                            width *= ratio;
                            height *= ratio;
                        }

                        canvas.width = width;
                        canvas.height = height;
                        ctx?.drawImage(img, 0, 0, width, height);

                        resolve(canvas.toDataURL('image/jpeg', 0.8));
                    };

                    img.src = URL.createObjectURL(file);
                });
            });

            const imageBase64 = await Promise.all(imagePromises);

            // PASO 3: Crear el reporte de dispositivo
            const reportData = {
                deviceCatalogId: deviceCatalogId,
                colaborador: colaboradorId,
                especialidad: especialidadSeleccionada,
                WorkEvidence: imageBase64[0],
                DeviceEvidence: imageBase64[1],
                ViewEvidence: imageBase64[2],
                note: deviceData.note
            };

            console.log('📤 Enviando reporte con datos:', {
                ...reportData,
                WorkEvidence: reportData.WorkEvidence ? 'BASE64_DATA' : null,
                DeviceEvidence: reportData.DeviceEvidence ? 'BASE64_DATA' : null,
                ViewEvidence: reportData.ViewEvidence ? 'BASE64_DATA' : null
            });

            const authToken = localStorage.getItem('token');

            // Solo modo de creación
            const method = "POST";
            const url = "http://localhost:4000/api/device-reports";

            console.log('🔄 Modo: CREANDO reporte');
            console.log('🔗 URL:', url);
            console.log('🔧 Método:', method);

            const reportRes = await fetch(url, {
                method: method,
                headers: {
                    "Content-Type": "application/json",
                    Authorization: authToken ? `Bearer ${authToken}` : '',
                },
                body: JSON.stringify(reportData),
            });

            const reportResp = await reportRes.json();
            if (!reportRes.ok) {
                throw new Error(reportResp.message || "Error al crear el reporte");
            }

            // Éxito
            toast.success("Reporte de dispositivo creado exitosamente");

            console.log('🔍 Verificando si debe completar dispositivo:', {
                selectedDeviceId,
                selectedPeriodoId,
                selectedColaboradorId,
                shouldComplete: !!(selectedDeviceId && selectedPeriodoId && selectedColaboradorId)
            });

            // Si viene desde Mis Dispositivos, actualizar el estado del dispositivo en el período MP
            if (selectedDeviceId && selectedPeriodoId && selectedColaboradorId) {
                try {
                    console.log('🔄 INICIANDO completado de dispositivo en período MP:', {
                        periodoId: selectedPeriodoId,
                        deviceCatalogId: selectedDeviceId,
                        colaboradorId: selectedColaboradorId
                    });

                    const token = localStorage.getItem("token");
                    const url = `http://localhost:4000/api/periodos-mp/${selectedPeriodoId}/complete-device/${selectedDeviceId}/${selectedColaboradorId}`;

                    console.log('📡 URL de completado:', url);
                    console.log('🔑 Token disponible:', !!token);

                    const completeResponse = await fetch(url, {
                        method: 'PATCH',
                        headers: {
                            Authorization: token ? `Bearer ${token}` : '',
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            deviceReportId: reportResp.data._id,
                            notas: `Reporte completado: ${deviceData.identifier} - ${deviceData.ubication}`,
                            esColaborativo: isCollaborativeWork,
                            colaboradores: selectedColaboradores,
                            tipoParticipacion: tipoParticipacion
                        })
                    });

                    console.log('📨 Respuesta de completado:', completeResponse.status, completeResponse.statusText);

                    if (completeResponse.ok) {
                        const result = await completeResponse.json();
                        console.log('✅ Dispositivo marcado como completado - respuesta:', result);
                        toast.success('¡Dispositivo completado exitosamente en el período MP!');

                        // Disparar evento para actualizar la lista de dispositivos
                        const updateEvent = new CustomEvent('deviceCompleted', {
                            detail: {
                                deviceId: selectedDeviceId,
                                periodoId: selectedPeriodoId,
                                colaboradorId: selectedColaboradorId
                            }
                        });
                        window.dispatchEvent(updateEvent);
                    } else {
                        const errorData = await completeResponse.text();
                        console.error('❌ Error al completar dispositivo:', completeResponse.status, errorData);
                        toast.warning(`Reporte subido, pero error al actualizar estado: ${completeResponse.status}`);
                    }
                } catch (error) {
                    console.error('❌ EXCEPCIÓN en completado:', error);
                    toast.warning('Reporte subido, pero error de conexión al actualizar estado');
                }
            } else {
                console.log('⚠️ NO se completará el dispositivo - faltan datos:', {
                    selectedDeviceId: selectedDeviceId || 'FALTA',
                    selectedPeriodoId: selectedPeriodoId || 'FALTA',
                    selectedColaboradorId: selectedColaboradorId || 'FALTA'
                });
            }

            // Notificar al componente padre con los datos del reporte
            onDeviceAdded({
                _id: reportResp.data._id,
                type: deviceData.type,
                ubication: deviceData.ubication,
                identifier: deviceData.identifier,
                building: deviceData.building,
                level: deviceData.level,
                note: deviceData.note,
                colaborador: reportResp.data.colaboradorInfo,
                especialidad: reportResp.data.especialidadInfo,
                fechaReporte: reportResp.data.fechaReporte
            });

            // Limpiar formulario y estados de completado
            setDeviceData({
                type: "",
                ubication: "",
                identifier: "",
                building: "",
                level: "",
                note: "",
            });
            setEspecialidadSeleccionada("");
            setEvidencias([null, null, null]);
            setSelectedDeviceId(null);
            setSelectedPeriodoId(null);
            setSelectedColaboradorId(null);
            // Estados de completado limpiados

        } catch (error: any) {
            console.error("Error en el envío:", error);
            toast.error(error.message || "Error al procesar la solicitud");
        } finally {
            onLoadingEnd();
        }
    };

    return (
        <div className="subir-reporte-form-compact">
            <form onSubmit={handleSubmit} className="form-compact">
                {/* Información del dispositivo */}
                <div className="form-section">
                    <h4 className="section-title">
                        <i className="bi bi-hdd me-2"></i>
                        Información del Dispositivo
                    </h4>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Tipo de Dispositivo</label>
                            <input
                                type="text"
                                value={deviceData.type}
                                onChange={(e) => handleDeviceChange("type", e.target.value)}
                                required
                                className="form-control"
                                placeholder="Ej: Detector de humo"
                            />
                        </div>

                        <div className="form-group">
                            <label>Identificador</label>
                            <input
                                type="text"
                                value={deviceData.identifier}
                                onChange={(e) => handleDeviceChange("identifier", e.target.value)}
                                required
                                className="form-control"
                                placeholder="Ej: N005L01D001"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Ubicación</label>
                            <input
                                type="text"
                                value={deviceData.ubication}
                                onChange={(e) => handleDeviceChange("ubication", e.target.value)}
                                required
                                className="form-control"
                                placeholder="Ej: Cuarto de máquinas"
                            />
                        </div>

                        <div className="form-group">
                            <label>Edificio</label>
                            <input
                                type="text"
                                value={deviceData.building}
                                onChange={(e) => handleDeviceChange("building", e.target.value)}
                                className="form-control"
                                placeholder="Ej: Torre A"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Nivel</label>
                            <input
                                type="text"
                                value={deviceData.level}
                                onChange={(e) => handleDeviceChange("level", e.target.value)}
                                className="form-control"
                                placeholder="Ej: Nivel 3"
                            />
                        </div>

                        <div className="form-group">
                            <label>Especialidad</label>
                            <select
                                value={especialidadSeleccionada}
                                onChange={(e) => setEspecialidadSeleccionada(e.target.value)}
                                required
                                className="form-control"
                            >
                                <option value="">Selecciona una especialidad</option>
                                {especialidades.map((esp) => (
                                    <option key={esp._id} value={esp._id}>
                                        {esp.nombre}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Notas</label>
                        <textarea
                            value={deviceData.note}
                            onChange={(e) => handleDeviceChange("note", e.target.value)}
                            className="form-control"
                            rows={2}
                            placeholder="Observaciones adicionales..."
                        />
                    </div>
                </div>

                {/* Evidencias */}
                <div className="form-section">
                    <h4 className="section-title">
                        <i className="bi bi-images me-2"></i>
                        Evidencias Requeridas
                    </h4>

                    <div className="evidences-grid">
                        {["Evidencia de Trabajo", "Evidencia del Dispositivo", "Evidencia de Vista"].map((label, index) => (
                            <div key={index} className="evidence-item">
                                <label className="evidence-label">{label}</label>

                                {evidencias[index] ? (
                                    <div className="evidence-preview">
                                        <img
                                            src={URL.createObjectURL(evidencias[index]!)}
                                            alt={`Evidencia ${index + 1}`}
                                            className="evidence-img"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => handleFileChange(index, null)}
                                            className="remove-evidence-btn"
                                        >
                                            <i className="bi bi-x"></i>
                                        </button>
                                    </div>
                                ) : (
                                    <div className="evidence-upload">
                                        <input
                                            ref={fileRefs[index]}
                                            type="file"
                                            accept="image/*"
                                            onChange={(e) => {
                                                const file = e.target.files?.[0] || null;
                                                handleFileChange(index, file);
                                            }}
                                            style={{ display: "none" }}
                                        />

                                        <div className="upload-options">
                                            <button
                                                type="button"
                                                onClick={() => fileRefs[index].current?.click()}
                                                className="upload-btn file"
                                            >
                                                <i className="bi bi-upload"></i>
                                                Archivo
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => startCamera(index)}
                                                className="upload-btn camera"
                                            >
                                                <i className="bi bi-camera"></i>
                                                Cámara
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Configuración de trabajo colaborativo */}
                <div className="collaborative-work-section">
                    <div className="collaborative-status">
                        {isCollaborativeWork ? (
                            <div className="collaborative-active">
                                <i className="bi bi-people-fill me-2"></i>
                                <span>Trabajo Colaborativo - {selectedColaboradores.length} participantes</span>
                                <button
                                    type="button"
                                    className="btn-modify-collaborative"
                                    onClick={openCollaborativeSelector}
                                >
                                    Modificar
                                </button>
                            </div>
                        ) : (
                            <button
                                type="button"
                                className="btn-collaborative"
                                onClick={openCollaborativeSelector}
                            >
                                <i className="bi bi-people me-2"></i>
                                Configurar Trabajo Colaborativo
                            </button>
                        )}
                    </div>
                </div>

                {/* Botón de envío */}
                <div className="form-actions">
                    <button type="submit" className="submit-btn">
                        <i className="bi bi-check-circle me-2"></i>
                        {selectedDeviceId ? "Actualizar Dispositivo" : "Subir Dispositivo"}
                    </button>
                </div>
            </form>

            {/* Modal de cámara */}
            {showCameraIndex !== null && (
                <div className="modal-overlay">
                    <div className="camera-modal">
                        <div className="camera-header">
                            <h4>Capturar Evidencia</h4>
                            <button onClick={stopCamera} className="close-btn">
                                <i className="bi bi-x"></i>
                            </button>
                        </div>
                        <div className="camera-body">
                            <video ref={videoRef} className="camera-video" />
                            <canvas ref={canvasRef} style={{ display: "none" }} />
                        </div>
                        <div className="camera-actions">
                            <button onClick={capturePhoto} className="capture-btn">
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
                currentColaboradorId={selectedColaboradorId || ''}
                onSelectionChange={handleCollaborativeSelectionChange}
                onClose={closeCollaborativeSelector}
            />
        </div>
    );
};

export default SubirReporteForm;