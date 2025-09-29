/**
 * Contexto global para manejar datos compartidos entre componentes
 * Evita recargas innecesarias y optimiza el rendimiento de la aplicación
 * Implementa un patrón de cache con carga bajo demanda para colaboradores
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../api';
import { toast } from 'react-toastify';

/**
 * Interface que define la estructura de un colaborador
 * Incluye información básica del colaborador, sus especialidades y póliza asignada
 */
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

/**
 * Interface del contexto que define todas las propiedades y métodos disponibles
 * Proporciona acceso a datos de colaboradores y funciones de gestión de estado
 */
interface DataContextType {
    colaboradores: Colaborador[];          // Lista actual de colaboradores
    isColaboradoresLoading: boolean;       // Estado de carga
    reloadColaboradores: () => void;       // Fuerza recarga de datos
    loadColaboradoresIfNeeded: () => void; // Carga datos solo si es necesario
}

// Crear el contexto
const DataContext = createContext<DataContextType | undefined>(undefined);

// Provider del contexto
export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
    const [isColaboradoresLoading, setIsColaboradoresLoading] = useState(false);
    const [colaboradoresLoaded, setColaboradoresLoaded] = useState(false);

    /**
     * Función para cargar colaboradores desde el servidor
     * Implementa cache para evitar llamadas innecesarias a la API
     * Solo carga datos si no han sido cargados previamente o están vacíos
     */
    const loadColaboradores = async () => {
        if (colaboradoresLoaded && colaboradores.length > 0) {
            return; // Cache hit - ya están cargados, no recargar
        }

        setIsColaboradoresLoading(true);
        try {
            const response = await api.get("/colaboradores/");
            setColaboradores(response.data);
            setColaboradoresLoaded(true);
        } catch (error) {
            console.error('Error cargando colaboradores:', error);
            toast.error("Error al obtener colaboradores");
        } finally {
            setIsColaboradoresLoading(false);
        }
    };

    /**
     * Función para forzar la recarga de colaboradores
     * Invalida el cache y ejecuta una nueva carga desde el servidor
     * Útil después de operaciones CRUD que modifiquen los datos
     */
    const reloadColaboradores = () => {
        setColaboradoresLoaded(false);
        loadColaboradores();
    };

    /**
     * Efecto que carga colaboradores automáticamente al inicializar el contexto
     * Solo se ejecuta si existe un token de autenticación válido
     * Garantiza que los datos estén disponibles desde el primer render
     */
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            loadColaboradores();
        }
    }, []);

    const value: DataContextType = {
        colaboradores,
        isColaboradoresLoading,
        reloadColaboradores,
        loadColaboradoresIfNeeded: loadColaboradores,
    };

    return (
        <DataContext.Provider value={value}>
            {children}
        </DataContext.Provider>
    );
};

/**
 * Hook personalizado para acceder al contexto de datos
 * Proporciona una interfaz fácil y segura para usar el contexto
 * Incluye validación automática para detectar uso fuera del provider
 * @returns Objeto con todos los datos y métodos del contexto
 * @throws Error si se usa fuera de un DataProvider
 */
export const useData = (): DataContextType => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};