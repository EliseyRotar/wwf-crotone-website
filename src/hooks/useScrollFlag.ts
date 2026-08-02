"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Shared scroll flag hook. Returns true when window.scrollY crosses the
 * configured threshold (default 20px). Uses requestAnimationFrame to throttle
 * updates and a ref guard to coalesce events.
 */
export function useScrollFlag(threshold = 20): boolean {
  const [flag, setFlag] = useState(false);
  const ticking = useRef(false);

  useEffect(() => {
    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        setFlag(window.scrollY > threshold);
        ticking.current = false;
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return flag;
}
