import { useAuth } from '../context/AuthContext';
import { Navigate } from 'react-router-dom';
import { Bot } from 'lucide-react';
import Button from '../components/Button';

export default function Login() {
    const { user, signInWithGoogle } = useAuth();

    if (user) {
        return <Navigate to="/" replace />;
    }

    return (
        <div className="min-h-screen bg-[#101010] flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl p-8 shadow-2xl border border-gray-100 flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-[#101010] rounded-2xl flex items-center justify-center mb-6 shadow-lg border border-gray-800">
                    <Bot size={32} className="text-[#B7EF02]" />
                </div>
                
                <h1 className="text-3xl font-serif font-bold text-[#101010] mb-2">2H Central Hub</h1>
                <p className="text-[#727272] mb-8">Access restricted to authorized personnel.</p>

                <Button 
                    onClick={signInWithGoogle} 
                    className="w-full flex justify-center items-center py-3 text-lg font-medium"
                >
                    Sign in with Google
                </Button>
            </div>
            
            <div className="mt-8 text-xs text-[#727272]">
                &copy; {new Date().getFullYear()} 2H Web Solutions
            </div>
        </div>
    );
}
