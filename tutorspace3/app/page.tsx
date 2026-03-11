'use client'
// app/page.tsx — Login Page
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }

    // Check approval
    const { data: profile } = await supabase
      .from('profiles').select('*').eq('id', data.user.id).single()

    if (!profile?.is_approved) {
      await supabase.auth.signOut()
      setError('Votre compte est en attente de validation par le professeur.')
      setLoading(false)
      return
    }
    router.push('/dashboard')
  }

  return (
    <div className="grid-bg min-h-screen flex items-center justify-center p-4">
      {/* Decorative corner elements */}
      <div className="fixed top-0 left-0 w-64 h-64 opacity-10 pointer-events-none">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <path d="M0,0 L200,0 L0,200 Z" fill="#e8a030" />
        </svg>
      </div>
      <div className="fixed bottom-0 right-0 w-64 h-64 opacity-10 pointer-events-none rotate-180">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <path d="M0,0 L200,0 L0,200 Z" fill="#e8a030" />
        </svg>
      </div>

      <div className="w-full max-w-md animate-in">
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-4 pulse-glow"
               style={{ background: 'linear-gradient(135deg, #e8a030, #b87a18)' }}>
            <span className="text-3xl">📐</span>
          </div>
          <h1 className="text-4xl font-display font-800 tracking-tight"
              style={{ fontFamily: 'Syne', fontWeight: 800 }}>
            TutorSpace
          </h1>
          <p className="text-sm mt-2" style={{ color: '#8a9ab0' }}>
            Espace collaboratif prof-élève
          </p>
        </div>

        {/* Card */}
        <div className="rounded-2xl p-8 border"
             style={{ background: 'rgba(42,49,64,0.8)', borderColor: 'rgba(232,160,48,0.2)', backdropFilter: 'blur(12px)' }}>
          <h2 className="text-xl font-display font-semibold mb-6" style={{ fontFamily: 'Syne' }}>
            Connexion
          </h2>

          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm"
                 style={{ background: 'rgba(217,64,64,0.15)', border: '1px solid rgba(217,64,64,0.4)', color: '#f08080' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
                Adresse email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="vous@exemple.fr"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'rgba(15,14,11,0.6)',
                  border: '1px solid rgba(86,96,112,0.5)',
                  color: '#faf7f0',
                }}
                onFocus={e => e.target.style.borderColor = '#e8a030'}
                onBlur={e => e.target.style.borderColor = 'rgba(86,96,112,0.5)'}
              />
            </div>
            <div>
              <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
                Mot de passe
              </label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                required placeholder="••••••••"
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: 'rgba(15,14,11,0.6)',
                  border: '1px solid rgba(86,96,112,0.5)',
                  color: '#faf7f0',
                }}
                onFocus={e => e.target.style.borderColor = '#e8a030'}
                onBlur={e => e.target.style.borderColor = 'rgba(86,96,112,0.5)'}
              />
            </div>
            <button
              type="submit" disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-sm transition-all mt-2"
              style={{
                background: loading ? 'rgba(232,160,48,0.4)' : 'linear-gradient(135deg, #e8a030, #b87a18)',
                color: '#0f0e0b',
                fontFamily: 'Syne',
              }}
            >
              {loading ? 'Connexion...' : 'Se connecter →'}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: '#8a9ab0' }}>
            Pas encore de compte ?{' '}
            <Link href="/register" className="hover-underline" style={{ color: '#e8a030' }}>
              S'inscrire
            </Link>
          </p>
        </div>

        {/* Info */}
        <div className="mt-6 p-4 rounded-xl text-xs text-center" style={{ background: 'rgba(232,160,48,0.08)', border: '1px solid rgba(232,160,48,0.15)', color: '#8a9ab0' }}>
          Les nouveaux comptes doivent être validés par le professeur avant l'accès.
        </div>
      </div>
    </div>
  )
}
