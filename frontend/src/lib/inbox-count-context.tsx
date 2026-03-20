'use client'

import { createContext, useContext, useState } from 'react'

interface InboxCountContextType {
    inboxCount: number
    setInboxCount: (count: number) => void
}

const InboxCountContext = createContext<InboxCountContextType | undefined>(undefined)

export function InboxCountProvider({ children }: { children: React.ReactNode }) {
    const [inboxCount, setInboxCount] = useState(0)

    return (
        <InboxCountContext.Provider value={{ inboxCount, setInboxCount }}>
            {children}
        </InboxCountContext.Provider>
    )
}

export function useInboxCount() {
    const context = useContext(InboxCountContext)
    if (!context) throw new Error('useInboxCount must be used within InboxCountProvider')
    return context
}
