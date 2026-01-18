import { useState } from 'react';
import Button from './Button';
import { AlertTriangle } from 'lucide-react';

interface SecureDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
}

export default function SecureDeleteModal({ isOpen, onClose, onConfirm, title }: SecureDeleteModalProps) {
    const [inputValue, setInputValue] = useState('');

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (inputValue === 'delete') {
            onConfirm();
            setInputValue(''); // Reset for next time
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-xl p-8 w-full max-w-md shadow-2xl relative border border-red-100">
                <div className="text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <AlertTriangle className="text-red-600" size={24} />
                    </div>

                    <h3 className="text-2xl font-serif font-bold text-gray-900 mb-2">Delete {title}?</h3>
                    <p className="text-sm text-gray-500 mb-6">
                        This action cannot be undone. To confirm, please type <span className="font-bold text-gray-900">delete</span> below.
                    </p>

                    <input
                        type="text"
                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:border-red-500 focus:ring-1 focus:ring-red-500 outline-none transition-all text-center mb-6 text-brand-black"
                        placeholder="Type 'delete'"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                    />

                    <div className="flex gap-3">
                        <Button variant="secondary" onClick={onClose} className="flex-1">
                            Cancel
                        </Button>
                        <button
                            onClick={handleConfirm}
                            disabled={inputValue !== 'delete'}
                            className={`flex-1 px-4 py-2 rounded-full font-bold transition-all ${inputValue === 'delete'
                                    ? 'bg-red-600 text-white hover:bg-red-700 shadow-md'
                                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                                }`}
                        >
                            Confirm Delete
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
