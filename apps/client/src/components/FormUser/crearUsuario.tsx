import { useState, useEffect } from "react";
import "./crearUsuario.css";
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

export interface Encargado {
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
  onSuccess: (colaboradorCreado?: Encargado) => void; // Modificado para pasar el colaborador creado
  polizas: PolizaShort[];
  especialidades: EspecialidadShort[];
  rolUsuario?: string;          // 'admin' o 'coordinador'
  polizaUsuarioId?: string;     // en caso de coordinador
  colaboradorEditando?: Encargado;
}

const CrearColaboradorModal: React.FC<CrearColaboradorModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  polizas,
  especialidades,
  rolUsuario,
  polizaUsuarioId,
  colaboradorEditando
}) => {
  const [formData, setFormData] = useState({
    nombre: "",
    apellido_paterno: "",
    apellido_materno: "",
    correo: "",
    contraseña: "",
    telefono: "",
    estado: "Activo",
    rol: "Encargado",
    poliza: "",
    especialidad: [] as string[],
  });

  const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
  const [error, setError] = useState<string>("");

  // Inicializar o resetear form cuando cambie colaboradorEditando o rolUsuario/polizaUsuarioId
  useEffect(() => {
    if (!isOpen) return;
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
        rol: colaboradorEditando.rol || "Encargado",
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
        rol: "Encargado",
        poliza: defaultPoliza,
        especialidad: [],
      });
      setFieldErrors({});
      setError("");
    }
  }, [isOpen, colaboradorEditando, rolUsuario, polizaUsuarioId]);

  if (!isOpen) return null;

  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLDivElement).classList.contains("modal-overlay-crear-usuario")) {
      onClose();
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleCheckboxChange = (espId: string) => {
    const current = Array.isArray(formData.especialidad)
      ? [...formData.especialidad]
      : [];
    const idx = current.findIndex(id => id === espId);
    if (idx >= 0) {
      current.splice(idx, 1);
    } else {
      current.push(espId);
    }
    setFormData(prev => ({ ...prev, especialidad: current }));
  };

  const validateFields = (): boolean => {
    const newErrors: { [key: string]: string } = {};
    const hasSymbols = (text: string) =>
      /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/.test(text);

    if (!formData.nombre.trim()) {
      newErrors.nombre = "Requerido.";
    } else if (hasSymbols(formData.nombre)) {
      newErrors.nombre = "No uses símbolos.";
    }
    if (formData.apellido_paterno && hasSymbols(formData.apellido_paterno)) {
      newErrors.apellido_paterno = "No uses símbolos.";
    }
    if (formData.apellido_materno && hasSymbols(formData.apellido_materno)) {
      newErrors.apellido_materno = "No uses símbolos.";
    }
    if (!formData.correo.trim()) {
      newErrors.correo = "Requerido.";
    }
    if (!colaboradorEditando) {
      // creación: contraseña obligatoria
      if (!formData.contraseña || formData.contraseña.length < 8) {
        newErrors.contraseña = "Debe tener al menos 8 caracteres.";
      }
    } else {
      // edición: si hay contraseña, validar longitud
      if (formData.contraseña && formData.contraseña.length < 8) {
        newErrors.contraseña = "Debe tener al menos 8 caracteres.";
      }
    }
    if (formData.telefono) {
      if (!/^\d{10}$/.test(formData.telefono)) {
        newErrors.telefono = "Debe tener 10 dígitos numéricos.";
      }
    }
    // Póliza: si admin, puede dejar vacío o elegir; si coordinador, automáticamente forzado en submit
    // Especialidad: opcional, se envía null o array
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
      // Construir payload
      const payload: any = {
        nombre: formData.nombre.trim(),
        apellido_paterno: formData.apellido_paterno.trim(),
        apellido_materno: formData.apellido_materno.trim(),
        correo: formData.correo.trim(),
        telefono: formData.telefono.trim(),
        estado: formData.estado,
        rol: formData.rol,
        poliza: formData.poliza || null,
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
      // Forzar póliza si es coordinador
      if (rolUsuario === "coordinador" && polizaUsuarioId) {
        payload.poliza = polizaUsuarioId;
      }
      if (colaboradorEditando && colaboradorEditando._id) {
        // Edición
        await api.put(`/colaboradores/${colaboradorEditando._id}`, payload);
        toast.success("Colaborador actualizado.");
      } else {
        // Creación
        const response = await api.post("/colaboradores", payload);
        toast.success("Colaborador creado.");
        onSuccess(response.data); // Pasar el colaborador creado
      }
      if (colaboradorEditando) {
        onSuccess(); // Para ediciones, no pasamos datos
      }
    } catch (err: any) {
      console.error("Error al guardar colaborador:", err);
      const msg = err?.response?.data?.message || "Error en el servidor";
      setError(msg);
    }
  };

  return (
    <div
      className="modal-overlay-crear-usuario"
      onClick={handleOverlayClick}
    >
      <div className="modal-content-crear-usuario">
        <div className="register-logo">
          <h3>
            {colaboradorEditando && colaboradorEditando._id
              ? "Editar colaborador"
              : "Crear colaborador"}
          </h3>
        </div>
        <div className="form-container">
          <form onSubmit={handleSubmit}>
            <label>
              Nombre
              <input
                type="text"
                name="nombre"
                value={formData.nombre}
                onChange={handleChange}
                className={fieldErrors.nombre ? "input-error" : ""}
                required
              />
              {fieldErrors.nombre && (
                <span className="error-text">{fieldErrors.nombre}</span>
              )}
            </label>
            <label>
              Apellido paterno
              <input
                type="text"
                name="apellido_paterno"
                value={formData.apellido_paterno}
                onChange={handleChange}
                className={fieldErrors.apellido_paterno ? "input-error" : ""}
                required
              />
              {fieldErrors.apellido_paterno && (
                <span className="error-text">
                  {fieldErrors.apellido_paterno}
                </span>
              )}
            </label>
            <label>
              Apellido materno
              <input
                type="text"
                name="apellido_materno"
                value={formData.apellido_materno}
                onChange={handleChange}
                className={fieldErrors.apellido_materno ? "input-error" : ""}
              />
              {fieldErrors.apellido_materno && (
                <span className="error-text">
                  {fieldErrors.apellido_materno}
                </span>
              )}
            </label>
            <label>
              Correo
              <input
                type="email"
                name="correo"
                value={formData.correo}
                onChange={handleChange}
                className={fieldErrors.correo ? "input-error" : ""}
                required
              />
              {fieldErrors.correo && (
                <span className="error-text">{fieldErrors.correo}</span>
              )}
            </label>
            {!colaboradorEditando && (
              <label>
                Contraseña
                <input
                  type="password"
                  name="contraseña"
                  value={formData.contraseña}
                  onChange={handleChange}
                  className={fieldErrors.contraseña ? "input-error" : ""}
                  required
                />
                {fieldErrors.contraseña && (
                  <span className="error-text">
                    {fieldErrors.contraseña}
                  </span>
                )}
              </label>
            )}
            {colaboradorEditando && (
              <label>
                Nueva contraseña (opcional)
                <input
                  type="password"
                  name="contraseña"
                  value={formData.contraseña}
                  onChange={handleChange}
                  className={fieldErrors.contraseña ? "input-error" : ""}
                />
                {fieldErrors.contraseña && (
                  <span className="error-text">
                    {fieldErrors.contraseña}
                  </span>
                )}
              </label>
            )}
            <label>
              Teléfono
              <input
                type="tel"
                name="telefono"
                value={formData.telefono}
                onChange={handleChange}
                className={fieldErrors.telefono ? "input-error" : ""}
              />
              {fieldErrors.telefono && (
                <span className="error-text">{fieldErrors.telefono}</span>
              )}
            </label>
            <label>
              Póliza
              <select
                name="poliza"
                value={formData.poliza}
                onChange={handleChange}
                disabled={rolUsuario === "coordinador"}
              >
                <option value="">Selecciona una póliza</option>
                {polizas.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.nombre}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Especialidades:</legend>
              {especialidades.map((es) => (
                <label key={es._id} style={{ display: "block" }}>
                  <input
                    type="checkbox"
                    checked={
                      Array.isArray(formData.especialidad) &&
                      formData.especialidad.includes(es._id)
                    }
                    onChange={() => handleCheckboxChange(es._id)}
                  />{" "}
                  {es.nombre}
                </label>
              ))}
            </fieldset>
            <label>
              Estado
              <select
                name="estado"
                value={formData.estado}
                onChange={handleChange}
              >
                <option value="Activo">Activo</option>
                <option value="Inactivo">Inactivo</option>
              </select>
            </label>
            <label>
              Rol
              <select
                name="rol"
                value={formData.rol}
                onChange={handleChange}
                disabled={rolUsuario === "coordinador"}
              >
                <option value="Encargado">Encargado</option>
                <option value="Auxiliar">Auxiliar</option>
              </select>
            </label>

            {error && (
              <p className="error" style={{ color: "red" }}>
                {error}
              </p>
            )}

            <div className="modal-buttons">
              <button type="submit" className="register-button">
                {colaboradorEditando && colaboradorEditando._id
                  ? "Guardar"
                  : "Registrar"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="cancel-button"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CrearColaboradorModal;
