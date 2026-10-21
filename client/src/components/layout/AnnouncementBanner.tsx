import React, { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/context/AuthContext'
import { Announcement, AnnouncementLevel } from '@/types'
import { api } from '@/lib/api'
import { Megaphone, AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const DISMISSED_KEY = 'medplanner_dismissed_announcements'
const REFRESH_MS = 5 * 60 * 1000

const STYLES: Record<AnnouncementLevel, { box: string; icon: React.ElementType }> = {
  info: {
    box: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900/60 dark:bg-blue-950/40 dark:text-blue-100',
    icon: Info,
  },
  warning: {
    box: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-100',
    icon: Megaphone,
  },
  urgent: {
    box: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-100',
    icon: AlertTriangle,
  },
}

const readDismissed = (): number[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]')
    return Array.isArray(parsed) ? parsed : []
  } catch (e) {
    return []
  }
}

export const AnnouncementBanner: React.FC = () => {
  const { token } = useAuth()
  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [dismissed, setDismissed] = useState<number[]>(readDismissed)

  const load = useCallback(async () => {
    if (!token) return
    try {
      const data = await api<{ announcements: Announcement[] }>(token, '/api/announcements')
      setAnnouncements(Array.isArray(data.announcements) ? data.announcements : [])
    } catch (e) {
      // Aviso é complementar: se falhar, o app segue funcionando normalmente.
    }
  }, [token])

  useEffect(() => {
    load()
    const timer = setInterval(load, REFRESH_MS)
    window.addEventListener('focus', load)
    return () => {
      clearInterval(timer)
      window.removeEventListener('focus', load)
    }
  }, [load])

  const dismiss = (id: number) => {
    const next = [...dismissed, id]
    setDismissed(next)
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)) } catch (e) {}
  }

  const visible = announcements.filter(a => !dismissed.includes(a.id))
  if (visible.length === 0) return null

  return (
    <div className="space-y-2 mb-4" aria-live="polite">
      {visible.map(a => {
        const { box, icon: Icon } = STYLES[a.level] || STYLES.info
        return (
          <div key={a.id} className={cn('flex items-start gap-3 rounded-2xl border p-3.5 shadow-sm', box)} role="status">
            <Icon className="h-5 w-5 shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">{a.title}</p>
              <p className="text-sm whitespace-pre-line opacity-90">{a.message}</p>
            </div>
            <button
              onClick={() => dismiss(a.id)}
              aria-label="Dispensar aviso"
              className="shrink-0 rounded-lg p-1 opacity-60 hover:opacity-100 hover:bg-black/5 dark:hover:bg-white/10 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
