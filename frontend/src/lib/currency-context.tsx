'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api'

interface CurrencyContextType {
    currency: string
    setCurrency: (currency: string) => void
    loading: boolean
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined)

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
    const [currency, setCurrency] = useState('INR')
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        api.user.settings()
            .then((settings) => setCurrency(settings.currency))
            .catch(() => setCurrency('INR'))
            .finally(() => setLoading(false))
    }, [])

    return (
        <CurrencyContext.Provider value={{ currency, setCurrency, loading }}>
            {children}
        </CurrencyContext.Provider>
    )
}

export function useCurrency() {
    const context = useContext(CurrencyContext)
    if (!context) {
        throw new Error('useCurrency must be used within CurrencyProvider')
    }
    return context
}
