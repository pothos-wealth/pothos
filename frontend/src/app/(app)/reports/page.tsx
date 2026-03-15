'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { Card } from '@/components/ui/Card'
import { StatCard } from '@/components/dashboard/StatCard'
import { SpendingChart } from '@/components/dashboard/SpendingChart'
import { MonthPicker } from '@/components/dashboard/MonthPicker'
import { PothosLottie } from '@/components/ui/PothosLottie'
import { PageTransition } from '@/components/ui/PageTransition'
import { api } from '@/lib/api'
import { useCurrencyFormatter, useCurrencySymbol } from '@/lib/utils'
import type { Overview, CategoryReport, TrendsReport } from '@/lib/types'

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export default function ReportsPage() {
    const router = useRouter()
    const formatCurrency = useCurrencyFormatter()
    const currencySymbol = useCurrencySymbol()
    const [month, setMonth] = useState(() => new Date().getMonth() + 1)
    const [year, setYear] = useState(() => new Date().getFullYear())
    const [overview, setOverview] = useState<Overview | null>(null)
    const [categoryReport, setCategoryReport] = useState<CategoryReport | null>(null)
    const [trends, setTrends] = useState<TrendsReport | null>(null)
    const [loading, setLoading] = useState(true)

    const load = useCallback(() => {
        setLoading(true)
        Promise.all([
            api.reports.overview(month, year),
            api.reports.categories(month, year),
            api.reports.trends(6),
        ])
            .then(([o, c, t]) => { setOverview(o); setCategoryReport(c); setTrends(t) })
            .catch((err) => { if (err.message === 'UNAUTHORIZED') router.push('/sign-in') })
            .finally(() => setLoading(false))
    }, [month, year, router])

    useEffect(() => { load() }, [load])

    const savingsRate = overview && overview.income > 0
        ? Math.round((overview.net / overview.income) * 100)
        : null

    const trendData = trends?.data.map((d) => ({
        name: `${MONTH_SHORT[d.month - 1]} '${String(d.year).slice(2)}`,
        Income: d.income,
        Expenses: d.expenses,
    })) ?? []

    if (loading) {
        return (
            <PageTransition>
                <div className="flex items-center justify-center h-full">
                    <PothosLottie size={80} />
                </div>
            </PageTransition>
        )
    }

    return (
        <PageTransition>
        <div className="p-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-fg">Reports</h1>
                    <p className="text-sm text-fg-muted mt-0.5">Your financial picture</p>
                </div>
                <MonthPicker month={month} year={year} onChange={(m, y) => { setMonth(m); setYear(y) }} />
            </div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatCard title="Income" value={formatCurrency(overview?.income ?? 0)} />
                <StatCard title="Expenses" value={formatCurrency(overview?.expenses ?? 0)} />
                <StatCard
                    title="Net"
                    value={formatCurrency(overview?.net ?? 0)}
                    positive={overview ? overview.net >= 0 : true}
                />
                <StatCard
                    title="Savings Rate"
                    value={savingsRate !== null ? `${savingsRate}%` : '—'}
                    positive={savingsRate !== null ? savingsRate >= 0 : true}
                />
            </div>

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
                <div className="lg:col-span-3">
                    <SpendingChart data={categoryReport?.data ?? []} />
                </div>

                {/* Trends bar chart */}
                <div className="lg:col-span-2">
                    <Card>
                        <p className="text-sm font-semibold text-fg mb-4">Income vs Expenses (6 months)</p>
                        {trendData.length === 0 ? (
                            <div className="h-[180px] flex items-center justify-center">
                                <p className="text-sm text-fg-muted">No data yet</p>
                            </div>
                        ) : (
                            <div className="h-[200px]" role="img" aria-label="Monthly income and expenses bar chart">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={trendData} barGap={2} barSize={10}>
                                        <XAxis
                                            dataKey="name"
                                            tick={{ fontSize: 11, fill: 'var(--color-fg-muted)' }}
                                            axisLine={false}
                                            tickLine={false}
                                        />
                                        <YAxis
                                            tick={{ fontSize: 11, fill: 'var(--color-fg-muted)' }}
                                            axisLine={false}
                                            tickLine={false}
                                            tickFormatter={(v) => `${currencySymbol}${(v / 1000).toFixed(0)}k`}
                                            width={48}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'var(--color-bg-2)',
                                                border: '1px solid var(--color-border)',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                            }}
                                            formatter={(value) => [formatCurrency(Number(value)), '']}
                                        />
                                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px' }} />
                                        <Bar dataKey="Income" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
                                        <Bar dataKey="Expenses" fill="var(--color-expense)" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </Card>
                </div>
            </div>

            {/* Category breakdown table */}
            {categoryReport && categoryReport.data.length > 0 && (
                <Card>
                    <p className="text-sm font-semibold text-fg mb-4">Category Breakdown</p>
                    <div className="divide-y divide-border">
                        {categoryReport.data
                            .sort((a, b) => b.total - a.total)
                            .map((row) => {
                                const totalExpenses = categoryReport.data.reduce((s, r) => s + r.total, 0)
                                const pct = totalExpenses > 0 ? Math.round((row.total / totalExpenses) * 100) : 0
                                return (
                                    <div key={row.categoryId ?? 'uncategorised'} className="py-3 flex items-center gap-3">
                                        <span
                                            className="w-2.5 h-2.5 rounded-full shrink-0"
                                            style={{ backgroundColor: row.categoryColor ?? '#B5A882' }}
                                        />
                                        <span className="flex-1 text-sm text-fg">{row.categoryName}</span>
                                        <div className="w-24 h-1.5 bg-bg-3 rounded-full overflow-hidden">
                                            <div
                                                className="h-full rounded-full"
                                                style={{
                                                    width: `${pct}%`,
                                                    backgroundColor: row.categoryColor ?? 'var(--color-expense)',
                                                }}
                                            />
                                        </div>
                                        <span className="text-xs text-fg-muted w-8 text-right">{pct}%</span>
                                        <span className="text-sm font-semibold text-fg w-24 text-right">
                                            {formatCurrency(row.total)}
                                        </span>
                                    </div>
                                )
                            })}
                    </div>
                </Card>
            )}
        </div>
        </PageTransition>
    )
}
