import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  // Initialisation DANS la fonction — lu au runtime, pas au build
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  try {
    const { email, password, fullName, role, callerToken } = await req.json()

    const supabaseUser = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const { data: { user }, error: authError } = await supabaseUser.auth.getUser(callerToken)
    if (authError || !user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

    const { data: callerProfile } = await supabaseAdmin
      .from('profiles').select('role').eq('id', user.id).single()
    if (callerProfile?.role !== 'admin') return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: fullName, role },
    })
    if (createError) return NextResponse.json({ error: createError.message }, { status: 400 })

    await supabaseAdmin.from('profiles').update({ full_name: fullName, role, is_approved: true }).eq('id', newUser.user.id)

    if (role === 'admin') {
      const profCode = Math.random().toString(36).substring(2, 10)
      await supabaseAdmin.from('profiles').update({ prof_code: profCode }).eq('id', newUser.user.id)
      return NextResponse.json({ success: true, userId: newUser.user.id, profCode })
    }

    return NextResponse.json({ success: true, userId: newUser.user.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erreur serveur' }, { status: 500 })
  }
}
