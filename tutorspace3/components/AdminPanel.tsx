'use client'
// components/AdminPanel.tsx — Création de comptes par l'admin uniquement
import { useState, useEffect } from 'react'
import { supabase, Profile } from '@/lib/supabase'

type NewUserForm = {
  fullName: string
  email: string
  password: string
  role: 'student' | 'admin'
  profId: string  // pour lier un élève à un prof
}

export default function AdminPanel() {
  const [allUsers, setAllUsers] = useState<(Profile & { prof_code?: string })[]>([])
  const [profs, setProfs] = useState<Profile[]>([])
  const [tab, setTab] = useState<'users' | 'create' | 'exercises'>('users')
  const [loading, setLoading] = useState(true)
  const [myProfCode, setMyProfCode] = useState('')
  const [myId, setMyId] = useState('')

  const [form, setForm] = useState<NewUserForm>({
    fullName: '', email: '', password: '', role: 'student', profId: ''
  })
  const [creating, setCreating] = useState(false)
  const [createResult, setCreateResult] = useState<{ success?: string; error?: string; profCode?: string } | null>(null)

  const [newExercise, setNewExercise] = useState({ title: '', subject_id: '', description: '' })
  const [subjects, setSubjects] = useState<{ id: string; name: string; icon: string }[]>([])
  const [exercises, setExercises] = useState<any[]>([])
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [creatingEx, setCreatingEx] = useState(false)
  const [exError, setExError] = useState('')

  useEffect(() => { loadData() }, [])

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    setMyId(user.id)

    const [{ data: all }, { data: subs }, { data: exos }, { data: myProfile }] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at'),
      supabase.from('subjects').select('*'),
      supabase.from('exercises').select('*, subjects(name, icon)').order('created_at', { ascending: false }),
      supabase.from('profiles').select('prof_code').eq('id', user.id).single(),
    ])

    setAllUsers(all || [])
    setProfs((all || []).filter(u => u.role === 'admin'))
    setSubjects(subs || [])
    setExercises(exos || [])
    setMyProfCode(myProfile?.prof_code || '')
    setLoading(false)
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateResult(null)

    try {
      // Récupérer le token de session pour authentifier la requête API
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Session expirée')

      const res = await fetch('/api/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email,
          password: form.password,
          fullName: form.fullName,
          role: form.role,
          callerToken: session.access_token,
        }),
      })

      const result = await res.json()
      if (!res.ok) throw new Error(result.error)

      // Si élève avec un prof sélectionné, créer l'association
      if (form.role === 'student' && form.profId && result.userId) {
        await supabase.from('student_prof').insert({
          student_id: result.userId,
          prof_id: form.profId,
        })
      }

      setCreateResult({
        success: `Compte créé pour ${form.email}`,
        profCode: result.profCode,
      })
      setForm({ fullName: '', email: '', password: '', role: 'student', profId: '' })
      await loadData()
    } catch (err: any) {
      setCreateResult({ error: err.message })
    }
    setCreating(false)
  }

  function generatePassword() {
    const chars = 'abcdefghjkmnpqrstuvwxyz23456789'
    let pwd = ''
    for (let i = 0; i < 10; i++) pwd += chars[Math.floor(Math.random() * chars.length)]
    setForm(p => ({ ...p, password: pwd }))
  }

  async function revokeUser(userId: string) {
    await supabase.from('profiles').update({ is_approved: false }).eq('id', userId)
    await loadData()
  }

  async function approveUser(userId: string) {
    await supabase.from('profiles').update({ is_approved: true }).eq('id', userId)
    await loadData()
  }

  async function createExercise() {
    if (!newExercise.title || !newExercise.subject_id) return
    setCreatingEx(true)
    setExError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Non connecté')

      let imageUrl: string | null = null
      let pdfUrl: string | null = null

      if (uploadFile) {
        const ext = uploadFile.name.split('.').pop()
        const path = `exercises/${Date.now()}.${ext}`
        const { error: uploadError } = await supabase.storage.from('exercise-files').upload(path, uploadFile)
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
      if (insertError) throw new Error(insertError.message)

      setNewExercise({ title: '', subject_id: '', description: '' })
      setUploadFile(null)
      await loadData()
    } catch (err: any) {
      setExError(err.message)
    }
    setCreatingEx(false)
  }

  async function deleteExercise(id: string) {
    if (!confirm('Supprimer cet exercice ?')) return
    await supabase.from('exercises').delete().eq('id', id)
    await loadData()
  }

  function copyCode(text: string) {
    navigator.clipboard.writeText(text)
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="text-sm" style={{ color: '#8a9ab0' }}>Chargement...</div></div>

  return (
    <div className="space-y-6">

      {/* MON CODE PROF */}
      <section className="p-5 rounded-2xl"
               style={{ background: 'linear-gradient(135deg, rgba(48,96,192,0.15), rgba(48,96,192,0.08))', border: '1px solid rgba(48,96,192,0.3)' }}>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-2" style={{ fontFamily: 'Syne', color: '#93c5fd' }}>
          🔑 Mon code professeur
        </h3>
        <p className="text-xs mb-3" style={{ color: '#8a9ab0' }}>
          Ce code sert à lier vos élèves à votre compte lors de la création de leurs comptes.
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 px-4 py-3 rounded-xl font-mono text-xl font-bold tracking-widest text-center"
               style={{ background: 'rgba(15,14,11,0.6)', color: '#fbbf24', border: '1px solid rgba(232,160,48,0.4)' }}>
            {myProfCode || '—'}
          </div>
          <button onClick={() => copyCode(myProfCode)}
            className="px-4 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'rgba(48,96,192,0.2)', color: '#93c5fd', border: '1px solid rgba(48,96,192,0.4)', fontFamily: 'Syne' }}>
            📋 Copier
          </button>
        </div>
      </section>

      {/* TABS */}
      <div className="flex gap-2 flex-wrap">
        {[
          { key: 'users', label: `👥 Comptes (${allUsers.length})` },
          { key: 'create', label: '➕ Créer un compte' },
          { key: 'exercises', label: `📋 Exercices (${exercises.length})` },
        ].map(t => (
          <button key={t.key} onClick={() => { setTab(t.key as any); setCreateResult(null) }}
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

      {/* LISTE DES COMPTES */}
      {tab === 'users' && (
        <div className="space-y-2">
          {allUsers.map(user => (
            <div key={user.id} className="flex items-center justify-between p-4 rounded-xl"
                 style={{ background: 'rgba(42,49,64,0.6)', border: '1px solid rgba(86,96,112,0.2)' }}>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
                     style={{ background: user.role === 'admin' ? 'rgba(48,96,192,0.3)' : 'rgba(232,160,48,0.2)', color: user.role === 'admin' ? '#93c5fd' : '#fbbf24', fontFamily: 'Syne' }}>
                  {user.full_name?.[0]?.toUpperCase() || user.email[0].toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-medium">{user.full_name || 'Sans nom'}</div>
                  <div className="text-xs" style={{ color: '#8a9ab0' }}>{user.email}</div>
                  {user.role === 'admin' && user.prof_code && (
                    <div className="text-xs font-mono mt-0.5" style={{ color: '#fbbf24' }}>
                      Code : {user.prof_code}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-1 rounded-full text-xs ${user.is_approved ? 'badge-approved' : 'badge-pending'}`}>
                  {user.role === 'admin' ? '👩‍🏫 Prof' : user.is_approved ? '✓ Élève actif' : '⏳ Inactif'}
                </span>
                {user.id !== myId && (
                  user.is_approved
                    ? <button onClick={() => revokeUser(user.id)}
                        className="text-xs px-3 py-1.5 rounded-lg"
                        style={{ background: 'rgba(217,64,64,0.15)', color: '#f08080', border: '1px solid rgba(217,64,64,0.3)' }}>
                        Désactiver
                      </button>
                    : <button onClick={() => approveUser(user.id)}
                        className="text-xs px-3 py-1.5 rounded-lg font-semibold"
                        style={{ background: 'rgba(16,185,129,0.2)', color: '#6ee090', border: '1px solid rgba(16,185,129,0.4)' }}>
                        ✓ Activer
                      </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CRÉER UN COMPTE */}
      {tab === 'create' && (
        <div className="p-6 rounded-2xl space-y-5"
             style={{ background: 'rgba(42,49,64,0.5)', border: '1px solid rgba(86,96,112,0.2)' }}>
          <p className="text-xs" style={{ color: '#8a9ab0' }}>
            Le compte est créé immédiatement, sans confirmation email. Transmettez manuellement l'identifiant et le mot de passe à la personne.
          </p>

          {/* Résultat */}
          {createResult?.success && (
            <div className="p-4 rounded-xl space-y-2"
                 style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)' }}>
              <div className="text-sm font-semibold" style={{ color: '#6ee090' }}>✓ {createResult.success}</div>
              {createResult.profCode && (
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs" style={{ color: '#8a9ab0' }}>Code prof généré :</span>
                  <span className="font-mono font-bold text-base px-3 py-1 rounded-lg" style={{ background: 'rgba(232,160,48,0.15)', color: '#fbbf24', border: '1px solid rgba(232,160,48,0.3)' }}>
                    {createResult.profCode}
                  </span>
                  <button onClick={() => copyCode(createResult.profCode!)}
                    className="text-xs px-2 py-1 rounded" style={{ color: '#8a9ab0' }}>📋</button>
                </div>
              )}
            </div>
          )}
          {createResult?.error && (
            <div className="p-3 rounded-lg text-sm"
                 style={{ background: 'rgba(217,64,64,0.15)', border: '1px solid rgba(217,64,64,0.4)', color: '#f08080' }}>
              ✗ {createResult.error}
            </div>
          )}

          <form onSubmit={handleCreateUser} className="space-y-4">
            {/* Rôle */}
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>Rôle</label>
              <div className="grid grid-cols-2 gap-3">
                {(['student', 'admin'] as const).map(r => (
                  <button type="button" key={r} onClick={() => setForm(p => ({ ...p, role: r, profId: '' }))}
                    className="p-3 rounded-xl text-sm font-semibold transition-all"
                    style={{
                      background: form.role === r ? (r === 'admin' ? 'rgba(48,96,192,0.25)' : 'rgba(232,160,48,0.2)') : 'rgba(86,96,112,0.15)',
                      border: `2px solid ${form.role === r ? (r === 'admin' ? '#3b82f6' : '#e8a030') : 'rgba(86,96,112,0.3)'}`,
                      color: form.role === r ? (r === 'admin' ? '#93c5fd' : '#fbbf24') : '#8a9ab0',
                      fontFamily: 'Syne',
                    }}>
                    {r === 'admin' ? '👩‍🏫 Professeur' : '🎓 Élève'}
                  </button>
                ))}
              </div>
            </div>

            {/* Champs */}
            {[
              { label: 'Prénom et Nom', key: 'fullName', type: 'text', placeholder: 'Marie Dupont' },
              { label: 'Email', key: 'email', type: 'email', placeholder: 'marie@exemple.fr' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>{field.label}</label>
                <input type={field.type} required placeholder={field.placeholder}
                  value={form[field.key as keyof NewUserForm]}
                  onChange={e => setForm(p => ({ ...p, [field.key]: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(15,14,11,0.6)', border: '1px solid rgba(86,96,112,0.5)', color: '#faf7f0' }} />
              </div>
            ))}

            {/* Mot de passe */}
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>Mot de passe</label>
              <div className="flex gap-2">
                <input type="text" required placeholder="Minimum 8 caractères"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="flex-1 px-4 py-3 rounded-xl text-sm outline-none font-mono"
                  style={{ background: 'rgba(15,14,11,0.6)', border: '1px solid rgba(86,96,112,0.5)', color: '#fbbf24' }} />
                <button type="button" onClick={generatePassword}
                  className="px-4 py-3 rounded-xl text-xs font-semibold whitespace-nowrap"
                  style={{ background: 'rgba(86,96,112,0.2)', color: '#8a9ab0', border: '1px solid rgba(86,96,112,0.3)' }}>
                  🎲 Générer
                </button>
                <button type="button" onClick={() => copyCode(form.password)}
                  className="px-4 py-3 rounded-xl text-xs"
                  style={{ background: 'rgba(86,96,112,0.2)', color: '#8a9ab0', border: '1px solid rgba(86,96,112,0.3)' }}>
                  📋
                </button>
              </div>
              <p className="text-xs mt-1.5" style={{ color: '#566070' }}>
                Notez ce mot de passe avant de créer le compte — vous devrez le transmettre à l'utilisateur.
              </p>
            </div>

            {/* Associer à un prof — uniquement si élève */}
            {form.role === 'student' && profs.length > 0 && (
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
                  Associer au professeur
                </label>
                <select value={form.profId} onChange={e => setForm(p => ({ ...p, profId: e.target.value }))}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(15,14,11,0.8)', border: '1px solid rgba(86,96,112,0.5)', color: form.profId ? '#faf7f0' : '#566070' }}>
                  <option value="">-- Choisir un professeur (optionnel) --</option>
                  {profs.map(p => (
                    <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                  ))}
                </select>
              </div>
            )}

            <button type="submit" disabled={creating}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all"
              style={{ background: creating ? 'rgba(232,160,48,0.4)' : 'linear-gradient(135deg, #e8a030, #b87a18)', color: '#0f0e0b', fontFamily: 'Syne' }}>
              {creating ? 'Création...' : `Créer le compte ${form.role === 'admin' ? 'professeur' : 'élève'} →`}
            </button>
          </form>
        </div>
      )}

      {/* EXERCICES */}
      {tab === 'exercises' && (
        <div className="space-y-6">
          <div className="p-5 rounded-2xl space-y-4"
               style={{ background: 'rgba(42,49,64,0.5)', border: '1px solid rgba(86,96,112,0.2)' }}>
            <h4 className="text-sm font-semibold" style={{ fontFamily: 'Syne' }}>➕ Créer un exercice</h4>
            {exError && (
              <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(217,64,64,0.15)', border: '1px solid rgba(217,64,64,0.4)', color: '#f08080' }}>
                {exError}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>Titre *</label>
                <input value={newExercise.title} onChange={e => setNewExercise(p => ({ ...p, title: e.target.value }))}
                  placeholder="Ex : Fractions niveau 6e"
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(15,14,11,0.6)', border: '1px solid rgba(86,96,112,0.5)', color: '#faf7f0' }} />
              </div>
              <div>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>Matière *</label>
                <select value={newExercise.subject_id} onChange={e => setNewExercise(p => ({ ...p, subject_id: e.target.value }))}
                  className="w-full px-3 py-2.5 rounded-xl text-sm outline-none"
                  style={{ background: 'rgba(15,14,11,0.8)', border: '1px solid rgba(86,96,112,0.5)', color: newExercise.subject_id ? '#faf7f0' : '#566070' }}>
                  <option value="">-- Choisir --</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>Consigne</label>
              <textarea value={newExercise.description} onChange={e => setNewExercise(p => ({ ...p, description: e.target.value }))}
                rows={2} placeholder="Instructions pour l'élève..."
                className="w-full px-3 py-2.5 rounded-xl text-sm outline-none resize-none"
                style={{ background: 'rgba(15,14,11,0.6)', border: '1px solid rgba(86,96,112,0.5)', color: '#faf7f0' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>Fichier PDF ou Image (optionnel)</label>
              <input type="file" accept=".pdf,image/*" onChange={e => setUploadFile(e.target.files?.[0] || null)}
                className="w-full text-sm" style={{ color: '#8a9ab0' }} />
            </div>
            <button onClick={createExercise} disabled={creatingEx || !newExercise.title || !newExercise.subject_id}
              className="px-6 py-2.5 rounded-xl text-sm font-semibold"
              style={{ background: (creatingEx || !newExercise.title || !newExercise.subject_id) ? 'rgba(232,160,48,0.3)' : 'linear-gradient(135deg, #e8a030, #b87a18)', color: '#0f0e0b', fontFamily: 'Syne' }}>
              {creatingEx ? 'Création...' : '+ Créer l\'exercice'}
            </button>
          </div>

          <div className="space-y-2">
            {exercises.map(ex => (
              <div key={ex.id} className="flex items-center justify-between p-3 rounded-xl"
                   style={{ background: 'rgba(42,49,64,0.5)', border: '1px solid rgba(86,96,112,0.2)' }}>
                <div>
                  <div className="text-sm font-medium">{ex.subjects?.icon} {ex.title}</div>
                  <div className="text-xs mt-0.5" style={{ color: '#8a9ab0' }}>
                    {ex.subjects?.name} · {new Date(ex.created_at).toLocaleDateString('fr-FR')}
                    {ex.pdf_url && ' · 📄 PDF'}{ex.image_url && ' · 🖼️ Image'}
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
