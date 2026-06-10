import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CheckSquare, Bot, Briefcase, Settings, LogOut, BookOpen, Palette, Globe } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function SidebarNav() {
    const location = useLocation();
    const { logout } = useAuth();

    const navItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/clients', label: 'Clients', icon: Users },
        { path: '/tasks', label: 'Tasks', icon: CheckSquare },
        { path: '/agents', label: 'Agents', icon: Bot },
        { path: '/websites', label: 'Websites', icon: Globe },
        { path: '/projects', label: 'App Factory', icon: Briefcase },
    ];

    return (
        <div className="flex flex-col h-full justify-between">
            <div className="space-y-2">
                {navItems.map((item) => (
                    <Link
                        key={item.path}
                        to={item.path}
                        className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all ${location.pathname === item.path
                                ? 'text-brand-lime bg-brand-lime/10 border border-brand-lime/20'
                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        <item.icon size={18} />
                        {item.label}
                    </Link>
                ))}

                <Link
                    to="#"
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-all"
                >
                    <Settings size={18} />
                    Settings
                </Link>

                <Link
                    to="/settings/rules"
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all ${location.pathname.startsWith('/settings/rules')
                            ? 'text-brand-lime bg-brand-lime/10 border border-brand-lime/20'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <BookOpen size={18} />
                    Rules
                </Link>

                <Link
                    to="/settings/design-systems"
                    className={`flex items-center gap-3 px-4 py-2.5 rounded-xl font-medium transition-all ${location.pathname.startsWith('/settings/design-systems')
                            ? 'text-brand-lime bg-brand-lime/10 border border-brand-lime/20'
                            : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    <Palette size={18} />
                    Design Systems
                </Link>
            </div>
            
            <div className="pt-4 border-t border-gray-800">
                <button
                    onClick={logout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all font-medium"
                >
                    <LogOut size={18} />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
