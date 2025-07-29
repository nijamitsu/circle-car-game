import { useEffect, useRef, useState } from 'react';

interface Point {
  x: number;
  y: number;
}

export const CircleCarGame = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<Point[]>([]);
  const [carPosition, setCarPosition] = useState({ x: -100, y: 500 }); // Start off-screen at road level
  const [isAnimating, setIsAnimating] = useState(false);
  const [isWobbling, setIsWobbling] = useState(false);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Set canvas dimensions based on window size, with a max size of 800x600
    const updateCanvasSize = () => {
      const width = Math.min(window.innerWidth, 800); // Ensure canvas width does not exceed browser width
      const height = Math.min(window.innerHeight, 600);
      canvas.width = width;
      canvas.height = height;
      drawCanvas();
    };

    // Initial size setup
    updateCanvasSize();

    // Update canvas size on window resize
    window.addEventListener('resize', updateCanvasSize);

    return () => {
      window.removeEventListener('resize', updateCanvasSize);
    };
  }, [points, carPosition, isWobbling, rotation]);

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || !canvas) return;

    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw road
    ctx.beginPath();
    ctx.moveTo(0, 500);
    ctx.lineTo(canvas.width, 500);
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Draw points during circle drawing
    if (points.length > 0 && !isAnimating) {
      ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);
      points.forEach((point) => {
        ctx.lineTo(point.x, point.y);
      });
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw car body
    if (isAnimating) {
      ctx.save();
      
      // Apply car body tilt
      ctx.translate(carPosition.x + 20, carPosition.y - 60);
      ctx.rotate(rotation);
      ctx.translate(-(carPosition.x + 20), -(carPosition.y - 60));
      
      // Car body
      ctx.fillStyle = '#4a90e2';
      ctx.fillRect(carPosition.x - 40, carPosition.y - 80, 120, 40); // Moved up relative to wheels
      
      ctx.restore();
      
      // Draw wheels using the drawn circle as a template
      if (points.length > 0) {
        const wheelBase = 80; // Distance between wheels
        drawWheel(ctx, carPosition.x - 20, carPosition.y - 20, isWobbling);
        drawWheel(ctx, carPosition.x + wheelBase - 20, carPosition.y - 20, isWobbling);
      }
    }
  };

  const drawWheel = (ctx: CanvasRenderingContext2D, x: number, y: number, wobble: boolean) => {
    if (points.length < 2) return;

    // Calculate center and radius from drawn points
    const center = calculateCircleCenter();
    const baseRadius = calculateRadius(center);
    
    ctx.save();
    ctx.translate(x, y);
    
    // Calculate rotation based on wheel position
    const wheelX = x + carPosition.x; // Get absolute X position of the wheel
    const rotation = (wheelX / 20) % (Math.PI * 2); // Full rotation every 20 pixels
    ctx.rotate(rotation);
    
    if (wobble) {
      // No additional wobble - the wheel shape itself creates the wobble effect
      const currentRadius = calculateWheelRadius(rotation);
      const radiusDiff = currentRadius - baseRadius;
      ctx.translate(0, radiusDiff * 0.3); // Slight vertical adjustment based on radius
    }

    // Scale the original points to match desired wheel size
    const wheelRadius = 20;
    const scale = wheelRadius / baseRadius;

    ctx.beginPath();
    const scaledPoints = points.map(p => ({
      x: (p.x - center.x) * scale,
      y: (p.y - center.y) * scale
    }));

    ctx.moveTo(scaledPoints[0].x, scaledPoints[0].y);
    scaledPoints.forEach((point) => {
      ctx.lineTo(point.x, point.y);
    });
    ctx.closePath();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  };

  const calculateCircleCenter = () => {
    const sumX = points.reduce((sum, p) => sum + p.x, 0);
    const sumY = points.reduce((sum, p) => sum + p.y, 0);
    return {
      x: sumX / points.length,
      y: sumY / points.length
    };
  };

  const calculateRadius = (center: Point) => {
    return points.reduce((sum, p) => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      return sum + Math.sqrt(dx * dx + dy * dy);
    }, 0) / points.length;
  };

  const checkCircleQuality = () => {
    const center = calculateCircleCenter();
    const radius = calculateRadius(center);
    
    // Check if points form a relatively circular shape
    const radiusVariance = points.map(p => {
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      return Math.abs(distance - radius);
    });

    const averageVariance = radiusVariance.reduce((a, b) => a + b, 0) / radiusVariance.length;
    return averageVariance < radius * 0.2; // 20% tolerance
  };

  const startAnimation = () => {
    setIsAnimating(true);
    setIsWobbling(!checkCircleQuality());
    const baseSpeed = 2;
    
    // Animate car movement with physics
    const animate = () => {

      setCarPosition(prev => {
        const canvas = canvasRef.current;
        if (!canvas) return prev;
        
        if (prev.x > canvas.width) {
          return { x: -100, y: 500 };
        }

        // Calculate wheel contact points with the road
        const wheelBase = 80;
        const leftWheelX = prev.x - 20;
        const rightWheelX = prev.x + wheelBase - 20;
        
        // Get current rotation angles for both wheels
        const leftRotation = (leftWheelX / 20) % (Math.PI * 2);
        const rightRotation = (rightWheelX / 20) % (Math.PI * 2);
        
        // Calculate radii at current rotation points
        const leftRadius = calculateWheelRadius(leftRotation);
        const rightRadius = calculateWheelRadius(rightRotation);
        
        // Calculate car body tilt based on wheel radii difference
        const tilt = Math.atan2(rightRadius - leftRadius, wheelBase);
        setRotation(tilt);

        // Calculate car body height based on average wheel radius
        const avgRadius = (leftRadius + rightRadius) / 2;
        const baseRadius = calculateRadius(calculateCircleCenter());
        const heightOffset = (avgRadius - baseRadius) * (isWobbling ? 1 : 0.3);

        // Adjust horizontal speed based on wheel quality and shape
        const speedMultiplier = isWobbling ? 0.7 : 1;
        const newX = prev.x + baseSpeed * speedMultiplier;

        // Car body follows the wheel positions while maintaining contact with road
        return { 
          x: newX,
          y: 500 - heightOffset // Subtract offset to move car body up when wheels are larger
        };
      });
      
      requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  };

  const calculateWheelRadius = (angle: number) => {
    if (points.length < 3) return 20; // Default wheel radius

    const center = calculateCircleCenter();
    
    // Find the point at the current angle
    const distances = points.map(point => {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      const pointAngle = Math.atan2(dy, dx);
      return {
        diff: Math.abs(((pointAngle - angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI),
        radius: Math.sqrt(dx * dx + dy * dy)
      };
    });

    // Get the radius at this angle by interpolating between closest points
    const sortedDistances = distances.sort((a, b) => a.diff - b.diff);
    const closest = sortedDistances[0];
    const nextClosest = sortedDistances[1];
    
    const totalWeight = closest.diff + nextClosest.diff;
    if (totalWeight === 0) return closest.radius;
    
    const weight1 = 1 - (closest.diff / totalWeight);
    const weight2 = 1 - (nextClosest.diff / totalWeight);
    
    return (closest.radius * weight1 + nextClosest.radius * weight2) / (weight1 + weight2);
  };



  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isAnimating) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setIsDrawing(true);
    setPoints([{ x, y }]);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isAnimating) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setPoints(prev => [...prev, { x, y }]);
  };

  const handleMouseUp = () => {
    if (isDrawing && points.length > 10) {
      setPoints(prev => [...prev, points[0]]); // Close the circle
      startAnimation();
    }
    setIsDrawing(false);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    setIsDrawing(true);
    setPoints([{ x, y }]);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (!isDrawing || isAnimating) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;
    
    setPoints(prev => [...prev, { x, y }]);
  };

  const handleTouchEnd = () => {
    handleMouseUp();
  };

  const handleReset = () => {
    setPoints([]);
    setCarPosition({ x: -100, y: 500 }); // Reset to off-screen position at road level
    setIsAnimating(false);
    setIsWobbling(false);
  };

  return (
    <div style={{ textAlign: 'center', padding: '20px', maxWidth: '100%', overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        style={{ border: '1px solid #ccc', maxWidth: '100%' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      />
      <div style={{ marginTop: '20px' }}>
        <button 
          onClick={handleReset}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#4a90e2',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer'
          }}
        >
          Draw New Circle
        </button>
      </div>
    </div>
  );
};
