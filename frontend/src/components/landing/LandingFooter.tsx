export function LandingFooter() {
	return (
		<footer className="border-t border-border py-3 px-6">
			<div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-fg-muted">
				<span>© {new Date().getFullYear()} Pothos</span>
				<div className="flex items-center gap-4">
					<a
						href="https://www.gnu.org/licenses/agpl-3.0.html"
						target="_blank"
						rel="noopener noreferrer"
						className="hover:text-fg transition-colors duration-200"
					>
						AGPLv3
					</a>
					<span className="w-px h-3 bg-border" />
					<span>Built with care and claude 🍃</span>
				</div>
			</div>
		</footer>
	)
}
