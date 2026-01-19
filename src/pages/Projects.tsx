import { useState, useEffect } from 'react';
import { collection, setDoc, deleteDoc, doc, onSnapshot, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import Button from '../components/Button';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';
import SecureDeleteModal from '../components/SecureDeleteModal';
import { Trash2, Folder, AppWindow, ChevronRight, Home, Layout } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Project {
    id: string;
    appId: string;
    clientId: string;
    clientName: string;
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

const GLOBAL_RULES = `
*** 2H WEBSOLUTIONS ECOSYSTEM & RULES ***

1. OUR WORLD (THE STACK)
   - IDE/Builder: Google Antigravity (Agent-first coding).
   - Hosting/Edge: Vercel (Serverless Functions used for AI/API).
   - Backend/DB: Firebase (Firestore, Auth, Storage).
   - Automation: n8n (Handles complex logic & third-party integrations).
   - Code: React + Tailwind + TypeScript.

2. CORE ARCHITECTURE (SINGLE BACKEND)
   - NEVER create a new Firebase project. Use the provided config.
   - SCOPE: All DB writes must go to 'apps/{APP_ID}/...'.
   - AUTH: Use Firebase Auth. No custom user databases.

3. SECURITY & API KEYS (STRICT)
   - CLIENT-SIDE: Public keys (like Firebase Config) go into '.env'.
   - SERVER-SIDE (Secrets): Keys like 'GOOGLE_GEMINI_API_KEY' MUST be set in Vercel Environment Variables.
   - ACCESS: In code, access secrets via 'process.env.KEY_NAME' (only works in /api/ functions).
   - RULE: Never hardcode an API Key in a file committed to GitHub.

4. EXTERNAL CONNECTIONS
   - Simple AI: Use Vercel Serverless Functions (/api/chat).
   - Complex Ops: Write a document to 'apps/{APP_ID}/actions/'. n8n will trigger, execute, and write back the result.

5. CODING STANDARD
   - UI: Tailwind CSS only. Use 'lucide-react' for icons.
   - ERROR HANDLING: Log errors to console AND 'apps/{APP_ID}/system_logs'.
`.trim();

export default function Projects() {
    const navigate = useNavigate();
    const [projects, setProjects] = useState<Project[]>([]);
    const [clients, setClients] = useState<Client[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [loading, setLoading] = useState(true);

    // Navigation State
    const [currentView, setCurrentView] = useState<'root' | 'client'>('root');
    const [viewClient, setViewClient] = useState<Client | null>(null);

    // Delete State
    const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);

    // Form State (Wizard)
    const [selectedClientId, setSelectedClientId] = useState('');
    const [appName, setAppName] = useState('');
    const [appType, setAppType] = useState('Central Hub');
    const [version, setVersion] = useState('v1');
    const [generatedPrompt, setGeneratedPrompt] = useState('');

    // Firebase Config State
    const [apiKey, setApiKey] = useState('');
    const [authDomain, setAuthDomain] = useState('');
    const [projectId, setProjectId] = useState('');
    const [storageBucket, setStorageBucket] = useState('');
    const [messagingSenderId, setMessagingSenderId] = useState('');
    const [fbAppId, setFbAppId] = useState('');

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
VITE_FIREBASE_API_KEY=${apiKey || 'Pending'}
VITE_FIREBASE_AUTH_DOMAIN=${authDomain || 'Pending'}
VITE_FIREBASE_PROJECT_ID=${projectId || 'Pending'}
VITE_FIREBASE_STORAGE_BUCKET=${storageBucket || 'Pending'}
VITE_FIREBASE_MESSAGING_SENDER_ID=${messagingSenderId || 'Pending'}
VITE_FIREBASE_APP_ID=${fbAppId || 'Pending'}
\`\`\`
            `.trim();
            setGeneratedPrompt(prompt);
        } else {
            setGeneratedPrompt('');
        }
    }, [selectedClient, appId, appType, appName, apiKey, authDomain, projectId, storageBucket, messagingSenderId, fbAppId]);

    const resetForm = () => {
        setSelectedClientId('');
        setAppName('');
        setAppType('Central Hub');
        setVersion('v1');
        setApiKey('');
        setAuthDomain('');
        setProjectId('');
        setStorageBucket('');
        setMessagingSenderId('');
        setFbAppId('');
    };

    const handleOpenWizard = () => {
        if (viewClient) {
            setSelectedClientId(viewClient.id);
        }
        setIsModalOpen(true);
    };

    const handleCreateProject = async () => {
        if (!selectedClient) return;

        const fullSystemContext = generatedPrompt + "\n\n" + GLOBAL_RULES;

        try {
            await setDoc(doc(db, 'apps', '2h_hub_v1', 'projects', appId), {
                appId,
                clientId: selectedClient.id,
                clientName: selectedClient.companyName,
                type: appType,
                name: appName || appType,
                createdAt: serverTimestamp(),
                memory: fullSystemContext,
                firebaseConfig: {
                    apiKey,
                    authDomain,
                    projectId,
                    storageBucket,
                    messagingSenderId,
                    appId: fbAppId
                }
            });
            setIsModalOpen(false);
            resetForm();
        } catch (error) {
            console.error("Error creating project: ", error);
            alert("Failed to create project");
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

    const copyToClipboard = () => {
        navigator.clipboard.writeText(generatedPrompt);
        alert("Prompt copied to clipboard!");
    };

    // Filter projects for view
    const visibleProjects = viewClient
        ? projects.filter(p => p.clientId === viewClient.id)
        : [];

    return (
        <DashboardShell
            headerTitle="App Factory"
            sidebarContent={<SidebarNav />}
            headerActions={
                <Button onClick={handleOpenWizard}>Create New App</Button>
            }
        >
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
                <button
                    onClick={() => { setCurrentView('root'); setViewClient(null); }}
                    className="hover:text-brand-lime flex items-center gap-1 transition-colors"
                >
                    <Home size={14} /> Clients
                </button>
                {viewClient && (
                    <>
                        <ChevronRight size={14} />
                        <span className="font-medium text-brand-black">{viewClient.companyName}</span>
                    </>
                )}
            </div>

            {loading ? (
                <p className="text-brand-text-muted">Loading...</p>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {currentView === 'root' ? (
                        // CLIENT FOLDERS
                        clients.map(client => (
                            <div
                                key={client.id}
                                onClick={() => { setViewClient(client); setCurrentView('client'); }}
                                className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col items-center justify-center gap-4 py-12"
                            >
                                <Folder size={48} className="text-brand-lime group-hover:scale-110 transition-transform" />
                                <h3 className="text-lg font-serif font-bold text-brand-black">{client.companyName}</h3>
                            </div>
                        ))
                    ) : (
                        // APP CARDS
                        <>
                            {visibleProjects.length === 0 ? (
                                <div className="col-span-full flex flex-col items-center justify-center p-12 text-gray-400 border border-dashed border-gray-200 rounded-xl">
                                    <AppWindow size={48} className="mb-4 opacity-20" />
                                    <p>No apps found for {viewClient?.companyName}.</p>
                                    <button onClick={handleOpenWizard} className="text-brand-lime hover:underline mt-2">Create First App</button>
                                </div>
                            ) : (
                                visibleProjects.map(project => (
                                    <div
                                        key={project.id}
                                        onClick={() => navigate(`/projects/${project.id}`)}
                                        className="bg-white border border-gray-100 rounded-xl p-6 shadow-sm hover:shadow-md transition-all relative group cursor-pointer"
                                    >
                                        {/* Delete Action */}
                                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
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
                        </>
                    )}
                </div>
            )}

            {/* Wizard Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm overflow-y-auto py-10">
                    <div className="bg-white rounded-xl p-8 w-full max-w-4xl shadow-2xl relative my-auto">
                        <h3 className="text-2xl font-serif font-bold text-brand-black mb-6">New App Wizard</h3>

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

                                {/* Section 2: Firebase Config */}
                                <div className="space-y-4">
                                    <h4 className="text-sm font-bold text-gray-900 border-b pb-2">2. Firebase Configuration</h4>

                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">apiKey</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50"
                                            value={apiKey}
                                            onChange={(e) => setApiKey(e.target.value)}
                                        />
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">authDomain</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50"
                                                value={authDomain}
                                                onChange={(e) => setAuthDomain(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">projectId</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50"
                                                value={projectId}
                                                onChange={(e) => setProjectId(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">storageBucket</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50"
                                                value={storageBucket}
                                                onChange={(e) => setStorageBucket(e.target.value)}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-500 mb-1">messagingSenderId</label>
                                            <input
                                                type="text"
                                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50"
                                                value={messagingSenderId}
                                                onChange={(e) => setMessagingSenderId(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 mb-1">appId</label>
                                        <input
                                            type="text"
                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50"
                                            value={fbAppId}
                                            onChange={(e) => setFbAppId(e.target.value)}
                                        />
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
                            <Button type="button" variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">
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
        </DashboardShell>
    );
}
