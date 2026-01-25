"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { Undo2, Trash2, Check } from "lucide-react";
import { Button } from "@/modules/_shared";

interface SignatureCanvasProps {
  /** Aspect ratio (width / height) of the target area */
  aspectRatio: number;
  onConfirm: (signatureDataUrl: string) => void;
  onCancel: () => void;
}

interface Point {
  x: number;
  y: number;
}

interface Stroke {
  points: Point[];
}

// Fixed comfortable drawing dimensions
const CANVAS_WIDTH = 360;
const MIN_CANVAS_HEIGHT = 120;
const MAX_CANVAS_HEIGHT = 200;

/**
 * Canvas component for drawing signatures with touch/mouse support.
 * Uses a fixed comfortable size for drawing, then exports at correct aspect ratio.
 */
export function SignatureCanvas({
  aspectRatio,
  onConfirm,
  onCancel,
}: SignatureCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

  // Scale factor for high DPI displays
  const scale = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
  
  // Calculate canvas height from aspect ratio, clamped to comfortable range
  const calculatedHeight = CANVAS_WIDTH / aspectRatio;
  const canvasHeight = Math.max(MIN_CANVAS_HEIGHT, Math.min(MAX_CANVAS_HEIGHT, calculatedHeight));
  const canvasWidth = CANVAS_WIDTH;

  // Initialize and redraw canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set actual size in memory (scaled for retina)
    canvas.width = canvasWidth * scale;
    canvas.height = canvasHeight * scale;

    // Scale context to ensure correct drawing operations
    ctx.scale(scale, scale);

    // Clear canvas
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // Draw all strokes
    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
      }
      ctx.stroke();
    }

    // Draw current stroke
    if (currentStroke.length >= 2) {
      ctx.beginPath();
      ctx.moveTo(currentStroke[0].x, currentStroke[0].y);
      for (let i = 1; i < currentStroke.length; i++) {
        ctx.lineTo(currentStroke[i].x, currentStroke[i].y);
      }
      ctx.stroke();
    }
  }, [strokes, currentStroke, canvasWidth, canvasHeight, scale]);

  const getCoordinates = useCallback(
    (e: React.MouseEvent | React.TouchEvent): Point | null => {
      const canvas = canvasRef.current;
      if (!canvas) return null;

      const rect = canvas.getBoundingClientRect();
      let clientX: number, clientY: number;

      if ("touches" in e) {
        if (e.touches.length === 0) return null;
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else {
        clientX = e.clientX;
        clientY = e.clientY;
      }

      return {
        x: clientX - rect.left,
        y: clientY - rect.top,
      };
    },
    []
  );

  const handlePointerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      const point = getCoordinates(e);
      if (point) {
        setIsDrawing(true);
        setCurrentStroke([point]);
      }
    },
    [getCoordinates]
  );

  const handlePointerMove = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      if (!isDrawing) return;
      e.preventDefault();
      const point = getCoordinates(e);
      if (point) {
        setCurrentStroke((prev) => [...prev, point]);
      }
    },
    [isDrawing, getCoordinates]
  );

  const handlePointerUp = useCallback(() => {
    if (isDrawing && currentStroke.length > 0) {
      setStrokes((prev) => [...prev, { points: currentStroke }]);
      setCurrentStroke([]);
    }
    setIsDrawing(false);
  }, [isDrawing, currentStroke]);

  const handleUndo = useCallback(() => {
    setStrokes((prev) => prev.slice(0, -1));
  }, []);

  const handleClear = useCallback(() => {
    setStrokes([]);
    setCurrentStroke([]);
  }, []);

  const handleConfirm = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || strokes.length === 0) return;

    // Export canvas - use the actual aspect ratio for proper sizing
    // Calculate export dimensions maintaining the target aspect ratio
    const exportWidth = 600; // Higher resolution for quality
    const exportHeight = exportWidth / aspectRatio;

    const exportCanvas = document.createElement("canvas");
    exportCanvas.width = exportWidth;
    exportCanvas.height = exportHeight;
    const ctx = exportCanvas.getContext("2d");
    if (!ctx) return;

    // Scale strokes to fit export dimensions
    const scaleX = exportWidth / canvasWidth;
    const scaleY = exportHeight / canvasHeight;

    ctx.strokeStyle = "#1c1917";
    ctx.lineWidth = 2.5 * Math.min(scaleX, scaleY);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of strokes) {
      if (stroke.points.length < 2) continue;
      ctx.beginPath();
      ctx.moveTo(stroke.points[0].x * scaleX, stroke.points[0].y * scaleY);
      for (let i = 1; i < stroke.points.length; i++) {
        ctx.lineTo(stroke.points[i].x * scaleX, stroke.points[i].y * scaleY);
      }
      ctx.stroke();
    }

    const dataUrl = exportCanvas.toDataURL("image/png");
    onConfirm(dataUrl);
  }, [strokes, canvasWidth, canvasHeight, aspectRatio, onConfirm]);

  const hasStrokes = strokes.length > 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="text-sm text-stone-500 text-center mb-2">
        Draw your signature below
      </div>

      <div
        className="relative rounded-xl border-2 border-stone-300 bg-white overflow-hidden touch-none"
        style={{ width: canvasWidth, height: canvasHeight }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: canvasWidth, height: canvasHeight }}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onMouseLeave={handlePointerUp}
          onTouchStart={handlePointerDown}
          onTouchMove={handlePointerMove}
          onTouchEnd={handlePointerUp}
          onTouchCancel={handlePointerUp}
          className="cursor-crosshair"
        />
        
        {/* Signature line hint */}
        <div
          className="absolute bottom-6 left-6 right-6 border-b border-dashed border-stone-300 pointer-events-none"
        />
      </div>

      <div className="flex items-center gap-3 w-full max-w-sm">
        <Button
          variant="ghost"
          onClick={handleUndo}
          disabled={!hasStrokes}
          className="flex-1"
        >
          <Undo2 className="w-4 h-4" />
          Undo
        </Button>
        <Button
          variant="ghost"
          onClick={handleClear}
          disabled={!hasStrokes}
          className="flex-1"
        >
          <Trash2 className="w-4 h-4" />
          Clear
        </Button>
      </div>

      <div className="flex items-center gap-3 w-full max-w-sm mt-2">
        <Button variant="secondary" onClick={onCancel} className="flex-1">
          Cancel
        </Button>
        <Button onClick={handleConfirm} disabled={!hasStrokes} className="flex-1">
          <Check className="w-4 h-4" />
          Use Signature
        </Button>
      </div>
    </div>
  );
}
