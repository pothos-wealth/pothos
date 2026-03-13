import { nanoid } from "nanoid";
import { db } from "./index.js";
import { categories } from "./schema.js";

const defaultCategories = [
	{ name: "Food & Dining", icon: "🍔", color: "#ef4444", type: "expense" },
	{ name: "Transport", icon: "🚗", color: "#f97316", type: "expense" },
	{ name: "Housing", icon: "🏠", color: "#eab308", type: "expense" },
	{ name: "Utilities", icon: "💡", color: "#84cc16", type: "expense" },
	{ name: "Healthcare", icon: "🏥", color: "#06b6d4", type: "expense" },
	{ name: "Entertainment", icon: "🎬", color: "#8b5cf6", type: "expense" },
	{ name: "Shopping", icon: "🛍️", color: "#ec4899", type: "expense" },
	{ name: "Education", icon: "📚", color: "#14b8a6", type: "expense" },
	{ name: "Travel", icon: "✈️", color: "#6366f1", type: "expense" },
	{ name: "Personal Care", icon: "💅", color: "#f43f5e", type: "expense" },
	{ name: "Salary", icon: "💰", color: "#22c55e", type: "income" },
	{ name: "Freelance", icon: "💻", color: "#10b981", type: "income" },
	{ name: "Other Income", icon: "📈", color: "#34d399", type: "income" },
	{ name: "Savings", icon: "🏦", color: "#3b82f6", type: "neutral" },
	{ name: "Miscellaneous", icon: "📦", color: "#94a3b8", type: "neutral" },
] as const;

async function seed() {
	console.log("Seeding default categories...");

	const existing = await db.select().from(categories);

	if (existing.length > 0) {
		console.log("Categories already seeded, skipping.");
		return;
	}

	const now = Math.floor(Date.now() / 1000);

	await db.insert(categories).values(
		defaultCategories.map((cat) => ({
			id: nanoid(),
			userId: null,
			name: cat.name,
			icon: cat.icon,
			color: cat.color,
			type: cat.type,
			createdAt: now,
		}))
	);

	console.log(`Seeded ${defaultCategories.length} default categories.`);
}

seed().catch((err) => {
	console.error("Seed failed:", err);
	process.exit(1);
});
