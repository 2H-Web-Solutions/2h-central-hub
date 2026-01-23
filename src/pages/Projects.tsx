import { useState, useEffect } from 'react';
import { collection, setDoc, deleteDoc, updateDoc, doc, addDoc, onSnapshot, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Button from '../components/Button';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';
import SecureDeleteModal from '../components/SecureDeleteModal';
import { Trash2, Folder, AppWindow, ChevronRight, Home, Layout, FolderInput, Pencil, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Project {
    id: string;
    appId: string;
    clientId: string;
    clientName: string;
    folderId?: string | null; // NEW: Subfolder Support
    type: string;
    name: string;
    repoUrl?: string;
    createdAt?: Timestamp;
    // Firebase Config
    firebaseConfig?: {
        apiKey?: string;
        authDomain?: string;
        projectId?: string;
        storageBucket?: string;
        messagingSenderId?: string;
        appId?: string;
    };
}

interface Client {
    id: string;
    companyName: string;
    primaryColor?: string;
    backgroundColor?: string;
    surfaceColor?: string;
    fontHeading?: string;
    fontBody?: string;
}

interface Folder {
    id: string;
    name: string;
    clientId: string;
    createdAt?: Timestamp;
}

const GLOBAL_RULES = `
*** 2H WEBSOLUTIONS ECOSYSTEM & RULES ***

1. TECH STACK (NON-NEGOTIABLE)
   - Frontend: React + Vite + TypeScript + Tailwind CSS.
   - Hosting: Vercel (linked via GitHub).
   - Backend: Firebase (Firestore, Auth).
   - Automation: n8n (via Webhooks).

2. DATA ARCHITECTURE (SINGLE BACKEND LAW)
   - Scope: ALL data must be stored under 'apps/{APP_ID}/...'.
   - Root Access: NEVER write to the root of Firestore.
   - Auth: Use Firebase Client SDK (Anonymous or User).
   - Security Rule Target: "match /apps/{appId}/{document=**} { allow read, write: if request.auth != null; }"

3. DEPLOYMENT WORKFLOW (ANTIGRAVITY -> GITHUB -> VERCEL)
   - Step 1: Initialize Git in Antigravity.
   - Step 2: Push to GitHub ('git push origin main').
   - Step 3: Connect Vercel to the GitHub Repo.
   - Step 4: Add Environment Variables in Vercel Settings (NOT in code).
   - Updates: To update the live app, simply commit and push to main.

4. N8N INTEGRATION GUIDE
   - Auth: Use "Google Cloud Firestore" node with "Google OAuth2 (JWT)".
   - Credentials: Create a "Firebase Service Account" -> Generate JSON Key -> Paste into n8n Credential (Service Account Email + Private Key).
   - Operation: n8n writes result data to 'apps/{APP_ID}/actions/{actionId}' or specific report collections.

5. SECURITY PROTOCOLS
   - Client-Side: NO Admin SDK, NO Private Keys. Only use 'firebaseConfig'.
   - Server-Side (n8n/Vercel): Use Service Accounts/API Keys stored in Env Vars.
   - Error Handling: Fail gracefully. If n8n doesn't respond, show UI feedback.

6. UI/UX STANDARDS
   - Font: Headers='Federo', Body='Barlow'.
   - Colors: Strict usage of Brand Colors defined in Tailwind config.
   - Layout: Sticky Sidebar (Dark), Scrollable Content (Light).
`;

export default function Projects() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]); // New State

    const [loading, setLoading] = useState(true);

    // Navigation State
    const [currentView, setCurrentView] = useState<'root' | 'client'>('root');
    const [viewClient, setViewClient] = useState<Client | null>(null);
    const [viewFolder, setViewFolder] = useState<Folder | null>(null); // New State

    // Modal States
    const [isWizardOpen, setIsWizardOpen] = useState(false);
    const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
    const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);

    // Form State (Folder)
    const [folderName, setFolderName] = useState('');

    // Delete State
    const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
    const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null);

    // Move State
    const [projectToMove, setProjectToMove] = useState<Project | null>(null);

    // Form State (Wizard)
    const [selectedClientId, setSelectedClientId] = useState('');
    const [appName, setAppName] = useState('');
    const [appType, setAppType] = useState('Central Hub');
    const [version, setVersion] = useState('v1');
    const [generatedPrompt, setGeneratedPrompt] = useState('');

    // Firebase Config State


    // Computed
    const selectedClient = clients.find(c => c.id === selectedClientId);
    const appId = selectedClient
        ? (appName
            ? `${selectedClient.companyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${appName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${version}`
            : `${selectedClient.companyName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${appType.toLowerCase().replace(/ /g, '_')}_${version}`)
        : '';

    // Subscribe to Projects
    useEffect(() => {
        const q = query(collection(db, 'apps', '2h_hub_v1', 'projects'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Project)));
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // Subscribe to Clients
    useEffect(() => {
        const q = query(collection(db, 'apps', '2h_hub_v1', 'clients'), orderBy('companyName'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Client)));
        });
        return () => unsubscribe();
    }, []);

    // Subscribe to Folders
    useEffect(() => {
        const q = query(collection(db, 'apps', '2h_hub_v1', 'folders'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setFolders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Folder)));
        });
        return () => unsubscribe();
    }, []);


    // Generate Prompt Effect
    useEffect(() => {
        if (selectedClient && appId) {
            const prompt = `
### 📍 WORKSPACE CONTEXT: ${selectedClient.companyName.toUpperCase()} - ${(appName || appType).toUpperCase()}

**1. PROJECT IDENTITY**
*   **APP_ID:** \`${appId}\`
*   **Client (Owner):** ${selectedClient.companyName}
*   **App Name:** ${appName ? appName : appType}
*   **System Blueprint (Type):** ${appType}
*   **Purpose:** Custom ${appType} built for ${selectedClient.companyName}.

**2. CORPORATE VISUAL IDENTITY (Exact Brand Hex Codes)**
*   **Design Style:** Custom Brand Theme.
*   **Color Palette (STRICT):**
    *   **Sidebar/Header Background:** \`${selectedClient.backgroundColor || '#101010'}\`
    *   **Main Content Background:** \`${selectedClient.surfaceColor || '#F0F0F3'}\`
    *   **Primary Brand Color:** \`${selectedClient.primaryColor || '#B7EF02'}\`
    *   **Typography Colors:**
        *   **Headings:** \`${selectedClient.fontHeading || 'Sans-Serif'}\`
        *   **Body:** \`${selectedClient.fontBody || 'Sans-Serif'}\`
*   **Fonts:**
    *   **Headings:** \`${selectedClient.fontHeading || 'Sans-Serif'}\`
    *   **Body:** \`${selectedClient.fontBody || 'Sans-Serif'}\`

**3. APP NAVIGATION**
*   **Dashboard:** High-level metrics.
*   **Core Feature 1:** TBD
*   **Settings:** App configuration.

**4. DEPLOYMENT**
*   **GitHub:** TBD

### 6. INITIAL .ENV CONTENT
\`\`\`env
# Firebase Configuration
VITE_FIREBASE_API_KEY=${import.meta.env.VITE_FIREBASE_API_KEY || 'Pending'}
VITE_FIREBASE_AUTH_DOMAIN=${import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'Pending'}
VITE_FIREBASE_PROJECT_ID=${import.meta.env.VITE_FIREBASE_PROJECT_ID || 'Pending'}
VITE_FIREBASE_STORAGE_BUCKET=${import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'Pending'}
VITE_FIREBASE_MESSAGING_SENDER_ID=${import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || 'Pending'}
VITE_FIREBASE_APP_ID=${import.meta.env.VITE_FIREBASE_APP_ID || 'Pending'}
\`\`\`
            `.trim();
            setGeneratedPrompt(prompt);
        } else {
            setGeneratedPrompt('');
        }
    }, [selectedClient, appId, appType, appName]);

    const resetForm = () => {
        setSelectedClientId('');
        setAppName('');
        setAppType('Central Hub');
        setVersion('v1');

    };

    const handleOpenWizard = () => {
        if (viewClient) {
            setSelectedClientId(viewClient.id);
        }
        setIsWizardOpen(true);
    };

    const handleCreateProject = async () => {
        if (!selectedClient) return;

        const fullSystemContext = generatedPrompt + "\n\n" + GLOBAL_RULES;

        try {
            await setDoc(doc(db, 'apps', '2h_hub_v1', 'projects', appId), {
                appId,
                clientId: selectedClient.id,
                clientName: selectedClient.companyName,
                folderId: viewFolder?.id || null, // ASSIGN TO FOLDER
                type: appType,
                name: appName || appType,
                createdAt: serverTimestamp(),
                memory: fullSystemContext,
                firebaseConfig: {
                    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
                    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
                    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
                    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
                    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
                    appId: import.meta.env.VITE_FIREBASE_APP_ID
                }
            });
            setIsWizardOpen(false);
            resetForm();
        } catch (error) {
            console.error("Error creating project: ", error);
            alert("Failed to create project");
        }
    };

    // FOLDER OPERATIONS
    const handleCreateFolder = async () => {
        if (!viewClient || !folderName.trim()) return;
        try {
            await addDoc(collection(db, 'apps', '2h_hub_v1', 'folders'), {
                name: folderName,
                clientId: viewClient.id,
                createdAt: serverTimestamp()
            });
            setFolderName('');
            setIsFolderModalOpen(false);
        } catch (error) {
            console.error("Error creating folder: ", error);
            alert("Failed to create folder");
        }
    };

    const handleRenameFolder = async () => {
        if (!renamingFolder || !folderName.trim()) return;
        try {
            await updateDoc(doc(db, 'apps', '2h_hub_v1', 'folders', renamingFolder.id), {
                name: folderName
            });
            setRenamingFolder(null);
            setFolderName('');
        } catch (error) {
            console.error("Error renaming folder: ", error);
            alert("Failed to rename folder");
        }
    };

    const handleDeleteFolder = async () => {
        if (!deletingFolderId) return;

        // Check if empty
        const projectsInFolder = projects.filter(p => p.folderId === deletingFolderId);
        if (projectsInFolder.length > 0) {
            alert("Cannot delete non-empty folder. Please delete or move apps first.");
            setDeletingFolderId(null);
            return;
        }

        try {
            await deleteDoc(doc(db, 'apps', '2h_hub_v1', 'folders', deletingFolderId));
            setDeletingFolderId(null);
        } catch (error) {
            console.error("Error deleting folder: ", error);
            alert("Failed to delete folder");
        }
    };

    const handleDeleteProject = async () => {
        if (!deletingProjectId) return;
        try {
            await deleteDoc(doc(db, 'apps', '2h_hub_v1', 'projects', deletingProjectId));
            setDeletingProjectId(null);
        } catch (error) {
            console.error("Error deleting project: ", error);
            alert("Failed to delete project");
        }
    };

    const handleMoveProject = async (targetFolderId: string | null) => {
        if (!projectToMove) return;
        try {
            await updateDoc(doc(db, 'apps', '2h_hub_v1', 'projects', projectToMove.id), {
                folderId: targetFolderId
            });
            setProjectToMove(null);
        } catch (error) {
            console.error("Error moving project: ", error);
            alert("Failed to move project");
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedPrompt);
        alert("Prompt copied to clipboard!");
    };

    // FILTER LOGIC
    // 1. Folders: Only show folders for this client
    const visibleFolders = viewClient
        ? folders.filter(f => f.clientId === viewClient.id)
        : [];

    // 2. Projects: 
    //    - Must match client
    //    - Must match folder (if viewFolder is set, match id; otherwise, match null/undefined)
    const visibleProjects = viewClient
        ? projects.filter(p =>
            p.clientId === viewClient.id &&
            (viewFolder ? p.folderId === viewFolder.id : !p.folderId)
        )
        : [];

    return (
        <DashboardShell
            headerTitle="App Factory"
            sidebarContent={<SidebarNav />}
            headerActions={
                <div className="flex gap-2">
                    {/* New App Button - Always Visible if we can create apps */}
                    <Button onClick={handleOpenWizard}>Create New App</Button>

                    {/* New Folder Button - Only visible inside a client view, but NOT deep inside a folder? 
                        Actually, sub-sub folders are not requested, just 1 level. 
                        So show only if in Client View AND NOT in a Subfolder. 
                    */}
                    {currentView === 'client' && !viewFolder && (
                        <div className="relative">
                            <button
                                onClick={() => setIsFolderModalOpen(true)}
                                className="h-10 w-10 bg-yellow-100 hover:bg-yellow-200 text-yellow-700 rounded-lg flex items-center justify-center transition-colors"
                                title="New Folder"
                            >
                                <FolderInput size={20} />
                            </button>
                        </div>
                    )}
                </div>
            }
        >
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
                <button
                    onClick={() => { setCurrentView('root'); setViewClient(null); setViewFolder(null); }}
                    className="hover:text-brand-lime flex items-center gap-1 transition-colors"
                >
                    <Home size={14} /> Clients
                </button>
                {viewClient && (
                    <>
                        <ChevronRight size={14} />
                        <button
                            onClick={() => setViewFolder(null)}
                            className={`hover:text-brand-lime transition-colors ${!viewFolder ? 'font-medium text-brand-black' : ''}`}
                        >
                            {viewClient.companyName}
                        </button>
                    </>
                )}
                {viewFolder && (
                    <>
                        <ChevronRight size={14} />
                        <span className="font-medium text-brand-black">{viewFolder.name}</span>
                    </>
                )}
            </div>

            {loading ? (
                <p className="text-brand-text-muted">Loading...</p>
            ) : (
                <div className="space-y-8">
                    {/* LEVEL 1: ROOT (CLIENTS) */}
                    {currentView === 'root' && (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {clients.map(client => (
                                <div
                                    key={client.id}
                                    onClick={() => { setViewClient(client); setCurrentView('client'); }}
                                    className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col items-center justify-center gap-4 py-12"
                                >
                                    <Folder size={48} className="text-brand-lime group-hover:scale-110 transition-transform" />
                                    <h3 className="text-lg font-serif font-bold text-brand-black">{client.companyName}</h3>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* LEVEL 2: CLIENT VIEW */}
                    {currentView === 'client' && (
                        <>
                            {/* FOLDERS GRID (Only visible at root of client) */}
                            {!viewFolder && visibleFolders.length > 0 && (
                                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
                                    {visibleFolders.map(folder => (
                                        <div
                                            key={folder.id}
                                            onClick={() => setViewFolder(folder)}
                                            className="bg-yellow-50/50 border border-yellow-100 hover:border-yellow-300 rounded-xl p-4 flex items-center justify-between group cursor-pointer transition-all"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Folder size={24} className="text-yellow-500 fill-yellow-500/20" />
                                                <span className="font-medium text-gray-800">{folder.name}</span>
                                            </div>
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setRenamingFolder(folder); setFolderName(folder.name); }}
                                                    className="p-1.5 hover:bg-yellow-100 rounded-md text-yellow-600"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDeletingFolderId(folder.id); }}
                                                    className="p-1.5 hover:bg-red-100 rounded-md text-red-500"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* APPS GRID */}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {visibleProjects.length === 0 ? (
                                    <div className="col-span-full flex flex-col items-center justify-center p-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                                        <AppWindow size={48} className="mb-4 opacity-20" />
                                        <p>No apps found in {viewFolder ? viewFolder.name : viewClient?.companyName}.</p>
                                        <button onClick={handleOpenWizard} className="text-brand-lime hover:underline mt-2">Create App Here</button>
                                    </div>
                                ) : (
                                    visibleProjects.map(project => (
                                        <div
                                            key={project.id}
                                            onClick={() => navigate(`/projects/${project.id}`)}
                                            className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-all relative group cursor-pointer"
                                        >
                                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-2">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setProjectToMove(project); }}
                                                    className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-brand-lime hover:text-brand-black transition-colors"
                                                    title="Move Project"
                                                >
                                                    <FolderInput size={16} />
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setDeletingProjectId(project.id); }}
                                                    className="p-2 bg-red-50 text-red-600 rounded-full hover:bg-red-100 transition-colors"
                                                    title="Delete Project"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <div className="flex items-start gap-4 mb-3">
                                                <div className="p-3 bg-gray-50 rounded-lg text-brand-lime">
                                                    <Layout size={24} />
                                                </div>
                                                <div>
                                                    <h3 className="text-lg font-serif font-bold text-brand-black leading-tight">{project.name || project.type}</h3>
                                                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mt-1">{project.type}</p>
                                                </div>
                                            </div>

                                            <div className="bg-gray-50 rounded-lg p-2 border border-gray-100 font-mono text-[10px] text-gray-400 break-all truncate">
                                                {project.appId}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>
            )}

            {/* Create Folder Modal */}
            {isFolderModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
                        <h3 className="text-lg font-bold mb-4">New Folder</h3>
                        <input
                            autoFocus
                            type="text"
                            className="w-full px-4 py-2 border rounded-lg mb-4 outline-none focus:border-brand-lime"
                            placeholder="Folder Name (e.g. Archives)"
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleCreateFolder()}
                        />
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => setIsFolderModalOpen(false)} className="flex-1">Cancel</Button>
                            <Button variant="primary" onClick={handleCreateFolder} className="flex-1">Create</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Rename Folder Modal */}
            {renamingFolder && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
                        <h3 className="text-lg font-bold mb-4">Rename Folder</h3>
                        <input
                            autoFocus
                            type="text"
                            className="w-full px-4 py-2 border rounded-lg mb-4 outline-none focus:border-brand-lime"
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleRenameFolder()}
                        />
                        <div className="flex gap-2">
                            <Button variant="secondary" onClick={() => { setRenamingFolder(null); setFolderName(''); }} className="flex-1">Cancel</Button>
                            <Button variant="primary" onClick={handleRenameFolder} className="flex-1">Save</Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Wizard Modal */}
            {isWizardOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-10">
                    <div className="bg-white rounded-xl p-8 w-full max-w-4xl shadow-2xl relative my-auto">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-2xl font-serif font-bold text-brand-black">New App Wizard</h3>
                            <button onClick={() => setIsWizardOpen(false)} className="text-gray-400 hover:text-gray-600">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Left: Inputs */}
                            <div className="space-y-6 overflow-y-auto max-h-[70vh] pr-2">
                                {/* Section 1: Basic Info */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-gray-900 border-b pb-2">1. App Identity</h4>
                                    <div>
                                        <label className="block text-sm font-medium text-brand-text-muted mb-1">Select Client</label>
                                        <select
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                            value={selectedClientId}
                                            onChange={(e) => setSelectedClientId(e.target.value)}
                                        >
                                            <option value="">-- Choose Client --</option>
                                            {clients.map(c => (
                                                <option key={c.id} value={c.id}>{c.companyName}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-brand-text-muted mb-1">App Name (Specific)</label>
                                        <input
                                            type="text"
                                            className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                            placeholder="e.g. Marketing Dashboard 2026"
                                            value={appName}
                                            onChange={(e) => setAppName(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-brand-text-muted mb-1">App Type</label>
                                            <select
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                                value={appType}
                                                onChange={(e) => setAppType(e.target.value)}
                                            >
                                                <option value="Central Hub">Central Hub</option>
                                                <option value="Ads Manager">Ads Manager</option>
                                                <option value="SEO Suite">SEO Suite</option>
                                                <option value="Onboarding">Onboarding Portal</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-brand-text-muted mb-1">Version</label>
                                            <input
                                                type="text"
                                                className="w-full px-4 py-2 rounded-lg border border-gray-200 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                                value={version}
                                                onChange={(e) => setVersion(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>


                            </div>

                            {/* Right: Magic Preview */}
                            <div className="bg-zinc-900 rounded-xl p-4 overflow-hidden flex flex-col h-[70vh]">
                                <h4 className="text-sm font-bold text-brand-lime mb-2">Generated Workspace Prompt</h4>

                                {selectedClient ? (
                                    <>
                                        <div className="flex-1 overflow-y-auto mb-4 text-xs font-mono text-gray-300 whitespace-pre-wrap">
                                            {generatedPrompt}
                                        </div>
                                        <button
                                            onClick={copyToClipboard}
                                            className="w-full py-2 bg-brand-lime text-brand-black font-bold rounded-lg text-xs hover:bg-white transition-colors"
                                        >
                                            Copy Prompt to Clipboard
                                        </button>
                                    </>
                                ) : (
                                    <div className="flex-1 flex items-center justify-center text-gray-600 text-xs text-center p-4">
                                        Select a client to generate the prompt.
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex gap-3 mt-8 pt-6 border-t">
                            <Button type="button" variant="secondary" onClick={() => setIsWizardOpen(false)} className="flex-1">
                                Cancel
                            </Button>
                            <Button type="button" variant="primary" onClick={handleCreateProject} className="flex-1" disabled={!selectedClient}>
                                Initialize Project
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* Secure Delete Modal */}
            <SecureDeleteModal
                isOpen={!!deletingProjectId}
                onClose={() => setDeletingProjectId(null)}
                onConfirm={handleDeleteProject}
                title="Project"
            />

            {/* Secure Delete Folder Modal */}
            <SecureDeleteModal
                isOpen={!!deletingFolderId}
                onClose={() => setDeletingFolderId(null)}
                onConfirm={handleDeleteFolder}
                title="Folder"
            />

            {/* Move Project Modal */}
            {projectToMove && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="bg-white rounded-xl p-6 w-full max-w-sm shadow-xl">
                        <h3 className="text-lg font-bold mb-4">Move '{projectToMove.name}'</h3>
                        <p className="text-sm text-gray-500 mb-4">Select a destination folder:</p>

                        <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-2">
                            {/* Root Option */}
                            <button
                                onClick={() => handleMoveProject(null)}
                                className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3 ${!projectToMove.folderId ? 'border-brand-lime bg-lime-50' : 'border-gray-100 hover:border-brand-lime hover:bg-gray-50'}`}
                            >
                                <div className={`p-2 rounded-full ${!projectToMove.folderId ? 'bg-brand-lime text-brand-black' : 'bg-gray-100 text-gray-500'}`}>
                                    <Home size={16} />
                                </div>
                                <span className="font-medium">Client Root</span>
                                {!projectToMove.folderId && <span className="text-xs bg-brand-lime px-2 py-0.5 rounded-full ml-auto">Current</span>}
                            </button>

                            {/* Subfolder Options */}
                            {folders.filter(f => f.clientId === projectToMove.clientId).map(folder => (
                                <button
                                    key={folder.id}
                                    onClick={() => handleMoveProject(folder.id)}
                                    className={`w-full text-left px-4 py-3 rounded-lg border transition-all flex items-center gap-3 ${projectToMove.folderId === folder.id ? 'border-brand-lime bg-lime-50' : 'border-gray-100 hover:border-brand-lime hover:bg-gray-50'}`}
                                >
                                    <div className={`p-2 rounded-full ${projectToMove.folderId === folder.id ? 'bg-brand-lime text-brand-black' : 'bg-yellow-100 text-yellow-600'}`}>
                                        <Folder size={16} />
                                    </div>
                                    <span className="font-medium">{folder.name}</span>
                                    {projectToMove.folderId === folder.id && <span className="text-xs bg-brand-lime px-2 py-0.5 rounded-full ml-auto">Current</span>}
                                </button>
                            ))}
                        </div>

                        <div className="flex gap-2 mt-6">
                            <Button variant="secondary" onClick={() => setProjectToMove(null)} className="flex-1">Cancel</Button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardShell>
    );
}
