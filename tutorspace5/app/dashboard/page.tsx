'use client'
// app/dashboard/page.tsx
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase, Profile, Subject, Exercise } from '@/lib/supabase'
import AdminPanel from '@/components/AdminPanel'

type Tab = 'subjects' | 'admin'

export default function DashboardPage() {
  const router = useRouter()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<Tab>('subjects')
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/'); return }

    const [{ data: prof }, { data: subs }, { data: pending }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase.from('subjects').select('*'),
      supabase.from('profiles').select('id').eq('is_approved', false).eq('role', 'student'),
    ])
    if (!prof?.is_approved) { await supabase.auth.signOut(); router.push('/'); return }
    setProfile(prof as Profile)
    setSubjects(subs || [])
    setPendingCount(pending?.length || 0)
    setLoading(false)
  }

  useEffect(() => {
    if (selectedSubject) loadExercises()
  }, [selectedSubject])

  async function loadExercises() {
    const { data } = await supabase
      .from('exercises')
      .select('*')
      .eq('subject_id', selectedSubject)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
    setExercises(data || [])
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/')
  }

  if (loading) {
    return (
      <div className="grid-bg min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 rounded-2xl mx-auto mb-4 pulse-glow"
               style={{ background: 'linear-gradient(135deg, #e8a030, #b87a18)' }} />
          <div className="text-sm" style={{ color: '#8a9ab0' }}>Chargement...</div>
        </div>
      </div>
    )
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="grid-bg min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 flex items-center justify-between px-6 py-4"
              style={{ background: 'rgba(15,14,11,0.85)', borderBottom: '1px solid rgba(232,160,48,0.15)', backdropFilter: 'blur(12px)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-lg"
               style={{ background: 'linear-gradient(135deg, #e8a030, #b87a18)' }}>
            📐
          </div>
          <h1 className="text-lg font-display font-bold" style={{ fontFamily: 'Syne', fontWeight: 800 }}>
            TutorSpace
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Role badge */}
          <div className="px-3 py-1.5 rounded-full text-xs font-semibold hidden sm:block"
               style={{
                 background: isAdmin ? 'rgba(48,96,192,0.2)' : 'rgba(232,160,48,0.15)',
                 color: isAdmin ? '#93c5fd' : '#fbbf24',
                 border: `1px solid ${isAdmin ? 'rgba(48,96,192,0.4)' : 'rgba(232,160,48,0.3)'}`,
                 fontFamily: 'Syne',
               }}>
            {isAdmin ? '👩‍🏫 Professeur' : '🎓 Élève'}
          </div>
          {/* Avatar */}
          <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
               style={{ background: 'rgba(232,160,48,0.2)', color: '#fbbf24', fontFamily: 'Syne' }}>
            {profile?.full_name?.[0]?.toUpperCase() || profile?.email?.[0]?.toUpperCase()}
          </div>
          <span className="text-sm hidden md:block" style={{ color: '#c0ccd8' }}>
            {profile?.full_name || profile?.email}
          </span>
          <button onClick={logout}
            className="text-xs px-3 py-1.5 rounded-lg transition-all hover-underline"
            style={{ color: '#8a9ab0' }}>
            Déconnexion
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-56 flex-shrink-0 flex flex-col overflow-y-auto"
               style={{ background: 'rgba(15,14,11,0.6)', borderRight: '1px solid rgba(86,96,112,0.2)' }}>
          <nav className="p-4 space-y-1">
            <button
              onClick={() => { setActiveTab('subjects'); setSelectedSubject(null) }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all ${activeTab === 'subjects' && !selectedSubject ? 'font-semibold' : ''}`}
              style={{
                background: activeTab === 'subjects' && !selectedSubject ? 'rgba(232,160,48,0.15)' : 'transparent',
                color: activeTab === 'subjects' && !selectedSubject ? '#fbbf24' : '#8a9ab0',
              }}>
              <span>🏠</span> Accueil
            </button>

            <div className="pt-3 pb-1 px-3">
              <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#566070' }}>
                Matières
              </span>
            </div>

            {subjects.map(sub => (
              <button key={sub.id}
                onClick={() => { setSelectedSubject(sub.id); setActiveTab('subjects') }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all"
                style={{
                  background: selectedSubject === sub.id ? `${sub.color}20` : 'transparent',
                  color: selectedSubject === sub.id ? sub.color : '#8a9ab0',
                  border: selectedSubject === sub.id ? `1px solid ${sub.color}40` : '1px solid transparent',
                }}>
                <span>{sub.icon}</span> {sub.name}
              </button>
            ))}

            {/* Admin tab */}
            {isAdmin && (
              <>
                <div className="pt-3 pb-1 px-3">
                  <span className="text-xs uppercase tracking-wider font-semibold" style={{ color: '#566070' }}>
                    Administration
                  </span>
                </div>
                <button
                  onClick={() => setActiveTab('admin')}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-left transition-all"
                  style={{
                    background: activeTab === 'admin' ? 'rgba(48,96,192,0.15)' : 'transparent',
                    color: activeTab === 'admin' ? '#93c5fd' : '#8a9ab0',
                    border: activeTab === 'admin' ? '1px solid rgba(48,96,192,0.3)' : '1px solid transparent',
                  }}>
                  <span>⚙️</span>
                  <span>ADMIN</span>
                  {pendingCount > 0 && (
                    <span className="ml-auto w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold"
                          style={{ background: '#e8a030', color: '#0f0e0b' }}>
                      {pendingCount}
                    </span>
                  )}
                </button>
              </>
            )}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* ADMIN TAB */}
          {activeTab === 'admin' && isAdmin && (
            <div className="animate-in">
              <h2 className="text-2xl font-display font-bold mb-6" style={{ fontFamily: 'Syne', fontWeight: 800 }}>
                Panneau Administrateur
              </h2>
              <AdminPanel />
            </div>
          )}

          {/* SUBJECTS TAB — no subject selected */}
          {activeTab === 'subjects' && !selectedSubject && (
            <div className="animate-in">
              <div className="mb-8">
                <h2 className="text-2xl font-display font-bold" style={{ fontFamily: 'Syne', fontWeight: 800 }}>
                  Bonjour, {profile?.full_name?.split(' ')[0] || 'là'} 👋
                </h2>
                <p className="mt-2 text-sm" style={{ color: '#8a9ab0' }}>
                  {isAdmin
                    ? 'Choisissez une matière pour gérer vos exercices, ou accédez au panneau admin.'
                    : 'Choisissez une matière pour voir les exercices disponibles.'}
                </p>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {subjects.map((sub, i) => (
                  <button key={sub.id}
                    onClick={() => setSelectedSubject(sub.id)}
                    className="p-6 rounded-2xl text-left transition-all group animate-in"
                    style={{
                      background: 'rgba(42,49,64,0.6)',
                      border: `1px solid ${sub.color}30`,
                      animationDelay: `${i * 60}ms`,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = `${sub.color}15`)}
                    onMouseLeave={e => (e.currentTarget.style.background = 'rgba(42,49,64,0.6)')}>
                    <div className="text-3xl mb-3">{sub.icon}</div>
                    <div className="font-semibold text-sm" style={{ fontFamily: 'Syne', color: sub.color }}>
                      {sub.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* SUBJECTS TAB — subject selected */}
          {activeTab === 'subjects' && selectedSubject && (
            <div className="animate-in">
              <div className="flex items-center gap-3 mb-6">
                <button onClick={() => setSelectedSubject(null)}
                  className="text-sm transition-all hover-underline" style={{ color: '#8a9ab0' }}>
                  ← Matières
                </button>
                <span style={{ color: '#566070' }}>/</span>
                <h2 className="text-xl font-display font-bold" style={{ fontFamily: 'Syne' }}>
                  {subjects.find(s => s.id === selectedSubject)?.icon}{' '}
                  {subjects.find(s => s.id === selectedSubject)?.name}
                </h2>
              </div>

              {exercises.length === 0 ? (
                <div className="text-center py-16 rounded-2xl"
                     style={{ background: 'rgba(42,49,64,0.4)', border: '1px dashed rgba(86,96,112,0.3)' }}>
                  <div className="text-4xl mb-4">📭</div>
                  <div className="text-sm" style={{ color: '#8a9ab0' }}>
                    {isAdmin
                      ? 'Aucun exercice pour cette matière. Créez-en un dans le panneau Admin.'
                      : 'Aucun exercice disponible pour cette matière pour l\'instant.'}
                  </div>
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {exercises.map((ex, i) => (
                    <Link key={ex.id} href={`/exercise/${ex.id}`}
                      className="p-5 rounded-2xl transition-all group animate-in block"
                      style={{
                        background: 'rgba(42,49,64,0.6)',
                        border: '1px solid rgba(86,96,112,0.2)',
                        animationDelay: `${i * 60}ms`,
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(232,160,48,0.4)'
                        ;(e.currentTarget as HTMLElement).style.background = 'rgba(232,160,48,0.06)'
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(86,96,112,0.2)'
                        ;(e.currentTarget as HTMLElement).style.background = 'rgba(42,49,64,0.6)'
                      }}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-sm mb-1" style={{ fontFamily: 'Syne', color: '#faf7f0' }}>
                            {ex.title}
                          </h3>
                          {ex.description && (
                            <p className="text-xs leading-relaxed" style={{ color: '#8a9ab0' }}>
                              {ex.description.slice(0, 100)}{ex.description.length > 100 ? '…' : ''}
                            </p>
                          )}
                        </div>
                        <span className="text-xl ml-3">
                          {ex.pdf_url ? '📄' : ex.image_url ? '🖼️' : '✏️'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-4">
                        <span className="text-xs" style={{ color: '#566070' }}>
                          {new Date(ex.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                        </span>
                        <span className="text-xs font-semibold" style={{ color: '#e8a030', fontFamily: 'Syne' }}>
                          Ouvrir → 
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
