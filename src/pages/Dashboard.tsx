import { useState, useEffect } from 'react';
import { collection, query, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Button from '../components/Button';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';

interface Task {
    id: string;
    title: string;
    status: string;
    createdAt: any;
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
        // We can do this with multiple snapshots or a single combined effect. 
        // For real-time, we need snapshots.

        // 1. Clients Listener
        const qClients = query(collection(db, 'apps', '2h_hub_v1', 'clients'));
        const unsubClients = onSnapshot(qClients, (snap) => {

            // Prompt says: "Count documents... Subscribe to clients collection"
            // Let's assume all documents in 'clients' are active or at least count them.
            // Wait, previous prompt said we have 'status' (active/onboarding). 
            // "Count documents to show 'Active Clients'". 
            // I'll filter by status == 'active' for accuracy if possible, but prompt implies simple count.
            // Let's filter client.status === 'active' if I can.
            // Actually, querying strictly by status might be better. 
            // Let's just count all for now as "Total Clients" or filter in memory since list is small.
            const activeCount = snap.docs.filter(d => d.data().status === 'active').length;

            // Update stats partially
            setStats(prev => ({
                ...prev,
                activeClients: activeCount,
                mrr: activeCount * 1500
            }));
        });

        // 2. Tasks Listener (Open Tasks)
        // status != 'done'. Firestore != query is possible? Yes.
        // But status is 'todo' | 'in_progress' | 'done'.
        // Easier to query where 'status', 'in', ['todo', 'in_progress'] OR just client-side filter if small.
        // Let's use clean query.
        const qTasks = query(collection(db, 'apps', '2h_hub_v1', 'tasks'));
        const unsubTasks = onSnapshot(qTasks, (snap) => {
            const openCount = snap.docs.filter(doc => doc.data().status !== 'done').length;
            setStats(prev => ({
                ...prev,
                openTasks: openCount
            }));

            // 3. Recent Activity (Last 3 created tasks)
            // We can re-use this snapshot if we order it? No, raw collection might not be ordered.
            // Actually, for "Recent Activity", we specifically want the LATEST tasks.
            // Managing two queries for tasks (one for count, one for list) is fine.
            // Or just sort this list client side:
            const allTasks = snap.docs.map(d => ({ id: d.id, ...d.data() } as Task));
            // Sort by createdAt desc
            allTasks.sort((a, b) => {
                const tA = a.createdAt?.toMillis() || 0;
                const tB = b.createdAt?.toMillis() || 0;
                return tB - tA;
            });
            setRecentTasks(allTasks.slice(0, 3));

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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {/* Active Clients */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
                    <h3 className="text-lg font-serif font-bold tracking-tight text-brand-black mb-2">Active Clients</h3>
                    <p className="text-4xl font-bold text-brand-lime">
                        {loading ? '-' : stats.activeClients}
                    </p>
                    <p className="text-sm text-brand-text-muted mt-2">
                        {loading ? '...' : `Est. MRR: €${stats.mrr.toLocaleString()}`}
                    </p>
                </div>

                {/* Open Tasks */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
                    <h3 className="text-lg font-serif font-bold tracking-tight text-brand-black mb-2">Open Tasks</h3>
                    <p className="text-4xl font-bold text-brand-lime">
                        {loading ? '-' : stats.openTasks}
                    </p>
                    <p className="text-sm text-brand-text-muted mt-2">To do & In progress</p>
                </div>

                {/* Recent Activity */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-all">
                    <h3 className="text-lg font-serif font-bold tracking-tight text-brand-black mb-4">Recent Activity</h3>
                    <div className="space-y-3">
                        {loading ? (
                            <p className="text-sm text-gray-400">-</p>
                        ) : recentTasks.length > 0 ? (
                            recentTasks.map(task => (
                                <div key={task.id} className="flex items-center gap-3">
                                    <div className={`w-2 h-2 rounded-full ${task.status === 'done' ? 'bg-emerald-500' : 'bg-brand-lime'
                                        }`}></div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-brand-text-main truncate">{task.title}</p>
                                        <p className="text-xs text-brand-text-muted">
                                            {task.createdAt ? new Date(task.createdAt.seconds * 1000).toLocaleDateString() : 'Just now'}
                                        </p>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p className="text-sm text-gray-400">No recent activity</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Welcome Section */}
            <div className="mt-8 bg-white border border-gray-100 rounded-xl p-8 shadow-sm">
                <h2 className="text-3xl font-serif font-bold tracking-tight text-brand-black mb-4">
                    Welcome to 2H Central Hub
                </h2>
                <p className="text-brand-text-muted leading-relaxed">
                    Your centralized dashboard for managing clients, tasks, and AI agents.
                    This is the command center for all 2H Websolutions operations.
                </p>
                <div className="mt-6 flex gap-3">
                    <Button variant="primary">
                        Add Client
                    </Button>
                    <Button variant="secondary">
                        View All Tasks
                    </Button>
                </div>
            </div>
        </DashboardShell>
    );
}
