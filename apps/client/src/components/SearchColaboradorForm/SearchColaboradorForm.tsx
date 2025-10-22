// Componente de búsqueda para colaboradores - versión adaptada del SearchReportForm admin
import React, { useEffect, useState } from "react";
import "../SearchForm/SearchReportForm.css";
import api from "../../api";
import { toast } from "react-toastify";
import { jwtDecode } from 'jwt-decode';

// Interface para dispositivos encontrados en la búsqueda
interface Device {
    _id: string;
    type: string;
    ubication: string;
    identifier: string;
    building: string;
    level: string;
    note: string;
    images: any[];
    createdAt?: string;
    colaborador?: {
        _id: string;
        nombre: string;
        apellido_paterno?: string;
        apellido_materno?: string;
        correo?: string;
        rol?: string;
    };
}

// Interface para colaborador desde localStorage
interface Colaborador {
    _id: string;
    nombre: string;
    especialidad: {
        _id: string;
        nombre: string;
    }[];
    poliza: {
        _id: string;
        nombre: string;
        codigo: string;
    };
}

// Props del componente
interface SearchColaboradorFormProps {
    onSearch: (devices: Device[]) => void;
    onReporteGenerado?: (nombre: string, url: string) => void;
    onShowModal?: () => void;
    hasResults?: boolean;
    onLoadingStart?: () => void;
    onLoadingEnd?: () => void;
    onProgressUpdate?: (progress: number, message: string, timeRemaining?: number) => void;
    showEditableOnly?: boolean;
    onEditableOnlyChange?: (value: boolean) => void;
}

const SearchColaboradorForm: React.FC<SearchColaboradorFormProps> = ({
    onSearch,
    onReporteGenerado: _onReporteGenerado,
    onShowModal: _onShowModal,
    hasResults = false,
    onLoadingStart,
    onLoadingEnd,
    onProgressUpdate: _onProgressUpdate,
    showEditableOnly = false,
    onEditableOnlyChange,
}) => {
    // Estados para los campos del formulario
    const [especialidad, setEspecialidad] = useState("");
    const [fechaInicio, setFechaInicio] = useState("");
    const [fechaFinal, setFechaFinal] = useState("");

    // Estados para datos del colaborador
    const [colaboradorData, setColaboradorData] = useState<Colaborador | null>(null);
    const [colaboradorId, setColaboradorId] = useState<string>("");

    // Inicializar datos del colaborador desde el token
    useEffect(() => {
        const initializeColaboradorData = async () => {
            const token = localStorage.getItem('token');
            if (token) {
                try {
                    // Verificar si el token ha expirado
                    const { isTokenExpired } = await import('../../utils/tokenUtils');
                    if (isTokenExpired(token)) {
                        console.log('🔴 SearchColaboradorForm: Token expirado, no cargando datos');
                        return;
                    }

                    const decoded: any = jwtDecode(token);
                    setColaboradorId(decoded.userId);
                    fetchColaboradorData(decoded.userId);
                } catch (error) {
                    // Suprimir toast si el token ha expirado
                    const token = localStorage.getItem('token');
                    if (token) {
                        const { isTokenExpired } = await import('../../utils/tokenUtils');
                        if (!isTokenExpired(token)) {
                            console.error('Error decodificando token:', error);
                            toast.error('Error de autenticación');
                        }
                    }
                }
            }
        };

        initializeColaboradorData();
    }, []);

    const fetchColaboradorData = async (id: string) => {
        try {
            const response = await api.get(`/colaboradores/${id}`);
            setColaboradorData(response.data);
        } catch (error) {
            // Suprimir toast si el token ha expirado
            const token = localStorage.getItem('token');
            if (token) {
                const { isTokenExpired } = await import('../../utils/tokenUtils');
                if (!isTokenExpired(token)) {
                    console.error('Error cargando datos del colaborador:', error);
                    toast.error('Error al cargar datos del colaborador');
                }
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!colaboradorData?.poliza || !especialidad || !fechaInicio || !fechaFinal) {
            toast.warning("Complete todos los campos");
            return;
        }

        if (onLoadingStart) onLoadingStart();

        try {
            // Obtener los reportes/dispositivos del colaborador usando el endpoint específico
            const reportesResponse = await api.get(`/reportes/colaborador/${colaboradorId}`);
            console.log('🔍 Respuesta del servidor:', reportesResponse.data);

            let dispositivos = reportesResponse.data.reportes || [];
            console.log('📊 Dispositivos iniciales:', dispositivos.length);

            // Aplicar filtros según los criterios seleccionados
            if (especialidad) {
                console.log('🔍 Filtrando por especialidad:', especialidad);
                console.log('📊 Dispositivos antes del filtro:', dispositivos.map((d: any) => ({
                    identifier: d.identifier,
                    especialidadId: d.especialidad?._id,
                    especialidadNombre: d.especialidad?.nombre
                })));

                dispositivos = dispositivos.filter((dispositivo: any) => {
                    const match = dispositivo.especialidad?._id === especialidad;
                    if (!match) {
                        console.log(`❌ ${dispositivo.identifier} - Especialidad: ${dispositivo.especialidad?.nombre} (${dispositivo.especialidad?._id}) no coincide con ${especialidad}`);
                    } else {
                        console.log(`✅ ${dispositivo.identifier} - Especialidad: ${dispositivo.especialidad?.nombre} (${dispositivo.especialidad?._id}) coincide`);
                    }
                    return match;
                });
                console.log('📋 Después del filtro de especialidad:', dispositivos.length);
            }

            if (fechaInicio || fechaFinal) {
                dispositivos = dispositivos.filter((dispositivo: any) => {
                    const fechaDispositivo = new Date(dispositivo.createdAt);
                    let cumpleRango = true;

                    if (fechaInicio) {
                        cumpleRango = cumpleRango && fechaDispositivo >= new Date(fechaInicio);
                    }

                    if (fechaFinal) {
                        cumpleRango = cumpleRango && fechaDispositivo <= new Date(fechaFinal);
                    }

                    return cumpleRango;
                });
                console.log('📅 Después del filtro de fechas:', dispositivos.length);
            }

            // Si está activado el filtro de "solo editables"
            if (showEditableOnly) {
                dispositivos = dispositivos.filter((dispositivo: any) => dispositivo.puedeEditar);
                console.log('✏️ Después del filtro de editables:', dispositivos.length);
            }

            // Transformar los datos para que sean compatibles con la interfaz Device
            const dispositivosFormateados = dispositivos.map((reporte: any) => ({
                _id: reporte._id,
                type: reporte.type,
                ubication: reporte.ubication,
                identifier: reporte.identifier,
                building: reporte.building,
                level: reporte.level,
                note: reporte.note,
                images: reporte.images || [],
                createdAt: reporte.createdAt,
                colaborador: reporte.colaborador,
                especialidad: reporte.especialidad,
                puedeEditar: reporte.puedeEditar,
                periodoEditable: reporte.periodoEditable,
                // ¡AGREGAR LOS CAMPOS COLABORATIVOS!
                esColaborativo: reporte.esColaborativo,
                tipoParticipacion: reporte.tipoParticipacion
            }));

            onSearch(dispositivosFormateados);

            if (dispositivosFormateados.length === 0) {
                toast.info("No se encontraron dispositivos para los criterios seleccionados");
            } else {
                toast.success(`Se encontraron ${dispositivosFormateados.length} dispositivo(s)`);
            }
        } catch (error) {
            console.error("Error en la búsqueda:", error);
            toast.error("Error al buscar dispositivos");
        } finally {
            if (onLoadingEnd) onLoadingEnd();
        }
    };

    return (
        <form className="search-form" onSubmit={handleSubmit}>
            <div className="search-form__row">
                {/* Póliza (solo lectura para colaborador) */}
                <div className="search-form__group">
                    <label className="search-form__label">Póliza</label>
                    <input
                        type="text"
                        className="search-form__input search-form__input--readonly"
                        value={colaboradorData?.poliza?.nombre || 'Cargando...'}
                        readOnly
                        title={`Código: ${colaboradorData?.poliza?.codigo || ''}`}
                    />
                </div>

                {/* Especialidad */}
                <div className="search-form__group">
                    <label className="search-form__label">Especialidad</label>
                    <select
                        className="search-form__input"
                        value={especialidad}
                        onChange={(e) => {
                            console.log('🎯 Especialidad seleccionada:', e.target.value);
                            const espSeleccionada = colaboradorData?.especialidad.find(esp => esp._id === e.target.value);
                            console.log('🎯 Especialidad encontrada:', espSeleccionada);
                            setEspecialidad(e.target.value);
                        }}
                        required
                    >
                        <option value="">Seleccione una especialidad</option>
                        {colaboradorData?.especialidad.map((esp) => {
                            console.log('📋 Especialidad disponible:', esp.nombre, esp._id);
                            return (
                                <option key={esp._id} value={esp._id}>
                                    {esp.nombre}
                                </option>
                            );
                        })}
                    </select>
                </div>
            </div>

            <div className="search-form__row">
                {/* Rango de fechas */}
                <div className="search-form__group">
                    <label className="search-form__label">Período de reporte</label>
                    <div className="search-form__dates">
                        <input
                            type="date"
                            className="search-form__input"
                            value={fechaInicio}
                            onChange={(e) => setFechaInicio(e.target.value)}
                            required
                        />
                        <span className="search-form__date-separator">a</span>
                        <input
                            type="date"
                            className="search-form__input"
                            value={fechaFinal}
                            onChange={(e) => setFechaFinal(e.target.value)}
                            required
                        />
                    </div>
                </div>
            </div>

            {/* Filtro adicional para solo editables */}
            <div className="search-form__row">
                <div className="search-form__group search-form__group--checkbox">
                    <label className="search-form__checkbox-label">
                        <input
                            type="checkbox"
                            checked={showEditableOnly}
                            onChange={(e) => onEditableOnlyChange?.(e.target.checked)}
                            className="search-form__checkbox"
                        />
                        <span className="search-form__checkbox-text">
                            <i className="bi bi-pencil-square"></i>
                            Mostrar solo reportes editables
                        </span>
                    </label>
                </div>
            </div>

            <div className="search-form__actions">
                <button type="submit" className="search-form__button">
                    <i className="bi bi-search"></i>
                    Buscar Reportes
                </button>

                {hasResults && (
                    <div className="search-form__results-info">
                        <i className="bi bi-info-circle"></i>
                        <span>Resultados encontrados. Revisa la vista previa abajo.</span>
                    </div>
                )}
            </div>
        </form>
    );
};

export default SearchColaboradorForm;