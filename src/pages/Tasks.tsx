import { useState, useEffect } from 'react';
import { collection, collectionGroup, addDoc, updateDoc, onSnapshot, serverTimestamp, query, orderBy, Timestamp, DocumentReference } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Button from '../components/Button';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';

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
}

const normalizeStatus = (status: string): 'todo' | 'in_progress' | 'done' => {
    const s = (status || '').toLowerCase();
    if (['open', 'pending', 'todo', 'new'].includes(s)) return 'todo';
    if (['in_progress', 'doing', 'active', 'working'].includes(s)) return 'in_progress';
    if (['done', 'completed', 'closed', 'finished', 'resolved'].includes(s)) return 'done';
    return 'todo';
};

const normalizeTask = (doc: any): Task => {
    const data = doc.data();
    return {
        id: doc.id,
        ref: doc.ref,
        // Title Fallback Chain:
        title: data.title || data.name || data.taskName || data.headline || "Untitled Task",
        // Client/App Fallback:
        assignedClient: data.assignedClient || data.clientName || data.client || "Unknown Client",
        status: normalizeStatus(data.status),
        priority: ['low', 'medium', 'high'].includes(data.priority) ? data.priority : 'medium',
        dueDate: data.dueDate?.toDate ? data.dueDate.toDate() : (data.due_date?.toDate ? data.due_date.toDate() : (data.dueDate ? new Date(data.dueDate) : null)),
        createdAt: data.createdAt,
        sourceAppId: data.sourceApp || data.appName || doc.ref.parent.parent?.id || '2h_hub_v1'
    };
};

interface Client {
    id: string;
    companyName: string;
}


const formatAppId = (appId: string) => {
    return appId
        .replace(/^2h_/, '')            // Remove prefix
        .replace(/_v\d+$/, '')          // Remove version suffix
        .replace(/_/g, ' ')             // Replace underscores with spaces
        .replace(/\b\w/g, c => c.toUpperCase()); // Capitalize words
};

export default function Tasks() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [draggedTask, setDraggedTask] = useState<Task | null>(null);

    // Form State
    const [title, setTitle] = useState('');
    const [assignedClient, setAssignedClient] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [dueDate, setDueDate] = useState('');

    // Subscribe to Tasks
    useEffect(() => {
        const q = query(
            collectionGroup(db, 'tasks'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const taskList: Task[] = snapshot.docs.map(doc => normalizeTask(doc));
            setTasks(taskList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Drag & Drop Handlers
    const handleDragStart = (task: Task) => {
        setDraggedTask(task);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
    };

    const handleDrop = async (newStatus: 'todo' | 'in_progress' | 'done') => {
        if (!draggedTask) return;
        if (draggedTask.status === newStatus) return;

        try {
            // Optimistic Update (optional, but good for UX - here we rely on snapshot)
            // Actual Firestore Update
            await updateDoc(draggedTask.ref, { status: newStatus });
        } catch (error) {
            console.error("Error updating task status:", error);
            alert("Failed to move task.");
        }
        setDraggedTask(null);
    };

    // Subscribe to Clients (for Dropdown)
    useEffect(() => {
        const q = query(collection(db, 'apps', '2h_hub_v1', 'clients'), orderBy('companyName'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const clientList: Client[] = snapshot.docs.map(doc => ({
                id: doc.id,
                companyName: doc.data().companyName
            } as Client));
            setClients(clientList);
        });
        return () => unsubscribe();
    }, []);

    const handleAddTask = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await addDoc(collection(db, 'apps', '2h_hub_v1', 'tasks'), {
                title,
                assignedClient,
                priority,
                status: 'todo', // Default status
                dueDate,
                createdAt: serverTimestamp()
            });
            setIsModalOpen(false);
            setTitle('');
            setAssignedClient('');
            setPriority('medium');
            setDueDate('');
        } catch (error) {
            console.error("Error adding task: ", error);
            alert("Failed to add task");
        }
    };

    const TaskColumn = ({ title, status, items }: { title: string, status: 'todo' | 'in_progress' | 'done', items: Task[] }) => (
        <div
            className="flex flex-col h-full"
            onDragOver={handleDragOver}
            onDrop={() => handleDrop(status)}
        >
            <h3 className="text-lg font-serif font-bold text-brand-black mb-4 px-2">{title} <span className="text-sm text-gray-400 font-sans font-normal ml-2">({items.length})</span></h3>
            <div className={`p-4 rounded-xl flex-1 space-y-3 min-h-[200px] transition-colors ${draggedTask ? 'bg-zinc-200/80 dashed-border' : 'bg-zinc-200/50'}`}>
                {items.map(task => (
                    <div
                        key={task.id}
                        draggable
                        onDragStart={() => handleDragStart(task)}
                        className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-move active:cursor-grabbing"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${task.priority === 'high' ? 'bg-red-100 text-red-600' :
                                'bg-blue-100 text-blue-600'
                                }`}>
                                {task.priority}
                            </span>
                            {task.sourceAppId && task.sourceAppId !== '2h_hub_v1' && (
                                <span className="text-[10px] font-medium bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                                    {formatAppId(task.sourceAppId)}
                                </span>
                            )}

                            {task.dueDate && <span className="text-[10px] text-gray-400 ml-auto">{task.dueDate.toLocaleDateString()}</span>}
                        </div>
                        <h4 className="text-sm font-bold text-brand-black mb-1">{task.title}</h4>
                        <p className="text-xs text-brand-text-muted">{task.assignedClient}</p>
                    </div>
                ))}
            </div>
        </div>
    );

    return (
        <DashboardShell
            headerTitle="Global Tasks"
            sidebarContent={<SidebarNav />}
            headerActions={
                <Button onClick={() => setIsModalOpen(true)}>New Task</Button>
            }
        >
            {loading ? (
                <p className="text-brand-text-muted">Loading tasks...</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 h-full pb-8">
                    <TaskColumn title="To Do" status="todo" items={tasks.filter(t => t.status === 'todo')} />
                    <TaskColumn title="In Progress" status="in_progress" items={tasks.filter(t => t.status === 'in_progress')} />
                    <TaskColumn title="Done" status="done" items={tasks.filter(t => t.status === 'done')} />
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl relative">
                        <h3 className="text-2xl font-serif font-bold text-brand-black mb-6">Create New Task</h3>

                        <form onSubmit={handleAddTask} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-brand-text-muted mb-1">Task Title</label>
                                <input
                                    type="text"
                                    required
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-brand-text-muted mb-1">Assigned Client</label>
                                <select
                                    required
                                    className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                    value={assignedClient}
                                    onChange={(e) => setAssignedClient(e.target.value)}
                                >
                                    <option value="">Select Client</option>
                                    {clients.map(client => (
                                        <option key={client.id} value={client.companyName}>{client.companyName}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-brand-text-muted mb-1">Priority</label>
                                    <select
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                        value={priority}
                                        onChange={(e) => setPriority(e.target.value as 'low' | 'medium' | 'high')}
                                    >
                                        <option value="low">Low</option>
                                        <option value="medium">Medium</option>
                                        <option value="high">High</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-text-muted mb-1">Due Date</label>
                                    <input
                                        type="date"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                        value={dueDate}
                                        onChange={(e) => setDueDate(e.target.value)}
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 mt-8">
                                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" className="flex-1">
                                    Create Task
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
}
