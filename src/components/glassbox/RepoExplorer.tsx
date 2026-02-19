
import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Folder, File, ChevronLeft, Loader2, AlertCircle } from 'lucide-react';

interface RepoExplorerProps {
    repoUrl: string;
}

interface FileItem {
    name: string;
    path: string;
    type: 'file' | 'dir';
    sha: string;
    size: number;
    url: string;
}

export default function RepoExplorer({ repoUrl }: RepoExplorerProps) {
    const [currentPath, setCurrentPath] = useState('');
    const [fileTree, setFileTree] = useState<FileItem[]>([]);
    const [currentFile, setCurrentFile] = useState<string | null>(null);
    const [fileContent, setFileContent] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch file list
    const fetchFileList = async (path: string) => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/github', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'list', repoUrl, path })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to fetch file list');
            }

            const data = await response.json();
            // GitHub API returns an array for directory listing
            if (Array.isArray(data)) {
                // Sort: folders first, then files
                const sorted = data.sort((a: any, b: any) => {
                    if (a.type === b.type) return a.name.localeCompare(b.name);
                    return a.type === 'dir' ? -1 : 1;
                });
                setFileTree(sorted);
                setCurrentPath(path);
                setCurrentFile(null); // Clear file view when navigating folders
            } else {
                setError("Unexpected response format from GitHub");
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Initial load
    useEffect(() => {
        if (repoUrl) {
            fetchFileList('');
        }
    }, [repoUrl]);

    // Handle file/folder click
    const handleItemClick = async (item: FileItem) => {
        if (item.type === 'dir') {
            fetchFileList(item.path);
        } else {
            // Read file content
            setLoading(true);
            setError(null);
            setCurrentFile(item.path);
            try {
                const response = await fetch('/api/github', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'read', repoUrl, path: item.path })
                });

                if (!response.ok) {
                    const errData = await response.json();
                    throw new Error(errData.error || 'Failed to read file');
                }

                const data = await response.json();
                setFileContent(data.content);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
    };

    // Go up a directory
    const handleGoUp = () => {
        if (!currentPath) return;
        const parts = currentPath.split('/');
        parts.pop();
        fetchFileList(parts.join('/'));
    };

    return (
        <div className="flex h-full border rounded-xl overflow-hidden bg-white shadow-sm">
            {/* Sidebar: File List */}
            <div className="w-64 border-r bg-gray-50 flex flex-col">
                <div className="p-3 border-b bg-gray-100 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-600 truncate" title={currentPath || 'Root'}>
                        {currentPath ? `/${currentPath}` : '/ root'}
                    </span>
                    {currentPath && (
                        <button onClick={handleGoUp} className="p-1 hover:bg-gray-200 rounded" title="Go Up">
                            <ChevronLeft size={14} />
                        </button>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {loading && !currentFile && (
                        <div className="flex justify-center p-4"><Loader2 className="animate-spin text-gray-400" size={20} /></div>
                    )}

                    {error && !currentFile && (
                        <div className="p-2 text-xs text-red-500 bg-red-50 rounded border border-red-100 flex items-start gap-2">
                            <AlertCircle size={14} className="mt-0.5 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {!loading && fileTree.map((item) => (
                        <div
                            key={item.path}
                            onClick={() => handleItemClick(item)}
                            className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm truncate transition-colors ${currentFile === item.path
                                    ? 'bg-blue-100 text-blue-700 font-medium'
                                    : 'hover:bg-gray-200 text-gray-700'
                                }`}
                        >
                            {item.type === 'dir' ? (
                                <Folder size={16} className="text-yellow-500 shrink-0" />
                            ) : (
                                <File size={16} className="text-gray-400 shrink-0" />
                            )}
                            <span className="truncate">{item.name}</span>
                        </div>
                    ))}

                    {!loading && fileTree.length === 0 && !error && (
                        <div className="text-center text-xs text-gray-400 py-4">For empty folders, upload files</div>
                    )}
                </div>
            </div>

            {/* Main Area: Editor */}
            <div className="flex-1 flex flex-col bg-[#1e1e1e]">
                {/* Editor Header */}
                <div className="h-9 bg-[#252526] border-b border-[#3e3e42] flex items-center px-4">
                    <span className="text-xs text-gray-300 font-mono">
                        {currentFile || 'Select a file to view code'}
                    </span>
                </div>

                <div className="flex-1 relative">
                    {loading && currentFile && (
                        <div className="absolute inset-0 bg-black/20 z-10 flex items-center justify-center">
                            <Loader2 className="animate-spin text-white" size={32} />
                        </div>
                    )}

                    {currentFile ? (
                        <Editor
                            height="100%"
                            defaultLanguage="typescript" // You might want dynamic language detection based on extension
                            path={currentFile} // Helps Monaco with intellisense/syntax
                            value={fileContent}
                            theme="vs-dark"
                            options={{
                                readOnly: true,
                                minimap: { enabled: false },
                                fontSize: 13,
                                scrollBeyondLastLine: false,
                                automaticLayout: true,
                            }}
                        />
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-500">
                            <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <File size={32} opacity={0.5} />
                            </div>
                            <p className="text-sm">Select a file from the explorer</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
