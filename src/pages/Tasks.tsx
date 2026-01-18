import { useState, useEffect } from 'react';
import { collection, addDoc, onSnapshot, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Button from '../components/Button';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';

interface Task {
    id: string;
    title: string;
    assignedClient: string;
    priority: 'low' | 'medium' | 'high';
    status: 'todo' | 'in_progress' | 'done';
    dueDate: string;
    createdAt?: Timestamp;
}

interface Client {
    id: string;
    companyName: string;
}

export default function Tasks() {
    const [tasks, setTasks] = useState<Task[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // Form State
    const [title, setTitle] = useState('');
    const [assignedClient, setAssignedClient] = useState('');
    const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
    const [dueDate, setDueDate] = useState('');

    // Subscribe to Tasks
    useEffect(() => {
        const q = query(
            collection(db, 'apps', '2h_hub_v1', 'tasks'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const taskList: Task[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Task));
            setTasks(taskList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

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

    const TaskColumn = ({ title, items }: { title: string, items: Task[] }) => (
        <div className="flex flex-col h-full">
            <h3 className="text-lg font-serif font-bold text-brand-black mb-4 px-2">{title} <span className="text-sm text-gray-400 font-sans font-normal ml-2">({items.length})</span></h3>
            <div className="bg-zinc-200/50 p-4 rounded-xl flex-1 space-y-3 min-h-[200px]">
                {items.map(task => (
                    <div key={task.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer">
                        <div className="flex justify-between items-start mb-2">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${task.priority === 'high' ? 'bg-red-100 text-red-600' :
                                task.priority === 'medium' ? 'bg-amber-100 text-amber-600' :
                                    'bg-blue-100 text-blue-600'
                                }`}>
                                {task.priority}
                            </span>
                            {task.dueDate && <span className="text-[10px] text-gray-400">{new Date(task.dueDate).toLocaleDateString()}</span>}
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
                    <TaskColumn title="To Do" items={tasks.filter(t => t.status === 'todo')} />
                    <TaskColumn title="In Progress" items={tasks.filter(t => t.status === 'in_progress')} />
                    <TaskColumn title="Done" items={tasks.filter(t => t.status === 'done')} />
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
