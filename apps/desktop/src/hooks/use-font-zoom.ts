import { useEffect, useRef, type RefObject } from "react";

export function useFontZoom(
  value: number,
  onChange: (next: number) => void,
  min = 9,
  max = 32,
): RefObject<HTMLDivElement | null> {
  const ref = useRef<HTMLDivElement | null>(null);
  const latest = useRef({ value, onChange });

  useEffect(() => {
    latest.current = { value, onChange };
  });

  useEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const handler = (event: WheelEvent): void => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const current = latest.current;
      const next = Math.min(
        max,
        Math.max(min, Math.round(current.value + (event.deltaY < 0 ? 1 : -1))),
      );
      if (next !== current.value) current.onChange(next);
    };
    element.addEventListener("wheel", handler, { passive: false });
    return () => element.removeEventListener("wheel", handler);
  }, [min, max]);

  return ref;
}
