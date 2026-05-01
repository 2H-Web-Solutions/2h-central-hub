import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, updateDoc, collection, addDoc, serverTimestamp, query, orderBy, getDocs, writeBatch, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';
import Button from '../components/Button';
import { Github, Globe, ExternalLink, MessageSquare, Trash2, Lock, Copy, Paperclip, X, Archive, Map, Hammer, Bug, BookOpen, Edit2, Plus, PenSquare, Key, Check, Sparkles, Code2, UploadCloud, FileText, AlertTriangle, Download, CheckCircle2, Palette } from 'lucide-react';
import RepoExplorer from '../components/glassbox/RepoExplorer';
import ReactMarkdown from 'react-markdown';
import toast from 'react-hot-toast';
import { rulesService, Rule } from '../services/rulesService';
import { designSystemService, DesignSystem } from '../services/designSystemService';
import { parseRuleTemplate } from '../utils/ruleParser';

interface DatasetChunk {
    id?: string;
    text: string;
    vector: number[];
    timestamp?: any;
}

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
    name?: string;
    aiModel?: string;
    language?: 'en' | 'de';
    promptRuleId?: string;
    designRuleId?: string;
    designConfig?: {
        fontHeading?: string;
        fontBody?: string;
        borderRadius?: string;
        primaryColor?: string;
        secondaryColor?: string;
        tertiaryColor?: string;
        backgroundColor?: string;
        surfaceColor?: string;
        textColor?: string;
    };
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

const CodeBlock = ({ language, children }: { language: string, children: string }) => {
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async () => {
        const textToCopy = String(children).replace(/\n$/, '');

        // Helper to perform the fallback copy
        const fallbackCopy = () => {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = textToCopy;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.select();
                const successful = document.execCommand("copy");
                document.body.removeChild(textArea);
                
                if (successful) {
                    setIsCopied(true);
                } else {
                    throw new Error("execCommand failed");
                }
            } catch (fallbackErr) {
                console.error('Copy fallback failed:', fallbackErr);
                alert("Copy failed. Please select text manually.");
            }
        };

        try {
            // Check if we are in an iframe (often blocks clipboard)
            const isIframe = window.self !== window.top;
            
            if (navigator.clipboard && window.isSecureContext && !isIframe) {
                await navigator.clipboard.writeText(textToCopy);
                setIsCopied(true);
            } else {
                // If in iframe or no clipboard API, go straight to fallback
                fallbackCopy();
            }
        } catch (err) {
            // If clipboard API fails (e.g. permission denied), try fallback
            fallbackCopy();
        }

        setTimeout(() => setIsCopied(false), 2000);
    };

    return (
        <div className="rounded-md overflow-hidden my-3 border border-gray-200 bg-white shadow-sm">
            <div className="flex justify-between items-center bg-gray-50 px-3 py-1.5 border-b border-gray-100">
                <span className="text-[10px] font-mono font-bold text-gray-500 uppercase tracking-wider">{language}</span>
                <div className="flex items-center gap-3">

                    <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 text-[10px] uppercase font-bold text-gray-400 hover:text-brand-black transition-colors"
                    >
                        {isCopied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                        {isCopied ? 'Copied' : 'Copy'}
                    </button>
                </div>
            </div>
            <pre className="bg-gray-50/50 p-3 overflow-x-auto text-xs font-mono leading-relaxed text-gray-700">
                <code className={`language-${language}`}>
                    {children}
                </code>
            </pre>
        </div>
    );
};

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
    const [knowledgeTab, setKnowledgeTab] = useState<'timeline' | 'editor' | 'datasets'>('timeline');
    const [parsedLogs, setParsedLogs] = useState<parsedLog[]>([]);

    // Note State
    const [isNoteModalOpen, setIsNoteModalOpen] = useState(false);
    const [noteTitle, setNoteTitle] = useState('');
    const [noteContent, setNoteContent] = useState('');

    // Antigravity Prompt Generator State
    const [rules, setRules] = useState<Rule[]>([]);
    const [designSystems, setDesignSystems] = useState<DesignSystem[]>([]);
    const [selectedRuleId, setSelectedRuleId] = useState<string>('');
    const [missingOverrides, setMissingOverrides] = useState<Record<string, string>>({});
    const [generatedPrompt, setGeneratedPrompt] = useState<string>('');
    const [missingKeys, setMissingKeys] = useState<string[]>([]);
    const [promptCopied, setPromptCopied] = useState(false);

    // Fetch Project Rules and Design Systems
    useEffect(() => {
        const fetchRulesAndDesigns = async () => {
            try {
                const fetchedRules = await rulesService.getAllRules();
                setRules(fetchedRules);
                const fetchedDesigns = await designSystemService.getAllDesignSystems();
                setDesignSystems(fetchedDesigns);
            } catch (err) {
                console.error("Failed to fetch rules or design systems", err);
            }
        };
        fetchRulesAndDesigns();
    }, []);

    // Auto-select rule if project has a promptRuleId
    useEffect(() => {
        if (project?.promptRuleId && !selectedRuleId) {
            setSelectedRuleId(project.promptRuleId);
        }
    }, [project?.promptRuleId, selectedRuleId]);

    // Generate Prompt when selection or overrides change
    useEffect(() => {
        if (!selectedRuleId || !project) {
            setGeneratedPrompt('');
            setMissingKeys([]);
            return;
        }

        const rule = rules.find(r => r.id === selectedRuleId);
        if (!rule) return;

        // Flatten project context
        const projectData = {
            ...project,
            project_name: project.name || project.type,
            project_type: project.type,
            client_name: project.clientName,
            github_url: project.githubUrl,
            vercel_url: project.vercelUrl,
            gemini_api_key: project.geminiApiKey,
            // Include nested firebase config as flat keys
            firebase_api_key: project.firebaseConfig?.apiKey,
            firebase_project_id: project.firebaseConfig?.projectId,
            firebase_auth_domain: project.firebaseConfig?.authDomain,
            firebase_storage_bucket: project.firebaseConfig?.storageBucket,
            firebase_messaging_sender_id: project.firebaseConfig?.messagingSenderId,
            firebase_app_id: project.firebaseConfig?.appId,
            memory: project.memory
        };

        const result = parseRuleTemplate(rule.content, projectData, missingOverrides);
        setGeneratedPrompt(result.parsedTemplate);
        setMissingKeys(result.missingKeys);
    }, [selectedRuleId, project, rules, missingOverrides]);

    const handlePromptCopy = () => {
        navigator.clipboard.writeText(generatedPrompt).then(() => {
            setPromptCopied(true);
            toast.success("Prompt copied to clipboard!");
            setTimeout(() => setPromptCopied(false), 2000);
        });
    };

    const [isDownloading, setIsDownloading] = useState(false);

    const handleDownloadGlobalRule = async () => {
        if (!project) return;
        setIsDownloading(true);

        try {
            const ruleDocRef = doc(db, 'apps', '2h_web_solutions_central_hub_v1', 'rules', 'global_app_rule');
            const ruleSnap = await getDoc(ruleDocRef);

            if (!ruleSnap.exists()) {
                toast.error("Global Rule not found. Please create it in Settings -> Rules first.");
                setIsDownloading(false);
                return;
            }

            const ruleData = ruleSnap.data() as Rule;

            // Flatten project context to pass to parser
            const projectData = {
                ...project,
                project_name: project.name || project.type,
                project_type: project.type,
                client_name: project.clientName,
                github_repo: project.githubUrl,
                vercel_url: project.vercelUrl,
                gemini_api_key: project.geminiApiKey,
                firebase_api_key: project.firebaseConfig?.apiKey,
                firebase_project_id: project.firebaseConfig?.projectId,
                firebase_auth_domain: project.firebaseConfig?.authDomain,
                firebase_storage_bucket: project.firebaseConfig?.storageBucket,
                firebase_messaging_sender_id: project.firebaseConfig?.messagingSenderId,
                firebase_app_id: project.firebaseConfig?.appId,
                primary: project.primaryColor,
                secondary: project.secondaryColor,
                tertiary: project.tertiaryColor,
                memory: project.memory
            };

            const result = parseRuleTemplate(ruleData.content, projectData, missingOverrides);
            const parsedContent = result.parsedTemplate;

            const blob = new Blob([parsedContent], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            const projectName = project.name || project.type || 'project';
            a.download = `antigravity_prompt_${projectName.replace(/\s+/g, '_').toLowerCase()}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            toast.success("Global Rule downloaded successfully!");

        } catch (error) {
            console.error("Error downloading global rule:", error);
            toast.error("Failed to download Global Rule.");
        } finally {
            setIsDownloading(false);
        }
    };

    const [isDownloadingDesign, setIsDownloadingDesign] = useState(false);

    const handleDownloadDesignRule = async () => {
        if (!project?.designRuleId) {
            toast.error("Please select a Design System for this project first.");
            return;
        }

        setIsDownloadingDesign(true);

        try {
            const ruleData = await designSystemService.getDesignSystem(project.designRuleId);

            if (!ruleData) {
                toast.error("Selected Design Rule not found. It might have been deleted.");
                setIsDownloadingDesign(false);
                return;
            }
            const blob = new Blob([ruleData.content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `design.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            toast.success("design.md downloaded successfully!");

        } catch (error) {
            console.error("Error downloading design rule:", error);
            toast.error("Failed to download design.md.");
        } finally {
            setIsDownloadingDesign(false);
        }
    };

    // Dataset Upload States
    const [datasets, setDatasets] = useState<DatasetChunk[]>([]);
    const [isUploadingDataset, setIsUploadingDataset] = useState(false);


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
    const [streamedMessage, setStreamedMessage] = useState('');
    const [streamedStatus, setStreamedStatus] = useState('');
    const [language, setLanguage] = useState<'de' | 'en'>('de');
    const [attachments, setAttachments] = useState<string[]>([]);
    const [viewMode, setViewMode] = useState<'chat' | 'code'>('chat');
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



                if (data.language) {
                    setLanguage(data.language as 'en' | 'de');
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

    // Subscribe to Datasets
    useEffect(() => {
        if (!projectId) return;
        const q = query(
            collection(db, 'apps', '2h_hub_v1', 'projects', projectId, 'datasets'),
            orderBy('timestamp', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const chunks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as DatasetChunk));
            setDatasets(chunks);
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


    const handleLanguageChange = async (newLang: 'de' | 'en') => {
        setLanguage(newLang);
        if (!projectId) return;
        try {
            const docRef = doc(db, 'apps', '2h_hub_v1', 'projects', projectId);
            await updateDoc(docRef, { language: newLang });
        } catch (error) {
            console.error("Error updating language:", error);
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

    const handleCopyEnv = async () => {
        const envContent = `VITE_FIREBASE_API_KEY=${apiKey}
VITE_FIREBASE_AUTH_DOMAIN=${authDomain}
VITE_FIREBASE_PROJECT_ID=${fbProjectId}
VITE_FIREBASE_STORAGE_BUCKET=${storageBucket}
VITE_FIREBASE_MESSAGING_SENDER_ID=${messagingSenderId}
VITE_FIREBASE_APP_ID=${fbAppId}`;

        const fallbackCopy = () => {
            try {
                const textArea = document.createElement("textarea");
                textArea.value = envContent;
                textArea.style.position = "fixed";
                textArea.style.left = "-9999px";
                document.body.appendChild(textArea);
                textArea.select();
                const successful = document.execCommand("copy");
                document.body.removeChild(textArea);
                if (successful) {
                    toast.success("Copied .env block!");
                } else {
                    throw new Error("execCommand failed");
                }
            } catch (fallbackErr) {
                console.error('Copy fallback failed:', fallbackErr);
                toast.error("Copy failed. Please select text manually.");
            }
        };

        try {
            const isIframe = window.self !== window.top;
            
            if (navigator.clipboard && window.isSecureContext && !isIframe) {
                await navigator.clipboard.writeText(envContent);
                toast.success("Copied .env block!");
            } else {
                fallbackCopy();
            }
        } catch (err) {
            fallbackCopy();
        }
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

    // --- HANDLERS FOR DATASET UPLOAD ---
    const handleUploadDatasetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0 || !projectId) return;
        const file = e.target.files[0];
        setIsUploadingDataset(true);
        const loadToast = toast.loading(`Processing ${file.name}...`);

        try {
            let base64Pdf: string | undefined = undefined;
            let text: string | undefined = undefined;

            if (file.type === 'application/pdf') {
                const b64 = await convertFileToBase64(file);
                // Strip the data:application/pdf;base64, prefix
                base64Pdf = b64.replace(/^data:application\/pdf;base64,/, '');
            } else {
                text = await file.text();
            }

            const response = await fetch('/api/embed', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, base64Pdf }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Embed API failed");
            }

            const data = await response.json();

            // Save chunks to Firestore sequentially to absolutely avoid any Batch/Transaction size limits
            const datasetColl = collection(db, 'apps', '2h_hub_v1', 'projects', projectId, 'datasets');
            
            // We use limited concurrency (e.g., 5 at a time) to avoid freezing the browser but still be fast
            const BATCH_LIMIT = 5;
            for (let i = 0; i < data.chunks.length; i += BATCH_LIMIT) {
                const chunkSlice = data.chunks.slice(i, i + BATCH_LIMIT);
                await Promise.all(
                    chunkSlice.map((chunk: any) => 
                        addDoc(datasetColl, {
                            text: chunk.text,
                            vector: chunk.vector,
                            sourceName: file.name,
                            timestamp: serverTimestamp()
                        })
                    )
                );
            }

            toast.success(`Successfully embedded ${data.chunks.length} chunks!`, { id: loadToast });
        } catch (error: any) {
            console.error("Dataset upload error:", error);
            toast.error(error.message || "Failed to upload dataset", { id: loadToast });
        } finally {
            setIsUploadingDataset(false);
            if (e.target) e.target.value = ''; // Reset file input
        }
    };

    const handleDeleteDatasetChunk = async (chunkId: string) => {
        if (!projectId) return;
        if (!window.confirm("Delete this chunk from the AI knowledge base?")) return;
        try {
            await deleteDoc(doc(db, 'apps', '2h_hub_v1', 'projects', projectId, 'datasets', chunkId));
            toast.success("Dataset chunk removed");
        } catch (e) {
            console.error(e);
            toast.error("Failed to remove chunk");
        }
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
                    agent: 'Builder',
                    agentMode: 'BUILDER',
                    aiModel: project?.aiModel || 'gemini-3.1-pro-preview',
                    history: messages.map(m => ({ role: m.role, content: m.content })),
                    repoUrl: githubUrl || null,
                    // Pass Datasets for RAG
                    datasets: datasets.map(d => ({ text: d.text, vector: d.vector })),
                    // NOTE: Real multimodal support would require sending the Base64 in a specific format to the API. 
                    // For now, we assume text-based context or that the API ignores images if not supported.
                    // If you want actual Vision capabilities, you'd insert the image data here.
                    images: currentAttachments,
                    language: language
                })
            });

            // Check if response is JSON (usually an error)
            const contentType = response.headers.get("content-type");
            if (contentType && contentType.includes("application/json")) {
                const data = await response.json();
                throw new Error(data.error || "API Request failed");
            }

            if (!response.body) throw new Error("No response body");

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aiResponse = '';
            let buffer = '';
            
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                // Keep the last partial line in the buffer
                buffer = lines.pop() || '';
                
                for (const line of lines) {
                    const trimmedLine = line.trim();
                    if (trimmedLine.startsWith('data: ')) {
                        try {
                            const data = JSON.parse(trimmedLine.substring(6));
                            if (data.type === 'status') {
                                setStreamedStatus(data.message);
                            } else if (data.type === 'chunk') {
                                aiResponse += data.text;
                                setStreamedMessage(aiResponse);
                                setStreamedStatus(''); // Clear status when text starts
                            } else if (data.type === 'error') {
                                toast.error("KI Fehler: " + data.error);
                            }
                        } catch (e) {
                            console.warn("Parse error for chunk:", line, e);
                        }
                    }
                }
            }

            if (aiResponse) {
                // 3. Write final AI Response to Firestore
                await addDoc(collection(db, 'apps', '2h_hub_v1', 'projects', projectId, 'chat'), {
                    role: 'ai',
                    content: aiResponse,
                    timestamp: serverTimestamp()
                });
            } else {
                toast.error("AI returned empty response");
            }
            
            setStreamedMessage('');
            setStreamedStatus('');

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

    const handleDeleteMessage = async (messageId: string) => {
        if (!projectId) return;
        if (!window.confirm("Are you sure you want to delete this message?")) return;
        
        try {
            const msgRef = doc(db, 'apps', '2h_hub_v1', 'projects', projectId, 'chat', messageId);
            await deleteDoc(msgRef);
            toast.success("Message deleted");
        } catch (error) {
            console.error("Error deleting message:", error);
            toast.error("Failed to delete message");
        }
    };

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
            if (messages.length === 0) return;

            // Wir nutzen die bereits im State geladenen 'messages', um fehlerhafte getDocs() (Permission Issues) zu vermeiden.
            // Die Löschung erfolgt über einzelne deleteDocs in 50er-Schritten (Promise.all) anstatt über ein writeBatch, 
            // da writeBatch oft zusätzliche Array-Regeln in den Security Rules triggern kann.
            
            for (let i = 0; i < messages.length; i += 50) {
                const chunk = messages.slice(i, i + 50);
                await Promise.all(chunk.map(msg => {
                    const docRef = doc(db, 'apps', '2h_hub_v1', 'projects', projectId, 'chat', msg.id);
                    return deleteDoc(docRef);
                }));
            }
            
            toast.success("Chat wiped clean.");
        } catch (error) {
            console.error("Error clearing chat:", error);
            toast.error("Failed to wipe chat");
        }
    };

    const handleRefineBrain = async () => {
        if (!project?.memory) return toast.error("No memory to refine.");

        const confirmRefine = window.confirm("Optimize Project Knowledge? This will fix errors but keep history.");
        if (!confirmRefine) return;

        const toastId = toast.loading("Refining brain...");

        try {
            const response = await fetch('/api/refine-memory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ currentMemory: project.memory })
            });

            if (!response.ok) throw new Error("Refine failed");

            const data = await response.json();

            // Update Firestore
            if (projectId) {
                await updateDoc(doc(db, 'apps', '2h_hub_v1', 'projects', projectId), {
                    memory: data.refinedMemory
                });
            }

            toast.success("Brain optimized!", { id: toastId });
        } catch (err) {
            console.error(err);
            toast.error("Failed to refine memory", { id: toastId });
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
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-sm text-gray-500 font-mono bg-gray-100 px-3 py-1 rounded-full">
                        {project?.appId}
                    </div>
                </div>
            }
        >
            <div className="flex h-[calc(100vh-140px)] gap-6">
                {/* LEFT COLUMN: Project Context */}
                <div className="w-1/3 flex flex-col gap-6 overflow-y-auto pr-2">
                    {/* Header Card */}
                    <div className="bg-[#B7EF02]/10 p-8 rounded-2xl border border-[#B7EF02]/20 shadow-sm">
                        <h1 className="text-3xl font-serif font-bold text-brand-black mb-2">{project?.name || project?.type}</h1>
                        <span className="text-brand-black font-medium text-sm px-3 py-1 bg-white rounded-full border border-[#B7EF02]/30">{project?.clientName}</span>
                    </div>



                    {/* Linked Templates Card */}
                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow space-y-4">
                        <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                            <h3 className="font-bold font-serif text-lg text-gray-900 flex items-center gap-2">
                                <BookOpen size={18} className="text-[#B7EF02]" /> Linked Templates
                            </h3>
                        </div>

                        <div className="space-y-4">
                            {/* Prompt Rule Selection Dropdown */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Antigravity Prompt</label>
                                {selectedRuleId && rules.length > 0 && !rules.find(r => r.id === selectedRuleId) && (
                                    <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                                        <AlertTriangle size={16} />
                                        Linked Rule not found. Please select a new template.
                                    </div>
                                )}
                                <select
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium focus:border-[#B7EF02] focus:ring-1 focus:ring-[#B7EF02] outline-none bg-gray-50"
                                    value={selectedRuleId}
                                    onChange={async (e) => {
                                        const newPromptRuleId = e.target.value;
                                        setSelectedRuleId(newPromptRuleId);
                                        if (project?.id) {
                                            try {
                                                const correctProjectRef = doc(db, 'apps', '2h_web_solutions_central_hub_v1', 'projects', project.id);
                                                await updateDoc(correctProjectRef, {
                                                    promptRuleId: newPromptRuleId
                                                });
                                                toast.success("Prompt Template updated.");
                                            } catch (err) {
                                                console.error("Failed to update prompt rule id:", err);
                                                toast.error("Failed to update Prompt Template.");
                                            }
                                        }
                                    }}
                                >
                                    <option value="">-- Choose a template --</option>
                                    {/* Sort rules so that rules matching the project type are at the top */}
                                    {rules
                                        .filter(rule => rule.category !== 'design')
                                        .slice()
                                        .sort((a, b) => {
                                            const aMatches = a.category === project?.type || a.category === 'global';
                                            const bMatches = b.category === project?.type || b.category === 'global';
                                            if (aMatches && !bMatches) return -1;
                                            if (!aMatches && bMatches) return 1;
                                            return a.title.localeCompare(b.title);
                                        })
                                        .map(rule => (
                                            <option key={rule.id} value={rule.id}>
                                                {rule.title} ({rule.category})
                                            </option>
                                        ))
                                    }
                                </select>
                                <button
                                    onClick={handleDownloadGlobalRule}
                                    disabled={isDownloading || !project || !selectedRuleId}
                                    className={`mt-2 w-full flex justify-center items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg transition-colors ${
                                        (!project || !selectedRuleId || isDownloading) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200 hover:text-gray-900'
                                    }`}
                                >
                                    {isDownloading ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-gray-500/30 border-t-gray-500 rounded-full animate-spin"></div>
                                            Downloading...
                                        </>
                                    ) : (
                                        <>
                                            <Download size={14} />
                                            Download Global Rule
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Design Selection Dropdown */}
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Design System</label>
                                <select
                                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-medium focus:border-[#B7EF02] focus:ring-1 focus:ring-[#B7EF02] outline-none bg-gray-50"
                                    value={project?.designRuleId || ''}
                                    onChange={async (e) => {
                                        const newDesignRuleId = e.target.value;
                                        if (project?.id) {
                                            try {
                                                const correctProjectRef = doc(db, 'apps', '2h_web_solutions_central_hub_v1', 'projects', project.id);
                                                await updateDoc(correctProjectRef, {
                                                    designRuleId: newDesignRuleId
                                                });
                                                toast.success("Design System updated.");
                                            } catch (err) {
                                                console.error("Failed to update design rule id:", err);
                                                toast.error("Failed to update Design System.");
                                            }
                                        }
                                    }}
                                >
                                    <option value="">-- Choose a Design System --</option>
                                    {designSystems
                                        .sort((a, b) => a.title.localeCompare(b.title))
                                        .map(ds => (
                                            <option key={ds.id} value={ds.id}>
                                                {ds.title}
                                            </option>
                                        ))
                                    }
                                </select>
                                <button
                                    onClick={handleDownloadDesignRule}
                                    disabled={isDownloadingDesign || !project || !project.designRuleId}
                                    className={`mt-2 w-full flex justify-center items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg transition-colors ${
                                        (!project || !project.designRuleId || isDownloadingDesign) ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-200 hover:text-gray-900'
                                    }`}
                                >
                                    {isDownloadingDesign ? (
                                        <>
                                            <div className="w-3 h-3 border-2 border-gray-500/30 border-t-gray-500 rounded-full animate-spin"></div>
                                            Downloading...
                                        </>
                                    ) : (
                                        <>
                                            <Download size={14} />
                                            Download design.md
                                        </>
                                    )}
                                </button>
                            </div>

                            {/* Missing Variables Fallback */}
                            {missingKeys.length > 0 && (
                                <div className="bg-orange-50 border border-orange-100 rounded-lg p-4 space-y-3">
                                    <p className="text-xs font-bold text-orange-800 flex items-center gap-1.5">
                                        <AlertTriangle size={14} /> 
                                        Missing Variables Detected
                                    </p>
                                    <div className="grid grid-cols-2 gap-3">
                                        {missingKeys.map(key => (
                                            <div key={key}>
                                                <label className="block text-[10px] font-bold text-orange-700 uppercase tracking-wider mb-1">{key}</label>
                                                <input
                                                    type="text"
                                                    value={missingOverrides[key] || ''}
                                                    onChange={(e) => setMissingOverrides(prev => ({ ...prev, [key]: e.target.value }))}
                                                    placeholder={`Enter ${key}...`}
                                                    className="w-full px-2 py-1.5 rounded-md border border-orange-200 text-xs font-mono focus:border-orange-400 outline-none bg-white"
                                                />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Preview Area */}
                            {selectedRuleId && (
                                <div className="flex flex-col space-y-3">
                                    <div className="relative border border-gray-200 rounded-lg overflow-hidden bg-[#F8F8F9]">
                                        <div className="absolute top-2 right-2 flex gap-2">
                                            <button
                                                onClick={handlePromptCopy}
                                                className="bg-white border border-gray-200 text-gray-600 hover:text-[#101010] p-1.5 rounded shadow-sm hover:shadow transition-all flex items-center gap-1"
                                                title="Copy to Clipboard"
                                            >
                                                {promptCopied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                                                <span className="text-xs font-bold">{promptCopied ? "Copied" : "Copy"}</span>
                                            </button>
                                        </div>
                                        <textarea
                                            readOnly
                                            value={generatedPrompt}
                                            className="w-full min-h-[400px] p-4 pt-12 text-xs font-mono text-gray-800 bg-transparent resize-y outline-none"
                                        />
                                    </div>

                                    <button
                                        onClick={handlePromptDownload}
                                        className="w-full flex justify-center items-center gap-2 py-2.5 bg-[#B7EF02] text-[#101010] font-bold rounded-lg shadow-sm hover:shadow-md hover:bg-[#a3d602] transition-all"
                                    >
                                        <Download size={16} />
                                        Download Prompt (.txt)
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>


                    {/* Persistent Memory / Knowledge Timeline */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow flex-1 flex flex-col overflow-hidden min-h-[600px]">
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
                            <button
                                onClick={() => setKnowledgeTab('datasets')}
                                className={`pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-colors ${knowledgeTab === 'datasets'
                                    ? 'border-brand-lime text-brand-black'
                                    : 'border-transparent text-gray-400 hover:text-gray-600'
                                    }`}
                            >
                                <FileText size={16} /> Datasets (PDF/Txt)
                            </button>
                        </div>

                        {/* Content Area */}

                        {/* 1. Timeline View */}
                        {knowledgeTab === 'timeline' && (
                            <div className="flex-1 flex flex-col relative overflow-hidden">
                                {/* Add Note Header */}
                                <div className="p-4 border-b border-gray-50 flex justify-between items-center bg-gray-50/30">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Logbook Entries</span>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleRefineBrain}
                                            className="bg-white border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:border-brand-lime hover:text-brand-lime transition-colors shadow-sm"
                                        >
                                            <Sparkles size={14} /> Refine Brain
                                        </button>
                                        <button
                                            onClick={() => setIsNoteModalOpen(true)}
                                            className="bg-brand-black text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-gray-800 transition-colors shadow-sm"
                                        >
                                            <Plus size={14} /> Add Note
                                        </button>
                                    </div>
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

                        {/* 3. Datasets View */}
                        {knowledgeTab === 'datasets' && (
                            <div className="flex-1 flex flex-col p-4 relative overflow-hidden">
                                <div className="mb-4">
                                    <p className="text-xs text-gray-500 mb-3">Upload reference material like PDFs or raw text files. The AI will search through it only when you ask related questions.</p>
                                    <div className="flex items-center gap-3">
                                        <label className={`flex-1 flex justify-center items-center gap-2 border-2 border-dashed border-gray-200 rounded-xl p-4 cursor-pointer hover:border-brand-lime transition-colors ${isUploadingDataset ? 'opacity-50 pointer-events-none' : ''}`}>
                                            <input type="file" className="hidden" accept=".pdf,.txt,.md,.csv,.json" onChange={handleUploadDatasetFile} />
                                            <UploadCloud size={20} className="text-gray-400" />
                                            <span className="text-sm font-medium text-gray-600">
                                                {isUploadingDataset ? 'Processing Vectors...' : 'Upload PDF / Text Document'}
                                            </span>
                                        </label>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-2 space-y-3">
                                    {datasets.length === 0 ? (
                                        <div className="text-center py-10 text-gray-400 text-sm italic">
                                            No datasets uploaded. Upload a PDF or Text file.
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 gap-3">
                                            {datasets.map((chunk, idx) => (
                                                <div key={chunk.id || idx} className="bg-gray-50 border border-gray-100 rounded-lg p-3 relative group">
                                                    <div className="flex justify-between items-start mb-2">
                                                        <span className="text-[10px] font-bold text-brand-lime uppercase tracking-wider bg-brand-black px-2 py-0.5 rounded">
                                                            Chunk {(chunk as any).sourceName ? `- ${(chunk as any).sourceName}` : idx + 1}
                                                        </span>
                                                        <button 
                                                            onClick={() => handleDeleteDatasetChunk(chunk.id!)}
                                                            className="text-gray-300 hover:text-red-500 transition-colors p-1 bg-white rounded shadow-sm opacity-0 group-hover:opacity-100"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                    <p className="text-xs text-gray-600 line-clamp-3 leading-relaxed">
                                                        {chunk.text}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: Builder Chat */}
                <div
                    className="w-2/3 flex flex-col bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow overflow-hidden relative"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={handleDrop}
                >
                    {/* Chat Header */}
                    <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-[#F8F8F9]">
                        <div className="flex flex-col">
                            <h3 className="font-bold font-serif text-brand-black flex items-center gap-2 text-xl">
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-500"></div>
                                Builder Assistant
                            </h3>
                        </div>
                        <div className="flex items-center gap-4">                            {/* Language Switcher */}
                            <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-bold">
                                <button
                                    onClick={() => handleLanguageChange('de')}
                                    className={`px-2 py-1 rounded-md transition-all ${language === 'de' ? 'bg-white text-brand-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    title="German"
                                >
                                    DE
                                </button>
                                <button
                                    onClick={() => handleLanguageChange('en')}
                                    className={`px-2 py-1 rounded-md transition-all ${language === 'en' ? 'bg-white text-brand-black shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}
                                    title="English"
                                >
                                    EN
                                </button>
                            </div>

                            <div className="flex gap-2">

                                {/* GITHUB CODE VIEW TOGGLE */}
                                <button
                                    onClick={() => setViewMode(prev => prev === 'chat' ? 'code' : 'chat')}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md transition-colors border shadow-sm ${viewMode === 'code'
                                        ? 'bg-brand-lime text-brand-black border-brand-lime'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                        }`}
                                    title={viewMode === 'code' ? "Back to Chat" : "View Code"}
                                >
                                    {viewMode === 'code' ? <MessageSquare size={16} /> : <Code2 size={16} />}
                                    <span className="text-sm font-medium">{viewMode === 'code' ? 'Chat' : 'Code'}</span>
                                </button>


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
                    {/* Content Wrapper (Relative for positioning) */}
                    <div className="flex-1 flex flex-col overflow-hidden relative">
                        {viewMode === 'chat' ? (
                            <>
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
                                            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} group items-start gap-2`}
                                        >
                                            {msg.role === 'user' && (
                                                <button
                                                    onClick={() => handleDeleteMessage(msg.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 bg-white shadow-sm border border-gray-100 rounded-full opacity-0 group-hover:opacity-100 transition-all mt-1 flex-shrink-0"
                                                    title="Delete message"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
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
                                                <ReactMarkdown
                                                    components={{
                                                        code(props) {
                                                            const { children, className, node, ...rest } = props;
                                                            const match = /language-(\w+)/.exec(className || '');
                                                            return match ? (
                                                                <CodeBlock language={match[1]}>{String(children).replace(/\n$/, '')}</CodeBlock>
                                                            ) : (
                                                                <code className="bg-black/5 px-1 py-0.5 rounded font-mono text-[0.9em] text-brand-black/80" {...rest}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        },
                                                        // Style other markdown elements to match the chat look
                                                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                                                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                                                        li: ({ children }) => <li>{children}</li>,
                                                        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">{children}</a>
                                                    }}
                                                >
                                                    {msg.content}
                                                </ReactMarkdown>
                                            </div>
                                            {msg.role !== 'user' && (
                                                <button
                                                    onClick={() => handleDeleteMessage(msg.id)}
                                                    className="p-1.5 text-gray-400 hover:text-red-500 bg-white shadow-sm border border-gray-100 rounded-full opacity-0 group-hover:opacity-100 transition-all mt-1 flex-shrink-0"
                                                    title="Delete message"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    {isThinking && !streamedMessage && !streamedStatus && (
                                        <div className="flex justify-start animate-pulse">
                                            <div className="bg-gray-100 px-5 py-3 rounded-2xl rounded-tl-none text-sm text-gray-500 italic">
                                                Thinking...
                                            </div>
                                        </div>
                                    )}

                                    {streamedStatus && (
                                        <div className="flex justify-start">
                                            <div className="bg-gray-100 px-4 py-2 rounded-2xl rounded-tl-none text-xs font-mono text-brand-lime bg-brand-black flex items-center gap-2">
                                                <div className="w-2 h-2 bg-brand-lime rounded-full animate-pulse" />
                                                {streamedStatus}
                                            </div>
                                        </div>
                                    )}

                                    {streamedMessage && (
                                        <div className="flex justify-start items-start gap-2">
                                            <div className="max-w-[80%] px-5 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap bg-gray-100 text-gray-800 rounded-tl-none border-b-2 border-brand-lime">
                                                <ReactMarkdown
                                                    components={{
                                                        code(props) {
                                                            const { children, className, node, ...rest } = props;
                                                            const match = /language-(\w+)/.exec(className || '');
                                                            return match ? (
                                                                <CodeBlock language={match[1]}>{String(children).replace(/\n$/, '')}</CodeBlock>
                                                            ) : (
                                                                <code className="bg-black/5 px-1 py-0.5 rounded font-mono text-[0.9em] text-brand-black/80" {...rest}>
                                                                    {children}
                                                                </code>
                                                            );
                                                        },
                                                        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                                                        ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                                                        ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                                                        li: ({ children }) => <li>{children}</li>,
                                                        a: ({ href, children }) => <a href={href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline hover:text-blue-800">{children}</a>
                                                    }}
                                                >
                                                    {streamedMessage}
                                                </ReactMarkdown>
                                                <span className="inline-block w-2 h-4 bg-brand-black ml-1 animate-ping" />
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
                                            placeholder="Message Builder Assistant... (Ctrl+Enter to send)"
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
                            </>
                        ) : (
                            <div className="absolute inset-0 bg-[#1e1e1e]">
                                <RepoExplorer repoUrl={project?.githubUrl || ''} />
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
