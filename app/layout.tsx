import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TutorSpace — Plateforme de Tutorat',
  description: 'Espace collaboratif prof-élève sécurisé',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  )
}
```

Cliquez **Commit changes** → Vercel relance automatiquement.

Vérifiez aussi que ces fichiers sont bien présents dans votre repo GitHub :
```
app/globals.css        ✅ ou ❌ ?
app/layout.tsx         ← on vient de le créer
app/page.tsx           ✅ ou ❌ ?
app/dashboard/page.tsx ✅ ou ❌ ?
