import React, { useState } from 'react'
import { AuthProvider, useAuth } from '@/context/AuthContext'
import { Navbar } from '@/components/layout/Navbar'
import { Sidebar } from '@/components/layout/Sidebar'
import { BottomNav } from '@/components/layout/BottomNav'
import { WeeklySchedule } from '@/pages/WeeklySchedule'
import { ImportantEvents } from '@/pages/ImportantEvents'
import { GradeCalculator } from '@/pages/GradeCalculator'
import { SemesterSubjects } from '@/pages/SemesterSubjects'
import { AdminDashboard } from '@/pages/AdminDashboard'
import { AuthModal } from '@/components/auth/AuthModal'

const MainApp: React.FC = () => {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<string>('agenda')
  const [authModalOpen, setAuthModalOpen] = useState(false)

  // Show auth modal on first load if user isn't logged in
  React.useEffect(() => {
    if (!loading && !user) {
      // Optional: prompt user to log in or register
      const hasDismissed = sessionStorage.getItem('medplanner_auth_prompted')
      if (!hasDismissed) {
        setAuthModalOpen(true)
        sessionStorage.setItem('medplanner_auth_prompted', 'true')
      }
    }
  }, [loading, user])

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
        onOpenAuth={() => setAuthModalOpen(true)}
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

      <AuthModal
        open={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
      />
    </div>
  )
}

export function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  )
}

export default App
