'use client'
// app/register/page.tsx — Page désactivée, les comptes sont créés par l'admin
import Link from 'next/link'

export default function RegisterPage() {
  return (
    <div className="grid-bg min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md text-center animate-in">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-6"
             style={{ background: 'rgba(42,49,64,0.8)', border: '1px solid rgba(232,160,48,0.3)' }}>
          <span className="text-4xl">🔐</span>
        </div>
        <h2 className="text-2xl font-display font-bold mb-3" style={{ fontFamily: 'Syne' }}>
          Inscription sur invitation
        </h2>
        <p className="text-sm mb-8 leading-relaxed" style={{ color: '#8a9ab0' }}>
          Les comptes sont créés directement par votre professeur.
          Contactez-le pour obtenir vos identifiants de connexion.
        </p>
        <Link href="/"
          className="inline-block px-8 py-3 rounded-xl font-semibold text-sm"
          style={{ background: 'linear-gradient(135deg, #e8a030, #b87a18)', color: '#0f0e0b', fontFamily: 'Syne' }}>
          ← Retour à la connexion
        </Link>
      </div>
    </div>
  )
}
