import { useCallback, useEffect, useState } from "react";

export type RegionCode = "IN" | "US" | "GB" | "SG" | "AE";

export interface Region {
  code: RegionCode;
  label: string;
  currency: string;
  locale: string;
  /** Indicative FX rate from the USD base fields (v1 static, no live FX). */
  fx: number;
  /** Indicative local market ratio for salary bands vs the US base. */
  marketRatio: number;
}

export const REGIONS: Region[] = [
  { code: "IN", label: "India", currency: "INR", locale: "en-IN", fx: 88, marketRatio: 0.32 },
  { code: "US", label: "United States", currency: "USD", locale: "en-US", fx: 1, marketRatio: 1 },
  { code: "GB", label: "United Kingdom", currency: "GBP", locale: "en-GB", fx: 0.79, marketRatio: 0.78 },
  { code: "SG", label: "Singapore", currency: "SGD", locale: "en-SG", fx: 1.29, marketRatio: 0.82 },
  { code: "AE", label: "UAE", currency: "AED", locale: "en-AE", fx: 3.67, marketRatio: 0.75 },
];

export const DEFAULT_REGION: RegionCode = "IN";
export const REGION_STORAGE_KEY = "skilltrack.region";

export function getRegion(code: RegionCode): Region {
  return REGIONS.find((r) => r.code === code) ?? REGIONS[0];
}

function roundIndicative(value: number): number {
  if (value >= 1_000_000) return Math.round(value / 50_000) * 50_000;
  if (value >= 100_000) return Math.round(value / 5_000) * 5_000;
  if (value >= 10_000) return Math.round(value / 500) * 500;
  if (value >= 1_000) return Math.round(value / 100) * 100;
  return Math.round(value / 10) * 10;
}

/** Convert a USD base amount to an indicative local amount (rounded, no fake precision). */
export function convertIndicative(usd: number, region: Region, kind: "exam" | "salary" = "exam"): number {
  const raw = kind === "salary" ? usd * region.marketRatio * region.fx : usd * region.fx;
  return roundIndicative(raw);
}

export function formatMoney(amount: number, region: Region): string {
  return new Intl.NumberFormat(region.locale, {
    style: "currency",
    currency: region.currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatExamCost(usdCost: number, regionCode: RegionCode): string {
  const region = getRegion(regionCode);
  return formatMoney(convertIndicative(usdCost, region, "exam"), region);
}

export function formatSalary(usdSalary: number, regionCode: RegionCode): string {
  const region = getRegion(regionCode);
  return formatMoney(convertIndicative(usdSalary, region, "salary"), region);
}

export const REGION_DISCLAIMER =
  "Indicative ranges converted from USD baselines — not OEM quotes or live FX.";

export const EXAM_COST_TIP =
  "OEMs usually list exam fees in USD; local taxes may apply at checkout.";

function readStored(): RegionCode {
  if (typeof window === "undefined") return DEFAULT_REGION;
  const saved = window.localStorage.getItem(REGION_STORAGE_KEY);
  return REGIONS.some((r) => r.code === saved) ? (saved as RegionCode) : DEFAULT_REGION;
}

/** Shared region preference, persisted in localStorage and synced across components. */
export function useRegion() {
  const [code, setCode] = useState<RegionCode>(DEFAULT_REGION);

  useEffect(() => {
    setCode(readStored());
    const onChange = () => setCode(readStored());
    window.addEventListener("storage", onChange);
    window.addEventListener("skilltrack:region", onChange);
    return () => {
      window.removeEventListener("storage", onChange);
      window.removeEventListener("skilltrack:region", onChange);
    };
  }, []);

  const setRegion = useCallback((next: RegionCode) => {
    setCode(next);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(REGION_STORAGE_KEY, next);
      window.dispatchEvent(new Event("skilltrack:region"));
    }
  }, []);

  return { regionCode: code, region: getRegion(code), setRegion };
}
