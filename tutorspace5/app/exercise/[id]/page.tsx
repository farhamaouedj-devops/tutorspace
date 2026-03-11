'use client'
// app/exercise/[id]/page.tsx — Workspace complet v4
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import Canvas from '@/components/Canvas'

type Profile = { id: string; email: string; full_name: string; role: string }
type Exercise = { id: string; title: string; description?: string; pdf_url?: string; image_url?: string; subject_id: string }
type Subject  = { name: string; icon: string; color: string }
type VoiceMsg = { id: string; user_id: string; role_type: string; audio_url: string; duration?: number; created_at: string }

export default function ExercisePage({ params }: { params: { id: string } }) {
  const exerciseId = params.id
  const router = useRouter()

  const [profile,  setProfile]  = useState<Profile | null>(null)
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [subject,  setSubject]  = useState<Subject | null>(null)
  const [students, setStudents] = useState<Profile[]>([])   // prof only
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null)
  const [loading, setLoading]   = useState(true)
  const [leftMode, setLeftMode] = useState<'canvas' | 'file'>('canvas')
  const [voiceOpen, setVoiceOpen] = useState(false)
  const [voices, setVoices]     = useState<VoiceMsg[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [recTime, setRecTime]   = useState(0)
  const [uploading, setUploading] = useState(false)
  const [playing, setPlaying]   = useState<string | null>(null)
  const [savedAt, setSavedAt]   = useState<string | null>(null)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const audioChunks   = useRef<Blob[]>([])
  const timerRef      = useRef<ReturnType<typeof setInterval>>()
  const audioRefs     = useRef<{ [id: string]: HTMLAudioElement }>({})

  useEffect(() => { init() }, [exerciseId])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const [{ data: prof }, { data: ex }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('exercises').select('*, subjects(name,icon,color)').eq('id', exerciseId).single(),
    ])
    if (!prof?.is_approved) { router.push('/'); return }

    setProfile(prof as Profile)
    setExercise(ex as Exercise)
    setSubject((ex as any)?.subjects || null)
    if (ex?.pdf_url || ex?.image_url) setLeftMode('file')

    // Si prof → charger la liste des élèves associés
    if (prof.role === 'admin') {
      const { data: associations } = await supabase
        .from('student_prof')
        .select('student_id, profiles!student_prof_student_id_fkey(id, email, full_name)')
        .eq('prof_id', user.id)
      const studs = (associations || []).map((a: any) => a.profiles).filter(Boolean)
      setStudents(studs)
      if (studs.length > 0) setSelectedStudent(studs[0].id)
    }

    setLoading(false)
    loadVoices()
  }

  async function loadVoices() {
    const { data } = await supabase
      .from('voice_messages')
      .select('*')
      .eq('exercise_id', exerciseId)
      .order('created_at', { ascending: true })
    setVoices(data || [])
  }

  // Realtime voice messages
  useEffect(() => {
    const ch = supabase.channel(`voice-${exerciseId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'voice_messages', filter: `exercise_id=eq.${exerciseId}` },
        p => setVoices(prev => [...prev, p.new as VoiceMsg]))
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [exerciseId])

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
      audioChunks.current = []
      mr.ondataavailable = e => audioChunks.current.push(e.data)
      mr.start(100)
      mediaRecorder.current = mr
      setIsRecording(true)
      setRecTime(0)
      timerRef.current = setInterval(() => setRecTime(t => t + 1), 1000)
    } catch {
      alert('Microphone non accessible. Vérifiez les permissions.')
    }
  }

  async function stopRecording() {
    clearInterval(timerRef.current)
    setIsRecording(false)
    if (!mediaRecorder.current) return
    mediaRecorder.current.stop()
    mediaRecorder.current.stream.getTracks().forEach(t => t.stop())
    setUploading(true)
    setTimeout(async () => {
      const blob = new Blob(audioChunks.current, { type: 'audio/webm' })
      const path = `${exerciseId}/${profile!.id}/${Date.now()}.webm`
      const { error } = await supabase.storage.from('voice-messages').upload(path, blob, { contentType: 'audio/webm' })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('voice-messages').getPublicUrl(path)
        await supabase.from('voice_messages').insert({
          exercise_id: exerciseId,
          user_id: profile!.id,
          role_type: profile!.role === 'admin' ? 'prof_explanation' : 'student_question',
          audio_url: publicUrl,
          duration: recTime,
        })
      }
      setUploading(false)
    }, 400)
  }

  function togglePlay(msg: VoiceMsg) {
    const audio = audioRefs.current[msg.id]
    if (!audio) return
    if (playing === msg.id) { audio.pause(); setPlaying(null) }
    else { Object.values(audioRefs.current).forEach(a => a.pause()); audio.play(); setPlaying(msg.id) }
  }

  function fmt(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  if (loading) return (
    <div className="grid-bg min-h-screen flex items-center justify-center">
      <div className="text-sm animate-in" style={{ color: '#8a9ab0' }}>Chargement...</div>
    </div>
  )
  if (!exercise || !profile) return null

  const isAdmin = profile.role === 'admin'
  // Right panel : if prof → show selected student's canvas; if student → show own canvas
  const rightUserId = isAdmin ? (selectedStudent || profile.id) : profile.id

  return (
    <div className="grid-bg flex flex-col" style={{ height: '100vh', overflow: 'hidden' }}>

      {/* ── HEADER ── */}
      <header className="flex items-center justify-between px-4 py-2.5 flex-shrink-0"
              style={{ background: 'rgba(10,12,18,0.92)', borderBottom: '1px solid rgba(86,96,112,0.25)', backdropFilter: 'blur(12px)', zIndex: 40 }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard"
            className="w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all"
            style={{ background: 'rgba(86,96,112,0.2)', color: '#8a9ab0' }}>
            ←
          </Link>
          <div className="flex items-center gap-2">
            {subject && (
              <span className="text-xs px-2 py-0.5 rounded-full hidden sm:inline"
                    style={{ background: `${subject.color}20`, color: subject.color, border: `1px solid ${subject.color}40` }}>
                {subject.icon} {subject.name}
              </span>
            )}
            <h1 className="text-sm font-semibold" style={{ fontFamily: 'Syne', color: '#faf7f0' }}>
              {exercise.title}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {savedAt && <span className="text-xs hidden sm:block" style={{ color: '#4a5568' }}>✓ {savedAt}</span>}

          {/* Student selector — prof only */}
          {isAdmin && students.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs hidden sm:block" style={{ color: '#566070' }}>Élève :</span>
              <select value={selectedStudent || ''} onChange={e => setSelectedStudent(e.target.value)}
                className="px-3 py-1.5 rounded-xl text-xs outline-none"
                style={{ background: 'rgba(42,49,64,0.9)', border: '1px solid rgba(232,160,48,0.3)', color: '#fbbf24', fontFamily: 'Syne' }}>
                {students.map(s => (
                  <option key={s.id} value={s.id}>{s.full_name || s.email}</option>
                ))}
              </select>
            </div>
          )}

          {isAdmin && students.length === 0 && (
            <span className="text-xs px-3 py-1.5 rounded-xl" style={{ background: 'rgba(86,96,112,0.2)', color: '#566070' }}>
              Aucun élève associé
            </span>
          )}

          {/* Role badge */}
          <div className="px-3 py-1.5 rounded-full text-xs font-semibold"
               style={{
                 background: isAdmin ? 'rgba(48,96,192,0.2)' : 'rgba(232,160,48,0.15)',
                 color: isAdmin ? '#93c5fd' : '#fbbf24',
                 border: `1px solid ${isAdmin ? 'rgba(48,96,192,0.4)' : 'rgba(232,160,48,0.3)'}`,
                 fontFamily: 'Syne',
               }}>
            {isAdmin ? '👩‍🏫 Prof' : '🎓 Élève'}
          </div>

          {/* Voice toggle */}
          <button onClick={() => setVoiceOpen(!voiceOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: voiceOpen ? 'rgba(232,160,48,0.2)' : 'rgba(86,96,112,0.2)',
              border: `1px solid ${voiceOpen ? 'rgba(232,160,48,0.5)' : 'rgba(86,96,112,0.3)'}`,
              color: voiceOpen ? '#fbbf24' : '#8a9ab0',
              fontFamily: 'Syne',
            }}>
            <span className={isRecording ? 'recording-pulse inline-block' : ''}>🎤</span>
            <span className="hidden sm:inline">Vocal</span>
            {voices.length > 0 && (
              <span className="w-4 h-4 rounded-full text-xs flex items-center justify-center"
                    style={{ background: '#e8a030', color: '#0f0e0b', fontWeight: 700 }}>
                {voices.length}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Consigne */}
      {exercise.description && (
        <div className="px-4 py-2 text-xs flex-shrink-0"
             style={{ background: 'rgba(232,160,48,0.07)', borderBottom: '1px solid rgba(232,160,48,0.15)', color: '#b08030' }}>
          📋 <strong>Consigne :</strong> {exercise.description}
        </div>
      )}

      {/* ── MAIN WORKSPACE ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Énoncé */}
        <div className="flex-1 flex flex-col min-w-0" style={{ borderRight: '2px solid rgba(86,96,112,0.25)' }}>
          <div className="flex items-center justify-between px-4 py-1.5 flex-shrink-0"
               style={{ background: 'rgba(20,28,42,0.85)', borderBottom: '1px solid rgba(86,96,112,0.2)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#3b82f6' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#93c5fd', fontFamily: 'Syne' }}>
                {isAdmin ? '✍️ Énoncé (Prof)' : '📖 Énoncé'}
              </span>
            </div>
            {(exercise.pdf_url || exercise.image_url) && (
              <div className="flex gap-1">
                {(['canvas', 'file'] as const).map(v => (
                  <button key={v} onClick={() => setLeftMode(v)}
                    className="text-xs px-2 py-1 rounded transition-all"
                    style={{ background: leftMode === v ? 'rgba(59,130,246,0.2)' : 'transparent', color: leftMode === v ? '#93c5fd' : '#566070', border: leftMode === v ? '1px solid rgba(59,130,246,0.3)' : '1px solid transparent' }}>
                    {v === 'canvas' ? 'Dessin' : 'Fichier'}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex-1 overflow-hidden">
            {leftMode === 'file' && (exercise.pdf_url || exercise.image_url) ? (
              <div className="w-full h-full" style={{ background: '#fdfaf3' }}>
                {exercise.pdf_url
                  ? <iframe src={exercise.pdf_url} className="w-full h-full" title="PDF" />
                  : <img src={exercise.image_url!} alt="Énoncé" className="w-full h-full object-contain" />
                }
              </div>
            ) : (
              <Canvas
                exerciseId={exerciseId}
                userId={profile.id}
                panel="left"
                readonly={!isAdmin}
                isProf={isAdmin}
                bgImageUrl={exercise.image_url || undefined}
                onSaved={() => setSavedAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))}
              />
            )}
          </div>
        </div>

        {/* RIGHT — Travail élève */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between px-4 py-1.5 flex-shrink-0"
               style={{ background: 'rgba(20,28,42,0.85)', borderBottom: '1px solid rgba(86,96,112,0.2)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: '#e8a030' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#fbbf24', fontFamily: 'Syne' }}>
                {isAdmin
                  ? `🔴 Travail de ${students.find(s => s.id === selectedStudent)?.full_name || 'l\'élève'}`
                  : '✏️ Mon espace de travail'}
              </span>
            </div>
            {isAdmin && (
              <span className="text-xs px-2 py-1 rounded"
                    style={{ background: 'rgba(239,68,68,0.12)', color: '#fca5a5', border: '1px solid rgba(239,68,68,0.25)' }}>
                Annotations en rouge
              </span>
            )}
          </div>

          <div className="flex-1 overflow-hidden relative">
            {/* Travail de l'élève — toujours visible */}
            <Canvas
              key={`student-${rightUserId}`}
              exerciseId={exerciseId}
              userId={rightUserId}
              panel="right"
              readonly={!isAdmin ? false : true}
              isProf={false}
              onSaved={() => setSavedAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))}
            />
            {/* Annotations du prof par-dessus (calque rouge) */}
            {isAdmin && (
              <div className="absolute inset-0">
                <Canvas
                  key={`prof-annot-${rightUserId}`}
                  exerciseId={exerciseId}
                  userId={profile.id}
                  panel="right"
                  readonly={false}
                  isProf={true}
                  onSaved={() => setSavedAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))}
                />
              </div>
            )}
          </div>
        </div>

        {/* VOICE PANEL */}
        {voiceOpen && (
          <div className="w-72 flex-shrink-0 flex flex-col animate-in"
               style={{ background: 'rgba(10,12,18,0.95)', borderLeft: '1px solid rgba(86,96,112,0.25)' }}>
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                 style={{ borderBottom: '1px solid rgba(86,96,112,0.2)' }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8a9ab0', fontFamily: 'Syne' }}>
                🎤 Messages vocaux
              </span>
              <button onClick={() => setVoiceOpen(false)} style={{ color: '#566070' }}>✕</button>
            </div>

            {/* Messages list */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {voices.length === 0 && (
                <div className="text-center py-8 text-xs" style={{ color: '#4a5568' }}>
                  Aucun message vocal pour cet exercice.
                </div>
              )}
              {voices.map(msg => {
                const isExpl = msg.role_type === 'prof_explanation'
                const isOwn  = msg.user_id === profile.id
                return (
                  <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-xs rounded-2xl px-4 py-3 ${isExpl ? 'bubble-prof' : 'bubble-student'}`}>
                      <div className="text-xs font-semibold mb-2" style={{ color: isExpl ? '#93c5fd' : '#fbbf24', fontFamily: 'Syne' }}>
                        {isExpl ? '👩‍🏫 Explication Prof' : '🎓 Question Élève'}
                      </div>
                      <div className="flex items-center gap-2">
                        <button onClick={() => togglePlay(msg)}
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ background: isExpl ? 'rgba(48,96,192,0.4)' : 'rgba(232,160,48,0.3)', border: `1px solid ${isExpl ? 'rgba(48,96,192,0.6)' : 'rgba(232,160,48,0.5)'}` }}>
                          {playing === msg.id ? '⏸' : '▶️'}
                        </button>
                        <div className="flex-1">
                          <div className="flex items-end gap-0.5 h-6">
                            {[...Array(14)].map((_, i) => (
                              <div key={i} className="flex-1 rounded-full"
                                   style={{ height: `${Math.random() * 20 + 4}px`, background: isExpl ? 'rgba(147,197,253,0.35)' : 'rgba(251,191,36,0.35)' }} />
                            ))}
                          </div>
                          <div className="text-xs mt-1" style={{ color: '#566070' }}>
                            {msg.duration ? fmt(msg.duration) : '—'} · {new Date(msg.created_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      </div>
                      <audio ref={el => { if (el) audioRefs.current[msg.id] = el }}
                        src={msg.audio_url} onEnded={() => setPlaying(null)} className="hidden" />
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Record button */}
            <div className="p-3 flex-shrink-0" style={{ borderTop: '1px solid rgba(86,96,112,0.2)' }}>
              {isRecording ? (
                <div className="flex items-center gap-3">
                  <div className="flex-1 flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full recording-pulse" style={{ background: '#ef4444' }} />
                    <span className="text-sm font-mono" style={{ color: '#f08080' }}>{fmt(recTime)}</span>
                  </div>
                  <button onClick={stopRecording}
                    className="px-4 py-2 rounded-xl text-xs font-semibold"
                    style={{ background: 'rgba(217,64,64,0.2)', color: '#f08080', border: '1px solid rgba(217,64,64,0.4)', fontFamily: 'Syne' }}>
                    ⏹ Stop
                  </button>
                </div>
              ) : (
                <button onClick={startRecording} disabled={uploading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{
                    background: isAdmin ? 'rgba(48,96,192,0.15)' : 'rgba(232,160,48,0.12)',
                    border: `1px solid ${isAdmin ? 'rgba(48,96,192,0.4)' : 'rgba(232,160,48,0.3)'}`,
                    color: isAdmin ? '#93c5fd' : '#fbbf24',
                    fontFamily: 'Syne',
                  }}>
                  🎤 {uploading ? 'Envoi...' : isAdmin ? 'Enregistrer une explication' : 'Poser une question'}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-1.5 flex-shrink-0 text-xs"
           style={{ background: 'rgba(10,12,18,0.85)', borderTop: '1px solid rgba(86,96,112,0.15)', color: '#3d4a5c' }}>
        <span>{exercise.title}</span>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
          <span>Sauvegarde manuelle — cliquez 💾 dans la barre d'outils</span>
        </div>
      </div>
    </div>
  )
}
