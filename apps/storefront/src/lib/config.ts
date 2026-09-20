export const BRAND_NAME = "Fashion4U";

export const API_URL = process.env.API_URL ?? "http://localhost:4000/api/v1";

// The bag and checkout run in the browser, which cannot read a server-only env.
export const PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
