/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    '192.168.101.77',
    '*.trycloudflare.com',
    '*.loca.lt',
    '*.lhr.life'
  ],
};

export default nextConfig;
