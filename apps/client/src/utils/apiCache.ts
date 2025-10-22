/**
 * Sistema de cache y debounce para peticiones API
 * Previene bucles infinitos y reduce carga del servidor
 */

interface CacheEntry {
    data: any;
    timestamp: number;
    expiry: number;
}

class APICache {
    private cache = new Map<string, CacheEntry>();
    private pendingRequests = new Map<string, Promise<any>>();
    private readonly CACHE_DURATION = 5000; // 5 segundos de cache
    private readonly DEBOUNCE_TIME = 100; // 100ms debounce

    /**
     * Obtener datos del cache si están disponibles y válidos
     */
    private getCachedData(key: string): any | null {
        const entry = this.cache.get(key);
        if (!entry) return null;

        const now = Date.now();
        if (now > entry.expiry) {
            this.cache.delete(key);
            return null;
        }

        console.log(`📦 Cache hit para: ${key}`);
        return entry.data;
    }

    /**
     * Guardar datos en el cache
     */
    private setCachedData(key: string, data: any): void {
        const now = Date.now();
        this.cache.set(key, {
            data,
            timestamp: now,
            expiry: now + this.CACHE_DURATION
        });
    }

    /**
     * Ejecutar petición con cache y debounce
     */
    async executeRequest(key: string, requestFn: () => Promise<any>): Promise<any> {
        // 1. Verificar cache primero
        const cachedData = this.getCachedData(key);
        if (cachedData !== null) {
            return cachedData;
        }

        // 2. Verificar si ya hay una petición pendiente para la misma key
        const pendingRequest = this.pendingRequests.get(key);
        if (pendingRequest) {
            console.log(`⏳ Petición ya pendiente para: ${key}, esperando...`);
            return await pendingRequest;
        }

        // 3. Ejecutar nueva petición
        console.log(`🌐 Nueva petición para: ${key}`);
        const requestPromise = this.executeWithDebounce(key, requestFn);
        this.pendingRequests.set(key, requestPromise);

        try {
            const result = await requestPromise;
            this.setCachedData(key, result);
            return result;
        } finally {
            this.pendingRequests.delete(key);
        }
    }

    /**
     * Ejecutar petición con debounce
     */
    private async executeWithDebounce(_key: string, requestFn: () => Promise<any>): Promise<any> {
        await new Promise(resolve => setTimeout(resolve, this.DEBOUNCE_TIME));
        return await requestFn();
    }

    /**
     * Limpiar cache manualmente
     */
    clearCache(key?: string): void {
        if (key) {
            this.cache.delete(key);
            console.log(`🗑️ Cache eliminado para: ${key}`);
        } else {
            this.cache.clear();
            console.log('🗑️ Todo el cache eliminado');
        }
    }

    /**
     * Obtener estadísticas del cache
     */
    getStats(): { cacheSize: number; pendingRequests: number } {
        return {
            cacheSize: this.cache.size,
            pendingRequests: this.pendingRequests.size
        };
    }
}

// Instancia singleton del cache
export const apiCache = new APICache();

/**
 * Hook para usar el cache de API de manera fácil
 */
export const useCachedRequest = () => {
    return {
        executeRequest: apiCache.executeRequest.bind(apiCache),
        clearCache: apiCache.clearCache.bind(apiCache),
        getStats: apiCache.getStats.bind(apiCache)
    };
};