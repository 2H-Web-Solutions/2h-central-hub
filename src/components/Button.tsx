import { ReactNode, ButtonHTMLAttributes } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    children: ReactNode;
    variant?: 'primary' | 'secondary';
    className?: string;
}

export default function Button({
    children,
    variant = 'primary',
    className = '',
    ...props
}: ButtonProps) {
    const baseStyles = 'px-6 py-2.5 font-medium rounded-full transition-all';

    const variantStyles = {
        primary: 'bg-brand-lime text-black hover:bg-[#84cc16] shadow-lg shadow-lime-500/20',
        secondary: 'bg-transparent border border-brand-lime text-brand-lime hover:bg-brand-lime hover:text-black',
    };

    return (
        <button
            className={`${baseStyles} ${variantStyles[variant]} ${className}`}
            {...props}
        >
            {children}
        </button>
    );
}
