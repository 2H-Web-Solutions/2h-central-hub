import { useState, useEffect, useMemo } from 'react';
import { collection, collectionGroup, addDoc, updateDoc, onSnapshot, serverTimestamp, query, orderBy, Timestamp, DocumentReference, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Button from '../components/Button';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';
import { Search, Filter, Plus, Calendar, CheckCircle2, Clock, AlertCircle, Trash2, X, Save, ExternalLink } from 'lucide-react';

// --- Types ---
interface Task {
    id: string;
    ref: DocumentReference;
    title: string;
    assignedClient: string;
    priority: 'low' | 'medium' | 'high';
    status: 'todo' | 'in_progress' | 'done';
    dueDate: Date | null;
    createdAt?: Timestamp;
    sourceAppId: string;
    description?: string; // Added description field
}

interface Client {
    id: string;
    companyName: string;
}

// --- Helpers ---
const normalizeStatus = (status: string): 'todo' | 'in_progress' | 'done' => {
    const s = (status || '').toLowerCase();
    if (['open', 'pending', 'todo', 'new'].includes(s)) return 'todo';
    if (['in_progress', 'doing', 'active', 'working'].includes(s)) return 'in_progress';
    if (['done', 'completed', 'closed', 'finished', 'resolved'].includes(s)) return 'done';
    return 'todo';
};

const formatAppId = (appId: string) => {
    return (appId || 'Unknown')
        .replace(/^2h_/, '')
        .replace(/_v\d+$/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase())
        .trim();
};

const getPriorityColor = (p: string) => {
    switch (p) {
        case 'high': return 'bg-red-100 text-red-700 border-red-200';
        case 'medium': return 'bg-amber-100 text-amber-700 border-amber-200';
        case 'low': return 'bg-blue-100 text-blue-700 border-blue-200';
        default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
};

const normalizeTask = (doc: any): Task => {
    const data = doc.data();
    return {
        id: doc.id,
        ref: doc.ref,
        // Intelligent Title Mapping
        title: data.title || data.taskName || data.name || data.headline || data.description?.slice(0, 50) || data.text?.slice(0, 50) || "Untitled Task",
        assignedClient: data.assignedClient || data.clientName || data.client || "Unknown Client",
        status: normalizeStatus(data.status),
        priority: ['low', 'medium', 'high'].includes(data.priority) ? data.priority : 'medium',
        dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : (data.due_date?.toDate ? data.due_date.toDate() : (data.dueDate ? new Date(data.dueDate) : null)),
        createdAt: data.createdAt,
        // Intelligent App Source Extraction
        sourceAppId: data.sourceApp || data.appName || doc.ref.parent.parent?.id || '2h_hub_v1',
        description: data.description || data.text || ''
    };
};

export default function Tasks() {
    // --- State ---
    const [tasks, setTasks] = useState<Task[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedAppFilter, setSelectedAppFilter] = useState('All Apps');

    // Modals & Editing
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingTask, setEditingTask] = useState<Task | null>(null); // If set, Details Modal is open

    // Drag & Drop
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);

    // Form State (shared for Create/Edit)
    const [formData, setFormData] = useState<{
        title: string;
        client: string;
        priority: 'low' | 'medium' | 'high';
        status: 'todo' | 'in_progress' | 'done';
        dueDate: string;
        description: string;
    }>({
        title: '', client: '', priority: 'medium', status: 'todo', dueDate: '', description: ''
    });

    // --- Effects ---

    // 1. Fetch Tasks
    useEffect(() => {
        const q = query(collectionGroup(db, 'tasks'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const taskList = snapshot.docs.map(normalizeTask);
            setTasks(taskList);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Fetch Clients
    useEffect(() => {
        const q = query(collection(db, 'apps', '2h_hub_v1', 'clients'), orderBy('companyName'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setClients(snapshot.docs.map(doc => ({ id: doc.id, companyName: doc.data().companyName })));
        });
        return () => unsubscribe();
    }, []);

    // --- Derived State ---
    const uniqueApps = useMemo(() => {
        const apps = new Set(tasks.map(t => formatAppId(t.sourceAppId)));
        return ['All Apps', ...Array.from(apps).sort()];
    }, [tasks]);

    const filteredTasks = useMemo(() => {
        return tasks.filter(task => {
            const matchesSearch = task.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                task.assignedClient.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesApp = selectedAppFilter === 'All Apps' || formatAppId(task.sourceAppId) === selectedAppFilter;
            return matchesSearch && matchesApp;
        });
    }, [tasks, searchQuery, selectedAppFilter]);

    // --- Handlers ---

    const openCreateModal = () => {
        setFormData({ title: '', client: '', priority: 'medium', status: 'todo', dueDate: '', description: '' });
        setIsCreateModalOpen(true);
    };

    const openEditModal = (task: Task) => {
        setEditingTask(task);
        setFormData({
            title: task.title,
            client: task.assignedClient,
            priority: task.priority,
            status: task.status,
            dueDate: task.dueDate ? task.dueDate.toISOString().split('T')[0] : '',
            description: task.description || ''
        });
    };

    const handleCreateSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, 'apps', '2h_hub_v1', 'tasks'), {
                title: formData.title,
                assignedClient: formData.client,
                priority: formData.priority,
                status: 'todo',
                dueDate: formData.dueDate,
                description: formData.description,
                createdAt: serverTimestamp()
            });
            setIsCreateModalOpen(false);
        } catch (err) { console.error(err); alert("Failed to create task"); }
    };

    const handleEditSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingTask) return;
        try {
            await updateDoc(editingTask.ref, {
                title: formData.title,
                assignedClient: formData.client,
                priority: formData.priority,
                status: formData.status,
                dueDate: formData.dueDate, // In a real app, maybe convert back to Timestamp or Date
                description: formData.description
            });
            setEditingTask(null);
        } catch (err) { console.error(err); alert("Failed to update task"); }
    };

    const handleDeleteTask = async () => {
        if (!editingTask || !confirm("Are you sure you want to delete this task?")) return;
        try {
            await deleteDoc(editingTask.ref);
            setEditingTask(null);
        } catch (err) { console.error(err); alert("Failed to delete task"); }
    };

    // Drag & Drop
    const handleDrop = async (newStatus: 'todo' | 'in_progress' | 'done') => {
        if (!draggedTask || draggedTask.status === newStatus) return;
        try {
            await updateDoc(draggedTask.ref, { status: newStatus });
        } catch (err) { console.error(err); }
        setDraggedTask(null);
    };

    // --- Components ---

    const TaskCard = ({ task }: { task: Task }) => (
        <div
            draggable
            onDragStart={() => setDraggedTask(task)}
            onClick={() => openEditModal(task)}
            className="group bg-white p-5 rounded-2xl shadow-sm border border-transparent hover:border-brand-lime transition-all cursor-pointer active:scale-[0.98] flex flex-col gap-3 relative overflow-hidden"
        >
            <div className="flex justify-between items-start">
                <span className={`text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border ${getPriorityColor(task.priority)}`}>
                    {task.priority}
                </span>
                {task.sourceAppId !== '2h_hub_v1' && (
                    <span className="text-[10px] font-bold bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full uppercase tracking-widest">
                        {formatAppId(task.sourceAppId)}
                    </span>
                )}
            </div>
            <h4 className="font-serif font-bold text-lg text-brand-black leading-tight group-hover:text-brand-lime transition-colors mt-1">
                {task.title}
            </h4>
            <div className="flex justify-between items-center mt-auto pt-2">
                <span className="text-[10px] font-bold text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100 uppercase tracking-widest truncate max-w-[120px]">
                    {task.assignedClient}
                </span>
                {task.dueDate && (
                    <span className={`text-xs font-medium flex items-center gap-1.5 ${task.dueDate < new Date() ? 'text-red-500 font-bold' : 'text-gray-400'}`}>
                        <Calendar size={12} />
                        {task.dueDate.toLocaleDateString()}
                    </span>
                )}
            </div>
        </div>
    );

        const Column = ({ title, status, icon: Icon }: { title: string, status: 'todo' | 'in_progress' | 'done', icon: any }) => {
            const items = filteredTasks.filter(t => t.status === status);
            return (
                <div
                    className="flex flex-col h-full min-w-[320px] w-full"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(status)}
                >
                    <div className="flex items-center justify-between mb-4 px-1">
                        <h3 className="font-serif font-bold text-xl text-gray-900 flex items-center gap-2">
                            {Icon && <Icon size={20} className="text-brand-lime" />}
                            {title}
                        </h3>
                        <span className="bg-white text-gray-900 text-xs font-bold px-2.5 py-1 rounded-full shadow-sm border border-gray-100">
                            {items.length}
                        </span>
                    </div>
                    <div className={`flex-1 overflow-y-auto p-2 space-y-4 rounded-2xl transition-colors ${draggedTask ? 'bg-gray-50/50 border-2 border-dashed border-gray-200' : ''}`}>
                        {items.map(task => <TaskCard key={task.id} task={task} />)}
                        {items.length === 0 && (
                            <div className="h-32 flex flex-col items-center justify-center text-gray-300 border border-dashed border-gray-300 rounded-2xl bg-white/50">
                                <p className="text-sm font-medium">No Tasks</p>
                            </div>
                        )}
                    </div>
                </div>
            );
        };

    return (
        <DashboardShell headerTitle="Global Task Board" sidebarContent={<SidebarNav />}>
            <div className="flex flex-col h-[calc(100vh-100px)]">
                
                {/* Welcome Section */}
                <section className="mb-8 shrink-0">
                    <h2 className="font-serif text-5xl text-brand-black mb-2 tracking-tight">Task Center</h2>
                    <p className="font-sans text-brand-text-muted max-w-2xl text-lg">Centralized Kanban board for monitoring and managing tasks across all connected workspaces.</p>
                </section>

                {/* Toolbar */}
                <div className="bg-white border border-gray-100 p-4 rounded-2xl shadow-sm flex flex-wrap gap-4 items-center justify-between shrink-0 mb-6">
                    <div className="flex items-center gap-4 flex-1 min-w-[200px]">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                placeholder="Search tasks or clients..."
                                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-brand-lime focus:border-brand-lime outline-none transition-all"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="relative">
                            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <select
                                className="pl-10 pr-8 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:ring-1 focus:ring-brand-lime outline-none cursor-pointer hover:border-gray-300 appearance-none font-medium text-gray-700"
                                value={selectedAppFilter}
                                onChange={e => setSelectedAppFilter(e.target.value)}
                            >
                                {uniqueApps.map(app => <option key={app} value={app}>{app}</option>)}
                            </select>
                        </div>
                    </div>
                    <button 
                        onClick={openCreateModal} 
                        className="flex items-center gap-2 bg-brand-lime text-brand-black px-6 py-2.5 rounded-full font-bold hover:bg-[#a3d600] transition-colors shadow-sm shrink-0"
                    >
                        <Plus size={18} />
                        <span>New Task</span>
                    </button>
                </div>

                {/* Kanban Board */}
                {loading ? (
                    <div className="flex-1 flex items-center justify-center text-gray-400">Loading global tasks...</div>
                ) : (
                    <div className="flex-1 overflow-x-auto overflow-y-hidden">
                        <div className="h-full flex gap-6 p-6 min-w-max">
                            <Column title="To Do" status="todo" icon={AlertCircle} />
                            <Column title="In Progress" status="in_progress" icon={Clock} />
                            <Column title="Done" status="done" icon={CheckCircle2} />
                        </div>
                    </div>
                )}
            </div>

            {/* Create Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
                        <form onSubmit={handleCreateSubmit} className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="text-xl font-serif font-bold">Create Task</h3>
                                <button type="button" onClick={() => setIsCreateModalOpen(false)}><X className="text-gray-400 hover:text-gray-600" /></button>
                            </div>
                            <div className="space-y-4">
                                <input required placeholder="Task Title" className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 focus:border-brand-lime outline-none" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                <div className="grid grid-cols-2 gap-4">
                                    <select required className="p-3 bg-gray-50 rounded-lg border border-gray-200" value={formData.client} onChange={e => setFormData({ ...formData, client: e.target.value })}>
                                        <option value="">Select Client</option>
                                        {clients.map(c => <option key={c.id} value={c.companyName}>{c.companyName}</option>)}
                                    </select>
                                    <select className="p-3 bg-gray-50 rounded-lg border border-gray-200" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as any })}>
                                        <option value="low">Low Priority</option>
                                        <option value="medium">Medium Priority</option>
                                        <option value="high">High Priority</option>
                                    </select>
                                </div>
                                <input type="date" className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200" value={formData.dueDate} onChange={e => setFormData({ ...formData, dueDate: e.target.value })} />
                                <textarea placeholder="Description (optional)" className="w-full p-3 bg-gray-50 rounded-lg border border-gray-200 h-24 resize-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                            </div>
                            <div className="flex gap-3 mt-6">
                                <Button type="button" variant="secondary" onClick={() => setIsCreateModalOpen(false)} className="flex-1">Cancel</Button>
                                <Button type="submit" className="flex-1">Create Task</Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit/Details Modal */}
            {editingTask && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl animate-in fade-in zoom-in duration-200">
                        <form onSubmit={handleEditSubmit} className="p-6">
                            <div className="flex justify-between items-start mb-6">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                                            {formatAppId(editingTask.sourceAppId)}
                                        </span>
                                        <span className="text-xs text-gray-300">•</span>
                                        <span className="text-xs font-mono text-gray-300">{editingTask.id.slice(0, 8)}</span>
                                    </div>
                                    <h3 className="text-xl font-serif font-bold">Edit Task</h3>
                                </div>
                                <button type="button" onClick={() => setEditingTask(null)}><X className="text-gray-400 hover:text-gray-600" /></button>
                            </div>

                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Title</label>
                                    <input required className="w-full p-3 bg-white border border-gray-200 rounded-lg focus:border-brand-lime outline-none font-medium" value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Status</label>
                                        <select className="w-full p-3 bg-white border border-gray-200 rounded-lg" value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value as any })}>
                                            <option value="todo">To Do</option>
                                            <option value="in_progress">In Progress</option>
                                            <option value="done">Done</option>
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-bold text-gray-500 uppercase">Priority</label>
                                        <select className="w-full p-3 bg-white border border-gray-200 rounded-lg" value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as any })}>
                                            <option value="low">Low</option>
                                            <option value="medium">Medium</option>
                                            <option value="high">High</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Description</label>
                                    <textarea className="w-full p-3 bg-white border border-gray-200 rounded-lg h-24 resize-none" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                                </div>

                                <div className="flex justify-between items-center pt-2 text-xs text-gray-400">
                                    <span>Created: {editingTask.createdAt?.toDate().toLocaleDateString() || 'Unknown'}</span>
                                    {editingTask.sourceAppId !== '2h_hub_v1' && (
                                        <span className="flex items-center gap-1">
                                            <ExternalLink size={12} /> External App Task
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8 pt-4 border-t border-gray-100">
                                <button type="button" onClick={handleDeleteTask} className="px-4 py-2 text-red-500 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors">
                                    <Trash2 size={18} /> Delete
                                </button>
                                <div className="flex-1 flex gap-3 justify-end">
                                    <Button type="button" variant="secondary" onClick={() => setEditingTask(null)}>Cancel</Button>
                                    <Button type="submit" className="flex items-center gap-2"><Save size={18} /> Save Changes</Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
}
