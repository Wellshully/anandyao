"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const DURATION_MS = 5000;
const DISMISS_COOKIE = "an_yao_birthday_seen";

type Particle = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  lifetime: number;
  hue: number;
  radius: number;
};

function Fireworks() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let frame = 0;
    let interval = 0;
    let previousTime = performance.now();

    const particles: Particle[] = [];
    const colors = [35, 48, 190, 275, 320, 345];

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);

      width = window.innerWidth;
      height = window.innerHeight;

      canvas!.width = Math.round(width * ratio);
      canvas!.height = Math.round(height * ratio);

      ctx!.setTransform(ratio, 0, 0, ratio, 0, 0);
    }

    function burst(x?: number, y?: number) {
      const cx = x ?? width * (0.15 + Math.random() * 0.7);
      const cy = y ?? height * (0.13 + Math.random() * 0.58);
      const hue = colors[Math.floor(Math.random() * colors.length)];
      const count = width < 600 ? 48 : 76;

      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 1.3 + Math.random() * 3.3;

        particles.push({
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          age: 0,
          lifetime: 42 + Math.random() * 38,
          hue: hue + (Math.random() - 0.5) * 24,
          radius: 1 + Math.random() * 1.8,
        });
      }
    }

    function draw(time: number) {
      const delta = Math.min(
        2.5,
        Math.max(0.25, (time - previousTime) / 16.667),
      );

      previousTime = time;

      ctx!.clearRect(0, 0, width, height);
      ctx!.globalCompositeOperation = "lighter";

      for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];

        particle.age += delta;

        if (particle.age >= particle.lifetime) {
          particles.splice(i, 1);
          continue;
        }

        particle.vx *= Math.pow(0.987, delta);
        particle.vy += 0.038 * delta;

        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;

        const alpha = Math.max(
          0,
          1 - particle.age / particle.lifetime,
        );

        ctx!.beginPath();
        ctx!.moveTo(particle.x, particle.y);
        ctx!.lineTo(
          particle.x - particle.vx * 3.2,
          particle.y - particle.vy * 3.2,
        );
        ctx!.strokeStyle =
          `hsla(${particle.hue}, 100%, 73%, ${alpha})`;
        ctx!.lineWidth = particle.radius;
        ctx!.stroke();

        ctx!.beginPath();
        ctx!.arc(
          particle.x,
          particle.y,
          particle.radius * 0.6,
          0,
          Math.PI * 2,
        );
        ctx!.fillStyle =
          `rgba(255, 245, 225, ${alpha * 0.8})`;
        ctx!.fill();
      }

      ctx!.globalCompositeOperation = "source-over";
      frame = window.requestAnimationFrame(draw);
    }

    resize();
    window.addEventListener("resize", resize);

    burst(width * 0.28, height * 0.3);
    burst(width * 0.72, height * 0.35);

    interval = window.setInterval(() => burst(), 720);
    frame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full"
    />
  );
}

export default function BirthdayExperience() {
  const router = useRouter();
  const [canExit, setCanExit] = useState(false);
  const navigatingRef = useRef(false);

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const timeout = window.setTimeout(
      () => setCanExit(true),
      reducedMotion ? 0 : DURATION_MS,
    );

    return () => window.clearTimeout(timeout);
  }, []);

  function exitBirthday() {
    if (!canExit || navigatingRef.current) return;

    navigatingRef.current = true;

    // Only dismiss for this browser, for roughly one day.
    document.cookie =
      `${DISMISS_COOKIE}=1; Path=/; Max-Age=86400; SameSite=Lax`;

    // Query flag is an additional safeguard against a redirect loop.
    router.replace("/?birthday=done");
  }

  return (
    <main
      className="relative isolate flex min-h-[100dvh] w-full items-center justify-center overflow-hidden bg-[#090716] text-white"
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: [
            "radial-gradient(ellipse at 50% 55%, rgba(114,52,148,.32), transparent 54%)",
            "radial-gradient(circle at 20% 20%, rgba(45,80,160,.22), transparent 35%)",
            "radial-gradient(circle at 80% 80%, rgba(224,70,128,.17), transparent 36%)",
          ].join(","),
        }}
      />

      <div
        aria-hidden="true"
        className="birthday-halo pointer-events-none absolute h-[65vmin] w-[65vmin] rounded-full"
        style={{
          background:
            "radial-gradient(circle, rgba(244,182,226,.14), rgba(138,86,207,.06) 46%, transparent 72%)",
          filter: "blur(16px)",
        }}
      />

      <Fireworks />

      <div
        className="pointer-events-none relative z-10 flex flex-col items-center px-5 text-center"
      >
        <div
          aria-hidden="true"
          className="birthday-sparkle mb-8 text-2xl tracking-[1.1em] text-amber-200/80 sm:text-3xl"
        >
          ✦ ✧ ✦
        </div>

        <h1
          className="birthday-title font-story text-[clamp(2.5rem,8.5vw,6.5rem)] font-bold leading-tight tracking-[0.08em]"
          style={{
            background:
              "linear-gradient(105deg, #fff8df 8%, #ffc6dd 33%, #ffffff 51%, #d8b8ff 72%, #ffe5ad 95%)",
            WebkitBackgroundClip: "text",
            backgroundClip: "text",
            color: "transparent",
            filter: "drop-shadow(0 0 22px rgba(255,151,218,.42))",
          }}
        >
          安！生日快樂
        </h1>

        <div
          aria-hidden="true"
          className="birthday-sparkle mt-8 text-xl tracking-[1.1em] text-pink-200/80 sm:text-2xl"
        >
          ✧ ✦ ✧
        </div>

        <div
          aria-live="polite"
          className="mt-14 min-h-7 text-sm tracking-[0.25em] text-white/70"
        >
          {canExit && (
            <span className="birthday-prompt">
              點一下繼續
            </span>
          )}
        </div>
      </div>

      {canExit && (
        <button
          type="button"
          aria-label="結束生日祝福，前往首頁"
          onClick={exitBirthday}
          className="absolute inset-0 z-20 cursor-pointer focus-visible:outline-4 focus-visible:outline-offset-[-6px] focus-visible:outline-pink-200"
        />
      )}

      <style jsx>{`
        @keyframes birthday-enter {
          from {
            opacity: 0;
            transform: translateY(24px) scale(0.9);
            filter: blur(9px);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
            filter: blur(0);
          }
        }

        @keyframes birthday-breathe {
          0%, 100% { transform: scale(0.92); opacity: 0.6; }
          50% { transform: scale(1.14); opacity: 1; }
        }

        @keyframes birthday-twinkle {
          0%, 100% { opacity: 0.45; }
          50% { opacity: 1; }
        }

        .birthday-title {
          animation: birthday-enter 1.5s ease-out both;
        }

        .birthday-halo {
          animation: birthday-breathe 5s ease-in-out infinite;
        }

        .birthday-sparkle {
          animation: birthday-twinkle 2.5s ease-in-out infinite;
        }

        .birthday-prompt {
          animation: birthday-enter 0.7s ease-out both;
        }

        @media (prefers-reduced-motion: reduce) {
          .birthday-title,
          .birthday-halo,
          .birthday-sparkle,
          .birthday-prompt {
            animation: none;
          }
        }
      `}</style>
    </main>
  );
}
