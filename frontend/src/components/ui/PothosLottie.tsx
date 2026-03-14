'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'

const DotLottieReact = dynamic(
    () => import('@lottiefiles/dotlottie-react').then((m) => ({ default: m.DotLottieReact })),
    { ssr: false }
)

interface PothosLottieProps {
    size?: number
    loop?: boolean
    className?: string
}

export function PothosLottie({ size = 64, loop = true, className }: PothosLottieProps) {
    const { resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => setMounted(true), [])

    if (!mounted) {
        return <div style={{ width: size, height: size }} className={className} />
    }

    const src =
        resolvedTheme === 'dark'
            ? '/animations/PothosDarkLoader.json'
            : '/animations/PothosLightLoader.json'

    return (
        <div style={{ width: size, height: size }} className={className}>
            <DotLottieReact src={src} loop={loop} autoplay style={{ width: size, height: size }} />
        </div>
    )
}
