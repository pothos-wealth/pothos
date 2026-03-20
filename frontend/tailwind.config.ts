import type { Config } from 'tailwindcss'

const config: Config = {
    content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
    darkMode: 'class',
    theme: {
        extend: {
            colors: {
                bg: 'var(--color-bg)',
                'bg-2': 'var(--color-bg-2)',
                'bg-3': 'var(--color-bg-3)',
                fg: 'var(--color-fg)',
                'fg-muted': 'var(--color-fg-muted)',
                primary: 'var(--color-primary)',
                'primary-hover': 'var(--color-primary-hover)',
                accent: 'var(--color-accent)',
                'accent-light': 'var(--color-accent-light)',
                border: 'var(--color-border)',
                expense: 'var(--color-expense)',
                'expense-light': 'var(--color-expense-light)',
                income: 'var(--color-income)',
                'income-light': 'var(--color-income-light)',
            },
            fontFamily: {
                sans: ['var(--font-jakarta)', 'Plus Jakarta Sans', 'sans-serif'],
            },
            keyframes: {
                blob: {
                    '0%, 100%': { transform: 'translate(0px, 0px) scale(1)' },
                    '33%': { transform: 'translate(30px, -20px) scale(1.06)' },
                    '66%': { transform: 'translate(-20px, 15px) scale(0.95)' },
                },
            },
            animation: {
                blob: 'blob 14s ease-in-out infinite',
                'blob-delayed': 'blob 18s ease-in-out infinite 5s',
            },
        },
    },
    plugins: [],
}

export default config
