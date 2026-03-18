import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { ThemeProvider } from "@/providers/ThemeProvider";
import { CurrencyProvider } from "@/lib/currency-context";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
	subsets: ["latin"],
	variable: "--font-jakarta",
	weight: ["400", "500", "600", "700", "800"],
	display: "swap",
});

export const metadata: Metadata = {
	title: "Pothos – Your money plant, growing.",
	description: "Watch your money plant grow. Track expenses, plan budgets, and understand your money — without the overwhelm.",
	appleWebApp: {
		capable: true,
		statusBarStyle: "black-translucent",
		title: "Pothos",
	},
	icons: {
		apple: "/apple-touch-icon.png",
	},
};

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: [
		{ media: "(prefers-color-scheme: light)", color: "#3D4F2C" },
		{ media: "(prefers-color-scheme: dark)", color: "#192214" },
	],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body className={`${jakarta.variable} font-sans antialiased bg-bg text-fg`}>
				<ThemeProvider>
					<ServiceWorkerRegistration />
					<CurrencyProvider>{children}</CurrencyProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
