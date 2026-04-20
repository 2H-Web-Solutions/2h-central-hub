import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '../lib/firebase';
import toast from 'react-hot-toast';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signInWithGoogle: () => Promise<void>;
    logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({ 
    user: null, 
    loading: true,
    signInWithGoogle: async () => {},
    logout: async () => {}
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const signInWithGoogle = async () => {
        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            toast.success("Erfolgreich eingeloggt!");
        } catch (error: any) {
            console.error("Google Auth Error", error);
            toast.error(error.message || "Fehler beim Login");
        }
    };

    const logout = async () => {
        try {
            await signOut(auth);
            toast.success("Erfolgreich abgemeldet");
        } catch (error) {
            console.error("Logout error", error);
            toast.error("Fehler beim Abmelden");
        }
    };

    // While checking auth state, we can show a loader or nothing
    if (loading) {
        return <div className="min-h-screen grid place-items-center bg-[#101010] text-[#727272]">Loading System...</div>;
    }

    return (
        <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
            {children}
        </AuthContext.Provider>
    );
}
