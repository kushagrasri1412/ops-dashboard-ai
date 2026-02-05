"use client";

import { useEffect, useRef, useState } from "react";

function getRoundedSize(element, fallbackHeight) {
  if (!element) return { width: 0, height: fallbackHeight };

  const rect = element.getBoundingClientRect();
  const width = Math.max(0, Math.round(rect.width));
  const height = Math.max(0, Math.round(rect.height)) || fallbackHeight;

  return { width, height };
}

/**
 * SSR-safe resize observer hook for responsive SVG charts.
 * Returns a ref for a container element and its measured width/height.
 */
export default function useResizeObserver({ height: fallbackHeight = 288 } = {}) {
  const ref = useRef(null);
  const [size, setSize] = useState(() => ({ width: 0, height: fallbackHeight }));

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    let frame = 0;
    let last = { width: 0, height: fallbackHeight };

    function commit(next) {
      if (next.width === last.width && next.height === last.height) return;
      last = next;
      setSize(next);
    }

    // Initial measurement.
    commit(getRoundedSize(element, fallbackHeight));

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;

      const nextWidth = Math.max(0, Math.round(entry.contentRect.width));
      const nextHeight =
        Math.max(0, Math.round(entry.contentRect.height)) || fallbackHeight;

      if (frame) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        commit({ width: nextWidth, height: nextHeight });
      });
    });

    observer.observe(element);

    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [fallbackHeight]);

  return {
    ref,
    width: size.width,
    height: size.height,
  };
}

