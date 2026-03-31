"use client";

import { useEffect, useState } from "react";
import { Clock } from "@phosphor-icons/react";

export function SessionTimer() {
  const [minutes, setMinutes] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMinutes((m) => m + 1);
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (minutes < 1) return null;

  const display =
    minutes < 60
      ? `${minutes}m`
      : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;

  return (
    <div
      className="flex items-center gap-1.5 px-2 text-[11px] text-qc-text-muted/60"
      title={`You've been here for ${display}`}
    >
      <Clock size={12} />
      <span>{display}</span>
    </div>
  );
}
