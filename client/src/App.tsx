import React, { useState } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { SemesterProvider } from '@/context/SemesterContext'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { WeeklySchedule } from '@/pages/WeeklySchedule'
import { ImportantEvents } from '@/pages/ImportantEvents'
import { GradeCalculator } from '@/pages/GradeCalculator'
import { SemesterSubjects } from '@/pages/SemesterSubjects'
import { AdminDashboard } from '@/pages/AdminDashboard'
import { LoginView } from '@/pages/LoginView'
import { Stethoscope } from 'lucide-react'

const MainApp: React.FC = () => {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<string>('agenda')

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        <div className="h-12 w-12 rounded-2xl bg-blue-600/10 text-blue-600 flex items-center justify-center animate-pulse mb-3">
          <Stethoscope className="h-6 w-6" />
        </div>
        <p className="text-xs sm:text-sm font-semibold text-slate-500">
          Carregando Med Planner...
        </p>
      </div>
    )
  }

  // Strict Auth Gate: Block all app access if user is not authenticated
  if (!user) {
    return <LoginView />
  }

  const renderActiveScreen = () => {
    switch (activeTab) {
      case 'agenda':
        return <WeeklySchedule />
      case 'eventos':
        return <ImportantEvents />
      case 'notas':
        return <GradeCalculator />
      case 'materias':
        return <SemesterSubjects />
      case 'admin':
        return user?.role === 'admin' ? <AdminDashboard /> : <WeeklySchedule />
      default:
        return <WeeklySchedule />
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50/60 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      <Navbar
        onOpenAuth={() => {}}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />

      <div className="flex flex-1 max-w-7xl w-full mx-auto pb-20 lg:pb-8">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />

        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {renderActiveScreen()}
        </main>
      </div>

      <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <SemesterProvider>
        <MainApp />
      </SemesterProvider>
    </AuthProvider>
  )
}

export default App
