import type React from "react";

export const BRAND_LOGO_FALLBACK = "/brands/default-brand.png";

export function getBrandLogoSrc(logo?: string | null): string {
  const value = String(logo || "").trim();
  if (!value) return BRAND_LOGO_FALLBACK;
  if (
    value.startsWith("http://") ||
    value.startsWith("https://") ||
    value.startsWith("data:") ||
    value.startsWith("blob:") ||
    value.startsWith("/")
  ) {
    return value;
  }

  const normalized = value.replace(/\\/g, "/").replace(/^\.?\//, "");
  if (normalized.startsWith("brands/") || normalized.includes("/")) {
    return `/${normalized}`;
  }

  return `/brands/${normalized}`;
}

export function handleBrandLogoError(event: React.SyntheticEvent<HTMLImageElement>) {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied === "1") return;
  img.dataset.fallbackApplied = "1";
  img.src = BRAND_LOGO_FALLBACK;
}

