import type { NextConfig } from 'next'
import path from 'path'

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://localhost:3001'

const nextConfig: NextConfig = {
    outputFileTracingRoot: path.join(__dirname),
    async rewrites() {
        return [
            {
                source: '/api/v1/:path*',
                destination: `${BACKEND_URL}/api/v1/:path*`,
            },
        ]
    },
    async headers() {
        return [
            {
                source: '/sw.js',
                headers: [
                    { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
                    { key: 'Service-Worker-Allowed', value: '/' },
                ],
            },
        ]
    },
}

export default nextConfig
