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
}

export default nextConfig
