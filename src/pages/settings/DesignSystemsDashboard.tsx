import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Palette, Clock, FileText } from 'lucide-react';
import DashboardShell from '../../components/DashboardShell';
import SidebarNav from '../../components/SidebarNav';
import { designSystemService, DesignSystem } from '../../services/designSystemService';

export default function DesignSystemsDashboard() {
    const [designSystems, setDesignSystems] = useState<DesignSystem[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const fetchDesignSystems = async () => {
            setLoading(true);
            try {
                const fetched = await designSystemService.getAllDesignSystems();
                setDesignSystems(fetched);
            } catch (error) {
                console.error("Failed to fetch design systems:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDesignSystems();
    }, []);

    return (
        <DashboardShell
            headerTitle="Design Systems Management"
            sidebarContent={<SidebarNav />}
        >
            <div className="bg-[#F0F0F3] -m-8 p-6 min-h-[calc(100vh-64px)]">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header Section */}
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-serif font-bold text-[#101010] flex items-center gap-3">
                                <Palette className="text-[#B7EF02]" size={32} />
                                Design Systems Repository
                            </h1>
                            <p className="text-[#727272] mt-1">Manage global styling rules, tokens, and visual configurations.</p>
                        </div>
                        <button
                            onClick={() => navigate('/settings/design-systems/new')}
                            className="bg-[#B7EF02] text-[#101010] px-5 py-2.5 rounded-full font-bold shadow-sm hover:shadow-md hover:bg-[#a3d602] transition-all flex items-center gap-2"
                        >
                            <Plus size={20} />
                            Create New Design System
                        </button>
                    </div>

                    {/* Rules Grid */}
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B7EF02]"></div>
                        </div>
                    ) : designSystems.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-gray-200">
                            <FileText className="mx-auto text-gray-400 mb-3" size={40} />
                            <h3 className="text-lg font-medium text-gray-900 mb-1">No design systems found</h3>
                            <p className="text-gray-500 text-sm">Create your first design system to get started.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {designSystems.map(ds => (
                                <div
                                    key={ds.id}
                                    onClick={() => navigate(`/settings/design-systems/${ds.id}`)}
                                    className="bg-white rounded-lg p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group hover:border-[#B7EF02]/50"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-bold text-lg text-[#101010] group-hover:text-brand-lime transition-colors line-clamp-1" title={ds.title}>
                                            {ds.title}
                                        </h3>
                                    </div>
                                    <p className="text-sm text-gray-500 line-clamp-2 mb-4 font-mono">
                                        {ds.content}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-auto pt-4 border-t border-gray-50">
                                        <Clock size={12} />
                                        <span>Updated {ds.updatedAt?.toDate().toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
