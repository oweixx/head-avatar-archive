/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production';
const repoBase = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: isProd ? repoBase : '',
  assetPrefix: isProd && repoBase ? `${repoBase}/` : undefined,
  reactStrictMode: true,
};

export default nextConfig;
