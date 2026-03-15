/** @type {import('next').NextConfig} */
const nextConfig = {
  // Skip type checking during build (for Amplify compatibility)
  typescript: {
    ignoreBuildErrors: true,
  },

  // Expose server env vars at build time for Amplify SSR Lambda
  env: {
    // Auth
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
    COGNITO_CLIENT_ID: process.env.COGNITO_CLIENT_ID,
    COGNITO_CLIENT_SECRET: process.env.COGNITO_CLIENT_SECRET,
    COGNITO_ISSUER: process.env.COGNITO_ISSUER,
    COGNITO_DOMAIN: process.env.COGNITO_DOMAIN,
    COGNITO_USER_POOL_ID: process.env.COGNITO_USER_POOL_ID,

    // Database
    DATABASE_URL: process.env.DATABASE_URL,

    // AI Services
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    ASSEMBLYAI_API_KEY: process.env.ASSEMBLYAI_API_KEY,
    HUME_API_KEY: process.env.HUME_API_KEY,
    HUME_SECRET_KEY: process.env.HUME_SECRET_KEY,
    GAMMA_API_KEY: process.env.GAMMA_API_KEY,

    // RAG Service
    RAG_API_URL: process.env.RAG_API_URL,
    RAG_API_KEY: process.env.RAG_API_KEY,

    // AWS Services (APP_ prefix required — Amplify reserves AWS_ namespace)
    APP_AWS_ACCESS_KEY_ID: process.env.APP_AWS_ACCESS_KEY_ID,
    APP_AWS_SECRET_ACCESS_KEY: process.env.APP_AWS_SECRET_ACCESS_KEY,
    APP_AWS_REGION: process.env.APP_AWS_REGION,

    // Google APIs
    GOOGLE_API_KEY: process.env.GOOGLE_API_KEY,
    GOOGLE_CUSTOM_SEARCH_ID: process.env.GOOGLE_CUSTOM_SEARCH_ID,
  },

  // Image optimization domains
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.amazonaws.com',
      },
    ],
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ]
  },
}

module.exports = nextConfig
