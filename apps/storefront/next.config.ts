import type { NextConfig } from "next";

// Where admin-uploaded images are served from: the same value as the API's
// S3_PUBLIC_URL. Next.js only optimizes remote images from hosts listed here.
const imagesUrl = process.env.S3_PUBLIC_URL?.replace(/\/$/, "");
const isLocalBucket = imagesUrl ? ["localhost", "127.0.0.1"].includes(new URL(imagesUrl).hostname) : false;

const nextConfig: NextConfig = {
  // URLs in the spec end with a slash: /shop/category/men/tank-tops/
  trailingSlash: true,
  images: {
    remotePatterns: imagesUrl ? [new URL(`${imagesUrl}/**`)] : [],
    // Needed only for a local S3-compatible server (MinIO); never for AWS.
    dangerouslyAllowLocalIP: isLocalBucket,
  },
};

export default nextConfig;
