'use client'
// app/register/page.tsx
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

export default function RegisterPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Le mot de passe doit contenir au moins 8 caractères.'); return }
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signUp({
      email, password,
      options: { data: { full_name: fullName } }
    })
    if (error) { setError(error.message); setLoading(false); return }
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
            Votre compte est en attente de validation par le professeur.
            Vous recevrez un email de confirmation, puis le professeur activera votre accès.
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
          <p className="text-sm mt-2" style={{ color: '#8a9ab0' }}>Rejoindre TutorSpace</p>
        </div>

        <div className="rounded-2xl p-8 border"
             style={{ background: 'rgba(42,49,64,0.8)', borderColor: 'rgba(232,160,48,0.2)', backdropFilter: 'blur(12px)' }}>
          {error && (
            <div className="mb-4 p-3 rounded-lg text-sm"
                 style={{ background: 'rgba(217,64,64,0.15)', border: '1px solid rgba(217,64,64,0.4)', color: '#f08080' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleRegister} className="space-y-4">
            {[
              { label: 'Prénom et Nom', value: fullName, setter: setFullName, type: 'text', placeholder: 'Marie Curie' },
              { label: 'Adresse email', value: email, setter: setEmail, type: 'email', placeholder: 'marie@exemple.fr' },
              { label: 'Mot de passe (8 car. min.)', value: password, setter: setPassword, type: 'password', placeholder: '••••••••' },
            ].map(field => (
              <div key={field.label}>
                <label className="block text-xs font-medium mb-2 uppercase tracking-wider" style={{ color: '#8a9ab0' }}>
                  {field.label}
                </label>
                <input
                  type={field.type} value={field.value}
                  onChange={e => field.setter(e.target.value)}
                  required placeholder={field.placeholder}
                  className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                  style={{ background: 'rgba(15,14,11,0.6)', border: '1px solid rgba(86,96,112,0.5)', color: '#faf7f0' }}
                  onFocus={e => e.target.style.borderColor = '#e8a030'}
                  onBlur={e => e.target.style.borderColor = 'rgba(86,96,112,0.5)'}
                />
              </div>
            ))}

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
      </div>
    </div>
  )
}
