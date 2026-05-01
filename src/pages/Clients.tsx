import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Button from '../components/Button';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';
import SecureDeleteModal from '../components/SecureDeleteModal';
import { Pencil, Trash2, Loader2, Plus, ExternalLink, Globe, LayoutTemplate } from 'lucide-react';
import toast from 'react-hot-toast';
import { designSystemService, DesignSystem } from '../services/designSystemService';

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
    defaultDesignId?: string;
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

    const [designSystems, setDesignSystems] = useState<DesignSystem[]>([]);
    const [defaultDesignId, setDefaultDesignId] = useState('');

    // Fetch Design Systems
    useEffect(() => {
        designSystemService.getAllDesignSystems().then(setDesignSystems).catch(console.error);
    }, []);

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
        website && setWebsite('');
        setStatus('onboarding');
        setDefaultDesignId('');
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
        setDefaultDesignId(client.defaultDesignId || '');
        setIsModalOpen(true);
    };

    const handleSaveClient = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const clientData = {
                companyName,
                website,
                status,
                defaultDesignId
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
                <button 
                    onClick={handleOpenAdd}
                    className="flex items-center gap-2 bg-brand-lime text-brand-black px-6 py-2.5 rounded-full font-bold hover:bg-[#a3d600] transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    <span>Add Client</span>
                </button>
            }
        >
            {/* Welcome Section */}
            <section className="mb-10">
                <h2 className="font-serif text-5xl text-brand-black mb-2 tracking-tight">Client Directory</h2>
                <p className="font-sans text-brand-text-muted max-w-2xl text-lg">Manage all connected workspaces, brand identities, and active environments within the ecosystem.</p>
            </section>

            {/* List */}
            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-lime" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {clients.map(client => (
                        <div key={client.id} className="bg-white p-6 rounded-2xl shadow-sm border border-transparent hover:border-brand-lime transition-all relative overflow-hidden group flex flex-col h-full">
                            {/* Brand DNA Preview Dot */}
                            {client.primaryColor && (
                                <div
                                    className="absolute top-0 right-0 w-24 h-24 opacity-5 rounded-bl-full pointer-events-none"
                                    style={{ backgroundColor: client.primaryColor }}
                                ></div>
                            )}

                            {/* Action Buttons (Visible on Hover in Group) */}
                            <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                                <button
                                    onClick={(e) => { e.stopPropagation(); handleOpenEdit(client); }}
                                    className="p-2 bg-gray-50 text-gray-600 rounded-full hover:bg-white hover:text-brand-lime transition-all shadow-sm border border-gray-100"
                                    title="Edit Client"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    onClick={(e) => { e.stopPropagation(); setDeletingClientId(client.id); }}
                                    className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-all shadow-sm border border-red-100"
                                    title="Delete Client"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>

                            <div className="flex justify-between items-start mb-6 pr-16">
                                <div className="flex items-center gap-3">
                                    {client.primaryColor ? (
                                        <div
                                            className="w-10 h-10 rounded-xl shadow-sm flex items-center justify-center text-white font-bold text-lg"
                                            style={{ backgroundColor: client.primaryColor }}
                                            title="Brand Primary Color"
                                        >
                                            {client.companyName.charAt(0).toUpperCase()}
                                        </div>
                                    ) : (
                                        <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center text-gray-500 font-bold text-lg shadow-sm">
                                            {client.companyName.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                    <div>
                                        <h3 className="text-xl font-serif font-bold text-brand-black tracking-tight">{client.companyName}</h3>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <span className={`w-2 h-2 rounded-full ${client.status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                                            <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">{client.status}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Info Area */}
                            <div className="flex-grow space-y-4">
                                <div>
                                    <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Globe size={10} /> Website</h4>
                                    <a href={client.website} target="_blank" rel="noreferrer" className="text-sm text-brand-black hover:text-brand-lime transition-colors truncate max-w-full inline-flex items-center gap-1.5 font-medium bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-100 w-full">
                                        <span className="truncate">{client.website.replace(/^https?:\/\//, '')}</span>
                                        <ExternalLink size={12} className="flex-shrink-0 text-gray-400" />
                                    </a>
                                </div>

                                {/* DNA Preview Area */}
                                {client.primaryColor && (
                                    <div>
                                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><LayoutTemplate size={10} /> Brand DNA</h4>
                                        <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                                            <div className="flex -space-x-1">
                                                <div className="w-5 h-5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: client.primaryColor }} title="Primary"></div>
                                                <div className="w-5 h-5 rounded-full ring-2 ring-white shadow-sm" style={{ backgroundColor: client.backgroundColor || '#101010' }} title="Background"></div>
                                                <div className="w-5 h-5 rounded-full ring-2 ring-white shadow-sm border border-gray-200" style={{ backgroundColor: client.surfaceColor || '#ffffff' }} title="Surface"></div>
                                            </div>
                                            <span className="text-[10px] font-medium text-gray-500 px-1 truncate flex-grow">
                                                {client.fontHeading} • {client.fontBody}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}

                    {clients.length === 0 && (
                        <div className="col-span-full bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center flex flex-col items-center justify-center gap-4 group hover:border-brand-lime transition-colors cursor-pointer" onClick={handleOpenAdd}>
                            <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center text-gray-400 group-hover:text-brand-lime group-hover:bg-[#f5ffcc] transition-colors">
                                <Plus size={32} />
                            </div>
                            <div>
                                <h3 className="text-lg font-serif font-bold text-brand-black mb-1">No Clients Found</h3>
                                <p className="text-sm text-gray-500 max-w-sm mx-auto">Get started by creating your first client workspace. You can extract their Brand DNA automatically from their website.</p>
                            </div>
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
                                <div className="flex justify-between items-center border-b pb-2">
                                    <h4 className="text-sm font-bold text-gray-900">Brand Identity (DNA)</h4>
                                </div>


                                {/* Default Design System */}
                                <div className="pt-2">
                                    <label className="block text-xs font-medium text-gray-500 mb-1">Default Design System</label>
                                    <select
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                        value={defaultDesignId}
                                        onChange={(e) => setDefaultDesignId(e.target.value)}
                                    >
                                        <option value="">-- No Default Design System --</option>
                                        {designSystems.map(ds => (
                                            <option key={ds.id} value={ds.id}>{ds.title}</option>
                                        ))}
                                    </select>
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
