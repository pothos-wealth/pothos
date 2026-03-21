interface PlantIconProps {
	size?: number
	className?: string
}

// Paths extracted from PothosLightLoader.json (final frame).
// Each layer's transform (position, anchor, rotation, scale) has been applied
// to produce absolute canvas coordinates in the original 500×500 space.
// viewBox crops to the plant region and centers it.

export function PlantIcon({ size = 28, className }: PlantIconProps) {
	return (
		<svg
			width={size}
			height={size}
			viewBox="187 220 90 90"
			xmlns="http://www.w3.org/2000/svg"
			className={className}
			aria-hidden="true"
		>
			{/* Stem — stroke path, cubic bezier */}
			<path
				d="M 223.693,303.660
                   C 223.693,303.660 212.992,298.403 213.656,284.272
                   C 213.905,278.965 215.773,273.868 218.730,269.454
                   C 221.207,265.757 226.224,260.810 232.499,255.500"
				fill="none"
				stroke="currentColor"
				strokeWidth="6"
				strokeLinecap="round"
			/>

			{/* Leaf Left — layer has -9° rotation; tangents rotated accordingly */}
			<path
				d="M 198.786,237.246
                   C 198.786,237.246 215.181,243.514 219.214,250.547
                   C 219.214,250.547 226.145,259.907 216.538,266.364
                   C 216.538,266.364 215.267,250.322 201.080,239.872
                   C 201.080,239.872 210.279,249.391 212.489,256.646
                   C 212.708,257.362 212.969,258.060 213.237,258.759
                   C 213.778,260.174 214.608,263.094 214.719,267.898
                   C 214.719,267.898 204.231,274.929 200.763,254.641
                   C 200.763,254.641 198.786,237.246 198.786,237.246 Z"
				fill="currentColor"
			/>

			{/* Leaf Right — out tangents are zero; in tangents drive the curves */}
			<path
				d="M 263.021,278.629
                   C 263.021,278.629 245.140,286.743 232.113,284.415
                   C 232.113,284.415 218.138,282.293 220.613,273.191
                   C 220.613,273.191 222.872,269.264 256.980,277.676
                   C 256.980,277.676 232.152,268.871 221.619,270.480
                   C 221.619,270.480 230.035,258.601 247.061,267.345
                   C 247.061,267.345 256.955,272.170 263.021,278.629 Z"
				fill="currentColor"
			/>

			{/* Leaf Top — out tangents are zero; in tangents drive the curves */}
			<path
				d="M 259.050,226.858
                   C 259.050,226.858 259.631,251.394 248.816,257.698
                   C 248.816,257.698 242.374,262.842 233.437,257.671
                   C 233.437,257.671 247.254,247.754 253.877,235.128
                   C 253.877,235.128 242.807,250.402 232.403,256.201
                   C 232.403,256.201 221.948,249.429 236.474,238.215
                   C 236.474,238.215 256.100,225.716 259.050,226.858 Z"
				fill="currentColor"
			/>
		</svg>
	)
}
