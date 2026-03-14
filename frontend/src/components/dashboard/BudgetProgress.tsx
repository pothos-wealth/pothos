import { Card } from '@/components/ui/Card'
import { cn, useCurrencyFormatter, getCategoryName } from '@/lib/utils'
import type { BudgetWithSpent, Category } from '@/lib/types'

interface BudgetProgressProps {
    budgets: BudgetWithSpent[]
    categories: Category[]
}

export function BudgetProgress({ budgets, categories }: BudgetProgressProps) {
    const formatCurrency = useCurrencyFormatter()

    return (
        <Card className="h-full flex flex-col">
            <p className="text-sm font-semibold text-fg mb-4">Budget Progress</p>

            {budgets.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-fg-muted">No budgets set for this month</p>
                </div>
            ) : (
                <div className="flex flex-col flex-1 gap-4 overflow-y-auto">
                    {budgets.map((budget) => {
                        const isOver = budget.spent >= budget.amount
                        const percent = Math.min((budget.spent / budget.amount) * 100, 100)
                        return (
                            <div key={budget.id}>
                                <div className="flex justify-between items-center mb-1.5">
                                    <span className="text-xs font-medium text-fg">
                                        {getCategoryName(budget.categoryId, categories)}
                                    </span>
                                    <span
                                        className={cn(
                                            'text-xs',
                                            isOver ? 'text-expense' : 'text-fg-muted'
                                        )}
                                    >
                                        {formatCurrency(budget.spent)} /{' '}
                                        {formatCurrency(budget.amount)}
                                    </span>
                                </div>
                                <div className="h-1.5 bg-bg-3 rounded-full overflow-hidden">
                                    <div
                                        className={cn(
                                            'h-full rounded-full',
                                            isOver ? 'bg-expense' : 'bg-primary'
                                        )}
                                        style={{ width: `${percent}%` }}
                                    />
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </Card>
    )
}
