import { useState, useEffect } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Button from '../components/Button';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';
import SecureDeleteModal from '../components/SecureDeleteModal';
import { Pencil, Trash2 } from 'lucide-react';

interface Client {
    id: string;
    companyName: string;
    website: string;
    status: 'active' | 'onboarding';
    createdAt?: Timestamp;
    // Brand DNA
    primaryColor?: string;
    backgroundColor?: string;
    surfaceColor?: string;
    fontHeading?: string;
    fontBody?: string;
}

export default function Clients() {
    const [clients, setClients] = useState<Client[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // Edit & Delete State
    const [editingClient, setEditingClient] = useState<Client | null>(null);
    const [deletingClientId, setDeletingClientId] = useState<string | null>(null);

    // Form State
    const [companyName, setCompanyName] = useState('');
    const [website, setWebsite] = useState('');
    const [status, setStatus] = useState<'active' | 'onboarding'>('onboarding');

    // Brand DNA State
    const [primaryColor, setPrimaryColor] = useState('#B7EF02');
    const [backgroundColor, setBackgroundColor] = useState('#101010');
    const [surfaceColor, setSurfaceColor] = useState('#ffffff');
    const [fontHeading, setFontHeading] = useState('Federo');
    const [fontBody, setFontBody] = useState('Barlow');

    // Subscribe to Clients
    useEffect(() => {
        const q = query(
            collection(db, 'apps', '2h_hub_v1', 'clients'),
            orderBy('createdAt', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const clientList: Client[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Client));
            setClients(clientList);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const resetForm = () => {
        setCompanyName('');
        setWebsite('');
        setStatus('onboarding');
        setPrimaryColor('#B7EF02');
        setBackgroundColor('#101010');
        setSurfaceColor('#ffffff');
        setFontHeading('Federo');
        setFontBody('Barlow');
        setEditingClient(null);
    };

    const handleOpenAdd = () => {
        resetForm();
        setIsModalOpen(true);
    };

    const handleOpenEdit = (client: Client) => {
        setEditingClient(client);
        setCompanyName(client.companyName);
        setWebsite(client.website);
        setStatus(client.status);
        setPrimaryColor(client.primaryColor || '#B7EF02');
        setBackgroundColor(client.backgroundColor || '#101010');
        setSurfaceColor(client.surfaceColor || '#ffffff');
        setFontHeading(client.fontHeading || 'Federo');
        setFontBody(client.fontBody || 'Barlow');
        setIsModalOpen(true);
    };

    const handleSaveClient = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const clientData = {
                companyName,
                website,
                status,
                primaryColor,
                backgroundColor,
                surfaceColor,
                fontHeading,
                fontBody
            };

            if (editingClient) {
                // Update
                const docRef = doc(db, 'apps', '2h_hub_v1', 'clients', editingClient.id);
                await updateDoc(docRef, clientData);
            } else {
                // Create
                await addDoc(collection(db, 'apps', '2h_hub_v1', 'clients'), {
                    ...clientData,
                    createdAt: serverTimestamp()
                });
            }

            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            console.error("Error saving client: ", error);
            alert("Failed to save client");
        }
    };

    const handleDeleteClient = async () => {
        if (!deletingClientId) return;
        try {
            await deleteDoc(doc(db, 'apps', '2h_hub_v1', 'clients', deletingClientId));
            setDeletingClientId(null);
        } catch (error) {
            console.error("Error deleting client: ", error);
            alert("Failed to delete client");
        }
    };

    return (
        <DashboardShell
            headerTitle="Client Management"
            sidebarContent={<SidebarNav />}
            headerActions={
                <Button onClick={handleOpenAdd}>Add Client</Button>
            }
        >
            {/* List */}
            {loading ? (
                <p className="text-brand-text-muted">Loading clients...</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.map(client => (
                        <div key={client.id} className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-all relative overflow-hidden group">
                            {/* Brand DNA Preview Dot */}
                            {client.primaryColor && (
                                <div
                                    className="absolute top-0 right-0 w-16 h-16 opacity-10 rounded-bl-full pointer-events-none"
                                    style={{ backgroundColor: client.primaryColor }}
                                ></div>
                            )}

                            {/* Action Buttons (Visible on Hover in Group) */}
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(client); }}
                                    className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100 transition-colors"
                                    title="Edit Client"
                                >
                                    <Pencil size={16} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setDeletingClientId(client.id); }}
                                    className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors"
                                    title="Delete Client"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="flex justify-between items-start mb-4 pr-16">
                                <div className="flex items-center gap-3">
                                    {client.primaryColor && (
                                        <div
                                            className="w-3 h-3 rounded-full shadow-sm ring-1 ring-gray-100"
                                            style={{ backgroundColor: client.primaryColor }}
                                            title="Brand Primary Color"
                                        ></div>
                                    )}
                                    <h3 className="text-xl font-serif font-bold text-brand-black truncate">{client.companyName}</h3>
                                </div>
                            </div>

                            <div className="flex justify-between items-center mt-2">
                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${client.status === 'active'
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-amber-100 text-amber-700'
                                    }`}>
                                    {client.status.toUpperCase()}
                                </span>
                                <a href={client.website} target="_blank" rel="noreferrer" className="text-sm text-brand-text-muted hover:text-brand-lime transition-colors truncate max-w-[150px]">
                                    {client.website}
                                </a>
                            </div>
                        </div>
                    ))}

                    {clients.length === 0 && (
                        <div className="col-span-full text-center py-12 text-brand-text-muted">
                            No clients found. Add your first one!
                        </div>
                    )}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-10">
                    <div className="bg-white rounded-xl p-8 w-full max-w-lg shadow-2xl relative my-auto">
                        <h3 className="text-2xl font-serif font-bold text-brand-black mb-6">
                            {editingClient ? 'Edit Client' : 'Add New Client'}
                        </h3>

                        <form onSubmit={handleSaveClient} className="space-y-6">
                            {/* Basic Info */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-900 border-b pb-2">Basic Information</h4>
                                <div>
                                    <label className="block text-sm font-medium text-brand-text-muted mb-1">Company Name</label>
                                    <input
                                        type="text"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                        value={companyName}
                                        onChange={(e) => setCompanyName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-text-muted mb-1">Website URL</label>
                                    <input
                                        type="url"
                                        required
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                        value={website}
                                        onChange={(e) => setWebsite(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-brand-text-muted mb-1">Status</label>
                                    <select
                                        className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                        value={status}
                                        onChange={(e) => setStatus(e.target.value as 'active' | 'onboarding')}
                                    >
                                        <option value="onboarding">Onboarding</option>
                                        <option value="active">Active</option>
                                    </select>
                                </div>
                            </div>

                            {/* Brand DNA */}
                            <div className="space-y-4">
                                <h4 className="text-sm font-bold text-gray-900 border-b pb-2">Brand Identity (DNA)</h4>

                                {/* Colors */}
                                <div className="grid grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Primary Color</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                className="w-8 h-8 rounded cursor-pointer border-none p-0"
                                                value={primaryColor}
                                                onChange={(e) => setPrimaryColor(e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                                                value={primaryColor}
                                                onChange={(e) => setPrimaryColor(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Background</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                className="w-8 h-8 rounded cursor-pointer border-none p-0"
                                                value={backgroundColor}
                                                onChange={(e) => setBackgroundColor(e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                                                value={backgroundColor}
                                                onChange={(e) => setBackgroundColor(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Surface</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                className="w-8 h-8 rounded cursor-pointer border-none p-0"
                                                value={surfaceColor}
                                                onChange={(e) => setSurfaceColor(e.target.value)}
                                            />
                                            <input
                                                type="text"
                                                className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                                                value={surfaceColor}
                                                onChange={(e) => setSurfaceColor(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Fonts */}
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Heading Font</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                            placeholder="e.g., Federo"
                                            value={fontHeading}
                                            onChange={(e) => setFontHeading(e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">Body Font</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                            placeholder="e.g., Inter"
                                            value={fontBody}
                                            onChange={(e) => setFontBody(e.target.value)}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t">
                                <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">
                                    Cancel
                                </Button>
                                <Button type="submit" variant="primary" className="flex-1">
                                    {editingClient ? 'Update Client' : 'Save Client'}
                                </Button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Secure Delete Modal */}
            <SecureDeleteModal
                isOpen={!!deletingClientId}
                onClose={() => setDeletingClientId(null)}
                onConfirm={handleDeleteClient}
                title="Client"
            />
        </DashboardShell>
    );
}
