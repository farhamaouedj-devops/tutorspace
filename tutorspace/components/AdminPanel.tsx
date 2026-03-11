'use client'
// components/AdminPanel.tsx
import { useState, useEffect } from 'react'
import { supabase, Profile } from '@/lib/supabase'

export default function AdminPanel() {
  const [pendingUsers, setPendingUsers] = useState<Profile[]>([])
  const [allUsers, setAllUsers] = useState<Profile[]>([])
  const [tab, setTab] = useState<'pending' | 'all'>('pending')
  const [loading, setLoading] = useState(true)
  const [newExercise, setNewExercise] = useState({ title: '', subject_id: '', description: '' })
  const [subjects, setSubjects] = useState<{ id: string; name: string; icon: string }[]>([])
  const [exercises, setExercises] = useState<any[]>([])
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [creating, setCreating] = useState(false)

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: pending }, { data: all }, { data: subs }, { data: exos }] = await Promise.all([
      supabase.from('profiles').select('*').eq('is_approved', false).eq('role', 'student').order('created_at'),
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('subjects').select('*'),
      supabase.from('exercises').select('*, subjects(name, icon)').order('created_at', { ascending: false }),
    ])
    setPendingUsers(pending || [])
    setAllUsers(all || [])
    setSubjects(subs || [])
    setExercises(exos || [])
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
    const { data: { user } } = await supabase.auth.getUser()
    let imageUrl = null
    let pdfUrl = null

    if (uploadFile) {
      const ext = uploadFile.name.split('.').pop()
      const path = `exercises/${Date.now()}.${ext}`
      const { data } = await supabase.storage.from('exercise-files').upload(path, uploadFile)
      if (data) {
        const { data: { publicUrl } } = supabase.storage.from('exercise-files').getPublicUrl(path)
        if (uploadFile.type === 'application/pdf') pdfUrl = publicUrl
        else imageUrl = publicUrl
      }
    }

    await supabase.from('exercises').insert({
      ...newExercise,
      created_by: user?.id,
      image_url: imageUrl,
      pdf_url: pdfUrl,
    })
    setNewExercise({ title: '', subject_id: '', description: '' })
    setUploadFile(null)
    await loadData()
    setCreating(false)
  }

  async function deleteExercise(id: string) {
    if (!confirm('Supprimer cet exercice ?')) return
    await supabase.from('exercises').delete().eq('id', id)
    await loadData()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-sm" style={{ color: '#8a9ab0' }}>Chargement...</div>
    </div>
  )

  return (
    <div className="space-y-8">
      {/* Users management */}
      <section>
        <h3 className="text-lg font-display font-semibold mb-4 flex items-center gap-2"
            style={{ fontFamily: 'Syne' }}>
          <span>👥</span> Gestion des élèves
          {pendingUsers.length > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-bold"
                  style={{ background: 'rgba(232,160,48,0.3)', color: '#fbbf24', border: '1px solid rgba(232,160,48,0.5)' }}>
              {pendingUsers.length} en attente
            </span>
          )}
        </h3>

        <div className="flex gap-2 mb-4">
          {[{ key: 'pending', label: `En attente (${pendingUsers.length})` }, { key: 'all', label: `Tous (${allUsers.length})` }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{
                background: tab === t.key ? 'rgba(232,160,48,0.25)' : 'rgba(86,96,112,0.15)',
                border: `1px solid ${tab === t.key ? 'rgba(232,160,48,0.5)' : 'rgba(86,96,112,0.3)'}`,
                color: tab === t.key ? '#fbbf24' : '#8a9ab0',
                fontFamily: 'Syne',
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="space-y-2">
          {(tab === 'pending' ? pendingUsers : allUsers).map(user => (
            <div key={user.id} className="flex items-center justify-between p-4 rounded-xl"
                 style={{ background: 'rgba(42,49,64,0.6)', border: '1px solid rgba(86,96,112,0.2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                     style={{ background: 'rgba(232,160,48,0.2)', color: '#fbbf24', fontFamily: 'Syne' }}>
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
                {user.role === 'student' && (
                  user.is_approved
                    ? <button onClick={() => revokeUser(user.id)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-all"
                        style={{ background: 'rgba(217,64,64,0.15)', color: '#f08080', border: '1px solid rgba(217,64,64,0.3)' }}>
                        Révoquer
                      </button>
                    : <button onClick={() => approveUser(user.id)}
                        className="text-xs px-3 py-1.5 rounded-lg transition-all"
                        style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee090', border: '1px solid rgba(16,185,129,0.4)', fontFamily: 'Syne', fontWeight: 600 }}>
                        ✓ Valider
                      </button>
                )}
              </div>
            </div>
          ))}
          {tab === 'pending' && pendingUsers.length === 0 && (
            <div className="text-center py-8 text-sm" style={{ color: '#566070' }}>
              Aucun compte en attente de validation.
            </div>
          )}
        </div>
      </section>

      {/* Create exercise */}
      <section>
        <h3 className="text-lg font-display font-semibold mb-4 flex items-center gap-2" style={{ fontFamily: 'Syne' }}>
          <span>➕</span> Créer un exercice
        </h3>
        <div className="p-5 rounded-2xl space-y-4"
             style={{ background: 'rgba(42,49,64,0.5)', border: '1px solid rgba(86,96,112,0.2)' }}>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
                Titre *
              </label>
              <input value={newExercise.title} onChange={e => setNewExercise(p => ({ ...p, title: e.target.value }))}
                placeholder="Ex : Fractions — Niveau 6e"
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(15,14,11,0.6)', border: '1px solid rgba(86,96,112,0.5)', color: '#faf7f0' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
                Matière *
              </label>
              <select value={newExercise.subject_id} onChange={e => setNewExercise(p => ({ ...p, subject_id: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                style={{ background: 'rgba(15,14,11,0.6)', border: '1px solid rgba(86,96,112,0.5)', color: '#faf7f0' }}>
                <option value="">-- Choisir --</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
              Description
            </label>
            <textarea value={newExercise.description} onChange={e => setNewExercise(p => ({ ...p, description: e.target.value }))}
              rows={2} placeholder="Instructions pour l'élève..."
              className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
              style={{ background: 'rgba(15,14,11,0.6)', border: '1px solid rgba(86,96,112,0.5)', color: '#faf7f0' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
              Fichier (PDF ou Image)
            </label>
            <input type="file" accept=".pdf,image/*"
              onChange={e => setUploadFile(e.target.files?.[0] || null)}
              className="w-full text-sm file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-xs file:font-semibold"
              style={{ color: '#8a9ab0' }} />
          </div>
          <button onClick={createExercise} disabled={creating || !newExercise.title || !newExercise.subject_id}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{ background: creating ? 'rgba(232,160,48,0.3)' : 'linear-gradient(135deg, #e8a030, #b87a18)', color: '#0f0e0b', fontFamily: 'Syne' }}>
            {creating ? 'Création...' : '+ Créer l\'exercice'}
          </button>
        </div>
      </section>

      {/* Exercises list */}
      <section>
        <h3 className="text-lg font-display font-semibold mb-4 flex items-center gap-2" style={{ fontFamily: 'Syne' }}>
          <span>📋</span> Exercices ({exercises.length})
        </h3>
        <div className="space-y-2">
          {exercises.map(ex => (
            <div key={ex.id} className="flex items-center justify-between p-3 rounded-xl"
                 style={{ background: 'rgba(42,49,64,0.5)', border: '1px solid rgba(86,96,112,0.2)' }}>
              <div>
                <div className="text-sm font-medium">{ex.subjects?.icon} {ex.title}</div>
                <div className="text-xs mt-0.5" style={{ color: '#8a9ab0' }}>
                  {ex.subjects?.name} · {new Date(ex.created_at).toLocaleDateString('fr-FR')}
                </div>
              </div>
              <button onClick={() => deleteExercise(ex.id)}
                className="text-xs px-3 py-1.5 rounded-lg transition-all"
                style={{ background: 'rgba(217,64,64,0.1)', color: '#f08080', border: '1px solid rgba(217,64,64,0.2)' }}>
                Supprimer
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
