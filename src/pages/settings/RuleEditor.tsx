import { useState, useEffect, KeyboardEvent } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Save, ArrowLeft, Copy, Download, CheckCircle2, Trash2, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardShell from '../../components/DashboardShell';
import SidebarNav from '../../components/SidebarNav';
import { rulesService, RuleCategory, slugify } from '../../services/rulesService';

export default function RuleEditor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const isNew = id === 'new';

    const [title, setTitle] = useState('');
    const [category, setCategory] = useState<RuleCategory>('global');
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (!isNew && id) {
            const fetchRule = async () => {
                setLoading(true);
                try {
                    const rule = await rulesService.getRule(id);
                    if (rule) {
                        setTitle(rule.title);
                        setCategory(rule.category);
                        setContent(rule.content);
                    } else {
                        toast.error("Rule not found.");
                        navigate('/settings/rules');
                    }
                } catch (error) {
                    console.error("Failed to fetch rule:", error);
                    toast.error("Failed to load the rule.");
                } finally {
                    setLoading(false);
                }
            };
            fetchRule();
        }
    }, [id, isNew, navigate]);

    const handleSave = async () => {
        if (!title.trim()) {
            toast.error("Title is required.");
            return;
        }

        setSaving(true);
        try {
            if (isNew) {
                const newId = await rulesService.createRule({
                    title,
                    category,
                    content
                });
                toast.success("Rule created successfully!");
                navigate(`/settings/rules/${newId}`, { replace: true });
            } else if (id) {
                await rulesService.updateRule(id, {
                    title,
                    category,
                    content
                });
                toast.success("Rule updated successfully!");
            }
        } catch (error) {
            console.error("Failed to save rule:", error);
            toast.error("Failed to save the rule.");
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!id || isNew) return;
        const confirmed = window.confirm("Are you sure you want to delete this rule? This action cannot be undone.");
        if (confirmed) {
            setSaving(true);
            try {
                await rulesService.deleteRule(id);
                toast.success("Rule deleted successfully!");
                navigate('/settings/rules');
            } catch (error) {
                console.error("Failed to delete rule:", error);
                toast.error("Failed to delete the rule.");
            } finally {
                setSaving(false);
            }
        }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
        if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        }
    };

    const handleCopy = () => {
        navigator.clipboard.writeText(content).then(() => {
            setCopied(true);
            toast.success("Copied to clipboard!");
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleDownload = () => {
        const element = document.createElement("a");
        const file = new Blob([content], { type: 'text/plain' });
        element.href = URL.createObjectURL(file);
        
        // Generate filename based on title or id
        const filename = title ? `${slugify(title)}.txt` : `${id}.txt`;
        element.download = filename;
        
        document.body.appendChild(element); // Required for this to work in FireFox
        element.click();
        document.body.removeChild(element);
    };

    return (
        <DashboardShell
            headerTitle={isNew ? "Create New Rule" : "Edit Rule"}
            sidebarContent={<SidebarNav />}
        >
            <div className="bg-[#F0F0F3] -m-8 p-6 min-h-[calc(100vh-64px)]">
                <div className="max-w-4xl mx-auto">
                    
                    {/* Header Actions */}
                    <div className="flex justify-between items-center mb-6">
                        <button
                            onClick={() => navigate('/settings/rules')}
                            className="flex items-center gap-2 text-gray-500 hover:text-[#101010] transition-colors font-medium"
                        >
                            <ArrowLeft size={18} />
                            Back to Repository
                        </button>
                        
                        <div className="flex items-center gap-3">
                            {!isNew && (
                                <button
                                    onClick={handleDelete}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium shadow-sm hover:bg-red-100 transition-all disabled:opacity-50"
                                    title="Delete Rule"
                                >
                                    <Trash2 size={16} />
                                    Delete
                                </button>
                            )}
                            <button
                                onClick={handleDownload}
                                disabled={!content.trim()}
                                className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-[#101010] rounded-lg font-medium shadow-sm hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                title="Download as .txt"
                            >
                                <Download size={16} />
                                Download
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="flex items-center gap-2 px-6 py-2 bg-[#B7EF02] text-[#101010] rounded-lg font-bold shadow-sm hover:shadow-md hover:bg-[#a3d602] transition-all disabled:opacity-70"
                            >
                                <Save size={18} />
                                {saving ? "Saving..." : "Save Rule"}
                            </button>
                        </div>
                    </div>

                    {/* Editor Form */}
                    {loading ? (
                        <div className="flex justify-center items-center py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#B7EF02]"></div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Meta Card */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 flex gap-6">
                                <div className="flex-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Rule Title</label>
                                    <input
                                        type="text"
                                        value={title}
                                        onChange={(e) => setTitle(e.target.value)}
                                        placeholder="e.g. Global App Architecture Rules"
                                        className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#B7EF02] focus:border-transparent font-medium"
                                        onKeyDown={handleKeyDown}
                                    />
                                </div>
                                <div className="w-64">
                                    <label className="block text-sm font-bold text-gray-700 mb-1">Category</label>
                                    <select
                                        value={category}
                                        onChange={(e) => setCategory(e.target.value as RuleCategory)}
                                        className="w-full px-4 py-2 border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#B7EF02] focus:border-transparent font-medium bg-white"
                                    >
                                        <option value="global">Global Rules</option>
                                        <option value="app">Apps</option>
                                        <option value="website">Websites</option>
                                        <option value="webshop">Webshops</option>
                                    </select>
                                </div>
                            </div>

                            {/* Content Editor Card */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-100 overflow-hidden flex flex-col">
                                <div className="flex justify-between items-center px-6 py-3 border-b border-gray-100 bg-[#F8F8F9]">
                                    <h3 className="font-bold text-[#101010] text-sm flex items-center gap-2">
                                        <FileText size={16} className="text-[#B7EF02]" />
                                        Prompt / Template Content
                                    </h3>
                                    <button
                                        onClick={handleCopy}
                                        disabled={!content.trim()}
                                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 bg-white border border-gray-200 rounded-md hover:bg-gray-50 hover:text-[#101010] transition-colors disabled:opacity-50"
                                    >
                                        {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <Copy size={14} />}
                                        {copied ? "Copied!" : "Copy to Clipboard"}
                                    </button>
                                </div>
                                
                                <div className="relative flex-1">
                                    <textarea
                                        id="rule-textarea"
                                        value={content}
                                        onChange={(e) => setContent(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        placeholder="Enter your prompt, rules, or template content here...&#10;&#10;(Press Ctrl+Enter to save)"
                                        className="w-full min-h-[500px] p-6 font-mono text-sm leading-relaxed text-gray-800 focus:outline-none resize-y"
                                        spellCheck="false"
                                    />
                                </div>
                                
                                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-end">
                                    <span className="text-xs text-gray-400 font-medium">Press <kbd className="bg-white px-1 py-0.5 rounded border border-gray-200 shadow-sm mx-0.5">Ctrl</kbd> + <kbd className="bg-white px-1 py-0.5 rounded border border-gray-200 shadow-sm mx-0.5">Enter</kbd> to save</span>
                                </div>
                            </div>

                            {/* Variable Cheat Sheet */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-6">
                                <h3 className="font-bold text-[#101010] text-sm mb-3">Available Variables</h3>
                                <p className="text-xs text-gray-500 mb-4">Click a variable to insert it at the cursor position (or append to end).</p>
                                <div className="flex flex-wrap gap-2">
                                    {['{project_name}', '{app_id}', '{github_repo}', '{primary_color}', '{secondary_color}', '{tertiary_color}', '{language}', '{ai_model}', '{firebase_project_id}', '{firebase_api_key}', '{firebase_auth_domain}', '{firebase_storage_bucket}', '{firebase_messaging_sender_id}', '{firebase_app_id}'].map(variable => (
                                        <button
                                            key={variable}
                                            onClick={() => {
                                                const textarea = document.getElementById('rule-textarea') as HTMLTextAreaElement;
                                                if (textarea) {
                                                    const start = textarea.selectionStart;
                                                    const end = textarea.selectionEnd;
                                                    const newContent = content.substring(0, start) + variable + content.substring(end);
                                                    setContent(newContent);
                                                    
                                                    // Reset cursor position
                                                    setTimeout(() => {
                                                        textarea.focus();
                                                        textarea.setSelectionRange(start + variable.length, start + variable.length);
                                                    }, 0);
                                                } else {
                                                    setContent(prev => prev + variable);
                                                }
                                            }}
                                            className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-md font-mono text-xs text-[#101010] hover:bg-[#B7EF02] hover:border-[#B7EF02] transition-colors"
                                        >
                                            {variable}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardShell>
    );
}
