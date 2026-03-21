export class PothosApiError extends Error {
	constructor(
		public readonly status: number,
		message: string
	) {
		super(message)
		this.name = "PothosApiError"
	}
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
	const BASE_URL = (process.env.POTHOS_URL ?? "").replace(/\/$/, "")
	const API_KEY = process.env.POTHOS_API_KEY ?? ""
	const url = `${BASE_URL}/api/v1${path}`

	const res = await fetch(url, {
		...options,
		headers: {
			"Content-Type": "application/json",
			Authorization: `Bearer ${API_KEY}`,
			...options.headers,
		},
	})

	if (!res.ok) {
		let message = `Backend returned ${res.status}`
		try {
			const body = (await res.json()) as { error?: string }
			if (body?.error) message = body.error
		} catch {
			// ignore parse error, use default message
		}
		throw new PothosApiError(res.status, message)
	}

	if (res.status === 204) return undefined as T
	return res.json() as Promise<T>
}

export function fmtAmount(minorUnits: number): string {
	return (minorUnits / 100).toFixed(2)
}

export function fmtDate(unixTs: number): string {
	return new Date(unixTs * 1000).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	})
}
