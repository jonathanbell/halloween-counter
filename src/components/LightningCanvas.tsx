import { useEffect, useRef, memo } from 'react';
import './LightningCanvas.css';

interface Point {
  x: number;
  y: number;
}

interface Branch {
  points: Point[];
  children: Branch[];
}

interface LightningCanvasProps {
  triggerOnIncrement?: boolean;
}

export const LightningCanvas = memo(({ triggerOnIncrement }: LightningCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const lastStrikeRef = useRef<number>(0);

  const createBranch = (
    startX: number,
    startY: number,
    angle: number,
    length: number,
    depth: number
  ): Branch => {
    const points: Point[] = [];
    const segments = Math.floor(length / 5);

    let currentX = startX;
    let currentY = startY;
    points.push({ x: currentX, y: currentY });

    for (let i = 0; i < segments; i++) {
      const segmentLength = length / segments;
      const offsetAngle = angle + (Math.random() - 0.5) * 0.8;

      currentX += Math.cos(offsetAngle) * segmentLength;
      currentY += Math.sin(offsetAngle) * segmentLength;

      currentX += (Math.random() - 0.5) * 15;
      currentY += Math.random() * 3;

      points.push({ x: currentX, y: currentY });
    }

    const branch: Branch = {
      points,
      children: []
    };

    if (depth > 0 && length > 20) {
      const branchCount = Math.random() > 0.6 ? 2 : 1;

      for (let i = 0; i < branchCount; i++) {
        const branchPoint = points[Math.floor(points.length * (0.3 + Math.random() * 0.6))];
        const childAngle = angle + (Math.random() - 0.5) * Math.PI / 2;
        const childLength = length * (0.4 + Math.random() * 0.4);

        if (Math.random() > 0.3) {
          branch.children.push(
            createBranch(branchPoint.x, branchPoint.y, childAngle, childLength, depth - 1)
          );
        }
      }
    }

    return branch;
  };

  const drawBranch = (
    ctx: CanvasRenderingContext2D,
    branch: Branch,
    opacity: number,
    thickness: number = 4
  ) => {
    if (branch.points.length < 2) return;

    ctx.globalAlpha = opacity;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = thickness;
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#88ccff';

    ctx.beginPath();
    ctx.moveTo(branch.points[0].x, branch.points[0].y);
    for (let i = 1; i < branch.points.length; i++) {
      ctx.lineTo(branch.points[i].x, branch.points[i].y);
    }
    ctx.stroke();

    ctx.lineWidth = thickness * 0.4;
    ctx.strokeStyle = '#aaccff';
    ctx.shadowBlur = 50;
    ctx.stroke();

    branch.children.forEach(child => {
      drawBranch(ctx, child, opacity * 0.8, thickness * 0.6);
    });
  };

  const createLightning = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    const startX = Math.random() * canvas.width;
    const startY = 0;
    const initialAngle = Math.PI / 2 + (Math.random() - 0.5) * Math.PI / 8;
    const length = canvas.height * 0.5 + Math.random() * canvas.height * 0.3;

    const mainBolt = createBranch(startX, startY, initialAngle, length, 4);

    let opacity = 1;
    const fadeSpeed = 0.05;
    let flashOpacity = 0.3;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (flashOpacity > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        flashOpacity -= 0.02;
      }

      if (opacity > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        drawBranch(ctx, mainBolt, opacity);
        ctx.restore();

        opacity -= fadeSpeed;
        animationRef.current = requestAnimationFrame(animate);
      } else {
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      }
    };

    animate();
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    if (triggerOnIncrement) {
      createLightning(canvas, ctx);
      lastStrikeRef.current = Date.now();
    }

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [triggerOnIncrement]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const checkForLightning = () => {
      const now = Date.now();
      const timeSinceLastStrike = now - lastStrikeRef.current;
      const minInterval = 9000;
      const maxInterval = 17000;

      if (timeSinceLastStrike > minInterval) {
        const probability = (timeSinceLastStrike - minInterval) / (maxInterval - minInterval);

        if (Math.random() < probability) {
          lastStrikeRef.current = now;
          createLightning(canvas, ctx);
        }
      }
    };

    const interval = setInterval(checkForLightning, 500);

    setTimeout(() => {
      createLightning(canvas, ctx);
      lastStrikeRef.current = Date.now();
    }, 1000);

    return () => {
      clearInterval(interval);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <canvas
      ref={canvasRef}
      className="lightning-canvas"
      aria-hidden="true"
    />
  );
});

LightningCanvas.displayName = 'LightningCanvas';