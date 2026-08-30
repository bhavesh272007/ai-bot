// TARGET PATH: lib/voice/useNetworkInfo.ts
"use client";

import { useEffect, useState } from "react";

export interface NetworkInfo {
  downlinkMbps: number | null;
  rttMs: number | null;
  quality: string | null;
}

// Best-effort connection stats for the meeting-mode header, via the
// (Chromium-only) NetworkInformation API. Silently no-ops on browsers that
// don't expose navigator.connection (Safari, Firefox) — callers should treat
// `quality === null` as "don't render this row" rather than as an error.
export function useNetworkInfo(): NetworkInfo {
  const [networkInfo, setNetworkInfo] = useState<NetworkInfo>({
    downlinkMbps: null,
    rttMs: null,
    quality: null,
  });

  useEffect(() => {
    const conn = typeof navigator !== "undefined" ? (navigator as any).connection : null;
    if (!conn) return;

    function readConnection() {
      const downlink = typeof conn.downlink === "number" ? conn.downlink : null;
      const rtt = typeof conn.rtt === "number" ? conn.rtt : null;
      const effectiveType: string | undefined = conn.effectiveType;
      const quality =
        effectiveType === "4g"
          ? "Good"
          : effectiveType === "3g"
          ? "Average"
          : effectiveType
          ? "Poor"
          : null;
      setNetworkInfo({ downlinkMbps: downlink, rttMs: rtt, quality });
    }

    readConnection();
    conn.addEventListener?.("change", readConnection);
    return () => conn.removeEventListener?.("change", readConnection);
  }, []);

  return networkInfo;
}
