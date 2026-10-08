import { useEffect, type RefObject } from 'react';

type Particle = {
  x: number;
  y: number;
  col: string;
  size: number;
  speedX: number;
  speedY: number;
  life: number;
  maxLife: number;
  type: 'star' | 'circle';
};

const COLORS = ['#FFE082', '#FFF8E1', '#EDE7F6', '#FFFFFF'];
const SPAWN_CHANCE = 0.14;

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, col: string, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
    const inner = r * 0.4;
    if (i === 0) ctx.moveTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    else ctx.lineTo(cx + r * Math.cos(angle), cy + r * Math.sin(angle));
    const innerAngle = angle + Math.PI / 5;
    ctx.lineTo(cx + inner * Math.cos(innerAngle), cy + inner * Math.sin(innerAngle));
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCircle(ctx: CanvasRenderingContext2D, p: Particle, alpha: number) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = p.col;
  ctx.shadowColor = p.col;
  ctx.shadowBlur = p.size * 3;
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function createParticle(width: number, height: number): Particle {
  const life = Math.random() * 90 + 60;
  return {
    x: Math.random() * width,
    y: Math.random() * height,
    col: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: Math.random() * 1.6 + 0.8,
    speedX: (Math.random() - 0.5) * 0.5,
    speedY: -(Math.random() * 0.8 + 0.2),
    life,
    maxLife: life,
    type: Math.random() < 0.4 ? 'star' : 'circle',
  };
}

/** Animasi percikan bintang/titik di belakang konten, mengikuti ukuran parent canvas. */
export function useSparkCanvas(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = canvas?.parentElement;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !wrap || !ctx) return;

    let raf = 0;
    const particles: Particle[] = [];
    const resize = () => {
      canvas.width = wrap.offsetWidth;
      canvas.height = wrap.offsetHeight;
    };

    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (Math.random() < SPAWN_CHANCE) particles.push(createParticle(canvas.width, canvas.height));

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.speedX;
        p.y += p.speedY;
        p.speedY += 0.01;
        p.life--;

        const alpha = (p.life / p.maxLife) * 0.55;
        if (p.type === 'star') drawStar(ctx, p.x, p.y, p.size * 1.4, p.col, alpha);
        else drawCircle(ctx, p, alpha);

        if (p.life <= 0) particles.splice(i, 1);
      }
      raf = requestAnimationFrame(tick);
    };

    resize();
    window.addEventListener('resize', resize);
    tick();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef]);
}
