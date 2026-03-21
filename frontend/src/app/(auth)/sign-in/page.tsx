"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { api } from "@/lib/api"

export default function SignInPage() {
	const router = useRouter()
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [error, setError] = useState("")
	const [loading, setLoading] = useState(false)
	const [showPassword, setShowPassword] = useState(false)

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault()
		setError("")
		if (!email || !password) {
			setError("Email and password are required.")
			return
		}
		setLoading(true)
		try {
			await api.auth.login(email, password)
			router.push("/dashboard")
		} catch (err) {
			setError(err instanceof Error ? err.message : "Sign in failed. Please try again.")
		} finally {
			setLoading(false)
		}
	}

	return (
		<div className="w-full max-w-sm">
			<div className="mb-8 text-center">
				<h1 className="text-2xl font-bold text-fg">Welcome back</h1>
				<p className="text-sm text-fg-muted mt-1">Sign in to your Pothos account</p>
			</div>

			<form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
				{error && (
					<div className="bg-expense-light border border-expense text-expense rounded-xl px-4 py-3 text-sm">
						{error}
					</div>
				)}

				<div className="flex flex-col gap-1.5">
					<label htmlFor="email" className="text-sm font-medium text-fg">
						Email
					</label>
					<input
						id="email"
						type="email"
						required
						autoComplete="email"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						className="bg-bg-2 border border-border rounded-xl px-3 py-2.5 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow"
						placeholder="you@example.com"
					/>
				</div>

				<div className="flex flex-col gap-1.5">
					<label htmlFor="password" className="text-sm font-medium text-fg">
						Password
					</label>
					<div className="relative">
						<input
							id="password"
							type={showPassword ? "text" : "password"}
							required
							autoComplete="current-password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className="bg-bg-2 border border-border rounded-xl px-3 py-2.5 pr-10 text-sm text-fg placeholder:text-fg-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-primary transition-shadow w-full"
							placeholder="••••••••"
						/>
						<button
							type="button"
							onClick={() => setShowPassword((v) => !v)}
							className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-muted hover:text-fg transition-colors"
							aria-label={showPassword ? "Hide password" : "Show password"}
						>
							{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
						</button>
					</div>
				</div>

				<button
					type="submit"
					disabled={loading}
					className="mt-1 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl px-4 py-2.5 text-sm transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
				>
					{loading ? "Signing in…" : "Sign in"}
				</button>
			</form>

			<p className="text-center text-sm text-fg-muted mt-6">
				Don&apos;t have an account?{" "}
				<Link href="/sign-up" className="font-semibold text-primary hover:underline">
					Sign up
				</Link>
			</p>
		</div>
	)
}
