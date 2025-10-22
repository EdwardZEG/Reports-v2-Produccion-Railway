import { useState, useEffect } from "react";
import "./crearUsuario.css";
import "../../styles/coordinadores.css";
import "../../styles/Polizas.css";
import api from "../../api";
import { toast } from "react-toastify";

interface PolizaShort {
  _id: string;
  nombre: string;
}

interface EspecialidadShort {
  _id: string;
  nombre: string;
}

interface Encargado {
  _id: string;
  nombre: string;
  apellido_paterno: string;
  apellido_materno: string;
  correo: string;
  telefono?: string;
  estado: string;
  poliza?: PolizaShort | null;
  especialidad: EspecialidadShort[] | null;
  rol: string;
}

interface CrearColaboradorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (colaboradorCreado?: Encargado) => void | Promise<void>;
  polizas: PolizaShort[];
  especialidades: EspecialidadShort[];
  rolUsuario?: string;
  polizaUsuarioId?: string;
  colaboradorEditando?: Encargado;
  crearColaborador?: (datos: any) => Promise<{ success: boolean; data?: any; encargados?: any[] }>;
}

const CrearColaboradorModal: React.FC<CrearColaboradorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  polizas,
  especialidades,
  rolUsuario,
  polizaUsuarioId,
  colaboradorEditando,
  crearColaborador
}) => {
  const [formData, setFormData] = useState({
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    correo: "",
    contraseña: "",
    telefono: "",
    estado: "Activo",
    rol: "Auxiliar",
    poliza: "" as string | null,
    especialidad: [] as string[],
  });

  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [error, setError] = useState<string>("");

  // Estados para sistema de pasos - como coordinadores
  const [pasoActual, setPasoActual] = useState(1);
  const TOTAL_PASOS = 4;
  const [showPassword, setShowPassword] = useState(false);

  // Estados para carrusel de pólizas
  const [carruselIndex, setCarruselIndex] = useState(0);
  const POLIZAS_POR_PAGINA = 1;

  // Estados para carrusel de especialidades
  const [carruselEspecialidadesIndex, setCarruselEspecialidadesIndex] = useState(0);
  const ESPECIALIDADES_POR_PAGINA = 1;

  // Estado para especialidades filtradas por póliza
  const [especialidadesFiltradas, setEspecialidadesFiltradas] = useState<EspecialidadShort[]>([]);

  // Estado para pólizas filtradas (para coordinadores)
  const [polizasFiltradas, setPolizasFiltradas] = useState<PolizaShort[]>([]);

  // Inicializar o resetear form cuando cambie colaboradorEditando o rolUsuario/polizaUsuarioId
  useEffect(() => {
    if (!isOpen) return;

    // Siempre resetear el paso actual y carruseles al abrir el modal
    setPasoActual(1);
    setCarruselIndex(0);
    setCarruselEspecialidadesIndex(0);
    setShowPassword(false);

    // Validación para coordinadores: no pueden editar colaboradores de otras pólizas
    if (colaboradorEditando && rolUsuario === "coordinador" && polizaUsuarioId) {
      const colaboradorPolizaId = colaboradorEditando.poliza?._id;
      if (colaboradorPolizaId && colaboradorPolizaId !== polizaUsuarioId) {
        setError("No tienes permisos para editar colaboradores de otras pólizas");
        return;
      }
    }

    if (colaboradorEditando && colaboradorEditando._id) {
      // Edición: cargar datos existentes
      setFormData({
        nombre: colaboradorEditando.nombre || "",
        apellido_paterno: colaboradorEditando.apellido_paterno || "",
        apellido_materno: colaboradorEditando.apellido_materno || "",
        correo: colaboradorEditando.correo || "",
        contraseña: "",
        telefono: colaboradorEditando.telefono || "",
        estado: colaboradorEditando.estado || "Activo",
        rol: colaboradorEditando.rol || "Auxiliar",
        poliza: colaboradorEditando.poliza?._id || "",
        especialidad: Array.isArray(colaboradorEditando.especialidad)
          ? colaboradorEditando.especialidad.map(es => es._id)
          : [],
      });
      setFieldErrors({});
      setError("");
    } else {
      // Creación: valores por defecto; si rolUsuario es coordinador, prefill poliza
      const defaultPoliza =
        rolUsuario === "coordinador" && polizaUsuarioId
          ? polizaUsuarioId
          : "";
      setFormData({
        nombre: "",
        apellido_paterno: "",
        apellido_materno: "",
        correo: "",
        contraseña: "",
        telefono: "",
        estado: "Activo",
        rol: "Auxiliar",
        poliza: defaultPoliza,
        especialidad: [],
      });
      setFieldErrors({});
      setError("");
    }
  }, [isOpen, colaboradorEditando, rolUsuario, polizaUsuarioId]);

  // Filtrar especialidades por póliza seleccionada
  useEffect(() => {
    const fetchEspecialidadesPorPoliza = async () => {
      if (formData.poliza) {
        try {
          const response = await api.get(`/especialidades?polizaId=${formData.poliza}`);
          setEspecialidadesFiltradas(response.data);

          // Si hay especialidades previamente seleccionadas y se cambia la póliza
          if (formData.especialidad.length > 0) {
            // Verificar si las especialidades actuales pertenecen a la nueva póliza
            const especialidadesValidas = formData.especialidad.filter(espId =>
              response.data.some((esp: any) => esp._id === espId)
            );

            // Si algunas especialidades no son válidas para la nueva póliza
            if (especialidadesValidas.length !== formData.especialidad.length) {
              setFormData(prev => ({
                ...prev,
                especialidad: especialidadesValidas
              }));
            }
          }

          setCarruselEspecialidadesIndex(0);
        } catch (error) {
          console.error('Error al obtener especialidades filtradas:', error);
          setEspecialidadesFiltradas([]);
        }
      } else {
        // Sin póliza asignada - mostrar todas las especialidades disponibles
        try {
          const response = await api.get('/especialidades');
          setEspecialidadesFiltradas(response.data);
          setCarruselEspecialidadesIndex(0);
        } catch (error) {
          console.error('Error al obtener todas las especialidades:', error);
          setEspecialidadesFiltradas([]);
        }
      }
    };

    fetchEspecialidadesPorPoliza();
  }, [formData.poliza]);

  // Filtrar pólizas para coordinadores
  useEffect(() => {
    if (rolUsuario === "coordinador" && polizaUsuarioId) {
      // Solo mostrar la póliza asignada al coordinador cuando el coordinador está creando/editando
      const polizaCoordinador = polizas.filter(poliza => poliza._id === polizaUsuarioId);
      setPolizasFiltradas(polizaCoordinador);
    } else {
      // Para admin y otros roles, mostrar todas las pólizas (incluso cuando admin edita coordinadores)
      setPolizasFiltradas(polizas);
    }
  }, [rolUsuario, polizaUsuarioId, polizas]);

  // ===== FUNCIONES PARA SISTEMA DE PASOS =====
  const siguientePaso = () => {
    if (pasoActual < TOTAL_PASOS) {
      const nuevoPaso = pasoActual + 1;
      setPasoActual(nuevoPaso);

      // Si llega al paso 3 (Pólizas) en modo edición, posicionar carrusel en póliza asignada
      if (nuevoPaso === 3 && colaboradorEditando && formData.poliza) {
        const indicePoliza = polizasFiltradas.findIndex(poliza => poliza._id === formData.poliza);
        if (indicePoliza >= 0) {
          setCarruselIndex(indicePoliza);
        }
      }

      // Si llega al paso 4 (Especialidades) en modo edición, posicionar carrusel en especialidades asignadas
      if (nuevoPaso === 4 && colaboradorEditando && formData.especialidad.length > 0) {
        const primeraEspecialidad = formData.especialidad[0];
        const indiceEspecialidad = especialidades.findIndex(esp => esp._id === primeraEspecialidad);
        if (indiceEspecialidad >= 0) {
          setCarruselEspecialidadesIndex(Math.floor(indiceEspecialidad / ESPECIALIDADES_POR_PAGINA) * ESPECIALIDADES_POR_PAGINA);
        }
      }
    }
  };

  const pasoAnterior = () => {
    if (pasoActual > 1) {
      setPasoActual(prev => prev - 1);
    }
  };

  const irAPaso = (paso: number) => {
    if (paso >= 1 && paso <= TOTAL_PASOS) {
      setPasoActual(paso);

      // Si va al paso 3 (Pólizas) en modo edición, asegurar que el carrusel esté en la póliza correcta
      if (paso === 3 && colaboradorEditando && formData.poliza) {
        const indicePoliza = polizasFiltradas.findIndex(poliza => poliza._id === formData.poliza);
        if (indicePoliza >= 0) {
          setCarruselIndex(indicePoliza);
        }
      }

      // Si va al paso 4 (Especialidades) en modo edición, asegurar que el carrusel esté en las especialidades correctas
      if (paso === 4 && colaboradorEditando && formData.especialidad.length > 0) {
        const primeraEspecialidad = formData.especialidad[0];
        const indiceEspecialidad = especialidades.findIndex(esp => esp._id === primeraEspecialidad);
        if (indiceEspecialidad >= 0) {
          setCarruselEspecialidadesIndex(Math.floor(indiceEspecialidad / ESPECIALIDADES_POR_PAGINA) * ESPECIALIDADES_POR_PAGINA);
        }
      }
    }
  };

  // Función para mostrar/ocultar contraseña
  const togglePassword = () => {
    setShowPassword(!showPassword);
  };

  // ===== FUNCIONES PARA CARRUSEL DE PÓLIZAS =====
  const irAnteriorPoliza = () => {
    setCarruselIndex(prev => prev > 0 ? prev - 1 : Math.max(0, polizasFiltradas.length - POLIZAS_POR_PAGINA));
  };

  const irSiguientePoliza = () => {
    setCarruselIndex(prev => prev < polizasFiltradas.length - POLIZAS_POR_PAGINA ? prev + 1 : 0);
  };

  const seleccionarPoliza = (polizaId: string) => {
    setFormData(prev => ({
      ...prev,
      poliza: polizaId,
      especialidad: prev.especialidad // Mantener especialidades seleccionadas
    }));
    // Limpiar error de póliza si existe
    setFieldErrors(prev => {
      const { poliza: omit, ...rest } = prev;
      return rest;
    });
  };

  // ===== FUNCIONES PARA CARRUSEL DE ESPECIALIDADES =====
  const irAnteriorEspecialidad = () => {
    setCarruselEspecialidadesIndex(prev => prev > 0 ? prev - 1 : Math.max(0, especialidadesFiltradas.length - ESPECIALIDADES_POR_PAGINA));
  };

  const irSiguienteEspecialidad = () => {
    setCarruselEspecialidadesIndex(prev => prev < especialidadesFiltradas.length - ESPECIALIDADES_POR_PAGINA ? prev + 1 : 0);
  };

  const seleccionarEspecialidad = (especialidadId: string) => {
    const current = Array.isArray(formData.especialidad)
      ? [...formData.especialidad]
      : [];
    const idx = current.findIndex(id => id === especialidadId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(especialidadId);
    }
    setFormData(prev => ({ ...prev, especialidad: current }));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
      // Forzar que el rol siempre sea "Auxiliar" para colaboradores
      rol: "Auxiliar"
    }));
  };

  const validateFields = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    const hasSymbols = (text: string) => /[!@#$%^&*(),.?":{}|<>]/.test(text);

    if (!formData.nombre.trim()) {
      newErrors.nombre = "Nombre requerido.";
    } else if (hasSymbols(formData.nombre)) {
      newErrors.nombre = "No uses símbolos.";
    }

    if (!formData.apellido_paterno.trim()) {
      newErrors.apellido_paterno = "Apellido paterno requerido.";
    } else if (hasSymbols(formData.apellido_paterno)) {
      newErrors.apellido_paterno = "No uses símbolos.";
    }

    if (!formData.apellido_materno.trim()) {
      newErrors.apellido_materno = "Apellido materno requerido.";
    } else if (hasSymbols(formData.apellido_materno)) {
      newErrors.apellido_materno = "No uses símbolos.";
    }

    if (!formData.correo.trim()) {
      newErrors.correo = "Correo requerido.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.correo)) {
      newErrors.correo = "Correo inválido.";
    }

    if (!colaboradorEditando && !formData.contraseña) {
      newErrors.contraseña = "Contraseña es obligatoria.";
    } else if (formData.contraseña && formData.contraseña.length < 6) {
      newErrors.contraseña = "Contraseña debe tener al menos 6 caracteres.";
    }

    if (!formData.telefono.match(/^\d{10}$/)) {
      newErrors.telefono = "Debe tener 10 dígitos.";
    }

    // Validación de póliza obligatoria
    if (!formData.poliza) {
      newErrors.poliza = "Debe seleccionar una póliza.";
    }

    // Validación de especialidad obligatoria
    if (!Array.isArray(formData.especialidad) || formData.especialidad.length === 0) {
      newErrors.especialidad = "Debe seleccionar al menos una especialidad.";
    }

    setFieldErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!validateFields()) {
      toast.warning("Corrige los campos marcados.");
      return;
    }
    try {
      const payload: any = {
        nombre: formData.nombre.trim(),
        apellido_paterno: formData.apellido_paterno.trim(),
        apellido_materno: formData.apellido_materno.trim(),
        correo: formData.correo.trim(),
        telefono: formData.telefono.trim(),
        estado: colaboradorEditando ? formData.estado : "Activo", // Nuevos colaboradores siempre "Activo"
        rol: formData.rol,
        poliza: formData.poliza, // Póliza obligatoria
        especialidad:
          Array.isArray(formData.especialidad) && formData.especialidad.length > 0
            ? formData.especialidad
            : [],
      };
      if (!colaboradorEditando) {
        payload.contraseña = formData.contraseña;
      } else if (formData.contraseña) {
        payload.contraseña = formData.contraseña;
      }
      // Solo forzar la póliza del coordinador cuando el coordinador está creando nuevos colaboradores
      // Si es admin editando, respetar la póliza seleccionada en el formulario
      if (rolUsuario === "coordinador" && polizaUsuarioId && !colaboradorEditando) {
        payload.poliza = polizaUsuarioId;
      }
      if (colaboradorEditando && colaboradorEditando._id) {
        await api.put(`/colaboradores/${colaboradorEditando._id}`, payload);
        toast.success("Colaborador actualizado.");
        await onSuccess();
      } else {
        // Usar la función crearColaborador del hook si está disponible, sino usar API directamente
        if (crearColaborador) {
          const resultado = await crearColaborador(payload);
          if (resultado.success) {
            await onSuccess(resultado.data);
          }
        } else {
          const response = await api.post("/colaboradores", payload);
          toast.success("Colaborador creado.");
          await onSuccess(response.data);
        }
      }
    } catch (err: any) {
      console.error("Error al guardar colaborador:", err);
      const msg = err?.response?.data?.message || "Error en el servidor";
      setError(msg);
    }
  };

  // Función para obtener el título del paso actual
  const getTituloPaso = () => {
    switch (pasoActual) {
      case 1: return "Datos Personales";
      case 2: return "Datos de Contacto";
      case 3: return "Asignación de Póliza";
      case 4: return "Especialidades";
      default: return "";
    }
  };

  if (!isOpen) return null;

  const renderPasoActual = () => {
    switch (pasoActual) {
      case 1: // Datos Personales
        return (
          <>
            <div className="form-group">
              <label>Nombre:</label>
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                className={fieldErrors.nombre ? "input-error" : ""}
                placeholder="Ingrese el nombre"
              />
              {fieldErrors.nombre && <span className="mensaje-error-poliza">{fieldErrors.nombre}</span>}
            </div>

            <div className="form-group">
              <label>Apellido Paterno:</label>
              <input
                type="text"
                name="apellido_paterno"
                value={formData.apellido_paterno}
                onChange={handleChange}
                className={fieldErrors.apellido_paterno ? "input-error" : ""}
                placeholder="Ingrese el apellido paterno"
              />
              {fieldErrors.apellido_paterno && <span className="mensaje-error-poliza">{fieldErrors.apellido_paterno}</span>}
            </div>

            <div className="form-group">
              <label>Apellido Materno:</label>
              <input
                type="text"
                name="apellido_materno"
                value={formData.apellido_materno}
                onChange={handleChange}
                className={fieldErrors.apellido_materno ? "input-error" : ""}
                placeholder="Ingrese el apellido materno"
              />
              {fieldErrors.apellido_materno && <span className="mensaje-error-poliza">{fieldErrors.apellido_materno}</span>}
            </div>
          </>
        );

      case 2: // Datos de Contacto
        return (
          <>
            <div className="form-group">
              <label>Correo:</label>
              <input
                type="email"
                name="correo"
                value={formData.correo}
                onChange={handleChange}
                className={fieldErrors.correo ? "input-error" : ""}
                placeholder="Ingrese el correo electrónico"
              />
              {fieldErrors.correo && <span className="mensaje-error-poliza">{fieldErrors.correo}</span>}
            </div>

            <div className="form-group">
              <label>Teléfono:</label>
              <input
                type="text"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                className={fieldErrors.telefono ? "input-error" : ""}
                placeholder="Ingrese el teléfono"
              />
              {fieldErrors.telefono && <span className="mensaje-error-poliza">{fieldErrors.telefono}</span>}
            </div>

            {!colaboradorEditando && (
              <div className="form-group">
                <label>Contraseña:</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="contraseña"
                    value={formData.contraseña}
                    onChange={handleChange}
                    className={fieldErrors.contraseña ? "input-error" : ""}
                    placeholder="Ingrese la contraseña"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className={`toggle-password ${showPassword ? 'fas fa-eye-slash active' : 'fas fa-eye'}`}
                    onClick={togglePassword}
                    aria-label="Mostrar/ocultar contraseña"
                  />
                </div>
                {fieldErrors.contraseña && <span className="mensaje-error-poliza">{fieldErrors.contraseña}</span>}
              </div>
            )}

            {colaboradorEditando && (
              <div className="form-group">
                <label>Nueva Contraseña (opcional):</label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    name="contraseña"
                    value={formData.contraseña}
                    onChange={handleChange}
                    className={fieldErrors.contraseña ? "input-error" : ""}
                    placeholder="Ingrese la nueva contraseña"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className={`toggle-password ${showPassword ? 'fas fa-eye-slash active' : 'fas fa-eye'}`}
                    onClick={togglePassword}
                    aria-label="Mostrar/ocultar contraseña"
                  />
                </div>
                {fieldErrors.contraseña && <span className="mensaje-error-poliza">{fieldErrors.contraseña}</span>}
              </div>
            )}
          </>
        );

      case 3: // Asignación de Póliza
        return (
          <>
            {/* Carrusel de pólizas */}
            <div className="form-group">
              <label>Póliza Asignada:</label>
              {rolUsuario === "coordinador" && (
                <div className="mensaje-info" style={{ marginBottom: '10px' }}>
                  <i className="bi bi-info-circle"></i>
                  <span> Solo puedes asignar colaboradores a tu póliza</span>
                </div>
              )}
              {polizasFiltradas.length === 0 ? (
                <div className="mensaje-info">
                  <i className="bi bi-exclamation-triangle"></i>
                  <span>No hay pólizas disponibles</span>
                </div>
              ) : (
                <div className="polizas-carrusel">
                  <div className="carrusel-navegacion">
                    <button
                      type="button"
                      className="pagination-btn prev"
                      onClick={irAnteriorPoliza}
                      disabled={carruselIndex === 0}
                      title="Poliza anterior"
                    >
                      <i className="bi bi-chevron-left"></i>
                    </button>

                    <div className="carrusel-poliza-contenido">
                      {/* Mostrar solo las pólizas disponibles */}
                      {(() => {
                        const currentSlice = polizasFiltradas.slice(carruselIndex, carruselIndex + POLIZAS_POR_PAGINA);

                        return currentSlice.map((poliza) => (
                          <div
                            key={poliza._id}
                            className={`poliza-card ${formData.poliza === poliza._id ? 'poliza-selected' : ''}`}
                            onClick={() => seleccionarPoliza(poliza._id)}
                          >
                            <i className="bi bi-shield-check"></i>
                            <span>{poliza.nombre}</span>
                            {formData.poliza === poliza._id && (
                              <i className="bi bi-check-circle-fill poliza-check"></i>
                            )}
                          </div>
                        ));
                      })()}
                    </div>

                    <button
                      type="button"
                      className="pagination-btn next"
                      onClick={irSiguientePoliza}
                      disabled={carruselIndex + POLIZAS_POR_PAGINA >= (polizasFiltradas.length + (rolUsuario?.toLowerCase() === "admin" ? 1 : 0))} // +1 solo para admin
                      title="Poliza siguiente"
                    >
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>
                </div>
              )}
              {fieldErrors.poliza && <span className="mensaje-error-poliza">{fieldErrors.poliza}</span>}
            </div>
          </>
        );

      case 4: // Especialidades
        return (
          <>
            {/* Rol oculto - siempre será "Auxiliar" para colaboradores */}
            <input type="hidden" name="rol" value="Auxiliar" />

            {/* Carrusel de especialidades - Siempre visible */}
            <div className="form-group">
              <label>Especialidades:</label>

              {especialidadesFiltradas.length === 0 ? (
                <div className="mensaje-info">
                  <i className="bi bi-info-circle"></i>
                  <span> No hay especialidades disponibles para esta póliza</span>
                </div>
              ) : (
                <>
                  <div className="polizas-carrusel">
                    <div className="carrusel-navegacion">
                      <button
                        type="button"
                        className="pagination-btn prev"
                        onClick={irAnteriorEspecialidad}
                        disabled={carruselEspecialidadesIndex === 0}
                        title="Especialidades anteriores"
                      >
                        <i className="bi bi-chevron-left"></i>
                      </button>

                      <div className="carrusel-poliza-contenido">
                        {especialidadesFiltradas.slice(carruselEspecialidadesIndex, carruselEspecialidadesIndex + ESPECIALIDADES_POR_PAGINA).map((especialidad) => (
                          <div
                            key={especialidad._id}
                            className={`poliza-card ${formData.especialidad.includes(especialidad._id) ? 'poliza-selected' : ''}`}
                            onClick={() => seleccionarEspecialidad(especialidad._id)}
                          >
                            <i className="bi bi-cpu"></i>
                            <span>{especialidad.nombre}</span>
                            {formData.especialidad.includes(especialidad._id) && (
                              <i className="bi bi-check-circle-fill poliza-check"></i>
                            )}
                          </div>
                        ))}
                      </div>

                      <button
                        type="button"
                        className="pagination-btn next"
                        onClick={irSiguienteEspecialidad}
                        disabled={carruselEspecialidadesIndex + ESPECIALIDADES_POR_PAGINA >= especialidadesFiltradas.length}
                        title="Especialidades siguientes"
                      >
                        <i className="bi bi-chevron-right"></i>
                      </button>
                    </div>
                  </div>
                </>
              )}
              {fieldErrors.especialidad && <span className="mensaje-error-poliza">{fieldErrors.especialidad}</span>}
            </div>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <div className="modal-overlay-coordinadores">
      <div className="modal-content-coordinadores with-steps">
        <button className="modal-close" onClick={onClose}>
          ×
        </button>

        <div className="modal-title" style={{ fontWeight: 'bold' }}>
          {colaboradorEditando && colaboradorEditando._id
            ? "Editar Colaborador"
            : "Registrar Nuevo Colaborador"}
        </div>

        {/* Título del paso */}
        <div className="step-title">{getTituloPaso()}</div>
        <div className="step-info">{pasoActual} de {TOTAL_PASOS}</div>

        {/* Navegación de pasos con flechas a los lados del contenido */}
        <div className="step-navigation-container">
          {/* Flecha izquierda */}
          <button
            type="button"
            className="pagination-btn prev"
            onClick={pasoAnterior}
            disabled={pasoActual === 1}
            title="Paso anterior"
          >
            <i className="bi bi-chevron-left"></i>
          </button>

          {/* Contenido del paso actual */}
          <div className="step-content">
            <form onSubmit={handleSubmit}>
              {renderPasoActual()}
            </form>
          </div>

          {/* Flecha derecha */}
          <button
            type="button"
            className="pagination-btn next"
            onClick={siguientePaso}
            disabled={pasoActual === TOTAL_PASOS}
            title="Siguiente paso"
          >
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>

        {/* Indicadores de pasos (círculos pequeños) - POSICIÓN FIJA */}
        <div className="step-indicators-coordinadores">
          {Array.from({ length: TOTAL_PASOS }, (_, index) => (
            <button
              key={index + 1}
              type="button"
              className={`step-indicator ${pasoActual === index + 1 ? 'active' : ''}`}
              onClick={() => irAPaso(index + 1)}
              title={`Ir al paso ${index + 1}`}
            />
          ))}
        </div>

        {/* Botones de acción del modal - POSICIÓN FIJA */}
        <div className="modal-buttons-coordinadores">
          <button
            type="button"
            className="modal-btn modal-btn-cancelar"
            onClick={onClose}
          >
            <i className="bi bi-x-circle"></i>
            Cancelar
          </button>
          <button
            type="button"
            className="modal-btn modal-btn-confirmar-poliza"
            onClick={(e) => {
              e.preventDefault();
              const form = document.querySelector('form');
              if (form) {
                const submitEvent = new Event('submit', { bubbles: true, cancelable: true });
                form.dispatchEvent(submitEvent);
              }
            }}
          >
            <i className="bi bi-check-circle"></i>
            {colaboradorEditando ? "Actualizar" : "Registrar"}
          </button>
        </div>

        {error && (
          <p className="error" style={{ color: "red", textAlign: "center", marginTop: "10px" }}>
            {error}
          </p>
        )}
      </div>
    </div>
  );
};

export default CrearColaboradorModal;