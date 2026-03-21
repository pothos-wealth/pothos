"use client";

import { useState, useEffect, Suspense } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Greeting } from "@/components/dashboard/Greeting";
import { StatCard } from "@/components/dashboard/StatCard";
import { SpendingChart } from "@/components/dashboard/SpendingChart";
import { BudgetProgress } from "@/components/dashboard/BudgetProgress";
import { RecentTransactions } from "@/components/dashboard/RecentTransactions";
import { MonthPicker } from "@/components/dashboard/MonthPicker";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { PageTransition } from "@/components/ui/PageTransition";
import { api } from "@/lib/api";
import { useCurrency } from "@/lib/currency-context";
import { useCurrencyFormatter, useCurrencySymbol } from "@/lib/utils";
import type {
	Account,
	Overview,
	CategoryReport,
	BudgetWithSpent,
	TransactionList,
	Category,
	TrendsReport,
} from "@/lib/types";

const MONTH_SHORT = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

interface DashboardData {
	accounts: Account[];
	overview: Overview;
	categoryReport: CategoryReport;
	budgets: BudgetWithSpent[];
	transactions: TransactionList;
	categories: Category[];
	trends: TrendsReport;
}

function DashboardSkeleton() {
	return (
		<div className="px-4 py-6 md:px-6 max-w-7xl mx-auto">
			<div className="flex items-center justify-between mb-8">
				<div>
					<Skeleton className="h-8 w-52 mb-2" />
					<Skeleton className="h-4 w-32" />
				</div>
				<Skeleton className="h-9 w-36 rounded-xl" />
			</div>
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
				{[...Array(4)].map((_, i) => (
					<Card key={i}>
						<Skeleton className="h-3 w-24 mb-3" />
						<Skeleton className="h-8 w-32" />
					</Card>
				))}
			</div>
			<div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
				<Card className="lg:col-span-3">
					<Skeleton className="h-4 w-40 mb-4" />
					<Skeleton className="h-[180px] w-full rounded-xl" />
				</Card>
				<Card className="lg:col-span-2">
					<Skeleton className="h-4 w-32 mb-4" />
					{[...Array(4)].map((_, i) => (
						<div key={i} className="mb-3">
							<Skeleton className="h-3 w-3/4 mb-2" />
							<Skeleton className="h-2 w-full rounded-full" />
						</div>
					))}
				</Card>
			</div>
			<Card className="mb-6">
				<Skeleton className="h-4 w-32 mb-4" />
				<Skeleton className="h-[200px] w-full rounded-xl" />
			</Card>
			<Card>
				<Skeleton className="h-4 w-40 mb-4" />
				{[...Array(5)].map((_, i) => (
					<div key={i} className="py-3 flex items-center gap-4 border-t border-border">
						<Skeleton className="h-3 w-3 rounded-full" />
						<div className="flex-1">
							<Skeleton className="h-3 w-40 mb-1.5" />
							<Skeleton className="h-2.5 w-24" />
						</div>
						<div className="text-right">
							<Skeleton className="h-3 w-16 mb-1.5 ml-auto" />
							<Skeleton className="h-2.5 w-12 ml-auto" />
						</div>
					</div>
				))}
			</Card>
		</div>
	);
}

export default function DashboardPage() {
	const { loading: currencyLoading } = useCurrency();
	const formatCurrency = useCurrencyFormatter();
	const currencySymbol = useCurrencySymbol();
	const [month, setMonth] = useState(() => new Date().getMonth() + 1);
	const [year, setYear] = useState(() => new Date().getFullYear());
	const [data, setData] = useState<DashboardData | null>(null);
	const [loading, setLoading] = useState(true);
	const [unauthorized, setUnauthorized] = useState(false);

	useEffect(() => {
		setLoading(true);
		Promise.all([
			api.accounts.list(),
			api.reports.overview(month, year),
			api.reports.categories(month, year),
			api.budgets.list(month, year),
			api.transactions.list({ limit: 5 }),
			api.categories.list(),
			api.reports.trends(6),
		])
			.then(
				([
					accounts,
					overview,
					categoryReport,
					budgets,
					transactions,
					categories,
					trends,
				]) => {
					setData({
						accounts,
						overview,
						categoryReport,
						budgets,
						transactions,
						categories,
						trends,
					});
				}
			)
			.catch((err) => {
				if (err.message === "UNAUTHORIZED") setUnauthorized(true);
			})
			.finally(() => setLoading(false));
	}, [month, year]);

	if (loading || currencyLoading) return <PageTransition><DashboardSkeleton /></PageTransition>;

	if (unauthorized) {
		return (
			<div className="flex flex-col items-center justify-center h-full text-center p-6 gap-3">
				<p className="text-fg-muted">You need to be signed in to view this page.</p>
				<a href="/sign-in" className="text-sm font-semibold text-primary hover:underline">
					Sign in →
				</a>
			</div>
		);
	}

	const totalBalance = data?.accounts.reduce((sum, a) => sum + a.balance, 0) ?? 0;
	const overview = data?.overview;
	const savingsRate =
		overview && overview.income > 0 ? Math.round((overview.net / overview.income) * 100) : null;

	const trendData =
		data?.trends.data.map((d) => ({
			name: `${MONTH_SHORT[d.month - 1]} '${String(d.year).slice(2)}`,
			Income: d.income,
			Expenses: d.expenses,
		})) ?? [];

	return (
		<PageTransition>
			<div className="px-4 py-6 md:px-6 max-w-7xl mx-auto">
				{/* Header */}
				<div className="flex flex-col gap-2 mb-8 md:flex-row md:items-center md:justify-between">
					<div>
						<h1 className="text-2xl font-bold text-fg">
							<Suspense fallback="Good morning">
								<Greeting />
							</Suspense>
						</h1>
						<p className="text-sm text-fg-muted mt-0.5">Here&apos;s your overview</p>
					</div>
					<MonthPicker
						month={month}
						year={year}
						onChange={(m, y) => {
							setMonth(m);
							setYear(y);
						}}
					/>
				</div>

				{/* Stat cards */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
					<StatCard title="Total Balance" value={formatCurrency(totalBalance)} />
					<StatCard
						title="Monthly Income"
						value={formatCurrency(overview?.income ?? 0)}
					/>
					<StatCard
						title="Monthly Expenses"
						value={formatCurrency(overview?.expenses ?? 0)}
					/>
					<StatCard
						title="Saved"
						value={formatCurrency(overview?.net ?? 0)}
						trend={savingsRate !== null ? `${savingsRate}% savings rate` : undefined}
						trendTooltip="Of your income this month, this % has been saved"
						positive={overview ? overview.net >= 0 : true}
					/>
				</div>

				{/* Charts row */}
				<div className="grid grid-cols-1 lg:grid-cols-5 gap-4 mb-6">
					<div className="lg:col-span-3">
						<SpendingChart data={data?.categoryReport.data ?? []} />
					</div>
					<div className="lg:col-span-2">
						<BudgetProgress
							budgets={data?.budgets ?? []}
							categories={data?.categories ?? []}
						/>
					</div>
				</div>

				{/* 6-month trends */}
				<Card className="mb-6">
					<p className="text-sm font-semibold text-fg mb-4">6-Month Trend</p>
					{trendData.length === 0 ? (
						<div className="h-[180px] flex items-center justify-center">
							<p className="text-sm text-fg-muted">No data yet</p>
						</div>
					) : (
						<div className="h-[200px]">
							<ResponsiveContainer width="100%" height="100%">
								<BarChart data={trendData} barGap={4} barSize={14}>
									<XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-fg-muted)" }} axisLine={false} tickLine={false} />
									<YAxis tick={{ fontSize: 10, fill: "var(--color-fg-muted)" }} axisLine={false} tickLine={false} tickFormatter={(v) => { const major = v / 100; return major >= 1000 ? `${currencySymbol}${(major / 1000).toFixed(0)}k` : `${currencySymbol}${major.toFixed(0)}`; }} width={44} />
									<Tooltip
										contentStyle={{
											backgroundColor: "var(--color-bg-2)",
											border: "1px solid var(--color-border)",
											borderRadius: "12px",
											fontSize: "12px",
											color: "var(--color-fg)",
										}}
										formatter={(value) => formatCurrency(Number(value))}
										cursor={false}
									/>
									<Legend
										iconType="circle"
										iconSize={8}
										wrapperStyle={{ fontSize: "12px" }}
									/>
									<Bar
										dataKey="Income"
										fill="var(--color-primary)"
										radius={[4, 4, 0, 0]}
									/>
									<Bar
										dataKey="Expenses"
										fill="var(--color-expense)"
										radius={[4, 4, 0, 0]}
									/>
								</BarChart>
							</ResponsiveContainer>
						</div>
					)}
				</Card>

				{/* Recent transactions */}
				<RecentTransactions
					transactions={data?.transactions.data ?? []}
					categories={data?.categories ?? []}
				/>
			</div>
		</PageTransition>
	);
}
