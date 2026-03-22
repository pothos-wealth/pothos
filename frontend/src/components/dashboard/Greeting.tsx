"use client"

import { useState } from "react"
import {
	Moon,
	Flame,
	Eye,
	Laptop,
	Music2,
	Wand2,
	Sun,
	Bird,
	Coffee,
	Sunrise,
	TrendingUp,
	Dumbbell,
	Clock,
	Utensils,
	Crosshair,
	Building2,
	Sunset,
	Sparkles,
	PartyPopper,
	BedDouble,
	Save,
	type LucideIcon,
} from "lucide-react"

type Greeting = { text: string; Icon: LucideIcon }

const GREETINGS: Record<string, Greeting[]> = {
	lateNight: [
		{ text: "You're up late", Icon: Moon },
		{ text: "Burning the midnight oil", Icon: Flame },
		{ text: "Still awake?", Icon: Eye },
		{ text: "Night owl mode activated", Icon: Moon },
		{ text: "The internet never sleeps", Icon: Laptop },
		{ text: "Hello darkness, my old friend", Icon: Music2 },
		{ text: "One does not simply go to bed", Icon: Wand2 },
	],
	earlyMorning: [
		{ text: "Rise and shine", Icon: Sun },
		{ text: "Up with the birds", Icon: Bird },
		{ text: "Early bird!", Icon: Coffee },
		{ text: "Good morning", Icon: Sunrise },
		{ text: "You were up before the algorithms", Icon: TrendingUp },
	],
	morning: [
		{ text: "Good morning", Icon: Sun },
		{ text: "Hope your coffee is strong", Icon: Coffee },
		{ text: "Morning!", Icon: Sun },
		{ text: "Ready to crush it today?", Icon: Dumbbell },
		{ text: "Another one", Icon: Sun },
		{ text: "Good morning, Vietnam", Icon: Sun },
	],
	afternoon: [
		{ text: "Good afternoon", Icon: Sun },
		{ text: "Afternoon already?", Icon: Clock },
		{ text: "Hope lunch was good", Icon: Utensils },
		{ text: "Surviving the afternoon slump?", Icon: Coffee },
		{ text: "It's high noon", Icon: Crosshair },
		{ text: "The afternoon is dark and full of expenses", Icon: Flame },
	],
	evening: [
		{ text: "Good evening", Icon: Sparkles },
		{ text: "Winding down?", Icon: Sunset },
		{ text: "Hope your day went well", Icon: Sparkles },
		{ text: "Almost done for the day", Icon: PartyPopper },
		{ text: "The night is young", Icon: Moon },
	],
	night: [
		{ text: "Ready for bed?", Icon: BedDouble },
		{ text: "Wrapping up for the night", Icon: Moon },
		{ text: "Almost bedtime", Icon: Moon },
		{ text: "One last check before bed?", Icon: Eye },
		{ text: "Save and quit?", Icon: Save },
		{ text: "That's all, folks", Icon: Moon },
	],
}

function getGreeting(): Greeting {
	const hour = new Date().getHours()
	let options: Greeting[]
	if (hour < 5) options = GREETINGS.lateNight
	else if (hour < 7) options = GREETINGS.earlyMorning
	else if (hour < 12) options = GREETINGS.morning
	else if (hour < 17) options = GREETINGS.afternoon
	else if (hour < 21) options = GREETINGS.evening
	else options = GREETINGS.night
	return options[Math.floor(Math.random() * options.length)]
}

export function Greeting() {
	const [{ text, Icon }] = useState(getGreeting)
	return (
		<span className="inline-flex items-center gap-2">
			<Icon className="size-5 shrink-0" />
			{text}
		</span>
	)
}
