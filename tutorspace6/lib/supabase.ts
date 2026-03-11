import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Profile = {
  id: string
  email: string
  full_name: string
  role: 'admin' | 'student'
  is_approved: boolean
  prof_code?: string
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

export type VoiceMessage = {
  id: string
  exercise_id: string
  user_id: string
  role_type: 'prof_explanation' | 'student_question'
  audio_url: string
  duration?: number
  created_at: string
}
