import { useState, useEffect, useRef } from 'react';
import { collection, collectionGroup, addDoc, onSnapshot, serverTimestamp, query, orderBy, Timestamp, DocumentReference, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';
import { Bot, MessageSquare, Clock, Send, Sparkles } from 'lucide-react';

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
    const [activeSession, setActiveSession] = useState<Session | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // 1. Subscribe to ALL sessions (Global)
    useEffect(() => {
        const q = query(collectionGroup(db, 'sessions'), orderBy('updatedAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const list = snapshot.docs.map(doc => ({
                id: doc.id,
                ref: doc.ref,
                agentName: doc.data().agentName || 'Unknown Agent',
                appId: doc.ref.parent.parent?.id || 'Unknown App',
                lastMessage: doc.data().lastMessage || '',
                updatedAt: doc.data().updatedAt
            } as Session));
            setSessions(list);
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

        const q = query(activeSession.ref.collection('messages'), orderBy('createdAt', 'asc'));
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
            <div className="flex h-[calc(100vh-140px)] gap-6">
                {/* LEFT: Session List */}
                <div className="w-1/3 bg-white rounded-xl border border-gray-100 shadow-sm flex flex-col overflow-hidden">
                    <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-serif font-bold text-lg text-brand-black flex items-center gap-2">
                            <Sparkles size={18} className="text-brand-lime" />
                            Active Agents
                        </h3>
                    </div>

                    <div className="flex-1 overflow-y-auto p-2 space-y-1">
                        {loading ? (
                            <p className="p-4 text-center text-gray-400 text-sm">Scanning ecosystem...</p>
                        ) : sessions.length === 0 ? (
                            <p className="p-4 text-center text-gray-400 text-sm">No active agent sessions found.</p>
                        ) : (
                            sessions.map(session => (
                                <div
                                    key={session.id}
                                    onClick={() => setActiveSession(session)}
                                    className={`p-3 rounded-lg cursor-pointer transition-all border ${activeSession?.id === session.id
                                            ? 'bg-brand-lime/10 border-brand-lime shadow-sm'
                                            : 'bg-white border-transparent hover:bg-gray-50 hover:border-gray-100'
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className="font-bold text-sm text-brand-black truncate pr-2">{session.agentName}</h4>
                                        <span className="text-[10px] font-mono bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                                            {formatAppId(session.appId)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-gray-500 truncate mb-2">{session.lastMessage || "No messages yet..."}</p>
                                    <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                        <Clock size={10} />
                                        {session.updatedAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* RIGHT: Chat Layout */}
                <div className="w-2/3 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {activeSession ? (
                        <>
                            {/* Chat Header */}
                            <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
                                <div>
                                    <h3 className="font-bold text-brand-black">{activeSession.agentName}</h3>
                                    <p className="text-xs text-gray-500 flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                                        Live from {formatAppId(activeSession.appId)}
                                    </p>
                                </div>
                                <div className="text-xs font-mono text-gray-300">
                                    ID: {activeSession.id.slice(0, 8)}
                                </div>
                            </div>

                            {/* Messages Area */}
                            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/30">
                                {messages.map((msg) => (
                                    <div
                                        key={msg.id}
                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                    >
                                        <div className={`flex flex-col max-w-[75%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                                            <div
                                                className={`px-5 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${msg.role === 'user'
                                                        ? 'bg-[#B7EF02] text-brand-black rounded-tr-none'
                                                        : 'bg-white border border-gray-100 text-gray-700 rounded-tl-none'
                                                    }`}
                                            >
                                                {msg.content}
                                            </div>
                                            <span className="text-[10px] text-gray-300 mt-1 px-1">
                                                {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Input Area */}
                            <div className="p-4 bg-white border-t border-gray-100">
                                <form onSubmit={sendMessage} className="relative flex gap-3">
                                    <div className="flex-1 relative">
                                        <input
                                            type="text"
                                            className="w-full pl-5 pr-12 py-3 rounded-full border border-gray-200 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black placeholder-gray-400"
                                            placeholder={`Message ${activeSession.agentName}...`}
                                            value={input}
                                            onChange={(e) => setInput(e.target.value)}
                                            autoFocus
                                        />
                                        <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                            <button
                                                type="submit"
                                                disabled={!input.trim()}
                                                className="p-2 bg-brand-black text-brand-lime rounded-full hover:bg-black/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <Send size={16} />
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-300">
                            <Bot size={64} className="mb-4 opacity-20" />
                            <h3 className="text-lg font-bold text-gray-400">Mission Control Ready</h3>
                            <p className="text-sm">Select an active session to monitor or intervene.</p>
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
