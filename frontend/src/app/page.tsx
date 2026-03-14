import { LandingNav } from '@/components/landing/LandingNav'
import { LandingHero } from '@/components/landing/LandingHero'
import { LandingFooter } from '@/components/landing/LandingFooter'

export default function LandingPage() {
    return (
        <main className="min-h-screen bg-bg flex flex-col">
            <LandingNav />
            <LandingHero />
            <LandingFooter />
        </main>
    )
}
