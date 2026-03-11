'use client'
// app/register/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

type Role = 'student' | 'admin'

export default function RegisterPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [role, setRole] = useState<Role | null>(null)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [profCode, setProfCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return }
    setLoading(true)
    setError('')

    // Si élève, vérifier que le code prof existe
    let profId: string | null = null
    if (role === 'student') {
      if (!profCode.trim()) { setError('Veuillez entrer le code de votre professeur.'); setLoading(false); return }
      const { data: profProfile, error: profError } = await supabase
        .from('profiles')
        .select('id, full_name')
        .eq('prof_code', profCode.trim().toLowerCase())
        .eq('role', 'admin')
        .single()
      if (profError || !profProfile) {
        setError('Code professeur invalide. Vérifiez avec votre professeur.')
        setLoading(false)
        return
      }
      profId = profProfile.id
    }

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: role,
        }
      }
    })

    if (signUpError) { setError(signUpError.message); setLoading(false); return }

    // Si élève, créer l'association avec le prof
    if (role === 'student' && profId && data.user) {
      // Attendre un peu que le trigger crée le profil
      await new Promise(resolve => setTimeout(resolve, 1500))
      await supabase.from('student_prof').insert({
        student_id: data.user.id,
        prof_id: profId,
      })
    }

    setSuccess(true)
    setLoading(false)
  }

  if (success) {
    return (
      <div className="grid-bg min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center animate-in">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
               style={{ background: 'linear-gradient(135deg, #1a4028, #1e5030)', border: '1px solid rgba(110,224,144,0.4)' }}>
            <span className="text-4xl">✓</span>
          </div>
          <h2 className="text-2xl font-display font-bold mb-3" style={{ fontFamily: 'Syne', color: '#6ee090' }}>
            Inscription envoyée !
          </h2>
          <p className="text-sm mb-8" style={{ color: '#8a9ab0' }}>
            {role === 'student'
              ? 'Votre compte est en attente de validation par votre professeur. Vous serez notifié dès l\'activation.'
              : 'Votre compte professeur est en attente de validation par l\'administrateur principal.'}
          </p>
          <Link href="/"
            className="inline-block px-8 py-3 rounded-xl font-semibold text-sm"
            style={{ background: 'linear-gradient(135deg, #e8a030, #b87a18)', color: '#0f0e0b', fontFamily: 'Syne' }}>
            Retour à la connexion
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="grid-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md animate-in">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2 text-sm hover-underline" style={{ color: '#8a9ab0' }}>
            ← Retour
          </Link>
          <h1 className="text-3xl font-display font-800 mt-4" style={{ fontFamily: 'Syne', fontWeight: 800 }}>
            Créer un compte
          </h1>
        </div>

        <div className="rounded-2xl p-8 border"
             style={{ background: 'rgba(42,49,64,0.8)', borderColor: 'rgba(232,160,48,0.2)', backdropFilter: 'blur(12px)' }}>

          {/* ÉTAPE 1 — Choisir le rôle */}
          {step === 1 && (
            <div>
              <h2 className="text-lg font-display font-semibold mb-6 text-center" style={{ fontFamily: 'Syne' }}>
                Vous êtes...
              </h2>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { setRole('student'); setStep(2) }}
                  className="p-6 rounded-2xl text-center transition-all flex flex-col items-center gap-3"
                  style={{ background: 'rgba(232,160,48,0.1)', border: '2px solid rgba(232,160,48,0.3)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#e8a030')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(232,160,48,0.3)')}>
                  <span className="text-4xl">🎓</span>
                  <div>
                    <div className="font-semibold text-sm" style={{ fontFamily: 'Syne', color: '#fbbf24' }}>Élève</div>
                    <div className="text-xs mt-1" style={{ color: '#8a9ab0' }}>J'ai un code prof</div>
                  </div>
                </button>
                <button onClick={() => { setRole('admin'); setStep(2) }}
                  className="p-6 rounded-2xl text-center transition-all flex flex-col items-center gap-3"
                  style={{ background: 'rgba(48,96,192,0.1)', border: '2px solid rgba(48,96,192,0.3)' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = '#3b82f6')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(48,96,192,0.3)')}>
                  <span className="text-4xl">👩‍🏫</span>
                  <div>
                    <div className="font-semibold text-sm" style={{ fontFamily: 'Syne', color: '#93c5fd' }}>Professeur</div>
                    <div className="text-xs mt-1" style={{ color: '#8a9ab0' }}>Je donne des cours</div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* ÉTAPE 2 — Formulaire */}
          {step === 2 && (
            <div>
              <button onClick={() => { setStep(1); setError('') }}
                className="text-xs mb-6 hover-underline" style={{ color: '#8a9ab0' }}>
                ← Changer de rôle
              </button>

              <div className="flex items-center gap-3 p-3 rounded-xl mb-6"
                   style={{ background: role === 'admin' ? 'rgba(48,96,192,0.1)' : 'rgba(232,160,48,0.1)', border: `1px solid ${role === 'admin' ? 'rgba(48,96,192,0.3)' : 'rgba(232,160,48,0.3)'}` }}>
                <span className="text-2xl">{role === 'admin' ? '👩‍🏫' : '🎓'}</span>
                <div>
                  <div className="text-xs font-semibold" style={{ color: role === 'admin' ? '#93c5fd' : '#fbbf24', fontFamily: 'Syne' }}>
                    {role === 'admin' ? 'Compte Professeur' : 'Compte Élève'}
                  </div>
                  <div className="text-xs" style={{ color: '#8a9ab0' }}>
                    {role === 'admin' ? 'Validation requise par l\'admin principal' : 'Validation requise par votre prof'}
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-3 rounded-lg text-sm"
                     style={{ background: 'rgba(217,64,64,0.15)', border: '1px solid rgba(217,64,64,0.4)', color: '#f08080' }}>
                  {error}
                </div>
              )}

              <form onSubmit={handleRegister} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
                    Prénom et Nom
                  </label>
                  <input value={fullName} onChange={e => setFullName(e.target.value)}
                    type="text" required placeholder="Marie Curie"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(15,14,11,0.6)', border: '1px solid rgba(86,96,112,0.5)', color: '#faf7f0' }}
                    onFocus={e => e.target.style.borderColor = '#e8a030'}
                    onBlur={e => e.target.style.borderColor = 'rgba(86,96,112,0.5)'} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
                    Adresse email
                  </label>
                  <input value={email} onChange={e => setEmail(e.target.value)}
                    type="email" required placeholder="marie@exemple.fr"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(15,14,11,0.6)', border: '1px solid rgba(86,96,112,0.5)', color: '#faf7f0' }}
                    onFocus={e => e.target.style.borderColor = '#e8a030'}
                    onBlur={e => e.target.style.borderColor = 'rgba(86,96,112,0.5)'} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
                    Mot de passe (8 car. min.)
                  </label>
                  <input value={password} onChange={e => setPassword(e.target.value)}
                    type="password" required placeholder="••••••••"
                    className="w-full px-4 py-3 rounded-xl text-sm outline-none"
                    style={{ background: 'rgba(15,14,11,0.6)', border: '1px solid rgba(86,96,112,0.5)', color: '#faf7f0' }}
                    onFocus={e => e.target.style.borderColor = '#e8a030'}
                    onBlur={e => e.target.style.borderColor = 'rgba(86,96,112,0.5)'} />
                </div>

                {/* Code prof — uniquement pour les élèves */}
                {role === 'student' && (
                  <div>
                    <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
                      Code de votre professeur *
                    </label>
                    <input value={profCode} onChange={e => setProfCode(e.target.value)}
                      type="text" required placeholder="ex: a3f8c2d1"
                      className="w-full px-4 py-3 rounded-xl text-sm outline-none font-mono"
                      style={{ background: 'rgba(232,160,48,0.08)', border: '1px solid rgba(232,160,48,0.3)', color: '#fbbf24' }}
                      onFocus={e => e.target.style.borderColor = '#e8a030'}
                      onBlur={e => e.target.style.borderColor = 'rgba(232,160,48,0.3)'} />
                    <p className="text-xs mt-1.5" style={{ color: '#566070' }}>
                      Demandez ce code à votre professeur
                    </p>
                  </div>
                )}

                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-xl font-semibold text-sm transition-all mt-2"
                  style={{ background: loading ? 'rgba(232,160,48,0.4)' : 'linear-gradient(135deg, #e8a030, #b87a18)', color: '#0f0e0b', fontFamily: 'Syne' }}>
                  {loading ? 'Inscription...' : 'S\'inscrire →'}
                </button>
              </form>

              <p className="text-center text-sm mt-6" style={{ color: '#8a9ab0' }}>
                Déjà un compte ?{' '}
                <Link href="/" className="hover-underline" style={{ color: '#e8a030' }}>Se connecter</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
