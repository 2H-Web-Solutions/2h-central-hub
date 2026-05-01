import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, BookOpen, Clock, FileText } from 'lucide-react';
import DashboardShell from '../../components/DashboardShell';
import SidebarNav from '../../components/SidebarNav';
import { rulesService, Rule, RuleCategory } from '../../services/rulesService';

type FilterTab = 'all' | RuleCategory;

export default function RulesDashboard() {
    const [rules, setRules] = useState<Rule[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<FilterTab>('all');
    const navigate = useNavigate();

    useEffect(() => {
        const fetchRules = async () => {
            setLoading(true);
            try {
                const fetchedRules = await rulesService.getAllRules();
                setRules(fetchedRules);
            } catch (error) {
                console.error("Failed to fetch rules:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRules();
    }, []);

    const filteredRules = rules.filter(rule => 
        activeTab === 'all' ? true : rule.category === activeTab
    );

    const tabs: { id: FilterTab; label: string }[] = [
        { id: 'all', label: 'All' },
        { id: 'global', label: 'Global Rules' },
        { id: 'app', label: 'Apps' },
        { id: 'website', label: 'Websites' },
        { id: 'webshop', label: 'Webshops' }
    ];

    const getCategoryBadgeColor = (category: string) => {
        switch (category) {
            case 'global': return 'bg-purple-100 text-purple-700 border-purple-200';
            case 'app': return 'bg-blue-100 text-blue-700 border-blue-200';
            case 'website': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
            case 'webshop': return 'bg-orange-100 text-orange-700 border-orange-200';
            default: return 'bg-gray-100 text-gray-700 border-gray-200';
        }
    };

    return (
        <DashboardShell
            headerTitle="Rules Management"
            sidebarContent={<SidebarNav />}
        >
            <div className="bg-[#F0F0F3] -m-8 p-6 min-h-[calc(100vh-64px)]">
                <div className="max-w-7xl mx-auto space-y-6">
                    {/* Header Section */}
                    <div className="flex justify-between items-center">
                        <div>
                            <h1 className="text-3xl font-serif font-bold text-[#101010] flex items-center gap-3">
                                <BookOpen className="text-[#B7EF02]" size={32} />
                                Prompt & Template Repository
                            </h1>
                            <p className="text-[#727272] mt-1">Manage global AI instructions, system prompts, and structured templates.</p>
                        </div>
                        <button
                            onClick={() => navigate('/settings/rules/new')}
                            className="bg-[#B7EF02] text-[#101010] px-5 py-2.5 rounded-full font-bold shadow-sm hover:shadow-md hover:bg-[#a3d602] transition-all flex items-center gap-2"
                        >
                            <Plus size={20} />
                            Create New Rule
                        </button>
                    </div>

                    {/* Filter Tabs */}
                    <div className="flex gap-2 border-b border-gray-300 pb-px">
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2 font-medium text-sm transition-all border-b-2 ${
                                    activeTab === tab.id
                                        ? 'border-[#101010] text-[#101010]'
                                        : 'border-transparent text-gray-500 hover:text-[#101010]'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Rules Grid */}
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B7EF02]"></div>
                        </div>
                    ) : filteredRules.length === 0 ? (
                        <div className="text-center py-20 bg-white rounded-lg shadow-sm border border-gray-200">
                            <FileText className="mx-auto text-gray-400 mb-3" size={40} />
                            <h3 className="text-lg font-medium text-gray-900 mb-1">No rules found</h3>
                            <p className="text-gray-500 text-sm">There are no rules in this category yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredRules.map(rule => (
                                <div
                                    key={rule.id}
                                    onClick={() => navigate(`/settings/rules/${rule.id}`)}
                                    className="bg-white rounded-lg p-5 shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer group hover:border-[#B7EF02]/50"
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <h3 className="font-bold text-lg text-[#101010] group-hover:text-brand-lime transition-colors line-clamp-1" title={rule.title}>
                                            {rule.title}
                                        </h3>
                                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${getCategoryBadgeColor(rule.category)}`}>
                                            {rule.category}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-500 line-clamp-2 mb-4 font-mono">
                                        {rule.content}
                                    </p>
                                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-auto pt-4 border-t border-gray-50">
                                        <Clock size={12} />
                                        <span>Updated {rule.updatedAt?.toDate().toLocaleDateString()}</span>
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
