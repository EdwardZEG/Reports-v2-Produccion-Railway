/**
 * Utility function to generate API URLs that work in both development and production
 */
export const getApiUrl = (endpoint: string): string => {
    // Remove leading slash if present to avoid double slashes
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;

    if (import.meta.env.PROD) {
        // In production, use relative URLs that point to the same Railway domain
        return `/${cleanEndpoint}`;
    } else {
        // In development, use localhost:4000
        return `http://localhost:4000/${cleanEndpoint}`;
    }
};

/**
 * Get the base API URL
 */
export const getBaseApiUrl = (): string => {
    return import.meta.env.PROD ? '/api' : 'http://localhost:4000/api';
};