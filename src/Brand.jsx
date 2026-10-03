import { useEffect } from "react";
import "./brand.css";

// Stretchy brand: pulling down at the top of the page expands CACHE / ONCHAIN / ESCROW.
// The network + wallet bar is position:fixed, so it never moves. Releasing springs everything back.
export function useOverscroll() {
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const root = document.documentElement;
    let y0 = null, pull = 0, raf = 0;
    const set = (p) => {
      pull = p; cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => root.style.setProperty("--pull", p.toFixed(3)));
    };
    const start = (e) => { y0 = window.scrollY <= 0 ? e.touches[0].clientY : null; root.classList.remove("releasing"); };
    const move = (e) => {
      if (y0 === null) return;
      const dy = e.touches[0].clientY - y0;
      if (dy > 0 && window.scrollY <= 0) {
        if (e.cancelable) e.preventDefault(); // stops browser pull-to-refresh
        set(1 - Math.exp(-dy / 220));         // rubber band: 0 → 1
      } else if (pull) set(0);
    };
    const end = () => { y0 = null; if (pull) { root.classList.add("releasing"); set(0); } };
    addEventListener("touchstart", start, { passive: true });
    addEventListener("touchmove", move, { passive: false });
    addEventListener("touchend", end);
    addEventListener("touchcancel", end);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener("touchstart", start); removeEventListener("touchmove", move);
      removeEventListener("touchend", end); removeEventListener("touchcancel", end);
    };
  }, []);
}

export default function Brand({ variant = "hero" }) {
  return (
    <div className={`brand brand-${variant}`}>
      <div className="b-cache">CACHE</div>
      <div className="b-onchain">ONCHAIN</div>
      <div className="b-escrow">ESCROW</div>
    </div>
  );
}
