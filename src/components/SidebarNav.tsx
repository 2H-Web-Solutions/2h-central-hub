import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Users, CheckSquare, Bot, Briefcase, Settings } from 'lucide-react';

export default function SidebarNav() {
    const location = useLocation();

    const navItems = [
        { path: '/', label: 'Dashboard', icon: LayoutDashboard },
        { path: '/clients', label: 'Clients', icon: Users },
        { path: '/tasks', label: 'Tasks', icon: CheckSquare },
        { path: '/agents', label: 'Agents', icon: Bot },
        { path: '/projects', label: 'App Factory', icon: Briefcase },
    ];

    return (
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
        </div>
    );
}
