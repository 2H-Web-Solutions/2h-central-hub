/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'brand-lime': '#B7EF02',
                'brand-black': '#101010',
                'brand-bg': '#F0F0F3',
                'brand-text-main': '#101010',
                'brand-text-muted': '#727272',
                'upseo': {
                    'background': '#0b0f19',
                    'surface': '#111625',
                    'border': '#1f2937',
                },
            },
            fontFamily: {
                'serif': ['Federo', 'sans-serif'],
                'sans': ['Barlow', 'sans-serif'],
            },
        },
    },
    plugins: [],
}
