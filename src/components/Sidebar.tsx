import { ReactNode } from 'react';

interface SidebarProps {
    children?: ReactNode;
}

export default function Sidebar({ children }: SidebarProps) {
    return (
        <aside className="fixed left-0 top-0 h-full w-64 bg-brand-black border-r border-zinc-800">
            <div className="flex flex-col h-full">
                {/* Logo Area */}
                <div className="p-6 border-b border-zinc-800">
                    <img src="/logo.png" alt="2H Websolutions" className="h-12 w-auto" />
                    <p className="text-sm text-gray-400 mt-2 font-medium">Central Hub</p>
                </div>

                {/* Navigation Content */}
                <nav className="flex-1 overflow-y-auto p-4">
                    {children}
                </nav>

                {/* Footer Area */}
                <div className="p-4 border-t border-zinc-800 space-y-3">
                    {/* System Status */}
                    <div className="flex items-center gap-2 px-2">
                        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-xs text-emerald-500 font-medium">System Online</span>
                    </div>

                    <div>
                        <p className="text-xs text-gray-500">2H Websolutions</p>
                        <p className="text-xs text-gray-600">v1.0.0</p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
