'use client'
// components/Canvas.tsx — Dual-panel drawing canvas
import { useRef, useEffect, useState, useCallback } from 'react'
import { supabase, Stroke } from '@/lib/supabase'

type Tool = 'pen' | 'eraser' | 'highlighter'

interface CanvasProps {
  exerciseId: string
  userId: string
  panel: 'left' | 'right'
  readonly?: boolean
  bgImageUrl?: string
  annotationStrokes?: Stroke[]  // Prof's red correction annotations
  isProf?: boolean
  onStrokeSaved?: () => void
}

const COLORS = {
  prof: ['#1e40af', '#0d9488', '#166534', '#1e1b4b'],
  student: ['#0f0e0b', '#1d4ed8', '#b45309', '#5b21b6', '#b91c1c'],
  profAnnotation: '#d94040',
}

export default function Canvas({ exerciseId, userId, panel, readonly, bgImageUrl, annotationStrokes, isProf, onStrokeSaved }: CanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const overlayRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(isProf ? '#1e40af' : '#0f0e0b')
  const [lineWidth, setLineWidth] = useState(3)
  const [strokes, setStrokes] = useState<Stroke[]>([])
  const [isDrawing, setIsDrawing] = useState(false)
  const currentStroke = useRef<{ x: number; y: number }[]>([])
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>()

  // Load existing strokes from DB
  useEffect(() => {
    loadStrokes()
  }, [exerciseId, userId, panel])

  async function loadStrokes() {
    const { data } = await supabase
      .from('canvas_data')
      .select('strokes')
      .eq('exercise_id', exerciseId)
      .eq('user_id', userId)
      .eq('panel', panel)
      .single()
    if (data?.strokes) {
      setStrokes(data.strokes as Stroke[])
    }
  }

  // Redraw canvas whenever strokes change
  useEffect(() => {
    redraw()
  }, [strokes, annotationStrokes, bgImageUrl])

  function redraw() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw background image
    if (bgImageUrl) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        drawAllStrokes(ctx)
      }
      img.src = bgImageUrl
    } else {
      drawAllStrokes(ctx)
    }
  }

  function drawAllStrokes(ctx: CanvasRenderingContext2D) {
    // Draw user strokes
    for (const stroke of strokes) drawStroke(ctx, stroke)
    // Draw annotation strokes (prof corrections in red)
    if (annotationStrokes) {
      for (const s of annotationStrokes) drawStroke(ctx, s)
    }
  }

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    if (stroke.points.length < 2) return
    ctx.beginPath()
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = stroke.opacity ?? 1
    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
    } else if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = 0.35
      ctx.globalCompositeOperation = 'source-over'
    } else {
      ctx.globalCompositeOperation = 'source-over'
    }
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  function getPos(e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    }
  }

  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    if (readonly) return
    e.preventDefault()
    setIsDrawing(true)
    const canvas = canvasRef.current!
    const pos = getPos(e, canvas)
    currentStroke.current = [pos]
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing || readonly) return
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    currentStroke.current.push(pos)

    // Live draw on overlay
    const prev = currentStroke.current[currentStroke.current.length - 2]
    ctx.beginPath()
    ctx.strokeStyle = tool === 'eraser' ? '#000' : (isProf && panel === 'right' ? COLORS.profAnnotation : color)
    ctx.lineWidth = tool === 'eraser' ? lineWidth * 4 : lineWidth
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = tool === 'highlighter' ? 0.35 : 1
    ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over'
    ctx.moveTo(prev.x, prev.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }

  function endDrawing() {
    if (!isDrawing || readonly) return
    setIsDrawing(false)
    if (currentStroke.current.length < 2) return

    const newStroke: Stroke = {
      id: crypto.randomUUID(),
      points: [...currentStroke.current],
      color: isProf && panel === 'right' ? COLORS.profAnnotation : color,
      width: tool === 'eraser' ? lineWidth * 4 : lineWidth,
      tool,
    }
    currentStroke.current = []

    const updated = [...strokes, newStroke]
    setStrokes(updated)

    // Debounced save to DB
    if (saveTimeout.current) clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => saveStrokes(updated), 1500)
  }

  async function saveStrokes(data: Stroke[]) {
    await supabase.from('canvas_data').upsert({
      exercise_id: exerciseId,
      user_id: userId,
      panel,
      strokes: data,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'exercise_id,user_id,panel' })
    onStrokeSaved?.()
  }

  function clearCanvas() {
    setStrokes([])
    saveStrokes([])
  }

  const effectiveColor = isProf && panel === 'right' ? COLORS.profAnnotation : color
  const profColors = COLORS.prof
  const studentColors = COLORS.student

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      {!readonly && (
        <div className="flex items-center gap-2 px-3 py-2 flex-wrap"
             style={{ background: 'rgba(42,49,64,0.9)', borderBottom: '1px solid rgba(86,96,112,0.3)' }}>
          {/* Tools */}
          {(['pen', 'highlighter', 'eraser'] as Tool[]).map(t => (
            <button key={t} onClick={() => setTool(t)}
              title={t === 'pen' ? 'Stylo' : t === 'highlighter' ? 'Surligneur' : 'Gomme'}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
              style={{
                background: tool === t ? 'rgba(232,160,48,0.3)' : 'rgba(86,96,112,0.2)',
                border: tool === t ? '1px solid rgba(232,160,48,0.6)' : '1px solid transparent',
              }}>
              {t === 'pen' ? '✏️' : t === 'highlighter' ? '🖊️' : '⬜'}
            </button>
          ))}

          <div className="w-px h-6 mx-1" style={{ background: 'rgba(86,96,112,0.4)' }} />

          {/* Colors (only if not prof annotating on right panel) */}
          {!(isProf && panel === 'right') && (
            <>
              {(isProf ? profColors : studentColors).map(c => (
                <button key={c} onClick={() => setColor(c)}
                  className="w-6 h-6 rounded-full transition-all"
                  style={{
                    background: c,
                    border: color === c ? '2px solid #faf7f0' : '2px solid transparent',
                    boxShadow: color === c ? '0 0 0 1px rgba(232,160,48,0.8)' : 'none'
                  }} />
              ))}
            </>
          )}
          {isProf && panel === 'right' && (
            <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(217,64,64,0.2)', color: '#f08080', border: '1px solid rgba(217,64,64,0.4)' }}>
              Mode correction ✍️
            </span>
          )}

          <div className="w-px h-6 mx-1" style={{ background: 'rgba(86,96,112,0.4)' }} />

          {/* Line width */}
          <input type="range" min="1" max="20" value={lineWidth}
            onChange={e => setLineWidth(Number(e.target.value))}
            className="w-20 h-1 accent-amber-400"
            style={{ accentColor: '#e8a030' }} />
          <span className="text-xs" style={{ color: '#8a9ab0' }}>{lineWidth}px</span>

          <div className="flex-1" />
          <button onClick={clearCanvas} className="text-xs px-3 py-1.5 rounded-lg transition-all"
            style={{ background: 'rgba(217,64,64,0.15)', color: '#f08080', border: '1px solid rgba(217,64,64,0.3)' }}>
            Effacer tout
          </button>
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative overflow-hidden"
           style={{ background: panel === 'left' ? '#fdfaf3' : '#f8f4ec' }}>
        <canvas
          ref={canvasRef}
          width={800} height={600}
          className={`w-full h-full ${readonly ? 'canvas-readonly' : tool === 'pen' ? 'canvas-pen' : 'canvas-pen'}`}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          style={{ touchAction: 'none', display: 'block' }}
        />
        {readonly && (
          <div className="absolute top-3 right-3 text-xs px-3 py-1.5 rounded-full"
               style={{ background: 'rgba(86,96,112,0.8)', color: '#c0ccd8' }}>
            👁 Lecture seule
          </div>
        )}
      </div>
    </div>
  )
}
