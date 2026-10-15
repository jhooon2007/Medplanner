import React from 'react'
import { CalendarDays, Clock, Calculator, BookOpen, ShieldCheck, ChevronRight } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { cn } from '@/lib/utils'

interface SidebarProps {
  activeTab: string
  setActiveTab: (tab: string) => void
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab }) => {
  const { user } = useAuth()

  const navItems = [
    {
      id: 'agenda',
      label: 'Agenda Semanal',
      sublabel: 'Horários de aulas da semana',
      icon: CalendarDays,
    },
    {
      id: 'eventos',
      label: 'Eventos Importantes',
      sublabel: 'Provas, prazos & contagem',
      icon: Clock,
    },
    {
      id: 'notas',
      label: 'Cálculo de Notas',
      sublabel: 'Regras oficiais CHS II & IMC II',
      icon: Calculator,
    },
    {
      id: 'materias',
      label: 'Matérias do Semestre',
      sublabel: 'Checklist de assuntos e estudos',
      icon: BookOpen,
    },
  ]

  if (user?.role === 'admin') {
    navItems.push({
      id: 'admin',
      label: 'Painel Admin',
      sublabel: 'Gestão de usuários & dados',
      icon: ShieldCheck,
    })
  }

  return (
    <aside className="hidden lg:flex flex-col w-72 shrink-0 border-r border-slate-200/80 bg-white dark:border-slate-800/80 dark:bg-slate-900/60 p-4 min-h-[calc(100vh-4rem)]">
      <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 px-3 mb-2">
        Módulos Acadêmicos
      </div>

      <nav className="space-y-1.5 flex-1">
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = activeTab === item.id

          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center justify-between p-3 rounded-xl text-left transition-all duration-200 group relative",
                isActive
                  ? "bg-blue-500/10 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 font-semibold shadow-xs"
                  : "text-slate-600 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center transition-colors",
                    isActive
                      ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 group-hover:text-slate-900 dark:group-hover:text-slate-100"
                  )}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm leading-snug">{item.label}</div>
                  <div className="text-[11px] text-slate-400 font-normal">{item.sublabel}</div>
                </div>
              </div>

              <ChevronRight
                className={cn(
                  "h-4 w-4 transition-transform",
                  isActive ? "text-blue-600 rotate-90" : "text-slate-300 group-hover:translate-x-0.5"
                )}
              />
            </button>
          )
        })}
      </nav>

      {/* Quick Info card at bottom of sidebar */}
      <div className="mt-auto p-3.5 rounded-2xl bg-gradient-to-br from-slate-50 to-blue-50/40 border border-slate-200/80 dark:from-slate-800/40 dark:to-blue-950/20 dark:border-slate-800 text-xs">
        <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
          Calendário Ativo
        </div>
        <p className="text-slate-500 text-[11px] leading-relaxed">
          Semestre 2026.2 UFG: Módulos CHS II, IMC II e Integrador II carregados no sistema.
        </p>
      </div>
    </aside>
  )
}
