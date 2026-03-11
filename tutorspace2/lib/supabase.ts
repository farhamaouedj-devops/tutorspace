// lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Profile = {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'student'
  is_approved: boolean
  avatar_url?: string
  created_at: string
}

export type Subject = {
  id: string
  name: string
  icon: string
  color: string
}

export type Exercise = {
  id: string
  subject_id: string
  title: string
  description?: string
  pdf_url?: string
  image_url?: string
  created_by: string
  is_active: boolean
  created_at: string
}

export type CanvasData = {
  id: string
  exercise_id: string
  user_id: string
  panel: 'left' | 'right'
  strokes: Stroke[]
  updated_at: string
}

export type Stroke = {
  id: string
  points: { x: number; y: number }[]
  color: string
  width: number
  tool: 'pen' | 'eraser' | 'highlighter'
  opacity?: number
}

export type VoiceMessage = {
  id: string
  exercise_id: string
  user_id: string
  role_type: 'prof_explanation' | 'student_question'
  audio_url: string
  duration?: number
  transcript?: string
  created_at: string
}
