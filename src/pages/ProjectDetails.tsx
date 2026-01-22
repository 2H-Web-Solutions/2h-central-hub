import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, query, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';
import Button from '../components/Button';
import { Github, Globe, ExternalLink, MessageSquare, Trash2, Lock, Copy, Paperclip, X, Archive } from 'lucide-react';
import toast from 'react-hot-toast';

interface Project {
    id: string;
    appId: string;
    clientName: string;
    type: string;
    githubUrl?: string;
    vercelUrl?: string;
    memory?: string;
    firebaseConfig?: {
        apiKey?: string;
        authDomain?: string;
        projectId?: string;
        storageBucket?: string;
        messagingSenderId?: string;
        appId?: string;
    };
}

interface ChatMessage {
    id: string;
    role: 'user' | 'ai' | 'system';
    content: string;
    attachments?: string[]; // Base64 strings
    timestamp: any;
}

export default function ProjectDetails() {
    const { projectId } = useParams();
    const navigate = useNavigate();
    const [project, setProject] = useState<Project | null>(null);
    const [loading, setLoading] = useState(true);

    // Form States
    const [githubUrl, setGithubUrl] = useState('');
    const [vercelUrl, setVercelUrl] = useState('');
    const [memory, setMemory] = useState('');

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
                setLoading(false);
            } else {
                navigate('/projects');
            }
        });
        return () => unsubscribe();
    }, [projectId, navigate]);

    // Sync memory from project
    useEffect(() => {
        if (project?.memory) {
            setMemory(project.memory);
        }
    }, [project]);

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
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: currentInput + (currentAttachments.length > 0 ? `\n[With ${currentAttachments.length} images]` : ''),
                    context: project?.memory || "You are a helpful assistant.",
                    agent: "Builder",
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
        if (!projectId) return;
        if (messages.length === 0) return;

        const toastId = toast.loading("Archiving session knowledge...");
        try {
            await fetch('https://up-seo-2025.app.n8n.cloud/webhook-test/archive-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: project?.appId || projectId,
                    currentContext: project?.memory || ""
                })
            });
            toast.success("Session archived successfully", { id: toastId });
            handleWipeChat(); // Clear after archive
        } catch (error) {
            console.error("Archive failed:", error);
            toast.error("Archive failed.", { id: toastId });
        }
    };

    const handleWipeChat = async () => {
        if (!projectId) return;
        if (!window.confirm("Are you sure you want to WIPE the chat history? This cannot be undone.")) return;

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
                        <h2 className="text-2xl font-serif font-bold text-brand-black mb-1">{project?.clientName}</h2>
                        <span className="text-brand-lime font-medium text-sm">{project?.type}</span>
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

                    {/* Persistent Memory */}
                    <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex-1 flex flex-col">
                        <h3 className="font-bold text-gray-900 border-b pb-2 mb-4 flex items-center gap-2">
                            <MessageSquare size={16} /> Project Knowledge
                        </h3>
                        <p className="text-xs text-gray-400 mb-2">
                            This context is permanently available to the builder assistant.
                        </p>
                        <textarea
                            className="flex-1 w-full p-4 rounded-lg border border-gray-200 text-sm focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none bg-gray-50 resize-none font-mono leading-relaxed"
                            placeholder="Add specific rules, preferences, or tech stack details here..."
                            value={memory}
                            onChange={(e) => setMemory(e.target.value)}
                            onBlur={() => handleUpdateField('memory', memory)}
                        ></textarea>
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
                        <div>
                            <h3 className="font-bold text-brand-black flex items-center gap-2">
                                <div className="w-2 h-2 rounded-full bg-brand-lime"></div>
                                Builder Assistant
                            </h3>
                            <p className="text-xs text-brand-text-muted">Context Aware • Project Specific</p>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSmartArchive}
                                className="text-xs font-medium text-gray-500 hover:text-brand-lime bg-white border border-gray-200 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                                title="Sync memory to n8n & Clear"
                            >
                                <Archive size={14} /> Smart Archive
                            </button>
                            <button
                                onClick={handleWipeChat}
                                className="text-xs font-medium text-red-400 hover:text-red-600 bg-white border border-red-100 hover:border-red-200 px-3 py-1.5 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                                title="Delete messages without saving"
                            >
                                <Trash2 size={14} /> Wipe Chat
                            </button>
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
