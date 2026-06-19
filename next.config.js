import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
  serverExternalPackages: [],
  images: {
    // No remote images flow through next/image: the only <Image> usages are
    // local /assets/branding/*. Every remote image (OAuth/DiceBear avatars,
    // YouTube/Books/OpenLibrary thumbnails, scraped og:images) renders via
    // plain <img>, which bypasses the optimizer and ignores remotePatterns.
    // An empty allowlist closes the /_next/image open-proxy/SSRF surface with
    // no functional impact. If an app-owned image (e.g. from your own storage)
    // is ever migrated to <Image>, add that single host here.
    remotePatterns: [],
  },
};

export default nextConfig;

