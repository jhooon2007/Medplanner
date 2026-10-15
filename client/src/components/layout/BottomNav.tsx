import React from 'react'
import { CalendarDays, Clock, Calculator, BookOpen, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

interface BottomNavProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth()

  const navItems = [
    { id: 'agenda', label: 'Agenda Semanal', icon: CalendarDays },
    { id: 'eventos', label: 'Eventos Importantes', icon: Clock },
    { id: 'notas', label: 'Cálculo de Notas', icon: Calculator },
    { id: 'materias', label: 'Matérias do Semestre', icon: BookOpen },
  ]

  if (user?.role === 'admin') {
    navItems.push({ id: 'admin', label: 'Painel Admin', icon: ShieldCheck })
  }

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-slate-900/95 backdrop-blur-lg border-t border-slate-200 dark:border-slate-800 px-2 py-1.5 safe-area-pb">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "flex flex-col items-center justify-center py-1 px-2.5 rounded-xl transition-all relative",
                isActive
                  ? "text-blue-600 dark:text-blue-400 font-semibold"
                  : "text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              )}
            >
              <div
                className={cn(
                  "p-1.5 rounded-lg transition-transform",
                  isActive && "bg-blue-50 dark:bg-blue-950/60 scale-105"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <span className="text-[10px] tracking-tight mt-0.5 truncate max-w-[65px]">{item.label}</span>
              {isActive && (
                <span className="absolute -bottom-1 h-1 w-6 rounded-full bg-blue-600" />
              )}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
