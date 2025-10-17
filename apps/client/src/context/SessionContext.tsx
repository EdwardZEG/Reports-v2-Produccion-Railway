import React, { createContext, useContext, useState, ReactNode } from 'react';

interface SessionContextType {
    isSessionExpired: boolean;
    setIsSessionExpired: (expired: boolean) => void;
    suppressAlerts: boolean;
    setSuppressAlerts: (suppress: boolean) => void;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

export const SessionProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [isSessionExpired, setIsSessionExpired] = useState(false);
    const [suppressAlerts, setSuppressAlerts] = useState(false);

    return (
        <SessionContext.Provider value={{
            isSessionExpired,
            setIsSessionExpired,
            suppressAlerts,
            setSuppressAlerts
        }}>
            {children}
        </SessionContext.Provider>
    );
};

export const useSession = () => {
    const context = useContext(SessionContext);
    if (context === undefined) {
        throw new Error('useSession must be used within a SessionProvider');
    }
    return context;
};