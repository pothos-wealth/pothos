'use client'

import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ModalProps {
    open: boolean
    onClose: () => void
    title: string
    children: React.ReactNode
    className?: string
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
    const dialogRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!open) return
        const handleKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
        }
        document.addEventListener('keydown', handleKey)
        return () => document.removeEventListener('keydown', handleKey)
    }, [open, onClose])

    useEffect(() => {
        if (open) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => { document.body.style.overflow = '' }
    }, [open])

    if (!open) return null

    return (
        <div
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
        >
            <div
                ref={dialogRef}
                className={cn(
                    'bg-bg-2 border border-border rounded-2xl p-6 w-full max-w-md mx-4 shadow-xl',
                    className
                )}
            >
                <div className="flex items-center justify-between mb-5">
                    <h2 className="font-semibold text-fg text-base">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-fg-muted hover:text-fg transition-colors duration-150 rounded-lg p-1 hover:bg-bg-3"
                        aria-label="Close modal"
                    >
                        <X size={18} />
                    </button>
                </div>
                {children}
            </div>
        </div>
    )
}
