import { useEffect, useRef } from "react";
const V = [[-1,-1,-1],[1,-1,-1],[1,1,-1],[-1,1,-1],[-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1]];
const E = [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]];

// Lightweight canvas: ~12 slow wireframe cubes + node links. ~25fps, pauses when hidden, static if reduced motion.
export default function Background({ focus = 0 }) {
  const ref = useRef(null);
  const f = useRef(0);
  useEffect(() => { f.current = focus; }, [focus]);
  useEffect(() => {
    const c = ref.current, ctx = c.getContext("2d");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    let w = 0, h = 0, raf = 0, last = 0, tx = 0, ty = 0, cx = 0, cy = 0, zoom = 1, yoff = 0;
    let seed = 7; const r = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const n = innerWidth < 640 ? 7 : 12;
    const cubes = Array.from({ length: n }, () => ({
      x: (r() - .5) * 14, y: (r() - .5) * 9, z: r() * 8 + 1, s: .35 + r() * .8,
      a: r() * 6, b: r() * 6, va: (r() - .5) * .0016 + .0008, vb: (r() - .5) * .0016,
    }));
    const resize = () => {
      w = innerWidth; h = innerHeight; c.width = w * dpr; c.height = h * dpr;
      c.style.width = w + "px"; c.style.height = h + "px"; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (reduce) draw(0);
    };
    const P = (x, y, z, sc) => { const d = z + 6, k = 6 / d; return [w / 2 + (x + cx / d * 3) * sc * k * zoom, h / 2 + (y + yoff + cy / d * 3) * sc * k * zoom, k]; };
    function draw(dt) {
      ctx.clearRect(0, 0, w, h);
      const sc = Math.min(w, h) / 9;
      const pts = [];
      for (const q of cubes) {
        q.a += q.va * dt; q.b += q.vb * dt;
        const ca = Math.cos(q.a), sa = Math.sin(q.a), cb = Math.cos(q.b), sb = Math.sin(q.b);
        const pr = V.map(([x, y, z]) => {
          x *= q.s; y *= q.s; z *= q.s;
          const x1 = x * ca + z * sa, z1 = -x * sa + z * ca, y1 = y * cb - z1 * sb, z2 = y * sb + z1 * cb;
          return P(q.x + x1, q.y + y1, q.z + z2, sc);
        });
        const alpha = Math.max(.05, .3 - q.z * .03);
        ctx.strokeStyle = `rgba(70,120,255,${alpha})`; ctx.lineWidth = 1; ctx.beginPath();
        for (const [i, j] of E) { ctx.moveTo(pr[i][0], pr[i][1]); ctx.lineTo(pr[j][0], pr[j][1]); }
        ctx.stroke();
        pts.push(P(q.x, q.y, q.z, sc));
      }
      ctx.lineWidth = .6;
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i][0] - pts[j][0], dy = pts[i][1] - pts[j][1], dd = Math.hypot(dx, dy);
          if (dd < Math.min(w, h) * .38) { ctx.strokeStyle = `rgba(90,140,255,${.09 * (1 - dd / (Math.min(w, h) * .38))})`; ctx.beginPath(); ctx.moveTo(pts[i][0], pts[i][1]); ctx.lineTo(pts[j][0], pts[j][1]); ctx.stroke(); }
        }
        ctx.fillStyle = "rgba(120,165,255,.45)"; ctx.beginPath(); ctx.arc(pts[i][0], pts[i][1], 1.6, 0, 6.3); ctx.fill();
      }
    }
    const loop = (now) => {
      raf = requestAnimationFrame(loop);
      if (document.hidden || now - last < 40) return;
      const dt = Math.min(now - last, 100); last = now;
      cx += (tx - cx) * .05; cy += (ty - cy) * .05;
      zoom += (1 + f.current * .05 - zoom) * .04; yoff += (f.current * .35 - yoff) * .04;
      draw(dt);
    };
    const move = (e) => { tx = (e.clientX / w - .5) * 2; ty = (e.clientY / h - .5) * 2; };
    resize(); addEventListener("resize", resize);
    if (!reduce) { addEventListener("pointermove", move, { passive: true }); raf = requestAnimationFrame(loop); }
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", resize); removeEventListener("pointermove", move); };
  }, []);
  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0" style={{ opacity: .85 }} />;
}
