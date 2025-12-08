/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  async rewrites() {
    return [
      {
        source: '/socket.io/:path*',
        destination: `${process.env.SOCKET_SERVER_URL || 'http://localhost:4000'}/socket.io/:path*`,
      },
    ];
  },
}

module.exports = nextConfig
