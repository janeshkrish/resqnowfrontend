import { useEffect, useRef } from "react";

/** The two voices as one live wave behind the mic: crimson while the customer talks, navy while ResQNow-Thozhan does. */
export default function VoiceWave({ who }: { who: "you" | "thozhan" | null }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const whoRef = useRef(who);
  whoRef.current = who;

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const still = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    let amp = 0;
    let last: "you" | "thozhan" = "thozhan";
    let raf = 0;
    const draw = (ts: number) => {
      raf = requestAnimationFrame(draw);
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const width = c.clientWidth * 2, height = c.clientHeight * 2;
      if (c.width !== width) c.width = width;
      if (c.height !== height) c.height = height;
      const current = whoRef.current;
      if (current) last = current;
      amp += ((current === "you" ? 1 : current === "thozhan" ? 0.6 : 0) - amp) * 0.07;
      ctx.clearRect(0, 0, width, height);
      if (still || amp < 0.01) return;
      const t = ts / 1000, mid = height * 0.42;
      const you = last === "you";
      const colours = you ? ["176,31,42", "210,30,51", "142,24,34"] : ["40,48,72", "102,112,133", "176,31,42"];
      colours.forEach((col, i) => {
        const k = ((1.4 + i * 0.5) * Math.PI * 2) / width;
        const sp = (you ? 3.4 : 2.4) * (i % 2 ? -1 : 1) * (1 + i * 0.22);
        const pulse = you ? 0.5 + 0.5 * Math.abs(Math.sin(t * (2.4 + i * 0.7) + i * 1.3)) : 0.55 + 0.45 * Math.abs(Math.sin(t * (4.6 + i) + i));
        const a = height * 0.34 * amp * pulse;
        const grad = ctx.createLinearGradient(0, 0, width, 0);
        grad.addColorStop(0, `rgba(${col},0)`);
        grad.addColorStop(0.5, `rgba(${col},0.42)`);
        grad.addColorStop(1, `rgba(${col},0)`);
        ctx.beginPath();
        for (let x = 0; x <= width; x += 4) {
          const env = Math.pow(Math.sin((Math.PI * x) / width), 2);
          const y = mid - a * env * Math.sin(k * x + sp * t + i * 1.7);
          if (x === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        for (let x = width; x >= 0; x -= 4) {
          const env = Math.pow(Math.sin((Math.PI * x) / width), 2);
          ctx.lineTo(x, mid + a * env * 0.55 * Math.sin(k * x + sp * t + i * 1.7 + 0.9));
        }
        ctx.closePath();
        ctx.fillStyle = grad;
        ctx.fill();
      });
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvas} className="vt-wave" aria-hidden="true" />;
}
