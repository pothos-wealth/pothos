export interface Account {
    id: string
    name: string
    type: string
    balance: number
    initialBalance: number
    isActive: boolean
}

export interface Overview {
    month: number
    year: number
    income: number
    expenses: number
    net: number
}

export interface CategoryBreakdown {
    categoryId: string | null
    categoryName: string
    categoryColor: string | null
    categoryIcon: string | null
    total: number
}

export interface CategoryReport {
    month: number
    year: number
    data: CategoryBreakdown[]
}

export interface Category {
    id: string
    userId: string | null
    name: string
    icon: string | null
    color: string | null
    type: 'expense' | 'income' | 'neutral'
}

export interface BudgetWithSpent {
    id: string
    categoryId: string
    amount: number
    month: number
    year: number
    isRecurring: boolean
    spent: number
    remaining: number
}

export interface Transaction {
    id: string
    accountId: string
    categoryId: string | null
    type: 'income' | 'expense' | 'transfer'
    amount: number
    date: number
    description: string
    notes: string | null
}

export interface TransactionList {
    data: Transaction[]
    pagination: {
        page: number
        limit: number
        total: number
        totalPages: number
    }
}

export interface TrendPoint {
    month: number
    year: number
    income: number
    expenses: number
    net: number
}

export interface TrendsReport {
    months: number
    data: TrendPoint[]
}

export interface User {
    id: string
    email: string
    isSuperadmin: boolean
    createdAt: number
    updatedAt: number
}

export interface AdminUser {
    id: string
    email: string
    createdAt: number
    isSuperadmin: boolean
    currency: string | null
    accountCount: number
    transactionCount: number
    activeSessionCount: number
}

export interface AdminSession {
    id: string
    userId: string
    expiresAt: number
    createdAt: number
}

export interface AdminStats {
    dbSizeBytes: number
    totalUsers: number
    totalTransactions: number
}

export interface UserSettings {
    id: string
    userId: string
    currency: string
    createdAt: number
    updatedAt: number
}
