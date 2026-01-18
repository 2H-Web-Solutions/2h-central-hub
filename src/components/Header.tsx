import { ReactNode } from 'react';

interface HeaderProps {
    title?: string;
    children?: ReactNode;
}

export default function Header({ title = 'Dashboard', children }: HeaderProps) {
    return (
        <header className="sticky top-0 z-10 bg-brand-black border-b border-zinc-800 px-8 py-4">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-serif font-bold text-white">{title}</h2>
                </div>
                <div className="flex items-center gap-4">
                    {children}
                </div>
            </div>
        </header>
    );
}
