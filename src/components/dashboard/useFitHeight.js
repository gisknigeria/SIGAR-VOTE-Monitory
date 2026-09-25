import { useLayoutEffect, useRef, useState } from "react";

/** Height of the space left under the dashboard chrome, so the pulse fits the viewport exactly. */
export function useFitHeight() {
  const ref = useRef(null);
  const [height, setHeight] = useState(null);
  useLayoutEffect(() => {
    const measure = () => {
      if (!ref.current || window.innerWidth <= 900) return setHeight(null);
      const scroller = ref.current.closest(".results-center-body");
      const bottomPadding = scroller ? parseFloat(getComputedStyle(scroller).paddingBottom) || 0 : 0;
      const top = ref.current.getBoundingClientRect().top + (scroller?.scrollTop || 0);
      setHeight(Math.max(window.innerHeight - top - bottomPadding, 480));
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  });
  return [ref, height];
}
