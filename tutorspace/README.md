# 📐 TutorSpace — Plateforme de Tutorat Collaborative

> Stack : **Next.js 14** · **Tailwind CSS** · **Supabase** (Auth + DB + Storage)  
> Déploiement : **Vercel** (gratuit) · Hébergement DB : **Supabase** (gratuit)  
> Coût total : **0 €**

---

## 🗂️ Structure du projet

```
tutoring-platform/
├── app/
│   ├── layout.tsx          # Layout racine + polices
│   ├── globals.css         # Design system + animations
│   ├── page.tsx            # Page de connexion
│   ├── register/
│   │   └── page.tsx        # Inscription (is_approved: false par défaut)
│   ├── dashboard/
│   │   └── page.tsx        # Dashboard (Prof + Élève + onglet ADMIN)
│   └── exercise/[id]/
│       └── page.tsx        # Workspace collaboratif double panneau
├── components/
│   ├── Canvas.tsx          # Composant canvas avec dessin/sauvegarde DB
│   ├── VoiceRecorder.tsx   # Enregistrement vocal + lecture + bulles
│   └── AdminPanel.tsx      # Validation comptes + création exercices
├── lib/
│   └── supabase.ts         # Client Supabase + types TypeScript
└── supabase/
    └── schema.sql          # Toutes les tables + RLS + triggers
```

---

## 🚀 Mise en place pas-à-pas

### 1. Créer un projet Supabase (gratuit)

1. Aller sur [supabase.com](https://supabase.com) → **New project**
2. Notez votre **Project URL** et **anon public key** (Settings → API)

### 2. Initialiser la base de données

Dans **Supabase Dashboard → SQL Editor**, coller et exécuter tout le contenu de `supabase/schema.sql`.

### 3. Créer les buckets Storage

Dans **Supabase Dashboard → Storage**, créer deux buckets :

| Nom | Public | Usage |
|-----|--------|-------|
| `exercise-files` | ✅ Oui | PDFs et images des exercices |
| `voice-messages` | ✅ Oui | Fichiers audio WebM des messages vocaux |

**Policies Storage à créer pour chaque bucket :**
- SELECT (lecture) : `(SELECT is_approved FROM profiles WHERE id = auth.uid()) = true`
- INSERT (écriture exercise-files) : `(SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'`
- INSERT (écriture voice-messages) : `(SELECT is_approved FROM profiles WHERE id = auth.uid()) = true`

### 4. Configurer le projet Next.js

```bash
# Cloner / copier les fichiers
npm install

# Copier le fichier d'env
cp .env.local.example .env.local

# Remplir .env.local avec vos clés Supabase
NEXT_PUBLIC_SUPABASE_URL=https://XXXX.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbG...
```

### 5. Lancer en développement

```bash
npm run dev
# → http://localhost:3000
```

### 6. Déployer sur Vercel (gratuit)

```bash
# Option A : via CLI
npx vercel

# Option B : via GitHub
# 1. Push sur GitHub
# 2. Connecter sur vercel.com
# 3. Ajouter les variables d'env dans Settings → Environment Variables
```

---

## 👤 Comptes et rôles

| Rôle | Email | Accès |
|------|-------|-------|
| **Admin (Prof)** | `farha.maouedj@proton.me` | Tout + onglet ADMIN |
| **Élève** | N'importe quel email | Dashboard après validation |

### Flux d'inscription élève :
1. L'élève s'inscrit sur `/register`
2. Compte créé avec `is_approved: false`
3. La prof voit le compte dans l'onglet **ADMIN → En attente**
4. Elle clique **✓ Valider** → l'élève peut se connecter

---

## 🖊️ Workspace collaboratif

### Panneau Gauche (Énoncé)
- La **Prof** upload un PDF/image ET peut dessiner par-dessus
- L'**Élève** voit en lecture seule (badge "Lecture seule")
- Si fichier uploadé : toggle "Fichier / Dessin"

### Panneau Droit (Travail élève)
- L'**Élève** dessine sa réponse (couleurs au choix, stylo/surligneur/gomme)
- La **Prof** voit le travail ET peut annoter **en rouge** (mode correction)
- **Sauvegarde automatique** : debounce 1.5s → `canvas_data` table

### Outils de dessin
| Outil | Icône | Comportement |
|-------|-------|-------------|
| Stylo | ✏️ | Trait net, opacité 100% |
| Surligneur | 🖊️ | Trait semi-transparent (35%) |
| Gomme | ⬜ | Efface les tracés (composite destination-out) |

---

## 🎤 Messages vocaux

- Cliquer **🎤 Vocal** en haut à droite pour ouvrir le panneau
- **Prof** → bouton bleu "Enregistrer une explication"
- **Élève** → bouton orange "Poser une question vocale"
- Les messages s'affichent en **bulles différenciées** :
  - 🔵 Bleue à gauche : "Explication Prof"
  - 🟠 Orange à droite : "Question Élève"
- **Temps réel** : les nouveaux messages apparaissent instantanément (Supabase Realtime)
- Stockés dans le bucket `voice-messages` + table `voice_messages`

---

## 🗄️ Tables Supabase

```
profiles         → Utilisateurs (role, is_approved, email)
subjects         → Matières (Maths, Français, Sciences, etc.)
exercises        → Exercices (title, pdf_url, image_url, subject_id)
canvas_data      → Tracés de dessin en JSON (exercise_id, user_id, panel, strokes[])
voice_messages   → Messages audio (audio_url, role_type, duration)
annotations      → Réservé aux corrections prof (exercise_id, student_id, strokes[])
```

---

## 🔒 Sécurité (Row Level Security)

- Chaque table a RLS activé
- Un élève ne voit **que ses propres tracés**
- Un élève ne peut **pas modifier** l'énoncé du prof
- Seul l'admin peut **créer/supprimer** des exercices
- Seul l'admin peut **valider** des comptes
- Le trigger `handle_new_user` auto-approuve uniquement `farha.maouedj@proton.me`

---

## 🎨 Design

- **Polices** : Syne (titres, badges) + DM Sans (corps)
- **Palette** : Noir encre `#0f0e0b` / Amber `#e8a030` / Ardoise `#2a3140`
- **Style** : Notebook grid + blackboard aesthetic
- **Animations** : fadeInUp, pulse-glow, recording-pulse (CSS pur)
- **Mobile** : responsive jusqu'au canvas (touch events supportés)
