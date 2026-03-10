import type React from "react";

export const BRAND_LOGO_FALLBACK = "/brands/default-brand.png";

export function getBrandLogoSrc(logo?: string | null): string {
  const value = String(logo || "").trim();
  if (!value) return BRAND_LOGO_FALLBACK;
  if (value.startsWith("http://") || value.startsWith("https://") || value.startsWith("/")) {
    return value;
  }
  return `/brands/${value}`;
}

export function handleBrandLogoError(event: React.SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === "1") return;
  img.dataset.fallbackApplied = "1";
  img.src = BRAND_LOGO_FALLBACK;
}

