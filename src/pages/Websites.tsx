import { useState, useRef, useCallback, useEffect } from 'react';
import {
    ref,
    uploadBytesResumable,
    getDownloadURL,
    listAll,
    deleteObject,
    StorageReference,
} from 'firebase/storage';
import {
    collection,
    addDoc,
    onSnapshot,
    deleteDoc,
    doc,
    serverTimestamp,
    query,
    orderBy,
    updateDoc,
} from 'firebase/firestore';
import { storage, db } from '../lib/firebase';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';
import {
    Users,
    Puzzle,
    Layout,
    Upload,
    FileArchive,
    Trash2,
    Download,
    Loader2,
    CheckCircle2,
    AlertCircle,
    Plus,
    X,
    Github,
    ExternalLink,
    Globe,
    FileText,
    Link as LinkIcon,
    Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface UploadedPlugin {
    name: string;
    fullPath: string;
    ref: StorageReference;
    downloadUrl: string;
    timeCreated?: string;
}
interface UploadState {
    file: File;
    progress: number;
    status: 'uploading' | 'done' | 'error';
    error?: string;
}
interface Template {
    id: string;
    name: string;
    gitUrl: string;
    createdAt: any;
}
interface WebsiteClient {
    id: string;
    clientName: string;
    companyName: string;
    legacyUrl: string;
    wordpressUrl: string;
    newSiteUrl: string;
    referenceLinks: string[];
    assetsFileUrl?: string;
    assetsFileName?: string;
    designFileUrl?: string;
    designFileName?: string;
    createdAt: any;
}

// ─── Tab definitions ──────────────────────────────────────────────────────────
const TABS = [
    { id: 'clients', label: 'Clients', icon: Users },
    { id: 'plugins', label: 'Plugins', icon: Puzzle },
    { id: 'templates', label: 'Templates', icon: Layout },
] as const;
type TabId = typeof TABS[number]['id'];

// ─── Shared helpers ───────────────────────────────────────────────────────────
function formatBytes(bytes: number): string {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
function formatDate(iso?: string): string {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
const inputCls = 'w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-brand-black placeholder:text-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-lime/40 focus:border-brand-lime transition-all';

// ─── Form sub-components ──────────────────────────────────────────────────────
function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <div className="space-y-3">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-2">{title}</p>
            {children}
        </div>
    );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-gray-500">{label}</label>
            {children}
        </div>
    );
}

// ─── Link Row (card detail) ───────────────────────────────────────────────────
function LinkRow({ label, url, color = 'text-gray-400' }: { label: string; url: string; color?: string }) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl border border-gray-100 hover:border-brand-lime/40 hover:bg-brand-lime/5 transition-all group/link"
        >
            <Globe size={13} className={`${color} shrink-0`} />
            <span className="text-xs text-brand-text-muted truncate flex-1">{label}</span>
            <ExternalLink size={11} className="text-gray-300 group-hover/link:text-brand-lime transition-colors shrink-0" />
        </a>
    );
}

// ─── Clients Tab ──────────────────────────────────────────────────────────────
function ClientsTab() {
    const [clients, setClients] = useState<WebsiteClient[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [form, setForm] = useState({
        clientName: '', companyName: '', legacyUrl: '',
        wordpressUrl: '', newSiteUrl: '', referenceLinks: [''],
    });
    const [assetsFile, setAssetsFile] = useState<File | null>(null);
    const [designFile, setDesignFile] = useState<File | null>(null);
    const [uploadProgress, setUploadProgress] = useState({ assets: 0, design: 0 });
    const assetsInputRef = useRef<HTMLInputElement>(null);
    const designInputRef = useRef<HTMLInputElement>(null);

    const COLLECTION = 'apps/2h_hub_v1/website_clients';

    useEffect(() => {
        const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, (snap) => {
            setClients(snap.docs.map(d => ({ id: d.id, ...d.data() } as WebsiteClient)));
            setLoading(false);
        });
        return unsub;
    }, []);

    const uploadFile = (file: File, path: string, onProgress: (p: number) => void): Promise<string> =>
        new Promise((resolve, reject) => {
            const storageRef = ref(storage, path);
            const task = uploadBytesResumable(storageRef, file);
            task.on('state_changed',
                snap => onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
                reject,
                async () => resolve(await getDownloadURL(task.snapshot.ref))
            );
        });

    const resetForm = () => {
        setForm({ clientName: '', companyName: '', legacyUrl: '', wordpressUrl: '', newSiteUrl: '', referenceLinks: [''] });
        setAssetsFile(null);
        setDesignFile(null);
        setUploadProgress({ assets: 0, design: 0 });
    };

    const handleSave = async () => {
        if (!form.clientName.trim()) { toast.error('Client name is required'); return; }
        setSaving(true);
        try {
            const docRef = await addDoc(collection(db, COLLECTION), {
                clientName: form.clientName.trim(),
                companyName: form.companyName.trim(),
                legacyUrl: form.legacyUrl.trim(),
                wordpressUrl: form.wordpressUrl.trim(),
                newSiteUrl: form.newSiteUrl.trim(),
                referenceLinks: form.referenceLinks.filter(l => l.trim()),
                createdAt: serverTimestamp(),
            });
            const updates: Record<string, string> = {};
            if (assetsFile) {
                const url = await uploadFile(
                    assetsFile,
                    `website-clients/${docRef.id}/assets/${assetsFile.name}`,
                    p => setUploadProgress(prev => ({ ...prev, assets: p }))
                );
                updates.assetsFileUrl = url;
                updates.assetsFileName = assetsFile.name;
            }
            if (designFile) {
                const url = await uploadFile(
                    designFile,
                    `website-clients/${docRef.id}/design/${designFile.name}`,
                    p => setUploadProgress(prev => ({ ...prev, design: p }))
                );
                updates.designFileUrl = url;
                updates.designFileName = designFile.name;
            }
            if (Object.keys(updates).length > 0) {
                await updateDoc(doc(db, COLLECTION, docRef.id), updates);
            }
            toast.success('Client added!');
            resetForm();
            setShowModal(false);
        } catch {
            toast.error('Failed to save client');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete "${name}"?`)) return;
        setDeletingId(id);
        try {
            await deleteDoc(doc(db, COLLECTION, id));
            toast.success('Client deleted');
        } catch { toast.error('Failed to delete'); }
        finally { setDeletingId(null); }
    };

    const addRefLink = () => setForm(f => ({ ...f, referenceLinks: [...f.referenceLinks, ''] }));
    const updateRefLink = (i: number, val: string) => setForm(f => ({ ...f, referenceLinks: f.referenceLinks.map((l, idx) => idx === i ? val : l) }));
    const removeRefLink = (i: number) => setForm(f => ({ ...f, referenceLinks: f.referenceLinks.filter((_, idx) => idx !== i) }));

    const safeHostname = (url: string) => { try { return new URL(url).hostname.replace('www.', ''); } catch { return url; } };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-serif text-2xl text-brand-black font-bold">Website Clients</h2>
                    <p className="text-sm text-brand-text-muted mt-0.5">Manage client website details, assets and references</p>
                </div>
                <button
                    id="add-website-client-btn"
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-black text-brand-lime text-sm font-semibold hover:brightness-110 active:scale-95 transition-all shadow-sm"
                >
                    <Plus size={16} />
                    Add Client
                </button>
            </div>

            {/* Client list */}
            {loading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 size={28} className="animate-spin text-brand-lime" />
                </div>
            ) : clients.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-brand-lime/10 flex items-center justify-center">
                        <Users size={28} className="text-brand-lime" />
                    </div>
                    <p className="font-serif text-lg text-brand-black font-bold">No website clients yet</p>
                    <p className="text-sm text-brand-text-muted text-center max-w-xs">
                        Click "Add Client" to add a client's website details, links and assets.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                    {clients.map(client => (
                        <div
                            key={client.id}
                            className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 hover:border-brand-lime/30 hover:shadow-md transition-all group"
                        >
                            {/* Card header */}
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-brand-black flex items-center justify-center shrink-0">
                                        <Globe size={18} className="text-brand-lime" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="font-serif font-bold text-brand-black text-base leading-tight">{client.clientName}</p>
                                        {client.companyName && (
                                            <p className="text-xs text-brand-text-muted flex items-center gap-1 mt-0.5">
                                                <Building2 size={10} />
                                                {client.companyName}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => handleDelete(client.id, client.clientName)}
                                    disabled={deletingId === client.id}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 shrink-0"
                                    title="Delete"
                                >
                                    {deletingId === client.id
                                        ? <Loader2 size={13} className="animate-spin" />
                                        : <Trash2 size={13} />}
                                </button>
                            </div>

                            {/* Website links */}
                            <div className="space-y-1.5">
                                {client.legacyUrl && <LinkRow label={`Legacy: ${safeHostname(client.legacyUrl)}`} url={client.legacyUrl} color="text-gray-400" />}
                                {client.wordpressUrl && <LinkRow label={`WordPress: ${safeHostname(client.wordpressUrl)}`} url={client.wordpressUrl} color="text-blue-400" />}
                                {client.newSiteUrl && <LinkRow label={`New Site: ${safeHostname(client.newSiteUrl)}`} url={client.newSiteUrl} color="text-brand-lime" />}
                            </div>

                            {/* Reference templates */}
                            {client.referenceLinks?.filter(l => l).length > 0 && (
                                <div>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Reference Templates</p>
                                    <div className="flex flex-wrap gap-1.5">
                                        {client.referenceLinks.filter(l => l).map((link, i) => (
                                            <a
                                                key={i}
                                                href={link}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex items-center gap-1 px-2.5 py-1 bg-gray-50 rounded-full text-[11px] text-brand-text-muted border border-gray-100 hover:border-brand-lime/40 hover:text-brand-lime transition-all"
                                            >
                                                <LinkIcon size={9} />
                                                {safeHostname(link)}
                                            </a>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* File downloads */}
                            {(client.assetsFileUrl || client.designFileUrl) && (
                                <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-50">
                                    {client.assetsFileUrl && (
                                        <a
                                            href={client.assetsFileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-brand-lime/10 text-brand-black text-xs font-medium hover:bg-brand-lime/20 transition-all"
                                        >
                                            <FileArchive size={12} className="text-brand-lime" />
                                            {client.assetsFileName || 'Assets.zip'}
                                        </a>
                                    )}
                                    {client.designFileUrl && (
                                        <a
                                            href={client.designFileUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gray-100 text-brand-black text-xs font-medium hover:bg-gray-200 transition-all"
                                        >
                                            <FileText size={12} className="text-gray-500" />
                                            {client.designFileName || 'Design.md'}
                                        </a>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {/* ── Add Client Modal ─────────────────────────────────────────── */}
            {showModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ backdropFilter: 'blur(6px)', backgroundColor: 'rgba(0,0,0,0.45)' }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-brand-black flex items-center justify-center">
                                    <Globe size={16} className="text-brand-lime" />
                                </div>
                                <h3 className="font-serif text-lg font-bold text-brand-black">Add Website Client</h3>
                            </div>
                            <button
                                onClick={() => { setShowModal(false); resetForm(); }}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Modal body */}
                        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-6">
                            <FormSection title="Basic Information">
                                <Field label="Client Name *">
                                    <input
                                        id="wc-client-name"
                                        type="text"
                                        placeholder="e.g. John Smith"
                                        value={form.clientName}
                                        onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="Company Name">
                                    <input
                                        id="wc-company-name"
                                        type="text"
                                        placeholder="e.g. Acme Corp"
                                        value={form.companyName}
                                        onChange={e => setForm(f => ({ ...f, companyName: e.target.value }))}
                                        className={inputCls}
                                    />
                                </Field>
                            </FormSection>

                            <FormSection title="Website Links">
                                <Field label="Legacy Website">
                                    <input
                                        id="wc-legacy-url"
                                        type="url"
                                        placeholder="https://old-site.com"
                                        value={form.legacyUrl}
                                        onChange={e => setForm(f => ({ ...f, legacyUrl: e.target.value }))}
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="WordPress Link">
                                    <input
                                        id="wc-wordpress-url"
                                        type="url"
                                        placeholder="https://wp-site.com/wp-admin"
                                        value={form.wordpressUrl}
                                        onChange={e => setForm(f => ({ ...f, wordpressUrl: e.target.value }))}
                                        className={inputCls}
                                    />
                                </Field>
                                <Field label="New Site Link">
                                    <input
                                        id="wc-new-site-url"
                                        type="url"
                                        placeholder="https://new-site.com"
                                        value={form.newSiteUrl}
                                        onChange={e => setForm(f => ({ ...f, newSiteUrl: e.target.value }))}
                                        className={inputCls}
                                    />
                                </Field>
                            </FormSection>

                            <FormSection title="Reference Templates">
                                <div className="space-y-2">
                                    {form.referenceLinks.map((link, i) => (
                                        <div key={i} className="flex gap-2">
                                            <input
                                                type="url"
                                                placeholder="https://reference-site.com"
                                                value={link}
                                                onChange={e => updateRefLink(i, e.target.value)}
                                                className={`${inputCls} flex-1`}
                                            />
                                            {form.referenceLinks.length > 1 && (
                                                <button
                                                    onClick={() => removeRefLink(i)}
                                                    className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-400 hover:text-red-400 hover:border-red-200 transition-all shrink-0"
                                                >
                                                    <X size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        onClick={addRefLink}
                                        className="flex items-center gap-1.5 text-xs font-semibold text-brand-text-muted hover:text-brand-lime transition-colors mt-1"
                                    >
                                        <Plus size={13} />
                                        Add another link
                                    </button>
                                </div>
                            </FormSection>

                            <FormSection title="Files">
                                <Field label="Assets ZIP (logos, images, fonts)">
                                    <div
                                        onClick={() => assetsInputRef.current?.click()}
                                        className="border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-brand-lime/60 transition-all flex items-center gap-3"
                                    >
                                        <FileArchive size={20} className="text-brand-lime shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-brand-black truncate">
                                                {assetsFile ? assetsFile.name : 'Click to upload .zip'}
                                            </p>
                                            {assetsFile && <p className="text-xs text-brand-text-muted">{formatBytes(assetsFile.size)}</p>}
                                        </div>
                                        {saving && assetsFile && uploadProgress.assets > 0 && (
                                            <span className="text-xs font-bold text-brand-lime shrink-0">{uploadProgress.assets}%</span>
                                        )}
                                    </div>
                                    <input
                                        ref={assetsInputRef}
                                        type="file"
                                        accept=".zip,application/zip"
                                        className="hidden"
                                        onChange={e => setAssetsFile(e.target.files?.[0] || null)}
                                    />
                                </Field>
                                <Field label="Design Document (.md file)">
                                    <div
                                        onClick={() => designInputRef.current?.click()}
                                        className="border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-brand-lime/60 transition-all flex items-center gap-3"
                                    >
                                        <FileText size={20} className="text-gray-400 shrink-0" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-brand-black truncate">
                                                {designFile ? designFile.name : 'Click to upload .md file'}
                                            </p>
                                            {designFile && <p className="text-xs text-brand-text-muted">{formatBytes(designFile.size)}</p>}
                                        </div>
                                        {saving && designFile && uploadProgress.design > 0 && (
                                            <span className="text-xs font-bold text-brand-lime shrink-0">{uploadProgress.design}%</span>
                                        )}
                                    </div>
                                    <input
                                        ref={designInputRef}
                                        type="file"
                                        accept=".md,.markdown,text/markdown"
                                        className="hidden"
                                        onChange={e => setDesignFile(e.target.files?.[0] || null)}
                                    />
                                </Field>
                            </FormSection>
                        </div>

                        {/* Modal footer */}
                        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 shrink-0">
                            <button
                                onClick={() => { setShowModal(false); resetForm(); }}
                                className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-semibold text-brand-text-muted hover:bg-gray-50 transition-all"
                            >
                                Cancel
                            </button>
                            <button
                                id="save-website-client-btn"
                                onClick={handleSave}
                                disabled={saving}
                                className="flex-1 py-2.5 rounded-full bg-brand-black text-brand-lime text-sm font-semibold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                                {saving ? 'Saving…' : 'Add Client'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Plugins Tab ─────────────────────────────────────────────────────────────
function PluginsTab() {
    const [showModal, setShowModal] = useState(false);
    const [dragging, setDragging] = useState(false);
    const [uploads, setUploads] = useState<UploadState[]>([]);
    const [plugins, setPlugins] = useState<UploadedPlugin[]>([]);
    const [loadingList, setLoadingList] = useState(true);
    const [deletingPath, setDeletingPath] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const fetchPlugins = useCallback(async () => {
        setLoadingList(true);
        try {
            const listRef = ref(storage, 'plugins/');
            const result = await listAll(listRef);
            const items: UploadedPlugin[] = await Promise.all(
                result.items.map(async (itemRef) => {
                    const url = await getDownloadURL(itemRef);
                    return { name: itemRef.name, fullPath: itemRef.fullPath, ref: itemRef, downloadUrl: url };
                })
            );
            setPlugins(items);
        } catch (err) {
            console.error('Failed to list plugins:', err);
        } finally {
            setLoadingList(false);
        }
    }, []);

    useEffect(() => { fetchPlugins(); }, [fetchPlugins]);

    const handleFiles = (files: FileList | null) => {
        if (!files) return;
        const zipFiles = Array.from(files).filter(f => f.name.endsWith('.zip'));
        if (zipFiles.length === 0) { toast.error('Only .zip files are accepted'); return; }
        zipFiles.forEach((file) => {
            const storageRef = ref(storage, `plugins/${file.name}`);
            const task = uploadBytesResumable(storageRef, file);
            setUploads(prev => [...prev, { file, progress: 0, status: 'uploading' }]);
            task.on('state_changed',
                snap => {
                    const pct = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
                    setUploads(prev => prev.map(u => u.file === file ? { ...u, progress: pct } : u));
                },
                err => {
                    setUploads(prev => prev.map(u => u.file === file ? { ...u, status: 'error', error: err.message } : u));
                    toast.error(`Upload failed: ${file.name}`);
                },
                async () => {
                    setUploads(prev => prev.map(u => u.file === file ? { ...u, status: 'done', progress: 100 } : u));
                    toast.success(`${file.name} uploaded!`);
                    await fetchPlugins();
                    setTimeout(() => setUploads(prev => prev.filter(u => u.file !== file)), 3000);
                }
            );
        });
    };

    const onDrop = (e: React.DragEvent) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); };

    const handleDelete = async (plugin: UploadedPlugin) => {
        if (!confirm(`Delete "${plugin.name}"?`)) return;
        setDeletingPath(plugin.fullPath);
        try {
            await deleteObject(plugin.ref);
            setPlugins(prev => prev.filter(p => p.fullPath !== plugin.fullPath));
            toast.success('Plugin deleted');
        } catch { toast.error('Failed to delete plugin'); }
        finally { setDeletingPath(null); }
    };

    const hasActiveUploads = uploads.some(u => u.status === 'uploading');

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-serif text-2xl text-brand-black font-bold">Plugins</h2>
                    <p className="text-sm text-brand-text-muted mt-0.5">Upload and manage WordPress plugins as .zip files</p>
                </div>
                <button
                    id="add-plugin-btn"
                    onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-black text-brand-lime text-sm font-semibold hover:brightness-110 active:scale-95 transition-all shadow-sm"
                >
                    <Plus size={16} />
                    Add Plugin
                </button>
            </div>

            {/* Available Plugins list */}
            <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest">
                        Available Plugins ({plugins.length})
                    </h3>
                    <button onClick={fetchPlugins} className="text-xs text-brand-text-muted hover:text-brand-lime transition-colors">
                        Refresh
                    </button>
                </div>

                {loadingList ? (
                    <div className="flex items-center justify-center py-16">
                        <Loader2 size={28} className="animate-spin text-brand-lime" />
                    </div>
                ) : plugins.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-16 text-center shadow-sm flex flex-col items-center gap-4">
                        <div className="w-16 h-16 rounded-2xl bg-brand-lime/10 flex items-center justify-center">
                            <FileArchive size={28} className="text-brand-lime" />
                        </div>
                        <p className="font-serif text-lg text-brand-black font-bold">No plugins yet</p>
                        <p className="text-sm text-brand-text-muted">Click "Add Plugin" to upload your first .zip plugin.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        {plugins.map((plugin, idx) => (
                            <div key={plugin.fullPath} className={`flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gray-50/80 ${idx !== 0 ? 'border-t border-gray-50' : ''}`}>
                                <div className="w-9 h-9 rounded-xl bg-brand-lime/10 flex items-center justify-center shrink-0">
                                    <FileArchive size={16} className="text-brand-lime" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-brand-black truncate">{plugin.name}</p>
                                    <p className="text-xs text-brand-text-muted">{formatDate(plugin.timeCreated)}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <a href={plugin.downloadUrl} target="_blank" rel="noopener noreferrer"
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-brand-lime hover:bg-brand-lime/10 transition-all" title="Download">
                                        <Download size={15} />
                                    </a>
                                    <button onClick={() => handleDelete(plugin)} disabled={deletingPath === plugin.fullPath}
                                        className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-400 hover:bg-red-50 transition-all disabled:opacity-40" title="Delete">
                                        {deletingPath === plugin.fullPath ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Upload Modal ─────────────────────────────────────────────── */}
            {showModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ backdropFilter: 'blur(6px)', backgroundColor: 'rgba(0,0,0,0.45)' }}
                >
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col">
                        {/* Modal header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-brand-black flex items-center justify-center">
                                    <Puzzle size={16} className="text-brand-lime" />
                                </div>
                                <h3 className="font-serif text-lg font-bold text-brand-black">Add Plugin</h3>
                            </div>
                            <button
                                onClick={() => !hasActiveUploads && setShowModal(false)}
                                disabled={hasActiveUploads}
                                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-all disabled:opacity-30"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* Drop zone */}
                        <div className="p-6 space-y-5">
                            <div
                                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={onDrop}
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all duration-300 select-none ${dragging ? 'border-brand-lime bg-brand-lime/5 scale-[1.01]' : 'border-gray-200 hover:border-brand-lime/60 hover:bg-gray-50/50'}`}
                            >
                                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-colors duration-300 ${dragging ? 'bg-brand-lime/20' : 'bg-gray-100'}`}>
                                    <Upload size={24} className={dragging ? 'text-brand-lime' : 'text-gray-400'} />
                                </div>
                                <div className="text-center">
                                    <p className="font-serif text-base font-semibold text-brand-black">
                                        {dragging ? 'Drop to upload' : 'Drag & drop or click to browse'}
                                    </p>
                                    <p className="text-xs text-brand-text-muted mt-1">Only .zip files are accepted</p>
                                </div>
                                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-500 border border-gray-200">.zip files only</span>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".zip,application/zip"
                                    multiple
                                    className="hidden"
                                    onChange={e => handleFiles(e.target.files)}
                                    onClick={e => (e.currentTarget.value = '')}
                                />
                            </div>

                            {/* Upload progress list */}
                            {uploads.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Uploading</p>
                                    {uploads.map((u, i) => (
                                        <div key={i} className="bg-gray-50 rounded-xl border border-gray-100 p-3">
                                            <div className="flex items-center gap-2 mb-2">
                                                <FileArchive size={15} className="text-brand-lime shrink-0" />
                                                <span className="text-xs font-medium text-brand-black truncate flex-1">{u.file.name}</span>
                                                <span className="text-xs text-brand-text-muted">{formatBytes(u.file.size)}</span>
                                                {u.status === 'uploading' && <Loader2 size={14} className="animate-spin text-brand-lime" />}
                                                {u.status === 'done' && <CheckCircle2 size={14} className="text-green-500" />}
                                                {u.status === 'error' && <AlertCircle size={14} className="text-red-400" />}
                                            </div>
                                            <div className="h-1 bg-gray-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-300 ${u.status === 'error' ? 'bg-red-400' : 'bg-brand-lime'}`}
                                                    style={{ width: `${u.progress}%` }}
                                                />
                                            </div>
                                            <p className="text-[10px] text-brand-text-muted mt-1">
                                                {u.status === 'error' ? u.error : u.status === 'done' ? 'Done!' : `${u.progress}%`}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Modal footer */}
                        <div className="px-6 py-4 border-t border-gray-100">
                            <button
                                onClick={() => !hasActiveUploads && setShowModal(false)}
                                disabled={hasActiveUploads}
                                className="w-full py-2.5 rounded-full border border-gray-200 text-sm font-semibold text-brand-text-muted hover:bg-gray-50 transition-all disabled:opacity-40"
                            >
                                {hasActiveUploads ? 'Uploading… please wait' : 'Done'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab() {
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form, setForm] = useState({ name: '', gitUrl: '' });
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const COLLECTION = 'apps/2h_hub_v1/templates';

    useEffect(() => {
        const q = query(collection(db, COLLECTION), orderBy('createdAt', 'desc'));
        const unsub = onSnapshot(q, snap => {
            setTemplates(snap.docs.map(d => ({ id: d.id, ...d.data() } as Template)));
            setLoading(false);
        });
        return unsub;
    }, []);

    const handleSave = async () => {
        if (!form.name.trim()) { toast.error('Please enter a template name'); return; }
        if (!form.gitUrl.trim()) { toast.error('Please enter a Git URL'); return; }
        setSaving(true);
        try {
            await addDoc(collection(db, COLLECTION), { name: form.name.trim(), gitUrl: form.gitUrl.trim(), createdAt: serverTimestamp() });
            toast.success('Template added!');
            setForm({ name: '', gitUrl: '' });
            setShowModal(false);
        } catch { toast.error('Failed to save template'); }
        finally { setSaving(false); }
    };

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`Delete template "${name}"?`)) return;
        setDeletingId(id);
        try {
            await deleteDoc(doc(db, COLLECTION, id));
            toast.success('Template deleted');
        } catch { toast.error('Failed to delete template'); }
        finally { setDeletingId(null); }
    };

    const repoLabel = (url: string) => { try { return new URL(url).pathname.replace(/^\//, '').replace(/\.git$/, ''); } catch { return url; } };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="font-serif text-2xl text-brand-black font-bold">Templates</h2>
                    <p className="text-sm text-brand-text-muted mt-0.5">Link Git repositories as reusable website templates</p>
                </div>
                <button id="add-template-btn" onClick={() => setShowModal(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-brand-black text-brand-lime text-sm font-semibold hover:brightness-110 active:scale-95 transition-all shadow-sm">
                    <Plus size={16} />Add Template
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-24"><Loader2 size={28} className="animate-spin text-brand-lime" /></div>
            ) : templates.length === 0 ? (
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-brand-lime/10 flex items-center justify-center"><Github size={28} className="text-brand-lime" /></div>
                    <p className="font-serif text-lg text-brand-black font-bold">No templates yet</p>
                    <p className="text-sm text-brand-text-muted text-center max-w-xs">Click "Add Template" to link a Git repository as a reusable website template.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                    {templates.map(t => (
                        <div key={t.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col gap-4 hover:border-brand-lime/30 hover:shadow-md transition-all group">
                            <div className="flex items-start justify-between gap-2">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-brand-black flex items-center justify-center shrink-0"><Github size={18} className="text-brand-lime" /></div>
                                    <div className="min-w-0">
                                        <p className="font-serif font-bold text-brand-black text-base leading-tight truncate">{t.name}</p>
                                        <p className="text-xs text-brand-text-muted truncate">{repoLabel(t.gitUrl)}</p>
                                    </div>
                                </div>
                                <button onClick={() => handleDelete(t.id, t.name)} disabled={deletingId === t.id}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-400 hover:bg-red-50 transition-all opacity-0 group-hover:opacity-100 shrink-0" title="Delete">
                                    {deletingId === t.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                </button>
                            </div>
                            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2 border border-gray-100 min-w-0">
                                <Github size={13} className="text-gray-400 shrink-0" />
                                <span className="text-xs text-brand-text-muted truncate flex-1">{t.gitUrl}</span>
                                <a href={t.gitUrl} target="_blank" rel="noopener noreferrer" className="text-gray-400 hover:text-brand-lime transition-colors shrink-0" title="Open repository"><ExternalLink size={13} /></a>
                            </div>
                            <p className="text-xs text-gray-300">
                                Added {t.createdAt?.toDate ? t.createdAt.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backdropFilter: 'blur(6px)', backgroundColor: 'rgba(0,0,0,0.4)' }}>
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-brand-black flex items-center justify-center"><Github size={16} className="text-brand-lime" /></div>
                                <h3 className="font-serif text-lg font-bold text-brand-black">Add Template</h3>
                            </div>
                            <button onClick={() => { setShowModal(false); setForm({ name: '', gitUrl: '' }); }} className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:bg-gray-100 transition-all"><X size={16} /></button>
                        </div>
                        <div className="space-y-4">
                            <Field label="Template Name">
                                <input id="template-name-input" type="text" placeholder="e.g. WordPress Starter" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inputCls} onKeyDown={e => e.key === 'Enter' && handleSave()} />
                            </Field>
                            <Field label="Git Repository URL">
                                <input id="template-git-url-input" type="url" placeholder="https://github.com/org/repo.git" value={form.gitUrl} onChange={e => setForm(f => ({ ...f, gitUrl: e.target.value }))} className={inputCls} onKeyDown={e => e.key === 'Enter' && handleSave()} />
                            </Field>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setShowModal(false); setForm({ name: '', gitUrl: '' }); }} className="flex-1 py-2.5 rounded-full border border-gray-200 text-sm font-semibold text-brand-text-muted hover:bg-gray-50 transition-all">Cancel</button>
                            <button id="save-template-btn" onClick={handleSave} disabled={saving}
                                className="flex-1 py-2.5 rounded-full bg-brand-black text-brand-lime text-sm font-semibold hover:brightness-110 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                                {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                                {saving ? 'Saving…' : 'Add Template'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Websites() {
    const [activeTab, setActiveTab] = useState<TabId>('clients');

    return (
        <DashboardShell headerTitle="Websites" sidebarContent={<SidebarNav />}>
            {/* Tab Bar */}
            <div className="flex gap-1 mb-8 bg-white rounded-xl p-1 w-fit shadow-sm border border-gray-100">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            id={`websites-tab-${tab.id}`}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${isActive ? 'bg-brand-black text-brand-lime shadow-sm' : 'text-brand-text-muted hover:text-brand-black'}`}
                        >
                            <Icon size={15} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'clients' && <ClientsTab />}
            {activeTab === 'plugins' && <PluginsTab />}
            {activeTab === 'templates' && <TemplatesTab />}
        </DashboardShell>
    );
}
