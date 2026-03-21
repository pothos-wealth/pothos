"use client"

import { useState } from "react"

const GREETINGS: Record<string, string[]> = {
	lateNight: [
		"You're up late 🦉",
		"Burning the midnight oil 🕯️",
		"Still awake? 👀",
		"Night owl mode activated 🌙",
		"The internet never sleeps 💻",
		"Hello darkness, my old friend 🎵",
		"One does not simply go to bed 🧙",
	],
	earlyMorning: [
		"Rise and shine ☀️",
		"Up with the birds 🐦",
		"Early bird! ☕",
		"Good morning 🌅",
		"You were up before the algorithms 📈",
	],
	morning: [
		"Good morning ☀️",
		"Hope your coffee is strong ☕",
		"Morning! 🌤️",
		"Ready to crush it today? 💪",
		"Another one ☀️",
		"Good morning, Vietnam ✌️",
	],
	afternoon: [
		"Good afternoon 🌤️",
		"Afternoon already? ⏰",
		"Hope lunch was good 🍔",
		"Surviving the afternoon slump? ☕",
		"It's high noon 🤠",
		"The afternoon is dark and full of expenses 🔥",
	],
	evening: [
		"Good evening 🌆",
		"Winding down? 🌇",
		"Hope your day went well ✨",
		"Almost done for the day 🎉",
		"The night is young 🌃",
	],
	night: [
		"Ready for bed? 🛌",
		"Wrapping up for the night 🌙",
		"Almost bedtime 😴",
		"One last check before bed? 👀",
		"Save and quit? 💾",
		"That's all, folks 🌙",
	],
}

function getGreeting() {
	const hour = new Date().getHours()
	let options: string[]
	if (hour < 5) options = GREETINGS.lateNight
	else if (hour < 7) options = GREETINGS.earlyMorning
	else if (hour < 12) options = GREETINGS.morning
	else if (hour < 17) options = GREETINGS.afternoon
	else if (hour < 21) options = GREETINGS.evening
	else options = GREETINGS.night
	return options[Math.floor(Math.random() * options.length)]
}

export function Greeting() {
	const [greeting] = useState(getGreeting)
	return <span>{greeting}</span>
}
