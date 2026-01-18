import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { auth } from '../lib/firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (currentUser) {
                setUser(currentUser);
                setLoading(false);
            } else {
                signInAnonymously(auth).catch((error) => {
                    console.error("Anonymous auth failed", error);
                    setLoading(false);
                });
            }
        });

        return () => unsubscribe();
    }, []);

    // While checking auth state, we can show a loader or nothing
    if (loading) {
        return <div className="min-h-screen grid place-items-center bg-brand-bg text-brand-text-muted">Loading System...</div>;
    }

    return (
        <AuthContext.Provider value={{ user, loading }}>
            {children}
        </AuthContext.Provider>
    );
}
