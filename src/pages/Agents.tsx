import { useState, useEffect, useRef } from 'react';
import { collection, addDoc, onSnapshot, serverTimestamp, query, orderBy, Timestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import DashboardShell from '../components/DashboardShell';
import SidebarNav from '../components/SidebarNav';

interface Message {
    id: string;
    role: 'user' | 'ai';
    content: string;
    timestamp: Timestamp;
}

export default function Agents() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Hardcoded agents
    const agents = [
        { id: 1, name: 'Google Ads Specialist', role: 'PPC Expert' },
        { id: 2, name: 'SEO Auditor', role: 'Technical SEO' },
        { id: 3, name: 'Content Writer', role: 'Copywriting' }
    ];
    const [activeAgentId, setActiveAgentId] = useState(1);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Subscribe to Memory
    useEffect(() => {
        const q = query(
            collection(db, 'apps', '2h_hub_v1', 'memory'),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs: Message[] = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            } as Message));
            setMessages(msgs);
        });

        return () => unsubscribe();
    }, []);

    const sendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        try {
            await addDoc(collection(db, 'apps', '2h_hub_v1', 'memory'), {
                sessionId: 'default',
                role: 'user',
                content: input,
                timestamp: serverTimestamp(),
                agentId: activeAgentId
            });
            setInput('');

            // Trigger n8n Webhook (Background Process)
            try {
                fetch('https://up-seo-2025.app.n8n.cloud/webhook-test/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: input,
                        sessionId: 'default-session',
                        role: 'user',
                        agent: agents.find(a => a.id === activeAgentId)?.name || 'Unknown Agent',
                        timestamp: new Date().toISOString()
                    })
                });
            } catch (err) {
                console.error("Failed to trigger n8n", err);
            }
        } catch (error) {
            console.error("Error sending message: ", error);
        }
    };

    return (
        <DashboardShell
            headerTitle="AI Agents"
            sidebarContent={<SidebarNav />}
        >
            <div className="flex h-[calc(100vh-140px)] gap-6">
                {/* Agent List (Left) */}
                <div className="w-1/4 space-y-3">
                    {agents.map(agent => (
                        <div
                            key={agent.id}
                            onClick={() => setActiveAgentId(agent.id)}
                            className={`p-4 rounded-xl border cursor-pointer transition-all ${activeAgentId === agent.id
                                ? 'bg-white border-brand-lime shadow-md'
                                : 'bg-white border-gray-100 opacity-70 hover:opacity-100'
                                }`}
                        >
                            <h3 className="font-bold text-brand-black">{agent.name}</h3>
                            <p className="text-xs text-brand-text-muted">{agent.role}</p>
                        </div>
                    ))}
                </div>

                {/* Chat Window (Right) */}
                <div className="w-3/4 flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-gray-50/50">
                        {messages.length === 0 && (
                            <div className="text-center text-gray-400 mt-10">
                                <p>Select an agent and start chatting.</p>
                            </div>
                        )}

                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[70%] px-4 py-2 rounded-2xl text-sm ${msg.role === 'user'
                                        ? 'bg-[#B7EF02] text-brand-black rounded-tr-none'
                                        : 'bg-white border border-gray-200 text-gray-700 rounded-tl-none shadow-sm'
                                        }`}
                                >
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="p-4 bg-white border-t border-gray-100">
                        <form onSubmit={sendMessage} className="flex gap-2">
                            <input
                                type="text"
                                className="flex-1 px-4 py-2 rounded-full border border-gray-200 focus:border-brand-lime focus:ring-1 focus:ring-brand-lime outline-none transition-all bg-gray-50 text-brand-black"
                                placeholder="Type a message..."
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                            />
                            <button
                                type="submit"
                                className="p-2 bg-brand-black text-brand-lime rounded-full hover:bg-black/90 transition-all font-medium"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                            </button>
                        </form>
                    </div>
                </div>
            </div>
        </DashboardShell>
    );
}
