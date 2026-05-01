import { useState, useEffect } from 'react';
import { collection, collectionGroup, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';
import { formatAppId } from '../lib/utils';
import { Users, CheckSquare, Euro, Star, Plus, FilePlus, Share2, MessageSquare, AlertTriangle, Folder, UserPlus, CheckCircle2 } from 'lucide-react';

interface Task {
    id: string;
    title: string;
    status: string;
    createdAt: any;
    sourceAppId?: string;
}

export default function Dashboard() {
    const [stats, setStats] = useState({
        activeClients: 0,
        openTasks: 0,
        mrr: 0
    });
    const [recentTasks, setRecentTasks] = useState<Task[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // 1. Clients Listener
        const qClients = query(collection(db, 'apps', '2h_hub_v1', 'clients'));
        const unsubClients = onSnapshot(qClients, (snap) => {
            const activeCount = snap.docs.filter(d => d.data().status === 'active').length;
            setStats(prev => ({
                ...prev,
                activeClients: activeCount,
                mrr: activeCount * 1500
            }));
        });

        // 2. Tasks Listener (Open Tasks)
        const qTasks = query(collectionGroup(db, 'tasks'));
        const unsubTasks = onSnapshot(qTasks, (snap) => {
            const openCount = snap.docs.filter(doc => doc.data().status !== 'done').length;
            setStats(prev => ({
                ...prev,
                openTasks: openCount
            }));

            // 3. Recent Activity (Last 5 created tasks/events for the new UI)
            const allTasks = snap.docs.map(d => ({
                id: d.id,
                ...d.data(),
                sourceAppId: d.ref.parent.parent?.id
            } as Task));
            allTasks.sort((a, b) => {
                const tA = a.createdAt?.toMillis() || 0;
                const tB = b.createdAt?.toMillis() || 0;
                return tB - tA;
            });
            setRecentTasks(allTasks.slice(0, 5));

            setLoading(false);
        });

        return () => {
            unsubClients();
            unsubTasks();
        };
    }, []);

    return (
        <DashboardShell
            headerTitle="Dashboard"
            sidebarContent={<SidebarNav />}
        >
            {/* Welcome Section */}
            <section className="mb-10">
                <h2 className="font-serif text-5xl text-brand-black mb-2 tracking-tight">Operations Dashboard</h2>
                <p className="font-sans text-brand-text-muted max-w-2xl text-lg">High-performance management interface for the 2H Central Hub ecosystem. Real-time metrics and agent synchronization.</p>
            </section>

            {/* Bento Grid: Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
                {/* Active Clients Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-transparent hover:border-brand-lime transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <Users className="text-brand-lime w-8 h-8" />
                        <span className="bg-[#e2f89f] text-[#4f6900] text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">+12%</span>
                    </div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Active Clients</h3>
                    <p className="font-serif text-4xl text-brand-black font-bold">{loading ? '-' : stats.activeClients}</p>
                    <div className="mt-4 h-1 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-brand-lime w-[70%]"></div>
                    </div>
                </div>

                {/* Open Tasks Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-transparent hover:border-brand-lime transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <CheckSquare className="text-brand-lime w-8 h-8" />
                        <span className="bg-red-100 text-red-800 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider">High</span>
                    </div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Open Tasks</h3>
                    <p className="font-serif text-4xl text-brand-black font-bold">{loading ? '-' : stats.openTasks}</p>
                    <div className="mt-4 flex gap-1">
                        <div className="h-2 w-full bg-brand-lime rounded-full"></div>
                        <div className="h-2 w-full bg-brand-lime rounded-full"></div>
                        <div className="h-2 w-full bg-gray-100 rounded-full"></div>
                    </div>
                </div>

                {/* Monthly Revenue Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-transparent hover:border-brand-lime transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <Euro className="text-brand-lime w-8 h-8" />
                    </div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Monthly Revenue</h3>
                    <p className="font-serif text-4xl text-brand-black font-bold">{loading ? '-' : `€${(stats.mrr / 1000).toFixed(1)}k`}</p>
                    <p className="text-sm text-gray-500 mt-2 italic">Exceeding target by 4%</p>
                </div>

                {/* Client Satisfaction Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-transparent hover:border-brand-lime transition-all group">
                    <div className="flex justify-between items-start mb-4">
                        <Star className="text-brand-lime w-8 h-8" />
                    </div>
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Satisfaction</h3>
                    <p className="font-serif text-4xl text-brand-black font-bold">4.9</p>
                    <div className="mt-4 flex -space-x-2">
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 overflow-hidden flex items-center justify-center text-xs font-bold text-gray-500">SH</div>
                        <div className="w-8 h-8 rounded-full border-2 border-white bg-gray-100 overflow-hidden flex items-center justify-center text-xs font-bold text-gray-500">MK</div>
                        <div className="flex items-center justify-center w-8 h-8 rounded-full border-2 border-white bg-brand-lime text-brand-black text-[10px] font-bold">+1k</div>
                    </div>
                </div>
            </div>

            {/* Layout Row: Activity & Actions */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Recent Activities (List) */}
                <div className="lg:col-span-2 bg-white p-8 rounded-2xl shadow-sm border border-transparent">
                    <div className="flex justify-between items-center mb-8">
                        <h3 className="font-serif text-2xl text-brand-black font-bold">Recent Activities</h3>
                        <button className="text-xs font-bold text-brand-lime hover:underline transition-all uppercase tracking-widest">View All History</button>
                    </div>
                    
                    <div className="space-y-6">
                        {loading ? (
                            <p className="text-sm text-gray-400">Loading activities...</p>
                        ) : recentTasks.length > 0 ? (
                            recentTasks.map((task, index) => {
                                // Assign a random icon based on index for the mockup feel
                                const icons = [CheckCircle2, Folder, MessageSquare, AlertTriangle, UserPlus];
                                const Icon = icons[index % icons.length];
                                
                                return (
                                    <div key={task.id} className="flex gap-4 items-start pb-6 border-b border-gray-100 last:border-0 last:pb-0">
                                        <div className="w-10 h-10 rounded-full bg-gray-50 flex items-center justify-center flex-shrink-0">
                                            <Icon className="text-brand-lime w-5 h-5" />
                                        </div>
                                        <div className="flex-grow">
                                            <div className="flex items-center gap-2">
                                                <p className="text-brand-black font-medium">{task.title}</p>
                                                {task.sourceAppId && task.sourceAppId !== '2h_hub_v1' && (
                                                    <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full whitespace-nowrap uppercase tracking-wider">
                                                        {formatAppId(task.sourceAppId)}
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-sm text-gray-500">
                                                {task.createdAt ? new Date(task.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <p className="text-sm text-gray-400">No recent activity</p>
                        )}
                    </div>
                </div>

                {/* Quick Actions Sidebar */}
                <div className="bg-brand-black text-white p-8 rounded-2xl shadow-2xl flex flex-col justify-between overflow-hidden relative">
                    {/* Abstract visual element */}
                    <div className="absolute top-0 right-0 w-48 h-48 bg-brand-lime/10 blur-[50px] rounded-full translate-x-10 -translate-y-10"></div>
                    
                    <div className="relative z-10">
                        <h3 className="font-serif text-2xl text-brand-lime mb-6 font-bold">Quick Actions</h3>
                        <div className="space-y-4">
                            <button className="w-full bg-brand-lime text-brand-black font-bold text-xs tracking-widest py-4 rounded-full flex items-center justify-center gap-2 hover:brightness-110 active:scale-95 transition-all">
                                <Plus className="w-5 h-5" />
                                DEPLOY NEW AGENT
                            </button>
                            <button className="w-full border border-zinc-700 text-white font-bold text-xs tracking-widest py-4 rounded-full flex items-center justify-center gap-2 hover:bg-zinc-900 active:scale-95 transition-all">
                                <FilePlus className="w-5 h-5" />
                                CREATE TASK
                            </button>
                            <button className="w-full border border-zinc-700 text-white font-bold text-xs tracking-widest py-4 rounded-full flex items-center justify-center gap-2 hover:bg-zinc-900 active:scale-95 transition-all">
                                <Share2 className="w-5 h-5" />
                                GENERATE REPORT
                            </button>
                        </div>
                    </div>
                    
                    <div className="mt-12 p-6 bg-zinc-900/50 rounded-xl border border-zinc-800/50 relative z-10 backdrop-blur-sm">
                        <p className="text-[10px] font-bold text-zinc-500 mb-2 uppercase tracking-widest">SYSTEM STATUS</p>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-brand-lime animate-pulse shadow-[0_0_8px_rgba(183,239,2,0.6)]"></div>
                            <span className="text-sm font-bold tracking-wide">ALL SYSTEMS NOMINAL</span>
                        </div>
                        <p className="text-xs text-zinc-400 mt-2">Latency: 24ms | Uptime: 99.98%</p>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
