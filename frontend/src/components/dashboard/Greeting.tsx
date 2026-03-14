'use client'

import { useState, useEffect } from 'react'

export function Greeting() {
    const [greeting, setGreeting] = useState('Good morning')

    useEffect(() => {
        const hour = new Date().getHours()
        if (hour < 12) {
            setGreeting('Good morning')
        } else if (hour < 17) {
            setGreeting('Good afternoon')
        } else {
            setGreeting('Good evening')
        }
    }, [])

    return <span>{greeting}</span>
}
