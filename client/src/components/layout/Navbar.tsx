import React from 'react'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/Button'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Sun, Moon, LogOut, Shield, Stethoscope, User as UserIcon } from 'lucide-react'

interface NavbarProps {
  onOpenAuth: () => void
  activeTab: string
  setActiveTab: (tab: string) => void
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenAuth, activeTab, setActiveTab }) => {
  const { user, logout, isDark, toggleTheme } = useAuth()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-md dark:border-slate-800/80 dark:bg-slate-900/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Logo and Brand */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-md shadow-blue-500/20">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white">
                Med Planner
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950/70 dark:text-blue-300">
                by João Victor
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span>Semestre 2026.2</span>
              <span className="hidden sm:inline">• UFG Medicina</span>
            </div>
          </div>
        </div>

        {/* Right Actions: Theme Toggle, User Profile or Login */}
        <div className="flex items-center gap-2 sm:gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="rounded-xl h-9 w-9 text-slate-600 dark:text-slate-300"
            title={isDark ? 'Modo Claro' : 'Modo Escuro'}
          >
            {isDark ? <Sun className="h-4 w-4 text-amber-400" /> : <Moon className="h-4 w-4 text-slate-600" />}
          </Button>

          {user ? (
            <div className="flex items-center gap-2 sm:gap-3 pl-2 border-l border-slate-200 dark:border-slate-800">
              {user.role === 'admin' && (
                <Button
                  variant={activeTab === 'admin' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('admin')}
                  className="hidden md:flex items-center gap-1.5 text-xs font-semibold h-8 rounded-lg"
                >
                  <Shield className="h-3.5 w-3.5" />
                  Painel Admin
                </Button>
              )}

              <div className="flex items-center gap-2.5">
                <Avatar
                  src={user.photo_url}
                  fallback={user.name}
                  size="sm"
                  className="ring-2 ring-blue-500/20"
                />
                <div className="hidden sm:block text-left">
                  <div className="text-xs font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1">
                    {user.name}
                    {user.role === 'admin' && (
                      <Badge variant="blue" className="text-[10px] py-0 px-1.5">Admin</Badge>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate max-w-[120px]">
                    {user.email}
                  </div>
                </div>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                className="rounded-xl h-9 w-9 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400"
                title="Sair"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              onClick={onOpenAuth}
              size="sm"
              className="text-xs font-semibold rounded-xl h-9 px-4 gap-1.5"
            >
              <UserIcon className="h-3.5 w-3.5" />
              Entrar / Cadastrar
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
