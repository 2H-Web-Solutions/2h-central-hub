import { ReactNode } from 'react';
import Sidebar from './Sidebar';
import Header from './Header';

interface DashboardShellProps {
    children: ReactNode;
    headerTitle?: string;
    headerActions?: ReactNode;
    sidebarContent?: ReactNode;
}

export default function DashboardShell({
    children,
    headerTitle,
    headerActions,
    sidebarContent,
}: DashboardShellProps) {
    return (
        <div className="min-h-screen bg-brand-bg">
            {/* Sidebar */}
            <Sidebar>{sidebarContent}</Sidebar>

            {/* Main Content Area */}
            <div className="ml-64">
                {/* Header */}
                <Header title={headerTitle}>{headerActions}</Header>

                {/* Scrollable Content */}
                <main className="p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
