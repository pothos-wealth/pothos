'use client'

import { Modal } from './Modal'

interface ConfirmModalProps {
    open: boolean
    onClose: () => void
    onConfirm: () => void
    title: string
    message: string
    confirmLabel?: string
    loading?: boolean
}

export function ConfirmModal({
    open,
    onClose,
    onConfirm,
    title,
    message,
    confirmLabel = 'Delete',
    loading = false,
}: ConfirmModalProps) {
    return (
        <Modal open={open} onClose={onClose} title={title}>
            <p className="text-sm text-fg-muted mb-6">{message}</p>
            <div className="flex gap-2">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="flex-1 border border-border text-fg font-semibold rounded-xl px-4 py-2.5 text-sm hover:bg-bg-3 transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    Cancel
                </button>
                <button
                    type="button"
                    onClick={onConfirm}
                    disabled={loading}
                    className="flex-1 bg-expense hover:bg-expense/90 text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                    {loading ? 'Deleting…' : confirmLabel}
                </button>
            </div>
        </Modal>
    )
}
