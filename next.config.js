/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  headers: async () => {
    const allowedOriginsStr = process.env.ALLOWED_EMBED_ORIGINS || '';
    const allowedOrigins = allowedOriginsStr
      .split(',')
      .map((o) => o.trim())
      .filter((o) => o.length > 0);

    // Build frame-ancestors CSP directive
    let frameAncestors = "'self'"; // Always allow same-origin
    if (allowedOrigins.length > 0) {
      frameAncestors += ' ' + allowedOrigins.join(' ');
    } else if (!allowedOriginsStr) {
      // If ALLOWED_EMBED_ORIGINS is empty/unset, allow any origin (explicitly permissive)
      frameAncestors = '*';
    }

    return [
      {
        source: '/embed',
        headers: [
          {
            key: 'X-Frame-Options',
            value: frameAncestors === '*' ? 'ALLOWALL' : 'SAMEORIGIN'
          },
          {
            key: 'Content-Security-Policy',
            value: `frame-ancestors ${frameAncestors}`
          },
          {
            key: 'Access-Control-Allow-Origin',
            value: '*'
          }
        ]
      }
    ];
  }
};

export default nextConfig;
