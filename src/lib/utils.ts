import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getStudentAvatarUrl(seed: string, config?: unknown) {
  const baseUrl = `https://api.dicebear.com/9.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
  if (!config || typeof config !== "object") return baseUrl;

  // Add config params to URL
  const params = new URLSearchParams();
  Object.entries(config).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach(v => params.append(key, v));
    } else if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  });

  return `${baseUrl}&${params.toString()}`;
}
