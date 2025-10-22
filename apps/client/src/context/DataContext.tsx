/**
 * Contexto global para manejar datos compartidos entre componentes
 * Evita recargas innecesarias y optimiza el rendimiento de la aplicación
 * Implementa un patrón de cache con carga bajo demanda para colaboradores
 */
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import api from '../api';
import { toast } from 'react-toastify';
import { isTokenExpired } from '../utils/tokenUtils';

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
    invalidateColaboradoresCache: () => void; // Invalida cache y fuerza recarga
    addColaboradorToState: (colaborador: any) => void; // Agrega colaborador al estado
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
     * 🔧 MEMOIZADA para evitar loops infinitos en useEffect
     */
    const loadColaboradores = useCallback(async () => {
        // 🛡️ PROTECCIÓN ANTI-LOOP: No ejecutar si ya está cargando
        if (isColaboradoresLoading) {
            console.log('⚠️ DataContext: Ya está cargando colaboradores, saltando petición duplicada');
            return;
        }

        // Verificar si el token existe y es válido antes de hacer la petición
        const token = localStorage.getItem('token');
        if (!token || isTokenExpired(token)) {
            console.log('🔴 DataContext: Token expirado o no existe, saltando carga de colaboradores');
            return;
        }

        if (colaboradoresLoaded && colaboradores.length > 0) {
            console.log('✅ DataContext: Cache hit - colaboradores ya cargados, saltando petición');
            return; // Cache hit - ya están cargados, no recargar
        }

        console.log('🔄 DataContext: Iniciando carga de colaboradores...');
        setIsColaboradoresLoading(true);
        try {
            const response = await api.get("/colaboradores/");
            setColaboradores(response.data);
            setColaboradoresLoaded(true);
            console.log('✅ DataContext: Colaboradores cargados exitosamente:', response.data.length);
        } catch (error: any) {
            console.error('❌ DataContext: Error cargando colaboradores:', error);
            // No mostrar toast si es error de token expirado (lo maneja App.tsx)
            if (error.response?.status !== 401 || error.response?.data?.code !== 'TOKEN_EXPIRED') {
                toast.error("Error al obtener colaboradores");
            }
        } finally {
            setIsColaboradoresLoading(false);
        }
    }, [colaboradoresLoaded, colaboradores.length, isColaboradoresLoading]); // 🔧 Dependencies para memoización

    /**
     * Función para forzar la recarga de colaboradores
     * Invalida el cache y ejecuta una nueva carga desde el servidor
     * Útil después de operaciones CRUD que modifiquen los datos
     * 🔧 MEMOIZADA para evitar loops infinitos
     */
    const reloadColaboradores = useCallback(() => {
        console.log('🔄 DataContext: Forzando recarga de colaboradores...');
        setColaboradoresLoaded(false);
        loadColaboradores();
    }, [loadColaboradores]); // 🔧 Dependencies para memoización

    // 🚀 Función para invalidar cache y forzar recarga completa
    const invalidateColaboradoresCache = useCallback(() => {
        console.log('💥 DataContext: Invalidando cache de colaboradores...');
        setColaboradoresLoaded(false);
        setColaboradores([]);
        loadColaboradores();
    }, [loadColaboradores]);

    // 🎯 Función para agregar colaborador directamente al estado (optimistic update)
    const addColaboradorToState = useCallback((nuevoColaborador: any) => {
        console.log('➕ DataContext: Agregando colaborador al estado:', nuevoColaborador.nombre);
        setColaboradores(prev => {
            const existe = prev.some(c => c._id === nuevoColaborador._id);
            if (!existe) {
                console.log('✅ DataContext: Colaborador agregado al estado local');
                return [...prev, nuevoColaborador];
            }
            console.log('⚠️ DataContext: Colaborador ya existe en estado local');
            return prev;
        });
    }, []);

    /**
     * Efecto que carga colaboradores automáticamente al inicializar el contexto
     * 🚫 TEMPORALMENTE DESHABILITADO para prevenir loops infinitos
     * Los componentes que necesiten colaboradores deben usar loadColaboradoresIfNeeded() explícitamente
     */
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token && !isTokenExpired(token)) {
            console.log('� DataContext: Auto-load DESHABILITADO - componentes deben cargar explícitamente');
            // loadColaboradores(); // 🚫 DESHABILITADO TEMPORALMENTE
        } else if (token && isTokenExpired(token)) {
            console.log('🔴 DataContext: Token expirado, no cargando colaboradores');
        }
    }, []);

    const value: DataContextType = {
        colaboradores,
        isColaboradoresLoading,
        reloadColaboradores,
        loadColaboradoresIfNeeded: loadColaboradores,
        invalidateColaboradoresCache,
        addColaboradorToState,
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