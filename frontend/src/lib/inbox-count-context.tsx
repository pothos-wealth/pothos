"use client"

import { createContext, useContext, useState, useEffect } from "react"
import { api } from "@/lib/api"

interface InboxCountContextType {
	inboxCount: number
	setInboxCount: (count: number) => void
}

const InboxCountContext = createContext<InboxCountContextType | undefined>(undefined)

export function InboxCountProvider({ children }: { children: React.ReactNode }) {
	const [inboxCount, setInboxCount] = useState(0)

	useEffect(() => {
		Promise.all([
			api.parsedTransactions.list({ status: "pending_review", page: 1, limit: 1 }),
			api.parseQueue.list(),
		])
			.then(([ptResult, rawResult]) => {
				setInboxCount(ptResult.pagination.total + rawResult.length)
			})
			.catch(() => {})
	}, [])

	return (
		<InboxCountContext.Provider value={{ inboxCount, setInboxCount }}>
			{children}
		</InboxCountContext.Provider>
	)
}

export function useInboxCount() {
	const context = useContext(InboxCountContext)
	if (!context) throw new Error("useInboxCount must be used within InboxCountProvider")
	return context
}
