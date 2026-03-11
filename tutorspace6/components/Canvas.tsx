'use client'
// components/Canvas.tsx — Dessin + Texte + Image + Sauvegarde par élève
import { useRef, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

type Tool = 'pen' | 'eraser' | 'highlighter' | 'text'

type Stroke = {
  id: string
  points: { x: number; y: number }[]
  color: string
  width: number
  tool: 'pen' | 'eraser' | 'highlighter'
}

type TextObj = {
  id: string
  x: number
  y: number
  text: string
  color: string
  fontSize: number
}

type ImageObj = {
  id: string
  src: string   // base64
  x: number
  y: number
  w: number
  h: number
}

type CanvasState = {
  strokes: Stroke[]
  texts: TextObj[]
  images: ImageObj[]
}

interface CanvasProps {
  exerciseId: string
  userId: string          // owner of this canvas data
  panel: 'left' | 'right'
  readonly?: boolean
  bgImageUrl?: string
  isProf?: boolean
  transparent?: boolean
  onSaved?: () => void
}

const PROF_COLORS  = ['#1e3a8a', '#0f766e', '#166534', '#7c3aed']
const STU_COLORS   = ['#111827', '#1d4ed8', '#b45309', '#be185d', '#b91c1c']
const ANNOT_COLOR  = '#ef4444'

export default function Canvas({ exerciseId, userId, panel, readonly, bgImageUrl, isProf, transparent, onSaved }: CanvasProps) {
  const canvasRef   = useRef<HTMLCanvasElement>(null)
  const fileRef     = useRef<HTMLInputElement>(null)
  const [tool, setTool]       = useState<Tool>('pen')
  const [color, setColor]     = useState(isProf ? '#1e3a8a' : '#111827')
  const [lw, setLw]           = useState(3)
  const [fontSize, setFs]     = useState(22)
  const [state, setState]     = useState<CanvasState>({ strokes: [], texts: [], images: [] })
  const [isDrawing, setIsDrawing] = useState(false)
  const [saved, setSaved]     = useState(true)
  const [saving, setSaving]   = useState(false)
  // Text input overlay
  const [textBox, setTextBox] = useState<{ x: number; y: number; cx: number; cy: number; val: string } | null>(null)
  const currentPts = useRef<{ x: number; y: number }[]>([])
  const stateRef   = useRef<CanvasState>({ strokes: [], texts: [], images: [] })

  // Keep stateRef in sync
  useEffect(() => { stateRef.current = state }, [state])

  useEffect(() => { loadData() }, [exerciseId, userId, panel])

  async function loadData() {
    const { data } = await supabase
      .from('canvas_data')
      .select('strokes')
      .eq('exercise_id', exerciseId)
      .eq('user_id', userId)
      .eq('panel', panel)
      .maybeSingle()

    if (data?.strokes) {
      const s = data.strokes as any
      const loaded: CanvasState = {
        strokes: s.strokes || [],
        texts:   s.texts   || [],
        images:  s.images  || [],
      }
      setState(loaded)
      stateRef.current = loaded
    }
    setSaved(true)
  }

  // Redraw whenever state or bgImage changes
  useEffect(() => { redraw(state) }, [state, bgImageUrl])

  function redraw(s: CanvasState) {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Background color — skip if transparent (annotation layer)
    if (!transparent) {
      ctx.fillStyle = panel === 'left' ? '#fdfaf3' : '#f8f5ee'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    // Background image
    if (bgImageUrl) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        ctx.globalAlpha = 1
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        drawContent(ctx, s)
      }
      img.src = bgImageUrl
      return
    }
    drawContent(ctx, s)
  }

  function drawContent(ctx: CanvasRenderingContext2D, s: CanvasState) {
    // Inserted images
    for (const img of s.images) {
      const el = new Image()
      el.onload = () => {
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
        ctx.drawImage(el, img.x, img.y, img.w, img.h)
      }
      el.src = img.src
    }
    // Strokes
    for (const stroke of s.strokes) drawStroke(ctx, stroke)
    // Texts
    for (const t of s.texts) drawText(ctx, t)
  }

  function drawStroke(ctx: CanvasRenderingContext2D, stroke: Stroke) {
    if (stroke.points.length < 2) return
    ctx.save()
    ctx.beginPath()
    ctx.strokeStyle = stroke.color
    ctx.lineWidth   = stroke.width
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    if (stroke.tool === 'eraser') {
      ctx.globalCompositeOperation = 'destination-out'
      ctx.lineWidth = stroke.width * 4
    } else if (stroke.tool === 'highlighter') {
      ctx.globalAlpha = 0.35
    }
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    for (let i = 1; i < stroke.points.length; i++) ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
    ctx.stroke()
    ctx.restore()
  }

  function drawText(ctx: CanvasRenderingContext2D, t: TextObj) {
    ctx.save()
    ctx.fillStyle  = t.color
    ctx.font       = `${t.fontSize}px 'DM Sans', sans-serif`
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    // Multi-line support
    const lines = t.text.split('\n')
    lines.forEach((line, i) => ctx.fillText(line, t.x, t.y + i * (t.fontSize + 4)))
    ctx.restore()
  }

  function getPos(e: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY, cx: clientX - rect.left, cy: clientY - rect.top }
  }

  // ── TEXT TOOL CLICK ──
  function handleCanvasClick(e: React.MouseEvent) {
    if (readonly || tool !== 'text') return
    const { x, y, cx, cy } = getPos(e)
    setTextBox({ x, y, cx, cy, val: '' })
  }

  function commitText() {
    if (!textBox || !textBox.val.trim()) { setTextBox(null); return }
    const effectiveColor = isProf && panel === 'right' ? ANNOT_COLOR : color
    const newText: TextObj = { id: crypto.randomUUID(), x: textBox.x, y: textBox.y, text: textBox.val, color: effectiveColor, fontSize }
    const next = { ...stateRef.current, texts: [...stateRef.current.texts, newText] }
    setState(next)
    setSaved(false)
    setTextBox(null)
  }

  // ── DRAWING ──
  function startDrawing(e: React.MouseEvent | React.TouchEvent) {
    if (readonly || tool === 'text') return
    e.preventDefault()
    setIsDrawing(true)
    const { x, y } = getPos(e)
    currentPts.current = [{ x, y }]
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    if (!isDrawing || readonly || tool === 'text') return
    e.preventDefault()
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const { x, y } = getPos(e)
    const prev = currentPts.current[currentPts.current.length - 1]
    currentPts.current.push({ x, y })

    const effectiveColor = isProf && panel === 'right' ? ANNOT_COLOR : color

    ctx.save()
    ctx.beginPath()
    ctx.strokeStyle = effectiveColor
    ctx.lineWidth   = tool === 'eraser' ? lw * 4 : lw
    ctx.lineCap     = 'round'
    ctx.lineJoin    = 'round'
    if (tool === 'eraser')      ctx.globalCompositeOperation = 'destination-out'
    else if (tool === 'highlighter') ctx.globalAlpha = 0.35
    ctx.moveTo(prev.x, prev.y)
    ctx.lineTo(x, y)
    ctx.stroke()
    ctx.restore()
  }

  function endDrawing() {
    if (!isDrawing || readonly || tool === 'text') return
    setIsDrawing(false)
    if (currentPts.current.length < 2) return
    const effectiveColor = isProf && panel === 'right' ? ANNOT_COLOR : color
    const newStroke: Stroke = {
      id: crypto.randomUUID(),
      points: [...currentPts.current],
      color: effectiveColor,
      width: lw,
      tool: tool as 'pen' | 'eraser' | 'highlighter',
    }
    currentPts.current = []
    const next = { ...stateRef.current, strokes: [...stateRef.current.strokes, newStroke] }
    setState(next)
    setSaved(false)
  }

  // ── IMAGE UPLOAD ──
  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const src = ev.target?.result as string
      const img = new Image()
      img.onload = () => {
        const maxW = 400
        const scale = img.width > maxW ? maxW / img.width : 1
        const newImg: ImageObj = {
          id: crypto.randomUUID(),
          src,
          x: 20, y: 20,
          w: img.width * scale,
          h: img.height * scale,
        }
        const next = { ...stateRef.current, images: [...stateRef.current.images, newImg] }
        setState(next)
        setSaved(false)
      }
      img.src = src
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // ── SAVE ──
  async function saveData() {
    setSaving(true)
    const payload = {
      exercise_id: exerciseId,
      user_id: userId,
      panel,
      strokes: stateRef.current as any,
      updated_at: new Date().toISOString(),
    }
    await supabase.from('canvas_data').upsert(payload, { onConflict: 'exercise_id,user_id,panel' })
    setSaved(true)
    setSaving(false)
    onSaved?.()
  }

  function clearCanvas() {
    if (!confirm('Effacer tout le contenu de ce panneau ?')) return
    const empty: CanvasState = { strokes: [], texts: [], images: [] }
    setState(empty)
    setSaved(false)
  }

  const effectiveColor = isProf && panel === 'right' ? ANNOT_COLOR : color
  const palette = isProf ? PROF_COLORS : STU_COLORS

  return (
    <div className="flex flex-col h-full select-none">
      {/* ── TOOLBAR ── */}
      {!readonly && (
        <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 flex-shrink-0"
             style={{ background: 'rgba(30,38,52,0.95)', borderBottom: '1px solid rgba(86,96,112,0.3)' }}>

          {/* Tools */}
          {([
            { t: 'pen',         icon: '✏️', label: 'Stylo' },
            { t: 'highlighter', icon: '🖊️', label: 'Surligneur' },
            { t: 'text',        icon: '𝐓',  label: 'Texte' },
            { t: 'eraser',      icon: '⬜', label: 'Gomme' },
          ] as { t: Tool; icon: string; label: string }[]).map(({ t, icon, label }) => (
            <button key={t} onClick={() => setTool(t)} title={label}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-sm transition-all"
              style={{
                background: tool === t ? 'rgba(232,160,48,0.3)' : 'rgba(86,96,112,0.2)',
                border: tool === t ? '1px solid rgba(232,160,48,0.7)' : '1px solid transparent',
                color: tool === t ? '#fbbf24' : '#8a9ab0',
                fontWeight: t === 'text' ? 700 : 400,
              }}>
              {icon}
            </button>
          ))}

          <div className="w-px h-5 mx-0.5" style={{ background: 'rgba(86,96,112,0.4)' }} />

          {/* Colors — hidden in prof annotation mode */}
          {!(isProf && panel === 'right') ? (
            palette.map(c => (
              <button key={c} onClick={() => setColor(c)}
                className="w-5 h-5 rounded-full transition-all flex-shrink-0"
                style={{ background: c, border: color === c ? '2px solid #faf7f0' : '2px solid transparent', boxShadow: color === c ? '0 0 0 1px rgba(232,160,48,0.8)' : 'none' }} />
            ))
          ) : (
            <span className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(239,68,68,0.15)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.3)' }}>
              ✍️ Correction rouge
            </span>
          )}

          <div className="w-px h-5 mx-0.5" style={{ background: 'rgba(86,96,112,0.4)' }} />

          {/* Size slider */}
          {tool === 'text' ? (
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: '#566070' }}>Taille</span>
              <input type="range" min="12" max="48" value={fontSize}
                onChange={e => setFs(Number(e.target.value))}
                className="w-16 h-1" style={{ accentColor: '#e8a030' }} />
              <span className="text-xs w-6" style={{ color: '#8a9ab0' }}>{fontSize}</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{ color: '#566070' }}>Épaisseur</span>
              <input type="range" min="1" max="24" value={lw}
                onChange={e => setLw(Number(e.target.value))}
                className="w-16 h-1" style={{ accentColor: '#e8a030' }} />
              <span className="text-xs w-4" style={{ color: '#8a9ab0' }}>{lw}</span>
            </div>
          )}

          <div className="w-px h-5 mx-0.5" style={{ background: 'rgba(86,96,112,0.4)' }} />

          {/* Insert image */}
          <button onClick={() => fileRef.current?.click()}
            title="Insérer une photo"
            className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs transition-all"
            style={{ background: 'rgba(86,96,112,0.2)', color: '#8a9ab0', border: '1px solid rgba(86,96,112,0.3)' }}>
            🖼️ <span className="hidden sm:inline">Photo</span>
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

          <div className="flex-1" />

          {/* Save button */}
          <button onClick={saveData} disabled={saved || saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: saved ? 'rgba(16,185,129,0.1)' : 'linear-gradient(135deg, #e8a030, #b87a18)',
              color: saved ? '#6ee090' : '#0f0e0b',
              border: saved ? '1px solid rgba(16,185,129,0.3)' : 'none',
              fontFamily: 'Syne',
              cursor: saved ? 'default' : 'pointer',
            }}>
            {saving ? '⏳' : saved ? '✓ Sauvegardé' : '💾 Sauvegarder'}
          </button>

          {/* Clear */}
          <button onClick={clearCanvas}
            className="px-2 py-1.5 rounded-lg text-xs transition-all"
            style={{ background: 'rgba(217,64,64,0.1)', color: '#f08080', border: '1px solid rgba(217,64,64,0.2)' }}>
            🗑️
          </button>
        </div>
      )}

      {/* ── CANVAS AREA ── */}
      <div className="flex-1 relative overflow-hidden"
           style={{ background: panel === 'left' ? '#fdfaf3' : '#f8f5ee' }}>
        <canvas
          ref={canvasRef}
          width={900} height={650}
          className="w-full h-full"
          style={{ touchAction: 'none', display: 'block', cursor: readonly ? 'default' : tool === 'text' ? 'text' : tool === 'eraser' ? 'cell' : 'crosshair' }}
          onClick={handleCanvasClick}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
        />

        {/* Text input overlay */}
        {textBox && (
          <div className="absolute" style={{ left: textBox.cx, top: textBox.cy, zIndex: 50 }}>
            <textarea
              autoFocus
              value={textBox.val}
              onChange={e => setTextBox(p => p ? { ...p, val: e.target.value } : null)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commitText() } if (e.key === 'Escape') setTextBox(null) }}
              onBlur={commitText}
              rows={3}
              placeholder="Tapez votre texte... (Entrée pour valider)"
              className="rounded-lg px-3 py-2 text-sm outline-none resize-none shadow-xl"
              style={{
                background: 'rgba(15,14,11,0.95)',
                border: `2px solid ${effectiveColor}`,
                color: effectiveColor,
                fontFamily: 'DM Sans, sans-serif',
                fontSize: `${Math.min(fontSize, 18)}px`,
                minWidth: '200px',
                backdropFilter: 'blur(8px)',
              }}
            />
            <div className="text-xs mt-1 text-center" style={{ color: '#566070' }}>
              Entrée = valider · Échap = annuler
            </div>
          </div>
        )}

        {/* Readonly badge */}
        {readonly && (
          <div className="absolute top-3 right-3 text-xs px-3 py-1.5 rounded-full"
               style={{ background: 'rgba(42,49,64,0.85)', color: '#8a9ab0', border: '1px solid rgba(86,96,112,0.3)' }}>
            👁 Lecture seule
          </div>
        )}

        {/* Unsaved indicator */}
        {!readonly && !saved && (
          <div className="absolute bottom-3 right-3 text-xs px-3 py-1.5 rounded-full animate-pulse"
               style={{ background: 'rgba(232,160,48,0.15)', color: '#fbbf24', border: '1px solid rgba(232,160,48,0.3)' }}>
            ● Non sauvegardé
          </div>
        )}
      </div>
    </div>
  )
}
