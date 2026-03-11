'use client'
// app/exercise/[id]/page.tsx — Collaborative dual-panel workspace
import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Profile, Exercise } from '@/lib/supabase'
import Canvas from '@/components/Canvas'
import VoiceRecorder from '@/components/VoiceRecorder'

export default function ExercisePage({ params }: { params: { id: string } }) {
  const exerciseId = params.id
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [subject, setSubject] = useState<{ name: string; icon: string; color: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [sidePanel, setSidePanel] = useState<'voice' | null>(null)
  const [savedAt, setSavedAt] = useState<string | null>(null)
  const [leftPanel, setLeftPanel] = useState<'canvas' | 'pdf'>('canvas')

  useEffect(() => { init() }, [exerciseId])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const [{ data: prof }, { data: ex }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('exercises').select('*, subjects(name, icon, color)').eq('id', exerciseId).single(),
    ])
    if (!prof?.is_approved) { router.push('/'); return }
    setProfile(prof as Profile)
    setExercise(ex as Exercise)
    setSubject((ex as any)?.subjects || null)
    if (ex?.pdf_url || ex?.image_url) setLeftPanel('pdf')
    setLoading(false)
  }

  function handleSaved() {
    setSavedAt(new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
  }

  if (loading) {
    return (
      <div className="grid-bg min-h-screen flex items-center justify-center">
        <div className="text-sm animate-in" style={{ color: '#8a9ab0' }}>Chargement de l'exercice...</div>
      </div>
    )
  }

  if (!exercise || !profile) return null

  const isAdmin = profile.role === 'admin'

  return (
    <div className="grid-bg min-h-screen flex flex-col" style={{ height: '100vh', overflow: 'hidden' }}>
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ background: 'rgba(15,14,11,0.9)', borderBottom: '1px solid rgba(86,96,112,0.25)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <Link href="/dashboard"
            className="w-8 h-8 flex items-center justify-center rounded-lg transition-all text-sm"
            style={{ background: 'rgba(86,96,112,0.2)', color: '#8a9ab0' }}>
            ←
          </Link>
          <div>
            <div className="flex items-center gap-2">
              {subject && (
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${subject.color}20`, color: subject.color, border: `1px solid ${subject.color}40` }}>
                  {subject.icon} {subject.name}
                </span>
              )}
              <h1 className="text-sm font-semibold" style={{ fontFamily: 'Syne', color: '#faf7f0' }}>
                {exercise.title}
              </h1>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {savedAt && (
            <span className="text-xs hidden sm:block" style={{ color: '#566070' }}>
              ✓ Sauvegardé à {savedAt}
            </span>
          )}

          {/* Role badge */}
          <div className={`px-3 py-1.5 rounded-full text-xs font-semibold`}
               style={{
                 background: isAdmin ? 'rgba(48,96,192,0.2)' : 'rgba(232,160,48,0.15)',
                 color: isAdmin ? '#93c5fd' : '#fbbf24',
                 border: `1px solid ${isAdmin ? 'rgba(48,96,192,0.4)' : 'rgba(232,160,48,0.3)'}`,
                 fontFamily: 'Syne',
               }}>
            {isAdmin ? '👩‍🏫 Mode correction' : '🎓 Mon espace'}
          </div>

          {/* Voice toggle */}
          <button
            onClick={() => setSidePanel(sidePanel === 'voice' ? null : 'voice')}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: sidePanel === 'voice' ? (isAdmin ? 'rgba(48,96,192,0.3)' : 'rgba(232,160,48,0.25)') : 'rgba(86,96,112,0.2)',
              border: `1px solid ${sidePanel === 'voice' ? (isAdmin ? 'rgba(48,96,192,0.5)' : 'rgba(232,160,48,0.4)') : 'rgba(86,96,112,0.3)'}`,
              color: sidePanel === 'voice' ? (isAdmin ? '#93c5fd' : '#fbbf24') : '#8a9ab0',
              fontFamily: 'Syne',
            }}>
            <span className={sidePanel === 'voice' ? 'recording-pulse inline-block' : ''}>🎤</span>
            Vocal
          </button>
        </div>
      </header>

      {/* Info banner for student */}
      {!isAdmin && exercise.description && (
        <div className="px-4 py-2.5 text-xs flex-shrink-0"
             style={{ background: 'rgba(232,160,48,0.08)', borderBottom: '1px solid rgba(232,160,48,0.15)', color: '#c09040' }}>
          📋 <strong>Consigne :</strong> {exercise.description}
        </div>
      )}

      {/* Main workspace */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL — Énoncé du prof */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden"
             style={{ borderRight: '2px solid rgba(86,96,112,0.3)' }}>
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2 flex-shrink-0"
               style={{ background: 'rgba(30,40,55,0.8)', borderBottom: '1px solid rgba(86,96,112,0.2)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#3b82f6' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#93c5fd', fontFamily: 'Syne' }}>
                {isAdmin ? '✍️ Énoncé (zone Prof)' : '📖 Énoncé'}
              </span>
            </div>
            {(exercise.pdf_url || exercise.image_url) && (
              <div className="flex gap-1">
                {(['canvas', 'pdf'] as const).map(v => (
                  <button key={v} onClick={() => setLeftPanel(v)}
                    className="text-xs px-2 py-1 rounded-lg transition-all"
                    style={{
                      background: leftPanel === v ? 'rgba(59,130,246,0.25)' : 'transparent',
                      color: leftPanel === v ? '#93c5fd' : '#566070',
                      border: leftPanel === v ? '1px solid rgba(59,130,246,0.4)' : '1px solid transparent',
                    }}>
                    {v === 'canvas' ? 'Dessin' : 'Fichier'}
                  </button>
                ))}
              </div>
            )}
            {!isAdmin && (
              <span className="text-xs px-2 py-1 rounded-full" style={{ background: 'rgba(59,130,246,0.1)', color: '#60a5fa', border: '1px solid rgba(59,130,246,0.2)' }}>
                Lecture seule
              </span>
            )}
          </div>

          {/* Left panel content */}
          <div className="flex-1 overflow-hidden">
            {leftPanel === 'pdf' && (exercise.pdf_url || exercise.image_url) ? (
              <div className="w-full h-full relative">
                {exercise.pdf_url ? (
                  <iframe src={exercise.pdf_url} className="w-full h-full" title="Énoncé PDF" />
                ) : (
                  <img src={exercise.image_url!} alt="Énoncé" className="w-full h-full object-contain" style={{ background: '#fdfaf3' }} />
                )}
                {/* Prof can also draw on top */}
                {isAdmin && (
                  <div className="absolute inset-0">
                    <Canvas
                      exerciseId={exerciseId}
                      userId={profile.id}
                      panel="left"
                      isProf={true}
                      onStrokeSaved={handleSaved}
                    />
                  </div>
                )}
              </div>
            ) : (
              <Canvas
                exerciseId={exerciseId}
                userId={profile.id}
                panel="left"
                readonly={!isAdmin}
                isProf={isAdmin}
                bgImageUrl={exercise.image_url || undefined}
                onStrokeSaved={handleSaved}
              />
            )}
          </div>
        </div>

        {/* RIGHT PANEL — Espace travail élève */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2 flex-shrink-0"
               style={{ background: 'rgba(30,40,55,0.8)', borderBottom: '1px solid rgba(86,96,112,0.2)' }}>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: '#e8a030' }} />
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#fbbf24', fontFamily: 'Syne' }}>
                {isAdmin ? '🔴 Correction (annotations rouges)' : '✏️ Mon travail'}
              </span>
            </div>
            {isAdmin && (
              <span className="text-xs px-2 py-1 rounded-full"
                    style={{ background: 'rgba(217,64,64,0.15)', color: '#f08080', border: '1px solid rgba(217,64,64,0.3)' }}>
                Mode correction actif
              </span>
            )}
          </div>

          {/* Right canvas — student draws, prof annotates in red */}
          <div className="flex-1 overflow-hidden">
            <Canvas
              exerciseId={exerciseId}
              userId={profile.id}
              panel="right"
              readonly={isAdmin ? false : false}  // student draws, prof annotates
              isProf={isAdmin}
              onStrokeSaved={handleSaved}
            />
          </div>
        </div>

        {/* VOICE PANEL — slide-in */}
        {sidePanel === 'voice' && (
          <div className="w-72 flex-shrink-0 flex flex-col animate-in"
               style={{ background: 'rgba(15,14,11,0.9)', borderLeft: '1px solid rgba(86,96,112,0.3)' }}>
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
                 style={{ borderBottom: '1px solid rgba(86,96,112,0.2)' }}>
              <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#8a9ab0', fontFamily: 'Syne' }}>
                🎤 Messages vocaux
              </span>
              <button onClick={() => setSidePanel(null)}
                className="w-6 h-6 flex items-center justify-center rounded text-sm transition-all"
                style={{ color: '#566070' }}>✕</button>
            </div>
            <div className="flex-1 overflow-hidden">
              <VoiceRecorder
                exerciseId={exerciseId}
                userId={profile.id}
                roleType={isAdmin ? 'prof_explanation' : 'student_question'}
                isProf={isAdmin}
              />
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 flex-shrink-0 text-xs"
           style={{ background: 'rgba(15,14,11,0.8)', borderTop: '1px solid rgba(86,96,112,0.15)', color: '#566070' }}>
        <div className="flex items-center gap-4">
          <span>Exercice : <strong style={{ color: '#8a9ab0' }}>{exercise.title}</strong></span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#10b981' }} />
          <span>Sauvegarde automatique activée</span>
        </div>
      </div>
    </div>
  )
}
