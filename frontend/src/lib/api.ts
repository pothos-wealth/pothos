import type {
	Account,
	Overview,
	CategoryReport,
	Category,
	BudgetWithSpent,
	TransactionList,
	Transaction,
	TrendsReport,
	User,
	UserSettings,
	AdminUser,
	AdminSession,
	AdminStats,
	AdminSettings,
	ImapSettings,
	EmailStatus,
	LlmSettings,
	ParsedTransaction,
	ParsedTransactionList,
	PendingMessage,
} from "./types"

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
	const res = await fetch(`/api/v1${path}`, {
		credentials: "include",
		headers: {
			...(options?.body ? { "Content-Type": "application/json" } : {}),
			...options?.headers,
		},
		...options,
	})

	if (res.status === 401) throw new Error("UNAUTHORIZED")
	if (!res.ok) {
		let message = `Request failed: ${res.status}`
		try {
			const body = await res.json()
			if (body?.error) message = body.error
		} catch {}
		throw new Error(message)
	}

	if (res.status === 204) return undefined as T
	return res.json()
}

export const api = {
	auth: {
		config: () => apiFetch<{ registrationRequiresCode: boolean }>("/auth/config"),
		login: (email: string, password: string) =>
			apiFetch<{ message: string }>("/auth/login", {
				method: "POST",
				body: JSON.stringify({ email, password }),
			}),
		logout: () => apiFetch<{ message: string }>("/auth/logout", { method: "POST" }),
		register: (
			email: string,
			password: string,
			currency: string = "INR",
			inviteCode?: string
		) =>
			apiFetch<{ message: string }>("/auth/register", {
				method: "POST",
				body: JSON.stringify({
					email,
					password,
					currency,
					...(inviteCode ? { inviteCode } : {}),
				}),
			}),
		changePassword: (currentPassword: string, newPassword: string) =>
			apiFetch<{ message: string }>("/auth/change-password", {
				method: "POST",
				body: JSON.stringify({ currentPassword, newPassword }),
			}),
	},
	accounts: {
		list: () => apiFetch<Account[]>("/accounts"),
		create: (data: { name: string; type: string; initialBalance: number }) =>
			apiFetch<Account>("/accounts", { method: "POST", body: JSON.stringify(data) }),
		update: (id: string, data: { name?: string; type?: string }) =>
			apiFetch<Account>(`/accounts/${id}`, { method: "PUT", body: JSON.stringify(data) }),
		delete: (id: string) => apiFetch<void>(`/accounts/${id}`, { method: "DELETE" }),
		close: (id: string) => apiFetch<Account>(`/accounts/${id}/close`, { method: "POST" }),
		reopen: (id: string) => apiFetch<Account>(`/accounts/${id}/reopen`, { method: "POST" }),
	},
	categories: {
		list: () => apiFetch<Category[]>("/categories"),
		create: (data: {
			name: string
			icon?: string
			color?: string
			type: "expense" | "income" | "neutral"
		}) => apiFetch<Category>("/categories", { method: "POST", body: JSON.stringify(data) }),
		update: (
			id: string,
			data: { name?: string; icon?: string; color?: string; type?: string }
		) => apiFetch<Category>(`/categories/${id}`, { method: "PUT", body: JSON.stringify(data) }),
		delete: (id: string) => apiFetch<void>(`/categories/${id}`, { method: "DELETE" }),
	},
	reports: {
		overview: (month: number, year: number) =>
			apiFetch<Overview>(`/reports/overview?month=${month}&year=${year}`),
		categories: (month: number, year: number) =>
			apiFetch<CategoryReport>(`/reports/categories?month=${month}&year=${year}`),
		trends: (months = 6) => apiFetch<TrendsReport>(`/reports/trends?months=${months}`),
	},
	budgets: {
		list: (month: number, year: number) =>
			apiFetch<BudgetWithSpent[]>(`/budgets?month=${month}&year=${year}`),
		upsert: (data: {
			categoryId: string
			amount: number
			month: number
			year: number
			isRecurring: boolean
			isCommitted: boolean
		}) => apiFetch<BudgetWithSpent>("/budgets", { method: "POST", body: JSON.stringify(data) }),
		delete: (id: string) => apiFetch<void>(`/budgets/${id}`, { method: "DELETE" }),
	},
	transactions: {
		list: (params: Record<string, string | number>) => {
			const qs = new URLSearchParams(
				Object.entries(params).map(([k, v]) => [k, String(v)])
			).toString()
			return apiFetch<TransactionList>(`/transactions?${qs}`)
		},
		create: (data: {
			accountId: string
			categoryId?: string
			type: "income" | "expense"
			amount: number
			date: number
			description: string
			notes?: string
		}) =>
			apiFetch<Transaction>("/transactions", { method: "POST", body: JSON.stringify(data) }),
		createTransfer: (data: {
			fromAccountId: string
			toAccountId: string
			amount: number
			date: number
			description: string
			notes?: string
		}) =>
			apiFetch<{ debit: Transaction; credit: Transaction }>("/transactions/transfer", {
				method: "POST",
				body: JSON.stringify(data),
			}),
		update: (
			id: string,
			data: {
				categoryId?: string
				amount?: number
				date?: number
				description?: string
				notes?: string
			}
		) =>
			apiFetch<Transaction>(`/transactions/${id}`, {
				method: "PUT",
				body: JSON.stringify(data),
			}),
		delete: (id: string) => apiFetch<void>(`/transactions/${id}`, { method: "DELETE" }),
	},
	user: {
		me: () => apiFetch<User>("/user/me"),
		settings: () => apiFetch<UserSettings>("/user/settings"),
		updateSettings: (currency: string) =>
			apiFetch<UserSettings>("/user/settings", {
				method: "PUT",
				body: JSON.stringify({ currency }),
			}),
	},
	admin: {
		settings: () => apiFetch<AdminSettings>("/admin/settings"),
		stats: () => apiFetch<AdminStats>("/admin/stats"),
		users: () => apiFetch<AdminUser[]>("/admin/users"),
		deleteUser: (id: string) => apiFetch<void>(`/admin/users/${id}`, { method: "DELETE" }),
		getSessions: (userId: string) =>
			apiFetch<AdminSession[]>(`/admin/users/${userId}/sessions`),
		deleteSession: (userId: string, sessionId: string) =>
			apiFetch<void>(`/admin/users/${userId}/sessions/${sessionId}`, { method: "DELETE" }),
		deleteAllSessions: (userId: string) =>
			apiFetch<void>(`/admin/users/${userId}/sessions`, { method: "DELETE" }),
	},
	email: {
		getSettings: () => apiFetch<ImapSettings>("/email/settings"),
		saveSettings: (data: {
			email: string
			password: string
			host: string
			port: number
			mailbox: string
			isActive?: boolean
		}) =>
			apiFetch<ImapSettings>("/email/settings", {
				method: "PUT",
				body: JSON.stringify(data),
			}),
		deleteSettings: () => apiFetch<void>("/email/settings", { method: "DELETE" }),
		getStatus: () => apiFetch<EmailStatus>("/email/status"),
		poll: () =>
			apiFetch<{ fetched: number; parsed: number }>("/email/poll", { method: "POST" }),
	},
	llm: {
		getSettings: () => apiFetch<LlmSettings>("/llm/settings"),
		saveSettings: (data: { provider: string; apiKey?: string | null; model: string }) =>
			apiFetch<LlmSettings>("/llm/settings", { method: "PUT", body: JSON.stringify(data) }),
	},
	parseQueue: {
		list: () => apiFetch<PendingMessage[]>("/parse-queue"),
		submit: (
			id: string,
			data: {
				type: "income" | "expense"
				amount: number
				date: number
				description: string
				accountId?: string | null
				categoryId?: string | null
				notes?: string | null
				bypassReview?: boolean
			}
		) =>
			apiFetch<ParsedTransaction>(`/parse-queue/${id}/submit`, {
				method: "POST",
				body: JSON.stringify(data),
			}),
		dismiss: (id: string) => apiFetch<void>(`/parse-queue/${id}/dismiss`, { method: "POST" }),
	},
	parsedTransactions: {
		list: (params: { status?: string; page?: number; limit?: number }) => {
			const qs = new URLSearchParams(
				Object.entries(params)
					.filter(([, v]) => v !== undefined)
					.map(([k, v]) => [k, String(v)])
			).toString()
			return apiFetch<ParsedTransactionList>(`/parsed-transactions?${qs}`)
		},
		update: (
			id: string,
			data: Partial<
				Pick<
					ParsedTransaction,
					| "type"
					| "amount"
					| "date"
					| "description"
					| "accountId"
					| "categoryId"
					| "notes"
				>
			>
		) =>
			apiFetch<ParsedTransaction>(`/parsed-transactions/${id}`, {
				method: "PUT",
				body: JSON.stringify(data),
			}),
		approve: (id: string) =>
			apiFetch<Transaction>(`/parsed-transactions/${id}/approve`, { method: "POST" }),
		reject: (id: string) =>
			apiFetch<void>(`/parsed-transactions/${id}/reject`, { method: "POST" }),
	},
}
