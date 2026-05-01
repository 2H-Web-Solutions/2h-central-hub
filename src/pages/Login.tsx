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
        <div className="min-h-screen bg-[#101010] flex flex-col items-center justify-center p-4 relative overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#B7EF02]/5 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="max-w-md w-full bg-white rounded-3xl p-10 shadow-2xl shadow-[#B7EF02]/5 border border-gray-100 flex flex-col items-center text-center relative z-10">
                <div className="w-20 h-20 bg-[#101010] rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_20px_rgba(183,239,2,0.15)] border border-[#B7EF02]/20">
                    <Bot size={40} className="text-[#B7EF02]" />
                </div>
                
                <h1 className="text-3xl font-serif font-bold text-[#101010] mb-3">2H Central Hub</h1>
                <p className="text-[#727272] mb-10 font-medium">Access restricted to authorized personnel.</p>

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
