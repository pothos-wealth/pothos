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
} from './types'

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
    const res = await fetch(`/api/v1${path}`, {
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', ...options?.headers },
        ...options,
    })

    if (res.status === 401) throw new Error('UNAUTHORIZED')
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
        login: (email: string, password: string) =>
            apiFetch<{ message: string }>('/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password }),
            }),
        logout: () =>
            apiFetch<{ message: string }>('/auth/logout', { method: 'POST' }),
        register: (email: string, password: string, currency: string = 'INR') =>
            apiFetch<{ message: string }>('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ email, password, currency }),
            }),
        changePassword: (currentPassword: string, newPassword: string) =>
            apiFetch<{ message: string }>('/auth/change-password', {
                method: 'POST',
                body: JSON.stringify({ currentPassword, newPassword }),
            }),
    },
    accounts: {
        list: () => apiFetch<Account[]>('/accounts'),
        create: (data: { name: string; type: string; initialBalance: number }) =>
            apiFetch<Account>('/accounts', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: { name?: string; type?: string }) =>
            apiFetch<Account>(`/accounts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) =>
            apiFetch<void>(`/accounts/${id}`, { method: 'DELETE' }),
        close: (id: string) =>
            apiFetch<Account>(`/accounts/${id}/close`, { method: 'POST' }),
        reopen: (id: string) =>
            apiFetch<Account>(`/accounts/${id}/reopen`, { method: 'POST' }),
    },
    categories: {
        list: () => apiFetch<Category[]>('/categories'),
        create: (data: { name: string; icon?: string; color?: string; type: 'expense' | 'income' | 'neutral' }) =>
            apiFetch<Category>('/categories', { method: 'POST', body: JSON.stringify(data) }),
        update: (id: string, data: { name?: string; icon?: string; color?: string; type?: string }) =>
            apiFetch<Category>(`/categories/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) =>
            apiFetch<void>(`/categories/${id}`, { method: 'DELETE' }),
    },
    reports: {
        overview: (month: number, year: number) =>
            apiFetch<Overview>(`/reports/overview?month=${month}&year=${year}`),
        categories: (month: number, year: number) =>
            apiFetch<CategoryReport>(`/reports/categories?month=${month}&year=${year}`),
        trends: (months = 6) =>
            apiFetch<TrendsReport>(`/reports/trends?months=${months}`),
    },
    budgets: {
        list: (month: number, year: number) =>
            apiFetch<BudgetWithSpent[]>(`/budgets?month=${month}&year=${year}`),
        upsert: (data: { categoryId: string; amount: number; month: number; year: number }) =>
            apiFetch<BudgetWithSpent>('/budgets', { method: 'POST', body: JSON.stringify(data) }),
        delete: (id: string) =>
            apiFetch<void>(`/budgets/${id}`, { method: 'DELETE' }),
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
            type: 'income' | 'expense'
            amount: number
            date: number
            description: string
            notes?: string
        }) => apiFetch<Transaction>('/transactions', { method: 'POST', body: JSON.stringify(data) }),
        createTransfer: (data: {
            fromAccountId: string
            toAccountId: string
            amount: number
            date: number
            description: string
            notes?: string
        }) =>
            apiFetch<{ debit: Transaction; credit: Transaction }>('/transactions/transfer', {
                method: 'POST',
                body: JSON.stringify(data),
            }),
        update: (
            id: string,
            data: { categoryId?: string; amount?: number; date?: number; description?: string; notes?: string }
        ) => apiFetch<Transaction>(`/transactions/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
        delete: (id: string) =>
            apiFetch<void>(`/transactions/${id}`, { method: 'DELETE' }),
    },
    user: {
        me: () => apiFetch<User>('/user/me'),
        settings: () => apiFetch<UserSettings>('/user/settings'),
        updateSettings: (currency: string) =>
            apiFetch<UserSettings>('/user/settings', {
                method: 'PUT',
                body: JSON.stringify({ currency }),
            }),
    },
}
