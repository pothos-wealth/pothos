import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { CurrencyProvider } from "@/lib/currency-context";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
	subsets: ["latin"],
	variable: "--font-jakarta",
	weight: ["400", "500", "600", "700", "800"],
	display: "swap",
});

export const metadata: Metadata = {
	title: "Pothos – A calm place for your money",
	description: "Simple, beautiful budget and expense tracking.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${jakarta.variable} font-sans antialiased bg-bg text-fg`}>
				<ThemeProvider>
					<CurrencyProvider>{children}</CurrencyProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
