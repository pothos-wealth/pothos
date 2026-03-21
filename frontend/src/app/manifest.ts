import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
	return {
		name: "Pothos",
		short_name: "Pothos",
		description: "Your money plant, growing.",
		start_url: "/dashboard",
		scope: "/",
		display: "standalone",
		orientation: "portrait-primary",
		theme_color: "#3D4F2C",
		background_color: "#3D4F2C",
		icons: [
			{
				src: "/icon-192.png",
				sizes: "192x192",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/icon-512.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "any",
			},
			{
				src: "/icon-512-maskable.png",
				sizes: "512x512",
				type: "image/png",
				purpose: "maskable",
			},
		],
	}
}
