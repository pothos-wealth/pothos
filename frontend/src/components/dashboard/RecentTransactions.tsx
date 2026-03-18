import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { cn, useCurrencyFormatter, formatDate, getCategoryName } from '@/lib/utils'
import type { Transaction, Category } from '@/lib/types'

interface RecentTransactionsProps {
    transactions: Transaction[]
    categories: Category[]
}

export function RecentTransactions({ transactions, categories }: RecentTransactionsProps) {
    const formatCurrency = useCurrencyFormatter()

    return (
        <Card>
            <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold text-fg">Recent Transactions</p>
                <Link
                    href="/transactions"
                    className="text-xs font-medium text-primary hover:underline"
                >
                    View all
                </Link>
            </div>

            {transactions.length === 0 ? (
                <p className="text-sm text-fg-muted py-4 text-center">No transactions yet</p>
            ) : (
                <div className="divide-y divide-border">
                    {transactions.map((tx) => {
                        const isTransfer = tx.type === 'transfer'
                        const isPositive = tx.amount > 0
                        return (
                            <div key={tx.id} className="py-3 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <span
                                        className={cn(
                                            'w-2 h-2 rounded-full shrink-0',
                                            isTransfer ? 'bg-fg-muted' : isPositive ? 'bg-primary' : 'bg-expense'
                                        )}
                                    />
                                    <div>
                                        <p className="text-sm font-medium text-fg">
                                            {tx.description}
                                        </p>
                                        <p className="text-xs text-fg-muted">
                                            {isTransfer ? 'Transfer' : getCategoryName(tx.categoryId, categories)}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p
                                        className={cn(
                                            'text-sm font-semibold',
                                            isTransfer ? 'text-fg-muted' : isPositive ? 'text-primary' : 'text-fg'
                                        )}
                                    >
                                        {isTransfer ? '' : isPositive ? '+' : '-'}
                                        {formatCurrency(Math.abs(tx.amount))}
                                    </p>
                                    <p className="text-xs text-fg-muted">{formatDate(tx.date)}</p>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </Card>
    )
}
