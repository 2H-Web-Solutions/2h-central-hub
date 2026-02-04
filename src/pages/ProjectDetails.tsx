import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, query, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';
import Button from '../components/Button';
import { Github, Globe, ExternalLink, MessageSquare, Trash2, Lock, Copy, Paperclip, X, Archive, Map, Hammer, Bug, BookOpen, Edit2, Plus, PenSquare, Key } from 'lucide-react';
import toast from 'react-hot-toast';

interface Project {
    id: string;
    appId: string;
    clientName: string;
    type: string;
    githubUrl?: string;
    vercelUrl?: string;
    geminiApiKey?: string;
    memory?: string;
    firebaseConfig?: {
        apiKey?: string;
        authDomain?: string;
        projectId?: string;
        storageBucket?: string;
        messagingSenderId?: string;
        appId?: string;
    };
    agentMode?: 'STARTER' | 'BUILDER' | 'SOLVER';
    name?: string;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'ai' | 'system';
    content: string;
    attachments?: string[]; // Base64 strings
    timestamp: any;
}

interface parsedLog {
    title: string;
    date: string;
    content: string;
    raw: string;
}

export default function ProjectDetails() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    // Form States
    const [githubUrl, setGithubUrl] = useState('');
    const [vercelUrl, setVercelUrl] = useState('');
    const [geminiApiKey, setGeminiApiKey] = useState('');
    const [memory, setMemory] = useState('');

    // Knowledge Base Tabs
    const [knowledgeTab, setKnowledgeTab] = useState<'timeline' | 'editor'>('timeline');
    const [parsedLogs, setParsedLogs] = useState<parsedLog[]>([]);

    // Note State
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [noteTitle, setNoteTitle] = useState('');
    const [noteContent, setNoteContent] = useState('');


    // Firebase Config Form States
    const [apiKey, setApiKey] = useState('');
    const [authDomain, setAuthDomain] = useState('');
    const [fbProjectId, setFbProjectId] = useState('');
    const [storageBucket, setStorageBucket] = useState('');
    const [messagingSenderId, setMessagingSenderId] = useState('');
    const [fbAppId, setFbAppId] = useState('');

    // Chat States
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [isThinking, setIsThinking] = useState(false);
    const [agentMode, setAgentMode] = useState<'STARTER' | 'BUILDER' | 'SOLVER'>('STARTER');
    const [attachments, setAttachments] = useState<string[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Subscribe to Project Data
    useEffect(() => {
        if (!projectId) return;
        const docRef = doc(db, 'apps', '2h_hub_v1', 'projects', projectId);
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Project;
                setProject({ ...data, id: docSnap.id });

                // Sync form state if fields are not focused to avoid overwriting user input
                if (document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
                    setGithubUrl(data.githubUrl || '');
                    setVercelUrl(data.vercelUrl || '');
                    setGeminiApiKey(data.geminiApiKey || '');
                    setMemory(data.memory || '');

                    if (data.firebaseConfig) {
                        setApiKey(data.firebaseConfig.apiKey || '');
                        setAuthDomain(data.firebaseConfig.authDomain || '');
                        setFbProjectId(data.firebaseConfig.projectId || '');
                        setStorageBucket(data.firebaseConfig.storageBucket || '');
                        setMessagingSenderId(data.firebaseConfig.messagingSenderId || '');
                        setFbAppId(data.firebaseConfig.appId || '');
                    }
                }

                // Sync Agent Mode from Project (Persistence)
                if (data.agentMode) {
                    setAgentMode(data.agentMode as 'STARTER' | 'BUILDER' | 'SOLVER');
                }

                setLoading(false);
            } else {
                navigate('/projects');
            }
        });
        return () => unsubscribe();
    }, [projectId, navigate]);


    // Parse Memory to Logs
    useEffect(() => {
        if (project?.memory) {
            setMemory(project.memory);
            setParsedLogs(parseMemoryToLogs(project.memory));
        } else {
            setParsedLogs([]);
        }
    }, [project]);

    // Helper: Parse Memory String
    const parseMemoryToLogs = (memoryString: string): parsedLog[] => {
        if (!memoryString) return [];
        // Split by markdown H2 '## '
        const rawChunks = memoryString.split(/(?=^## )/gm);

        return rawChunks.map(chunk => {
            const lines = chunk.trim().split('\n');
            const titleLine = lines[0].replace(/^## /, '').trim();

            // Extract Date if present in title (e.g., "Title - 2024-01-30")
            // Looking for YYYY-MM-DD at the end or embedded
            const dateMatch = titleLine.match(/(\d{4}-\d{2}-\d{2})/);
            const date = dateMatch ? dateMatch[0] : 'No Date';

            // Clean title by removing date if it's at the end
            let cleanTitle = titleLine.replace(/\s*-\s*\d{4}-\d{2}-\d{2}$/, '').substring(0, 40); // truncate for UI
            if (cleanTitle.length === 40) cleanTitle += "...";

            const content = lines.slice(1).join('\n').trim();

            if (!chunk.trim()) return null; // skip empty chunks

            // Store raw content WITHOUT the leading ## for reconstruction
            const raw = chunk.replace(/^## /, '');

            return {
                title: cleanTitle || "Untitled Log",
                date: date,
                content: content,
                raw: raw
            };
        }).filter(log => log !== null) as parsedLog[];
    };


    // Subscribe to Chat Messages
    useEffect(() => {
        if (!projectId) return;
        const q = query(
            collection(db, 'apps', '2h_hub_v1', 'projects', projectId, 'chat'),
            orderBy('timestamp', 'asc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as ChatMessage));
            setMessages(msgs);
        });
        return () => unsubscribe();
    }, [projectId]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleUpdateField = async (field: keyof Project, value: string) => {
        if (!projectId) return;
        try {
            const docRef = doc(db, 'apps', '2h_hub_v1', 'projects', projectId);
            await updateDoc(docRef, { [field]: value });
        } catch (error) {
            console.error(`Error updating ${field}:`, error);
        }
    };

    const handleAddNote = async () => {
        if (!noteTitle.trim() || !noteContent.trim() || !projectId) return;

        const dateStr = new Date().toISOString().split('T')[0];
        const newLogEntry = `## ${noteTitle} - ${dateStr}\n${noteContent}`;

        const newMemory = (newLogEntry + "\n\n" + (project?.memory || "")).trim();

        // Update Firestore
        await handleUpdateField('memory', newMemory);

        // Reset Form
        setNoteTitle('');
        setNoteContent('');
        setIsNoteModalOpen(false);
        toast.success("Note added to timeline");
    };

    const handleDeleteEntry = async (index: number) => {
        if (!project?.memory || !projectId) return;

        if (!window.confirm("Are you sure you want to delete this log entry?")) return;

        // Use the parsed logs to reconstruct, skipping the deleted index
        const updatedLogs = parsedLogs.filter((_, i) => i !== index);

        // Reconstruct: Add "## " back to the raw content
        const newMemory = updatedLogs.map(log => "## " + log.raw).join("\n\n").trim();

        await handleUpdateField('memory', newMemory);
        toast.success("Entry deleted");
    };


    const handleModeChange = async (newMode: 'STARTER' | 'BUILDER' | 'SOLVER') => {
        setAgentMode(newMode);
        toast.success(`Switched to ${newMode === 'STARTER' ? 'Architect' : newMode === 'BUILDER' ? 'Builder' : 'Fixer'} Mode`);

        if (!projectId) return;
        try {
            const docRef = doc(db, 'apps', '2h_hub_v1', 'projects', projectId);
            await updateDoc(docRef, { agentMode: newMode });
        } catch (error) {
            console.error("Error updating agent mode:", error);
        }
    };

    const handleUpdateConfig = async () => {
        if (!projectId) return;
        try {
            const docRef = doc(db, 'apps', '2h_hub_v1', 'projects', projectId);
            await updateDoc(docRef, {
                firebaseConfig: {
                    apiKey,
                    authDomain,
                    projectId: fbProjectId,
                    storageBucket,
                    messagingSenderId,
                    appId: fbAppId
                }
            });
        } catch (error) {
            console.error("Error updating firebase config:", error);
        }
    };

    const handleCopyEnv = () => {
        const envContent = `VITE_FIREBASE_API_KEY=${apiKey}
VITE_FIREBASE_AUTH_DOMAIN=${authDomain}
VITE_FIREBASE_PROJECT_ID=${fbProjectId}
VITE_FIREBASE_STORAGE_BUCKET=${storageBucket}
VITE_FIREBASE_MESSAGING_SENDER_ID=${messagingSenderId}
VITE_FIREBASE_APP_ID=${fbAppId}`;

        navigator.clipboard.writeText(envContent);
        toast.success("Copied .env block!");
    };

    // --- FILE HANDLING ---

    const convertFileToBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
        });
    };

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const files = Array.from(e.target.files);
            const base64s = await Promise.all(files.map(file => convertFileToBase64(file)));
            setAttachments(prev => [...prev, ...base64s]);
        }
    };

    const handlePaste = async (e: React.ClipboardEvent) => {
        const items = e.clipboardData.items;
        const promises: Promise<string>[] = [];

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) {
                    promises.push(convertFileToBase64(file));
                }
            }
        }

        if (promises.length > 0) {
            const base64s = await Promise.all(promises);
            setAttachments(prev => [...prev, ...base64s]);
        }
    };

    const handleDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
            if (files.length > 0) {
                const base64s = await Promise.all(files.map(file => convertFileToBase64(file)));
                setAttachments(prev => [...prev, ...base64s]);
            }
        }
    };

    const removeAttachment = (index: number) => {
        setAttachments(prev => prev.filter((_, i) => i !== index));
    };

    // --- SEND LOGIC ---

    const handleSendMessage = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();

        if ((!chatInput.trim() && attachments.length === 0) || !projectId) return;

        const currentInput = chatInput;
        const currentAttachments = attachments;

        setChatInput('');
        setAttachments([]);
        setIsThinking(true);

        try {
            // 1. Write User Message to Firestore (Instant)
            await addDoc(collection(db, 'apps', '2h_hub_v1', 'projects', projectId, 'chat'), {
                role: 'user',
                content: currentInput,
                attachments: currentAttachments,
                timestamp: serverTimestamp()
            });

            // 2. Call API
            const metadata = `
*** LIVE PROJECT METADATA ***
- App Name: ${project?.name || project?.type || 'Unknown'}
- Client: ${project?.clientName || 'Unknown'}
- GitHub Repo: ${githubUrl || 'Not set'}
- Vercel Deployment: ${vercelUrl || 'Not set'}
- Gemini API Key: ${geminiApiKey || 'Pending'}
- Firebase Config:
  apiKey: ${apiKey || 'Pending'}
  authDomain: ${authDomain || 'Pending'}
  projectId: ${fbProjectId || 'Pending'}
  storageBucket: ${storageBucket || 'Pending'}
  messagingSenderId: ${messagingSenderId || 'Pending'}
  appId: ${fbAppId || 'Pending'}
`;
            const combinedContext = (project?.memory || "") + "\n\n" + metadata;

            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: currentInput + (currentAttachments.length > 0 ? `\n[With ${currentAttachments.length} images]` : ''),
                    context: combinedContext,
                    agent: "Builder",
                    agentMode: agentMode,
                    history: messages.map(m => ({ role: m.role, content: m.content })),
                    // NOTE: Real multimodal support would require sending the Base64 in a specific format to the API. 
                    // For now, we assume text-based context or that the API ignores images if not supported.
                    // If you want actual Vision capabilities, you'd insert the image data here.
                    images: currentAttachments
                })
            });

            // Check if response is JSON
            const contentType = response.headers.get("content-type");
            if (!contentType || !contentType.includes("application/json")) {
                throw new Error("API not available (Localhost? Deploy to Vercel to test AI).");
            }

            if (!response.ok) {
                throw new Error("API Request failed");
            }

            const data = await response.json();

            if (data.reply) {
                // 3. Write AI Response to Firestore
                await addDoc(collection(db, 'apps', '2h_hub_v1', 'projects', projectId, 'chat'), {
                    role: 'ai',
                    content: data.reply,
                    timestamp: serverTimestamp()
                });
            } else {
                console.error("No reply from API");
                toast.error("AI failed to respond");
            }

        } catch (error: any) {
            console.error("Chat Error:", error);
            toast.error(error.message || "Failed to connect to AI");
        } finally {
            setIsThinking(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            handleSendMessage();
        }
    };

    // --- CHAT MANAGEMENT ---

    const handleSmartArchive = async () => {
        if (!projectId || !project) return;
        if (messages.length === 0) {
            toast.error("No chat history to archive.");
            return;
        }

        const toastId = toast.loading("Writing Logbook Entry...");

        try {
            // 1. Generate Log Entry (Only sends chat history, not full memory)
            const response = await fetch('/api/archive', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chatHistory: messages.map(m => ({ role: m.role, content: m.content }))
                })
            });

            if (!response.ok) throw new Error("Logbook API failed");

            const data = await response.json();
            const newEntry = data.newEntry;

            if (!newEntry) throw new Error("No entry returned");

            // 2. Append to Top (Logbook Style)
            // Keep existing memory, add new entry at the top with a separator
            const currentMemory = project.memory || "";
            const updatedMemory = (newEntry + "\n\n" + currentMemory).trim();

            // 3. Save to Firestore
            const docRef = doc(db, 'apps', '2h_hub_v1', 'projects', projectId);
            await updateDoc(docRef, { memory: updatedMemory });

            // 4. Update UI
            setProject(prev => prev ? ({ ...prev, memory: updatedMemory }) : null);
            setMemory(updatedMemory);

            toast.success("Logbook updated!", { id: toastId });

            // 5. Cleanup
            await handleWipeChat(true);
            if (agentMode === 'STARTER') {
                handleModeChange('BUILDER');
            }

        } catch (error) {
            console.error("Archive failed:", error);
            toast.error("Logbook entry failed.", { id: toastId });
        }
    };

    const handleWipeChat = async (skipConfirm = false) => {
        if (!projectId) return;
        if (!skipConfirm && !window.confirm("Are you sure you want to WIPE the chat history? This cannot be undone.")) return;

        try {
            const chatColl = collection(db, 'apps', '2h_hub_v1', 'projects', projectId, 'chat');
            const snapshot = await getDocs(chatColl);
            const batch = writeBatch(db);
            snapshot.docs.forEach((doc) => {
                batch.delete(doc.ref);
            });
            await batch.commit();
            toast.success("Chat wiped clean.");
        } catch (error) {
            console.error("Error clearing chat:", error);
            toast.error("Failed to wipe chat");
        }
    };

    if (loading) {
        return (
            <DashboardShell headerTitle="Loading..." sidebarContent={<SidebarNav />}>
                <div className="flex items-center justify-center h-full text-gray-400">Loading Project...</div>
            </DashboardShell>
        );
    }

    return (
        <DashboardShell
            headerTitle="Project Cockpit"
            sidebarContent={<SidebarNav />}
            headerActions={
                <div className="flex items-center gap-2 text-sm text-gray-500 font-mono bg-gray-100 px-3 py-1 rounded-full">
                    {project?.appId}
                </div>
            }
        >
            <div className="flex h-[calc(100vh-140px)] gap-6">
                {/* LEFT COLUMN: Project Context */}
                <div className="w-1/3 flex flex-col gap-6 overflow-y-auto pr-2">
                    {/* Header Card */}
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                        <h1 className="text-3xl font-serif font-bold text-brand-black mb-1">{project?.name || project?.type}</h1>
                        <span className="text-brand-lime font-medium text-sm">{project?.clientName}</span>
                    </div>

                    {/* Links Card */}
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
                        <h3 className="font-bold text-gray-900 border-b pb-2 flex items-center gap-2">
                            <ExternalLink size={16} /> Deployment
                        </h3>

                        <div>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-1">
                                <Github size={14} /> Repository URL
                            </label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50 font-mono text-xs"
                                placeholder="https://github.com/..."
                                value={githubUrl}
                                onChange={(e) => setGithubUrl(e.target.value)}
                                onBlur={() => handleUpdateField('githubUrl', githubUrl)}
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-1">
                                <Globe size={14} /> Vercel Deployment
                            </label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50 font-mono text-xs"
                                placeholder="https://..."
                                value={vercelUrl}
                                onChange={(e) => setVercelUrl(e.target.value)}
                                onBlur={() => handleUpdateField('vercelUrl', vercelUrl)}
                            />
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-1">
                                <Key size={14} /> Gemini API Key (AI Studio)
                            </label>
                            <input
                                type="text"
                                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50 font-mono text-xs"
                                placeholder="AIza..."
                                value={geminiApiKey}
                                onChange={(e) => setGeminiApiKey(e.target.value)}
                                onBlur={() => handleUpdateField('geminiApiKey', geminiApiKey)}
                            />
                        </div>
                    </div>

                    {/* Firebase Config Card */}
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-4">
                        <div className="flex justify-between items-center border-b pb-2">
                            <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                <Lock size={16} /> Firebase Configuration
                            </h3>
                            <button
                                onClick={handleCopyEnv}
                                className="text-xs flex items-center gap-1 text-brand-lime hover:text-brand-black transition-colors font-medium cursor-pointer"
                                title="Copy as .env block"
                            >
                                <Copy size={12} /> Copy .env
                            </button>
                        </div>

                        <div className="grid grid-cols-1 gap-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">apiKey</label>
                                <input
                                    type="text"
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50"
                                    value={apiKey}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    onBlur={handleUpdateConfig}
                                    placeholder="Pending..."
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">authDomain</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50"
                                        value={authDomain}
                                        onChange={(e) => setAuthDomain(e.target.value)}
                                        onBlur={handleUpdateConfig}
                                        placeholder="Pending..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">projectId</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50"
                                        value={fbProjectId}
                                        onChange={(e) => setFbProjectId(e.target.value)}
                                        onBlur={handleUpdateConfig}
                                        placeholder="Pending..."
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">storageBucket</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50"
                                        value={storageBucket}
                                        onChange={(e) => setStorageBucket(e.target.value)}
                                        onBlur={handleUpdateConfig}
                                        placeholder="Pending..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-500 mb-1">messagingSenderId</label>
                                    <input
                                        type="text"
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs font-mono focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50"
                                        value={messagingSenderId}
                                        onChange={(e) => setMessagingSenderId(e.target.value)}
                                        onBlur={handleUpdateConfig}
                                        placeholder="Pending..."
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
                                    onBlur={handleUpdateConfig}
                                    placeholder="Pending..."
                                />
                            </div>
                        </div>
                    </div>

                    {/* Persistent Memory / Knowledge Timeline */}
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm flex-1 flex flex-col overflow-hidden">
                        {/* Tabs Header */}
                        <div className="flex border-b border-gray-100 px-6 pt-4 pb-0 gap-6">
                            <button
                                onClick={() => setKnowledgeTab('timeline')}
                                className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${knowledgeTab === 'timeline'
                                    ? 'border-brand-lime text-brand-black'
                                    : 'border-transparent text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                <BookOpen size={16} /> Timeline
                            </button>
                            <button
                                onClick={() => setKnowledgeTab('editor')}
                                className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${knowledgeTab === 'editor'
                                    ? 'border-brand-lime text-brand-black'
                                    : 'border-transparent text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                <Edit2 size={16} /> Raw Editor
                            </button>
                        </div>

                        {/* Content Area */}

                        {/* 1. Timeline View */}
                        {knowledgeTab === 'timeline' && (
                            <div className="flex-1 flex flex-col relative overflow-hidden">
                                {/* Add Note Header */}
                                <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Logbook Entries</span>
                                    <button
                                        onClick={() => setIsNoteModalOpen(true)}
                                        className="bg-brand-black text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-gray-800 transition-colors shadow-sm"
                                    >
                                        <Plus size={14} /> Add Note
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                    {/* Modal for Adding Note */}
                                    {isNoteModalOpen && (
                                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                                            <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl overflow-hidden border border-gray-100 animate-in zoom-in-95 duration-200">
                                                {/* Modal Header */}
                                                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                                                    <h3 className="font-bold text-lg text-brand-black flex items-center gap-2">
                                                        <PenSquare size={18} className="text-brand-lime" />
                                                        Add Knowledge Entry
                                                    </h3>
                                                    <button
                                                        onClick={() => setIsNoteModalOpen(false)}
                                                        className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-full hover:bg-gray-100"
                                                    >
                                                        <X size={20} />
                                                    </button>
                                                </div>

                                                {/* Modal Body */}
                                                <div className="p-6 space-y-4">
                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Entry Title</label>
                                                        <input
                                                            type="text"
                                                            className="w-full px-4 py-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-800 focus:border-brand-lime focus:ring-2 focus:ring-brand-lime/20 outline-none bg-white transition-all"
                                                            placeholder="e.g. Database Schema Update"
                                                            value={noteTitle}
                                                            onChange={(e) => setNoteTitle(e.target.value)}
                                                            autoFocus
                                                        />
                                                    </div>

                                                    <div>
                                                        <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Entry Content</label>
                                                        <textarea
                                                            className="w-full px-4 py-3 rounded-lg border border-gray-200 text-sm focus:border-brand-lime focus:ring-2 focus:ring-brand-lime/20 outline-none bg-white min-h-[150px] resize-none leading-relaxed"
                                                            placeholder="Describe the update, decision, or feature..."
                                                            value={noteContent}
                                                            onChange={(e) => setNoteContent(e.target.value)}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Modal Footer */}
                                                <div className="bg-gray-50 px-6 py-4 flex justify-end gap-3 border-t border-gray-100">
                                                    <button
                                                        onClick={() => setIsNoteModalOpen(false)}
                                                        className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <Button onClick={handleAddNote} disabled={!noteTitle.trim() || !noteContent.trim()}>
                                                        Save Entry
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Logs List */}
                                    {parsedLogs.length === 0 ? (
                                        <div className="text-center py-10 text-gray-400 text-sm italic">
                                            No logs yet. Use Smart Archive or Add Note.
                                        </div>
                                    ) : (
                                        parsedLogs.map((log, idx) => (
                                            <details key={idx} className="group bg-gray-50 border border-gray-100 rounded-xl open:bg-white open:shadow-md transition-all duration-200">
                                                <summary className="flex items-center justify-between p-4 cursor-pointer font-medium text-gray-700 hover:text-brand-black select-none list-none">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-lime group-open:scale-125 transition-transform"></div>
                                                        <span className="font-bold">{log.title}</span>
                                                    </div>
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-xs font-mono text-gray-400 bg-white px-2 py-1 rounded border border-gray-100">{log.date}</span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.preventDefault();
                                                                e.stopPropagation();
                                                                handleDeleteEntry(idx);
                                                            }}
                                                            className="text-gray-300 hover:text-red-500 transition-colors p-1"
                                                            title="Delete Entry"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </summary>
                                                <div className="px-4 pb-4 pt-0 text-sm text-gray-600 whitespace-pre-wrap leading-relaxed pl-8 border-t border-gray-50 mt-2">
                                                    {log.content}
                                                </div>
                                            </details>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* 2. Raw Editor View */}
                        {knowledgeTab === 'editor' && (
                            <div className="flex-1 flex flex-col p-4">
                                <p className="text-xs text-brand-text-muted mb-2 flex items-center gap-2">
                                    <Lock size={12} /> Direct Memory Access
                                </p>
                                <textarea
                                    className="flex-1 w-full p-4 rounded-lg border border-gray-200 text-sm focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50 resize-none font-mono leading-relaxed"
                                    placeholder="Add specific rules, preferences, or tech stack details here..."
                                    value={memory}
                                    onChange={(e) => setMemory(e.target.value)}
                                    onBlur={() => handleUpdateField('memory', memory)}
                                ></textarea>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Builder Chat */}
                <div
                    className="w-2/3 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden relative"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                >
                    {/* Chat Header */}
                    <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <div className="flex flex-col">
                            <h3 className="font-bold text-brand-black flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${agentMode === 'STARTER' ? 'bg-green-500' :
                                    agentMode === 'BUILDER' ? 'bg-blue-500' :
                                        'bg-red-500'
                                    }`}></div>
                                {agentMode === 'STARTER' ? 'Architect Assistant' :
                                    agentMode === 'BUILDER' ? 'Builder Assistant' :
                                        'Fixer Assistant'}
                            </h3>
                            <p className="text-xs text-brand-text-muted">
                                {agentMode === 'STARTER' ? 'Planning & Setup' :
                                    agentMode === 'BUILDER' ? 'Features & Logic' :
                                        'Debugger & Fixes'}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            {/* Mode Switcher */}
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                <button
                                    onClick={() => handleModeChange('STARTER')}
                                    className={`p-1.5 rounded-md transition-all ${agentMode === 'STARTER' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    title="Starter (Architect)"
                                >
                                    <Map size={16} />
                                </button>
                                <button
                                    onClick={() => handleModeChange('BUILDER')}
                                    className={`p-1.5 rounded-md transition-all ${agentMode === 'BUILDER' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    title="Builder (Features)"
                                >
                                    <Hammer size={16} />
                                </button>
                                <button
                                    onClick={() => handleModeChange('SOLVER')}
                                    className={`p-1.5 rounded-md transition-all ${agentMode === 'SOLVER' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    title="Solver (Debugger)"
                                >
                                    <Bug size={16} />
                                </button>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={handleSmartArchive}
                                    className={`text-xs font-medium bg-white border px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm ${agentMode === 'STARTER'
                                        ? 'border-brand-lime text-brand-black ring-2 ring-brand-lime/20 animate-pulse'
                                        : 'border-gray-200 text-gray-500 hover:text-brand-lime'
                                        }`}
                                    title="Sync memory to n8n & Clear"
                                >
                                    <Archive size={14} /> Smart Archive
                                </button>
                                <button
                                    onClick={() => handleWipeChat()}
                                    className="text-xs font-medium text-red-400 hover:text-red-600 bg-white border border-red-100 hover:border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                                    title="Delete messages without saving"
                                >
                                    <Trash2 size={14} /> Wipe Chat
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-white">
                        {messages.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
                                <MessageSquare size={32} className="opacity-20" />
                                <p>Start building <strong>{project?.clientName}</strong>...</p>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${msg.role === 'user'
                                        ? 'bg-[#B7EF02] text-brand-black rounded-tr-none font-medium'
                                        : 'bg-gray-100 text-gray-800 rounded-tl-none'
                                        }`}
                                >
                                    {/* Attachments */}
                                    {msg.attachments && msg.attachments.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {msg.attachments.map((src, idx) => (
                                                <img key={idx} src={src} className="max-w-[200px] max-h-[200px] rounded-lg border border-black/10" alt="Attachment" />
                                            ))}
                                        </div>
                                    )}
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        {isThinking && (
                            <div className="flex justify-start animate-pulse">
                                <div className="bg-gray-100 px-5 py-3 rounded-2xl rounded-tl-none text-sm text-gray-500 italic">
                                    Thinking...
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-gray-100">
                        {/* Attachment Previews */}
                        {attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-3 pb-2">
                                {attachments.map((src, index) => (
                                    <div key={index} className="relative group shrink-0">
                                        <img src={src} className="h-16 w-16 object-cover rounded-lg border border-gray-200" alt="preview" />
                                        <button
                                            onClick={() => removeAttachment(index)}
                                            className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <form onSubmit={handleSendMessage} className="flex gap-2 items-end">
                            {/* File Button */}
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                className="p-3 text-gray-400 hover:text-brand-lime hover:bg-gray-50 rounded-xl transition-colors"
                            >
                                <Paperclip size={20} />
                            </button>
                            <input
                                type="file"
                                ref={fileInputRef}
                                className="hidden"
                                accept="image/*"
                                multiple
                                onChange={handleFileSelect}
                            />

                            {/* Text Input */}
                            <textarea
                                className="flex-1 px-4 py-3 rounded-xl border border-gray-200 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black resize-none min-h-[46px] max-h-[200px]"
                                placeholder="Instructions for the builder... (Ctrl+Enter to send)"
                                value={chatInput}
                                onChange={(e) => setChatInput(e.target.value)}
                                onPaste={handlePaste}
                                onKeyDown={handleKeyDown}
                                rows={1}
                                style={{ height: 'auto', minHeight: '46px' }}
                                onInput={(e) => {
                                    e.currentTarget.style.height = 'auto';
                                    e.currentTarget.style.height = e.currentTarget.scrollHeight + 'px';
                                }}
                            />

                            <Button type="submit" variant="primary" className="h-[46px]">
                                Send
                            </Button>
                        </form>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
