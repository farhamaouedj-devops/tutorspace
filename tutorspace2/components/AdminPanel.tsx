'use client'
// components/AdminPanel.tsx
import { useState, useEffect } from 'react'
import { supabase, Profile } from '@/lib/supabase'

export default function AdminPanel() {
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([])
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [tab, setTab] = useState<'pending' | 'all' | 'exercises'>('pending')
  const [loading, setLoading] = useState(true)
  const [myProfCode, setMyProfCode] = useState('')
  const [newExercise, setNewExercise] = useState({ title: '', subject_id: '', description: '' })
  const [subjects, setSubjects] = useState<{ id: string; name: string; icon: string }[]>([])
  const [exercises, setExercises] = useState<any[]>([])
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()

    const [{ data: pending }, { data: all }, { data: subs }, { data: exos }, { data: myProfile }] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_approved', false).neq('email', 'farha.maouedj@proton.me').order('created_at'),
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('subjects').select('*'),
      supabase.from('exercises').select('*, subjects(name, icon)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('prof_code').eq('id', user?.id ?? '').single(),
    ])
    setPendingUsers(pending || [])
    setAllUsers(all || [])
    setSubjects(subs || [])
    setExercises(exos || [])
    setMyProfCode(myProfile?.prof_code || '')
    setLoading(false)
  }

  async function approveUser(userId: string) {
    await supabase.from('profiles').update({ is_approved: true }).eq('id', userId)
    await loadData()
  }

  async function revokeUser(userId: string) {
    await supabase.from('profiles').update({ is_approved: false }).eq('id', userId)
    await loadData()
  }

  async function createExercise() {
    if (!newExercise.title || !newExercise.subject_id) return
    setCreating(true)
    setCreateError('')

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      let imageUrl: string | null = null
      let pdfUrl: string | null = null

      if (uploadFile) {
        const ext = uploadFile.name.split('.').pop()
        const path = `exercises/${Date.now()}.${ext}`
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('exercise-files')
          .upload(path, uploadFile)

        if (uploadError) throw new Error('Erreur upload: ' + uploadError.message)

        const { data: { publicUrl } } = supabase.storage.from('exercise-files').getPublicUrl(path)
        if (uploadFile.type === 'application/pdf') pdfUrl = publicUrl
        else imageUrl = publicUrl
      }

      const { error: insertError } = await supabase.from('exercises').insert({
        title: newExercise.title,
        subject_id: newExercise.subject_id,
        description: newExercise.description || null,
        created_by: user.id,
        image_url: imageUrl,
        pdf_url: pdfUrl,
        is_active: true,
      })

      if (insertError) throw new Error('Erreur création: ' + insertError.message)

      setNewExercise({ title: '', subject_id: '', description: '' })
      setUploadFile(null)
      await loadData()
    } catch (err: any) {
      setCreateError(err.message || 'Erreur inconnue')
    }
    setCreating(false)
  }

  async function deleteExercise(id: string) {
    if (!confirm('Supprimer cet exercice ?')) return
    await supabase.from('exercises').delete().eq('id', id)
    await loadData()
  }

  function copyCode() {
    navigator.clipboard.writeText(myProfCode)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-sm" style={{ color: '#8a9ab0' }}>Chargement...</div>
    </div>
  )

  return (
    <div className="space-y-6">

      {/* MON CODE PROF */}
      <section className="p-5 rounded-2xl"
               style={{ background: 'linear-gradient(135deg, rgba(48,96,192,0.15), rgba(48,96,192,0.08))', border: '1px solid rgba(48,96,192,0.3)' }}>
        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2" style={{ fontFamily: 'Syne', color: '#93c5fd' }}>
          🔑 Mon code professeur
        </h3>
        <p className="text-xs mb-3" style={{ color: '#8a9ab0' }}>
          Donnez ce code à vos élèves pour qu'ils puissent s'inscrire et vous rejoindre.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 px-4 py-3 rounded-xl font-mono text-lg font-bold tracking-widest text-center"
               style={{ background: 'rgba(15,14,11,0.6)', color: '#fbbf24', border: '1px solid rgba(232,160,48,0.4)', letterSpacing: '0.2em' }}>
            {myProfCode || '—'}
          </div>
          <button onClick={copyCode}
            className="px-4 py-3 rounded-xl text-sm font-semibold transition-all"
            style={{ background: 'rgba(48,96,192,0.2)', color: '#93c5fd', border: '1px solid rgba(48,96,192,0.4)', fontFamily: 'Syne' }}>
            📋 Copier
          </button>
        </div>
      </section>

      {/* TABS */}
      <div className="flex gap-2">
        {[
          { key: 'pending', label: `En attente (${pendingUsers.length})` },
          { key: 'all', label: `Tous les comptes (${allUsers.length})` },
          { key: 'exercises', label: `Exercices (${exercises.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
            style={{
              background: tab === t.key ? 'rgba(232,160,48,0.25)' : 'rgba(86,96,112,0.15)',
              border: `1px solid ${tab === t.key ? 'rgba(232,160,48,0.5)' : 'rgba(86,96,112,0.3)'}`,
              color: tab === t.key ? '#fbbf24' : '#8a9ab0',
              fontFamily: 'Syne',
            }}>
            {t.label}
            {t.key === 'pending' && pendingUsers.length > 0 && (
              <span className="ml-2 inline-flex w-4 h-4 rounded-full items-center justify-center text-xs"
                    style={{ background: '#e8a030', color: '#0f0e0b' }}>
                {pendingUsers.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* PENDING / ALL USERS */}
      {(tab === 'pending' || tab === 'all') && (
        <div className="space-y-2">
          {(tab === 'pending' ? pendingUsers : allUsers).map(user => (
            <div key={user.id} className="flex items-center justify-between p-4 rounded-xl"
                 style={{ background: 'rgba(42,49,64,0.6)', border: '1px solid rgba(86,96,112,0.2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                     style={{ background: user.role === 'admin' ? 'rgba(48,96,192,0.3)' : 'rgba(232,160,48,0.2)', color: user.role === 'admin' ? '#93c5fd' : '#fbbf24', fontFamily: 'Syne' }}>
                  {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">{user.full_name || 'Nom non renseigné'}</div>
                  <div className="text-xs" style={{ color: '#8a9ab0' }}>{user.email}</div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs ${user.is_approved ? 'badge-approved' : 'badge-pending'}`}>
                  {user.role === 'admin' ? '👩‍🏫 Prof' : user.is_approved ? '✓ Actif' : '⏳ Attente'}
                </span>
                {user.role !== 'admin' || user.email !== 'farha.maouedj@proton.me' ? (
                  user.is_approved
                    ? <button onClick={() => revokeUser(user.id)}
                        className="text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: 'rgba(217,64,64,0.15)', color: '#f08080', border: '1px solid rgba(217,64,64,0.3)' }}>
                        Révoquer
                      </button>
                    : <button onClick={() => approveUser(user.id)}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                        style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee090', border: '1px solid rgba(16,185,129,0.4)', fontFamily: 'Syne' }}>
                        ✓ Valider
                      </button>
                ) : null}
              </div>
            </div>
          ))}
          {tab === 'pending' && pendingUsers.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: '#566070' }}>
              Aucun compte en attente. ✓
            </div>
          )}
        </div>
      )}

      {/* EXERCISES TAB */}
      {tab === 'exercises' && (
        <div className="space-y-6">
          {/* Créer un exercice */}
          <div className="p-5 rounded-2xl space-y-4"
               style={{ background: 'rgba(42,49,64,0.5)', border: '1px solid rgba(86,96,112,0.2)' }}>
            <h4 className="text-sm font-semibold" style={{ fontFamily: 'Syne', color: '#faf7f0' }}>
              ➕ Créer un exercice
            </h4>

            {createError && (
              <div className="p-3 rounded-lg text-sm"
                   style={{ background: 'rgba(217,64,64,0.15)', border: '1px solid rgba(217,64,64,0.4)', color: '#f08080' }}>
                {createError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
                  Titre *
                </label>
                <input value={newExercise.title}
                  onChange={e => setNewExercise(p => ({ ...p, title: e.target.value }))}
                  placeholder="Ex : Fractions — Niveau 6e"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(15,14,11,0.6)', border: '1px solid rgba(86,96,112,0.5)', color: '#faf7f0' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
                  Matière *
                </label>
                <select value={newExercise.subject_id}
                  onChange={e => setNewExercise(p => ({ ...p, subject_id: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(15,14,11,0.8)', border: '1px solid rgba(86,96,112,0.5)', color: newExercise.subject_id ? '#faf7f0' : '#566070' }}>
                  <option value="">-- Choisir --</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
                Consigne
              </label>
              <textarea value={newExercise.description}
                onChange={e => setNewExercise(p => ({ ...p, description: e.target.value }))}
                rows={2} placeholder="Instructions pour l'élève..."
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'rgba(15,14,11,0.6)', border: '1px solid rgba(86,96,112,0.5)', color: '#faf7f0' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
                Fichier (PDF ou Image) — optionnel
              </label>
              <input type="file" accept=".pdf,image/*"
                onChange={e => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-sm" style={{ color: '#8a9ab0' }} />
            </div>
            <button onClick={createExercise}
              disabled={creating || !newExercise.title || !newExercise.subject_id}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: (creating || !newExercise.title || !newExercise.subject_id) ? 'rgba(232,160,48,0.3)' : 'linear-gradient(135deg, #e8a030, #b87a18)',
                color: '#0f0e0b', fontFamily: 'Syne',
                cursor: (creating || !newExercise.title || !newExercise.subject_id) ? 'not-allowed' : 'pointer'
              }}>
              {creating ? 'Création en cours...' : '+ Créer l\'exercice'}
            </button>
          </div>

          {/* Liste exercices */}
          <div className="space-y-2">
            {exercises.length === 0 && (
              <div className="text-center py-8 text-sm" style={{ color: '#566070' }}>
                Aucun exercice créé pour l'instant.
              </div>
            )}
            {exercises.map(ex => (
              <div key={ex.id} className="flex items-center justify-between p-3 rounded-xl"
                   style={{ background: 'rgba(42,49,64,0.5)', border: '1px solid rgba(86,96,112,0.2)' }}>
                <div>
                  <div className="text-sm font-medium">{ex.subjects?.icon} {ex.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#8a9ab0' }}>
                    {ex.subjects?.name} · {new Date(ex.created_at).toLocaleDateString('fr-FR')}
                    {ex.pdf_url && ' · 📄 PDF'}
                    {ex.image_url && ' · 🖼️ Image'}
                  </div>
                </div>
                <button onClick={() => deleteExercise(ex.id)}
                  className="text-xs px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(217,64,64,0.1)', color: '#f08080', border: '1px solid rgba(217,64,64,0.2)' }}>
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
