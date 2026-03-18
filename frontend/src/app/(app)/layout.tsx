import { Sidebar } from '@/components/app/Sidebar'
import { BottomNav } from '@/components/app/BottomNav'

export default function AppLayout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen overflow-hidden bg-bg pt-[env(safe-area-inset-top)]">
            <Sidebar />
            <main className="flex-1 min-w-0 overflow-y-auto pb-20 md:pb-0 scrollbar-hide">
                {children}
            </main>
            <BottomNav />
        </div>
    )
}
