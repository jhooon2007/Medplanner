import React, { createContext, useContext, useState, useEffect } from 'react'
import { Semester } from '@/types'

export const DEFAULT_SEMESTERS: Semester[] = [
  { id: '1', number: 1, name: '1º Semestre', year_period: 'Ciclo Básico • 1º Ano' },
  { id: '2', number: 2, name: '2º Semestre', year_period: 'Ciclo Básico • 1º Ano', is_current: true },
  { id: '3', number: 3, name: '3º Semestre', year_period: 'Ciclo Básico • 2º Ano' },
  { id: '4', number: 4, name: '4º Semestre', year_period: 'Ciclo Básico • 2º Ano' },
  { id: '5', number: 5, name: '5º Semestre', year_period: 'Ciclo Clínico • 3º Ano' },
  { id: '6', number: 6, name: '6º Semestre', year_period: 'Ciclo Clínico • 3º Ano' },
  { id: '7', number: 7, name: '7º Semestre', year_period: 'Ciclo Clínico • 4º Ano' },
  { id: '8', number: 8, name: '8º Semestre', year_period: 'Ciclo Clínico • 4º Ano' },
  { id: '9', number: 9, name: '9º Semestre', year_period: 'Internato • 5º Ano' },
  { id: '10', number: 10, name: '10º Semestre', year_period: 'Internato • 5º Ano' },
  { id: '11', number: 11, name: '11º Semestre', year_period: 'Internato • 6º Ano' },
  { id: '12', number: 12, name: '12º Semestre', year_period: 'Internato • 6º Ano' },
]

interface SemesterContextType {
  semesters: Semester[]
  currentSemester: number
  currentSemesterObj: Semester
  setCurrentSemester: (num: number) => void
  addSemester: (name: string, year_period?: string) => void
  deleteSemester: (id: string) => void
}

const SemesterContext = createContext<SemesterContextType | undefined>(undefined)

export const SemesterProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [semesters, setSemesters] = useState<Semester[]>(() => {
    try {
      const saved = localStorage.getItem('medplanner_semesters')
      if (saved) {
        const parsed = JSON.parse(saved)
        // Refresh cycle mapping if older cached version has 3º or 4º as Ciclo Clínico
        if (parsed.some((s: any) => (s.number === 3 || s.number === 4) && s.year_period?.includes('Clínico'))) {
          return DEFAULT_SEMESTERS
        }
        return parsed
      }
    } catch (e) {}
    return DEFAULT_SEMESTERS
  })

  const [currentSemester, setCurrentSemesterState] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('medplanner_current_semester')
      if (saved) return parseInt(saved, 10)
    } catch (e) {}
    return 2
  })

  useEffect(() => {
    try {
      localStorage.setItem('medplanner_semesters', JSON.stringify(semesters))
    } catch (e) {}
  }, [semesters])

  useEffect(() => {
    try {
      localStorage.setItem('medplanner_current_semester', currentSemester.toString())
    } catch (e) {}
  }, [currentSemester])

  const setCurrentSemester = (num: number) => {
    setCurrentSemesterState(num)
  }

  const addSemester = (name: string, year_period?: string) => {
    const nextNum = semesters.length > 0 ? Math.max(...semesters.map(s => s.number)) + 1 : 1
    const newSem: Semester = {
      id: String(Date.now()),
      number: nextNum,
      name: name.trim() || `${nextNum}º Semestre`,
      year_period: year_period?.trim() || 'Ciclo da Faculdade',
    }
    setSemesters(prev => [...prev, newSem])
    setCurrentSemesterState(newSem.number)
  }

  const deleteSemester = (id: string) => {
    setSemesters(prev => prev.filter(s => s.id !== id))
    if (semesters.length > 1) {
      const remaining = semesters.filter(s => s.id !== id)
      setCurrentSemesterState(remaining[0].number)
    }
  }

  const currentSemesterObj =
    semesters.find(s => s.number === currentSemester) ||
    semesters[0] || {
      id: '2',
      number: 2,
      name: '2º Semestre',
      year_period: 'Ciclo Básico',
    }

  return (
    <SemesterContext.Provider
      value={{
        semesters,
        currentSemester,
        currentSemesterObj,
        setCurrentSemester,
        addSemester,
        deleteSemester,
      }}
    >
      {children}
    </SemesterContext.Provider>
  )
}

export const useSemester = () => {
  const context = useContext(SemesterContext)
  if (!context) {
    throw new Error('useSemester must be used within a SemesterProvider')
  }
  return context
}
