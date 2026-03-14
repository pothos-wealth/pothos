import { ThemeToggle } from '@/components/ui/ThemeToggle'
import Link from 'next/link'
import { PlantIcon } from '@/components/ui/PlantIcon'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-bg flex flex-col">
            <header className="px-6 py-4 flex items-center justify-between border-b border-border">
                <Link href="/" className="flex items-center gap-1.5">
                    <PlantIcon size={22} className="text-primary" />
                    <span className="font-bold text-fg tracking-tight">Pothos</span>
                </Link>
                <ThemeToggle />
            </header>
            <main className="flex-1 flex items-center justify-center px-4 py-12">
                {children}
            </main>
        </div>
    )
}
