"use client";

import { useRef, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eraser, Pen, Type } from "lucide-react";

type Mode = "draw" | "type";

interface SignaturePadProps {
  onChange: (dataUrl: string | null) => void;
  width?: number;
  height?: number;
  /**
   * id wired from the parent <Label htmlFor=...>. Applied to whichever input
   * is currently rendered (canvas in draw mode, text input in type mode), so
   * the label stays connected to a focusable form control through both modes.
   */
  id?: string;
  /**
   * Pre-fills the type-mode input with the signer's name from the form above,
   * so a screen-reader / keyboard user doesn't have to retype it. Optional.
   */
  typedNameFallback?: string;
}

export function SignaturePad({
  onChange,
  width = 500,
  height = 200,
  id,
  typedNameFallback,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasContent, setHasContent] = useState(false);
  const [mode, setMode] = useState<Mode>("draw");
  const [typedName, setTypedName] = useState(typedNameFallback ?? "");

  // Initial canvas brush settings — applied once, persist across clears.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || mode !== "draw") return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.strokeStyle = "#1a1a2e";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [mode]);

  // Type-mode: render the typed name onto a hidden canvas → emit data URL,
  // matching the on-wire format the draw path produces.
  useEffect(() => {
    if (mode !== "type") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const trimmed = typedName.trim();
    if (!trimmed) {
      setHasContent(false);
      onChange(null);
      return;
    }
    ctx.fillStyle = "#1a1a2e";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    // Step font size down for long names so they fit the canvas width.
    let fontSize = 64;
    do {
      ctx.font = `italic ${fontSize}px "Brush Script MT", "Lucida Handwriting", cursive`;
      const metrics = ctx.measureText(trimmed);
      if (metrics.width <= canvas.width - 40) break;
      fontSize -= 4;
    } while (fontSize > 24);
    ctx.fillText(trimmed, canvas.width / 2, canvas.height / 2);
    setHasContent(true);
    onChange(canvas.toDataURL("image/png"));
  }, [mode, typedName, onChange]);

  function getPosition(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    if ("touches" in e) {
      return {
        x: (e.touches[0].clientX - rect.left) * scaleX,
        y: (e.touches[0].clientY - rect.top) * scaleY,
      };
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPosition(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    setIsDrawing(true);
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPosition(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
  }

  function stopDrawing() {
    if (!isDrawing) return;
    setIsDrawing(false);
    setHasContent(true);
    const canvas = canvasRef.current;
    if (canvas) {
      onChange(canvas.toDataURL("image/png"));
    }
  }

  function clearAll() {
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    if (mode === "type") setTypedName("");
    setHasContent(false);
    onChange(null);
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    clearAll();
    setMode(next);
  }

  const statusText = hasContent
    ? "Signature captured"
    : mode === "draw"
      ? "Draw your signature above"
      : "Type your name to sign";

  return (
    <div className="space-y-2" role="group" aria-label="Signature input">
      <div className="flex items-center justify-end gap-1">
        <Button
          type="button"
          variant={mode === "draw" ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          aria-pressed={mode === "draw"}
          onClick={() => switchMode("draw")}
        >
          <Pen className="mr-1 h-3 w-3" />
          Draw
        </Button>
        <Button
          type="button"
          variant={mode === "type" ? "secondary" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          aria-pressed={mode === "type"}
          onClick={() => switchMode("type")}
        >
          <Type className="mr-1 h-3 w-3" />
          Type
        </Button>
      </div>

      {mode === "draw" ? (
        <div className="relative rounded-lg border-2 border-dashed border-gray-300 bg-white">
          <canvas
            ref={canvasRef}
            id={id}
            width={width}
            height={height}
            role="img"
            aria-label="Signature drawing area. Use mouse or touch to sign, or switch to Type mode for a keyboard alternative."
            tabIndex={0}
            className="w-full cursor-crosshair touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            style={{ aspectRatio: `${width}/${height}` }}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={startDrawing}
            onTouchMove={draw}
            onTouchEnd={stopDrawing}
          />
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 border-b border-gray-300" />
          <span className="pointer-events-none absolute bottom-1 left-4 text-[10px] text-gray-400">
            Sign above this line
          </span>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-3 sm:p-4">
          <Input
            id={id}
            type="text"
            value={typedName}
            autoComplete="name"
            onChange={(e) => setTypedName(e.target.value)}
            placeholder="Type your full name as signature"
            aria-describedby={id ? `${id}-help` : undefined}
            className="border-0 bg-transparent text-center font-serif italic text-2xl shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 sm:text-3xl"
            style={{ fontFamily: '"Brush Script MT", "Lucida Handwriting", cursive' }}
          />
          <div className="mt-2 border-b border-gray-300" />
          <p id={id ? `${id}-help` : undefined} className="mt-1 text-[10px] text-gray-400">
            Typed signatures are legally equivalent under eIDAS / Dutch law for this NDA flow.
          </p>
          {/* Hidden canvas used to render the typed name into the same
              data-URL format the draw mode emits. */}
          <canvas
            ref={canvasRef}
            width={width}
            height={height}
            aria-hidden="true"
            className="hidden"
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground" aria-live="polite">
          {statusText}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={clearAll}
          disabled={!hasContent && !typedName}
        >
          <Eraser className="mr-1 h-3 w-3" />
          Clear
        </Button>
      </div>
    </div>
  );
}
