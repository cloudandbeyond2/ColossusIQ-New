import type { NextConfig } from "next";

// Static security headers. The Content-Security-Policy is per-request (nonce) and is set in src/proxy.ts.
const securityHeaders = [
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Native / engine-backed packages used only by the PostgreSQL data store.
  serverExternalPackages: ["@prisma/client", "@node-rs/argon2"],
  turbopack: { root: process.cwd() },
  reactStrictMode: true,
  productionBrowserSourceMaps: false,
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      {
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, max-age=0" }],
      },
    ];
  async redirects() {
    return [
      {
        source: "/institution/courses",
        destination: "/institution/course-management",
        permanent: false,
      },
      {
        source: "/faculty/courses",
        destination: "/faculty/course-management",
        permanent: false,
      },
      {
        source: "/hod/courses",
        destination: "/hod/course-management",
        permanent: false,
      },
      {
        source: "/admin/courses",
        destination: "/admin/course-management",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
