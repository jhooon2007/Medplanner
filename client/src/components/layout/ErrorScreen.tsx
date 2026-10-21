import React from 'react'
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react'

interface ErrorScreenProps {
  title: string
  message: string
  onRetry?: () => void
  onLogout?: () => void
}

export const ErrorScreen: React.FC<ErrorScreenProps> = ({ title, message, onRetry, onLogout }) => (
  <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6">
    <div className="max-w-md w-full rounded-2xl border border-rose-200 dark:border-rose-900/60 bg-white dark:bg-slate-900 p-6 text-center shadow-lg">
      <AlertTriangle className="h-10 w-10 text-rose-500 mx-auto mb-3" />
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="text-sm text-slate-600 dark:text-slate-300 mt-2 break-words">{message}</p>
      <div className="flex flex-col sm:flex-row gap-2 justify-center mt-5">
        {onRetry && (
          <button onClick={onRetry}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 cursor-pointer">
            <RefreshCw className="h-4 w-4" /> Tentar de novo
          </button>
        )}
        {onLogout && (
          <button onClick={onLogout}
            className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-medium hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer">
            <LogOut className="h-4 w-4" /> Sair
          </button>
        )}
      </div>
    </div>
  </div>
)
