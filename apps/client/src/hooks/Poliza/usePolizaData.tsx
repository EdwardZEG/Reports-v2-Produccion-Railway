import { useEffect, useState } from "react";
import api from "../../api"; 
import { toast } from "react-toastify";

export interface Coordinador {
    _id: string;
    nombre: string;
    apellido_paterno: string;
    apellido_materno: string;
}

export interface Poliza {
    _id?: string;
    nombre: string;
    ubicacion: string;
    coordinador?: string | Coordinador;
    resaltado?: boolean;
}

interface UsePolizaData {
    polizas: Poliza[];
    coordinadores: Coordinador[];
    formData: {
        nombre: string;
        ubicacion: string;
        coordinador: string;
    };
    fieldErrors: { [key: string]: string };
    modoEdicion: boolean;
    mostrarModal: boolean;
    idEditando: string | null;
    error: string | null;
    setError: (v: string | null) => void;
    setIdEditando: (v: string | null) => void;
    setMostrarModal: (v: boolean) => void;
    setModoEdicion: (v: boolean) => void;
    setFormData: (v: any) => void;
    handleEditar: (p: Poliza) => void;
    handleEliminar: (id?: string) => Promise<void>;
    handleChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    handleSubmit: (e: React.FormEvent) => Promise<void>;
    formatCoordinador: (coord: string | Coordinador | undefined) => string;
}


export default function usePolizaData(): UsePolizaData {
    const [polizas, setPolizas] = useState<Poliza[]>([]);
    const [coordinadores, setCoordinadores] = useState<Coordinador[]>([]);
    const [formData, setFormData] = useState({ nombre: "", ubicacion: "", coordinador: "" });
    const [fieldErrors, setFieldErrors] = useState<{ [key: string]: string }>({});
    const [modoEdicion, setModoEdicion] = useState(false);
    const [mostrarModal, setMostrarModal] = useState(false);
    const [idEditando, setIdEditando] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [resPolizas, resCoordinadores] = await Promise.all([
                     api.get("/polizas"),
                    api.get("/coordinadores"),
                ]);
                setPolizas(resPolizas.data);
                setCoordinadores(resCoordinadores.data);
            } catch (error) {
                console.error("Error al obtener datos:", error);
                toast.error("Error al cargar los datos. Intente nuevamente.");
            }
        };
        fetchData();
    }, []);

    const contieneSimbolos = (text: string) => /[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s]/.test(text);

    const formatCoordinador = (coord: string | Coordinador | undefined): string => {
        if (!coord) return "Sin asignar";
        if (typeof coord === "object") {
            return `${coord.nombre} ${coord.apellido_paterno} ${coord.apellido_materno || ""}`.trim();
        }
        const encontrado = coordinadores.find((c) => c._id === coord);
        return encontrado ? `${encontrado.nombre} ${encontrado.apellido_paterno} ${encontrado.apellido_materno || ""}`.trim() : "Cargando...";
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const errores: { [key: string]: string } = {};
        if (!formData.nombre.trim()) errores.nombre = "El nombre es obligatorio.";
        else if (contieneSimbolos(formData.nombre)) errores.nombre = "No uses símbolos especiales.";

        if (!formData.ubicacion.trim()) errores.ubicacion = "La ubicación es obligatoria.";
        else if (contieneSimbolos(formData.ubicacion)) errores.ubicacion = "No uses símbolos especiales.";

        if (Object.keys(errores).length > 0) {
            setFieldErrors(errores);
            Object.values(errores).forEach((msg) => toast.warning(msg));
            return;
        }

        const datos = {
            nombre: formData.nombre,
            ubicacion: formData.ubicacion,
            coordinador: formData.coordinador || null,
        };

        try {
            if (modoEdicion && idEditando) {
                const res = await api.put(`/polizas/${idEditando}`, datos);
                setPolizas(polizas.map((p) => (p._id === idEditando ? res.data : p)));
            } else {
                const res = await api.post("/polizas", datos);
                setPolizas([...polizas, res.data]);
            }
            toast.success("Póliza guardada correctamente.");
            setMostrarModal(false);
            setModoEdicion(false);
            setIdEditando(null);
            setFormData({ nombre: "", ubicacion: "", coordinador: "" });
        } catch (error) {
            console.error("Error al guardar:", error);
            toast.error("Error al guardar la póliza.");
        }
    };

    const handleEditar = (p: Poliza) => {
        setFormData({
            nombre: p.nombre,
            ubicacion: p.ubicacion,
            coordinador:
                typeof p.coordinador === "object" && p.coordinador !== null
                    ? p.coordinador._id
                    : p.coordinador || "",

        });
        setIdEditando(p._id || null);
        setModoEdicion(true);
        setMostrarModal(true);
    };

    const handleEliminar = async (id?: string) => {
        if (!id) return;
        if (confirm("¿Estás seguro de que deseas eliminar esta póliza?")) {
            try {
                await api.delete(`/polizas/${id}`);
                setPolizas(polizas.filter((p) => p._id !== id));
                toast.success("Póliza eliminada correctamente.");
            } catch (error) {
                console.error("Error al eliminar la póliza:", error);
                toast.error("Error al eliminar la póliza.");
            }
        }
    };

    return {
        polizas,
        coordinadores,
        formData,
        fieldErrors,
        modoEdicion,
        mostrarModal,
        idEditando,
        error,
        setError,
        setIdEditando,
        setMostrarModal,
        setModoEdicion,
        setFormData,
        handleEditar,
        handleEliminar,
        handleChange,
        handleSubmit,
        formatCoordinador,
    };
}