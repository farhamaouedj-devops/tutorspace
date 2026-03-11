'use client'
// components/VoiceRecorder.tsx
import { useState, useRef, useEffect } from 'react'
import { supabase, VoiceMessage } from '@/lib/supabase'

interface VoiceRecorderProps {
  exerciseId: string
  userId: string
  roleType: 'prof_explanation' | 'student_question'
  isProf: boolean
}

export default function VoiceRecorder({ exerciseId, userId, roleType, isProf }: VoiceRecorderProps) {
  const [messages, setMessages] = useState<VoiceMessage[]>([])
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [uploading, setUploading] = useState(false)
  const mediaRecorder = useRef<MediaRecorder | null>(null)
  const chunks = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval>>()
  const audioRefs = useRef<{ [id: string]: HTMLAudioElement }>({})
  const [playing, setPlaying] = useState<string | null>(null)

  useEffect(() => { loadMessages() }, [exerciseId])

  async function loadMessages() {
    const { data } = await supabase
      .from('voice_messages')
      .select('*')
      .eq('exercise_id', exerciseId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data as VoiceMessage[])
  }

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`voice-${exerciseId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'voice_messages', filter: `exercise_id=eq.${exerciseId}` },
        (payload: any) => setMessages(prev => [...prev, payload.new as VoiceMessage]))
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [exerciseId])

  async function startRecording() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    const mr = new MediaRecorder(stream, { mimeType: 'audio/webm' })
    chunks.current = []
    mr.ondataavailable = e => chunks.current.push(e.data)
    mr.start(100)
    mediaRecorder.current = mr
    setIsRecording(true)
    setRecordingTime(0)
    timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
  }

  async function stopRecording() {
    clearInterval(timerRef.current)
    setIsRecording(false)
    if (!mediaRecorder.current) return
    mediaRecorder.current.stop()
    mediaRecorder.current.stream.getTracks().forEach(t => t.stop())

    setUploading(true)
    setTimeout(async () => {
      const blob = new Blob(chunks.current, { type: 'audio/webm' })
      const fileName = `${exerciseId}/${userId}/${Date.now()}.webm`

      const { data: uploadData, error } = await supabase.storage
        .from('voice-messages')
        .upload(fileName, blob, { contentType: 'audio/webm' })

      if (!error && uploadData) {
        const { data: { publicUrl } } = supabase.storage.from('voice-messages').getPublicUrl(fileName)
        await supabase.from('voice_messages').insert({
          exercise_id: exerciseId,
          user_id: userId,
          role_type: roleType,
          audio_url: publicUrl,
          duration: recordingTime,
        })
        await loadMessages()
      }
      setUploading(false)
    }, 300)
  }

  function togglePlay(msg: VoiceMessage) {
    const audio = audioRefs.current[msg.id]
    if (!audio) return
    if (playing === msg.id) { audio.pause(); setPlaying(null) }
    else { audio.play(); setPlaying(msg.id) }
  }

  function formatTime(s: number) {
    return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
  }

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8 text-xs" style={{ color: '#566070' }}>
            Aucun message vocal pour cet exercice.
          </div>
        )}
        {messages.map(msg => {
          const isOwnMsg = msg.user_id === userId
          const isExplanation = msg.role_type === 'prof_explanation'
          return (
            <div key={msg.id} className={`flex ${isOwnMsg ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-xs rounded-2xl px-4 py-3 ${isExplanation ? 'bubble-prof' : 'bubble-student'}`}>
                {/* Label */}
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-semibold" style={{ color: isExplanation ? '#93c5fd' : '#fbbf24', fontFamily: 'Syne' }}>
                    {isExplanation ? '👩‍🏫 Explication Prof' : '🎓 Question Élève'}
                  </span>
                </div>
                {/* Player */}
                <div className="flex items-center gap-3">
                  <button onClick={() => togglePlay(msg)}
                    className="w-9 h-9 rounded-full flex items-center justify-center transition-all flex-shrink-0"
                    style={{ background: isExplanation ? 'rgba(48,96,192,0.4)' : 'rgba(232,160,48,0.3)', border: `1px solid ${isExplanation ? 'rgba(48,96,192,0.6)' : 'rgba(232,160,48,0.5)'}` }}>
                    <span className="text-base">{playing === msg.id ? '⏸' : '▶️'}</span>
                  </button>
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      {[...Array(12)].map((_, i) => (
                        <div key={i} className="flex-1 rounded-full"
                          style={{ height: `${Math.random() * 16 + 4}px`, background: isExplanation ? 'rgba(147,197,253,0.4)' : 'rgba(251,191,36,0.4)' }} />
                      ))}
                    </div>
                    <div className="text-xs mt-1" style={{ color: '#8a9ab0' }}>
                      {msg.duration ? formatTime(msg.duration) : '—'}
                    </div>
                  </div>
                </div>
                <audio ref={el => { if (el) audioRefs.current[msg.id] = el }}
                  src={msg.audio_url}
                  onEnded={() => setPlaying(null)}
                  className="hidden" />
              </div>
            </div>
          )
        })}
      </div>

      {/* Recorder controls */}
      <div className="p-3 border-t" style={{ borderColor: 'rgba(86,96,112,0.3)' }}>
        {isRecording ? (
          <div className="flex items-center gap-3">
            <div className="flex-1 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full recording-pulse" style={{ background: '#ef4444' }} />
              <span className="text-sm font-mono" style={{ color: '#f08080' }}>
                {formatTime(recordingTime)}
              </span>
              <span className="text-xs" style={{ color: '#8a9ab0' }}>Enregistrement...</span>
            </div>
            <button onClick={stopRecording}
              className="px-4 py-2 rounded-xl text-xs font-semibold transition-all"
              style={{ background: 'rgba(217,64,64,0.2)', color: '#f08080', border: '1px solid rgba(217,64,64,0.4)', fontFamily: 'Syne' }}>
              ⏹ Stop
            </button>
          </div>
        ) : (
          <button onClick={startRecording} disabled={uploading}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: uploading ? 'rgba(86,96,112,0.2)' : (isProf ? 'rgba(48,96,192,0.2)' : 'rgba(232,160,48,0.15)'),
              border: `1px solid ${isProf ? 'rgba(48,96,192,0.4)' : 'rgba(232,160,48,0.35)'}`,
              color: isProf ? '#93c5fd' : '#fbbf24',
              fontFamily: 'Syne',
            }}>
            <span className="text-base">🎤</span>
            {uploading ? 'Envoi...' : isProf ? 'Enregistrer une explication' : 'Poser une question vocale'}
          </button>
        )}
      </div>
    </div>
  )
}
