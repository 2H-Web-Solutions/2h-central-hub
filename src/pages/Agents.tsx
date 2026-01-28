import { useState, useEffect, useRef } from 'react';
import { collection, collectionGroup, addDoc, onSnapshot, serverTimestamp, query, orderBy, Timestamp, DocumentReference, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';
import { Bot, Send, Sparkles, LayoutGrid } from 'lucide-react';

interface Session {
    id: string;
    ref: DocumentReference;
    agentName: string;
    appId: string;
    lastMessage: string;
    updatedAt: Timestamp;
}

interface Message {
    id: string;
    role: 'user' | 'ai';
    content: string;
    createdAt: Timestamp;
}

const formatAppId = (appId: string) => {
    return (appId || 'Unknown App')
        .replace(/^2h_/, '')
        .replace(/_v\d+$/, '')
        .replace(/_/g, ' ')
        .replace(/\b\w/g, c => c.toUpperCase());
};

export default function Agents() {
    // State
    const [sessions, setSessions] = useState<Session[]>([]);
    const [groupedSessions, setGroupedSessions] = useState<{ [appId: string]: Session[] }>({});
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Subscribe to ALL sessions (Global)
    useEffect(() => {
        const q = query(collectionGroup(db, 'sessions'), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ref: doc.ref,
                    agentName: data.agentName || 'Unknown Agent',
                    appId: data.appId || data.appName || doc.ref.parent.parent?.id || 'Unknown App',
                    lastMessage: data.lastMessage || '',
                    updatedAt: data.updatedAt
                } as Session;
            });

            setSessions(list);

            // Grouping Logic
            const groups: { [appId: string]: Session[] } = {};
            list.forEach(session => {
                if (!groups[session.appId]) groups[session.appId] = [];
                groups[session.appId].push(session);
            });
            setGroupedSessions(groups);

            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    // 2. Subscribe to messages of ACTIVE session
    useEffect(() => {
        if (!activeSession) {
            setMessages([]);
            return;
        }

        const q = query(collection(activeSession.ref, 'messages'), orderBy('createdAt', 'asc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Message));
            setMessages(list);
        });
        return () => unsubscribe();
    }, [activeSession]);

    // Scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // 3. Send Message Handler
    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || !activeSession) return;

        try {
            const msgContent = input;
            setInput(''); // Optimistic clear

            // A. Write User Message to the specific session
            await addDoc(collection(activeSession.ref, 'messages'), {
                role: 'user',
                content: msgContent,
                createdAt: serverTimestamp()
            });

            // B. Update Session Metadata (to bump it to top)
            await updateDoc(activeSession.ref, {
                lastMessage: msgContent,
                updatedAt: serverTimestamp()
            });

        } catch (error) {
            console.error("Error sending message:", error);
            alert("Failed to send message.");
        }
    };

    return (
        <DashboardShell
            headerTitle="Agent Mission Control"
            sidebarContent={<SidebarNav />}
        >
            <div className="flex h-[calc(100vh-140px)] rounded-xl border border-gray-200 overflow-hidden shadow-sm bg-white">

                {/* LEFT: Sidebar (Grouped List) */}
                <div className="w-[300px] flex-shrink-0 bg-gray-50/50 border-r border-gray-100 flex flex-col">
                    <div className="p-4 border-b border-gray-100 bg-white sticky top-0 z-10">
                        <h3 className="font-serif font-bold text-lg text-brand-black flex items-center gap-2">
                            <Sparkles size={18} className="text-brand-lime" />
                            Active Agents
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-4">
                        {loading ? (
                            <p className="p-4 text-center text-gray-400 text-sm">Scanning ecosystem...</p>
                        ) : sessions.length === 0 ? (
                            <p className="p-4 text-center text-gray-400 text-sm">No active agent sessions found.</p>
                        ) : (
                            Object.entries(groupedSessions).map(([appId, appSessions]) => (
                                <div key={appId} className="space-y-1">
                                    <div className="px-2 py-1 flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
                                        <LayoutGrid size={12} />
                                        {formatAppId(appId)}
                                    </div>
                                    <div className="space-y-1 pl-2 border-l-2 border-gray-100 ml-2">
                                        {appSessions.map(session => (
                                            <div
                                                key={session.id}
                                                onClick={() => setActiveSession(session)}
                                                className={`p-3 rounded-lg cursor-pointer transition-all border ${activeSession?.id === session.id
                                                    ? 'bg-white border-brand-lime shadow-sm ring-1 ring-brand-lime/20'
                                                    : 'bg-transparent border-transparent hover:bg-white hover:border-gray-200 hover:shadow-sm'
                                                    }`}
                                            >
                                                <div className="flex justify-between items-start mb-0.5">
                                                    <h4 className={`text-sm font-medium truncate pr-2 ${activeSession?.id === session.id ? 'text-brand-black' : 'text-gray-700'}`}>
                                                        {session.agentName}
                                                    </h4>
                                                </div>
                                                <p className="text-xs text-gray-400 truncate flex items-center gap-1">
                                                    {session.lastMessage || "No messages ..."}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT: Chat Layout */}
                <div className="flex-1 flex flex-col bg-white">
                    {activeSession ? (
                        <>
                            {/* Chat Header */}
                            <div className="h-16 px-6 border-b border-gray-100 flex justify-between items-center bg-white">
                                <div>
                                    <h3 className="font-bold text-brand-black text-lg">{activeSession.agentName}</h3>
                                    <p className="text-xs text-gray-500 flex items-center gap-1.5">
                                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                                        Connected to {formatAppId(activeSession.appId)}
                                    </p>
                                </div>
                                <div className="text-xs font-mono text-gray-300 bg-gray-50 px-2 py-1 rounded">
                                    ID: {activeSession.id.slice(0, 8)}...
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-8 space-y-6 bg-white">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`flex flex-col max-w-[70%] group ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div
                                                className={`px-6 py-4 rounded-2xl text-sm leading-relaxed shadow-sm transition-all ${msg.role === 'user'
                                                    ? 'bg-[#B7EF02] text-brand-black rounded-tr-none hover:shadow-md'
                                                    : 'bg-gray-100 text-gray-800 rounded-tl-none hover:bg-gray-200/80 hover:shadow-md'
                                                    }`}
                                            >
                                                {msg.content}
                                            </div>
                                            <span className="text-[10px] text-gray-300 mt-1.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                {msg.createdAt?.toDate ? msg.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-6 bg-white border-t border-gray-100">
                                <form onSubmit={sendMessage} className="relative flex gap-3 max-w-4xl mx-auto">
                                    <div className="flex-1 relative group">
                                        <input
                                            type="text"
                                            className="w-full pl-6 pr-14 py-4 rounded-full border border-gray-200 focus:border-brand-lime focus:ring-4 focus:ring-brand-lime/10 outline-none transition-all bg-gray-50 text-brand-black placeholder-gray-400 font-medium"
                                            placeholder={`Reply to ${activeSession.agentName}...`}
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            autoFocus
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                            <button
                                                type="submit"
                                                disabled={!input.trim()}
                                                className="p-2.5 bg-brand-black text-brand-lime rounded-full hover:bg-black/90 hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                            >
                                                <Send size={18} className={input.trim() ? 'ml-0.5' : ''} />
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-300 bg-gray-50/30">
                            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                                <Bot size={48} className="text-gray-300" />
                            </div>
                            <h3 className="text-xl font-bold text-gray-400 mb-2">Mission Control Ready</h3>
                            <p className="text-sm text-gray-400 max-w-xs text-center">
                                Select an active session from the sidebar to monitor or intervene in real-time.
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
