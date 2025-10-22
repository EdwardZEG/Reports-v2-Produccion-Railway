// Cache compartido para colaboradores/coordinadores
export const colaboradoresCache = new Map<string, { data: any[], timestamp: number }>();
export const CACHE_DURATION = 5000; // 5 segundos

// 🚀 Función para invalidar TODO el cache de colaboradores
export const invalidarCacheColaboradores = () => {
    console.log('💥 [CACHE] Invalidando COMPLETAMENTE el cache de colaboradores...');
    colaboradoresCache.clear();
    console.log('✅ [CACHE] Cache completamente limpio');
};