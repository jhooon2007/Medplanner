import React, { createContext, useContext, useState, useEffect } from 'react'
import { User } from '@/types'

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (token: string, user: User) => void
  logout: () => void
  updateProfile: (updatedUser: User, newToken?: string) => void
  isDark: boolean
  toggleTheme: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    try {
      const savedUser = localStorage.getItem('medplanner_user')
      if (savedUser) return JSON.parse(savedUser)
    } catch (e) {}
    return null
  })
  const [token, setToken] = useState<string | null>(localStorage.getItem('medplanner_token'))
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('medplanner_theme')
    if (saved) return saved === 'dark'
    return false
  })

  // Apply dark class to document
  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark')
      localStorage.setItem('medplanner_theme', 'dark')
    } else {
      document.documentElement.classList.remove('dark')
      localStorage.setItem('medplanner_theme', 'light')
    }
  }, [isDark])

  const toggleTheme = () => setIsDark(prev => !prev)

  // Verify token on mount
  useEffect(() => {
    const fetchMe = async () => {
      if (!token) {
        setLoading(false)
        return
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        })
        if (res.ok) {
          const text = await res.text()
          try {
            const data = JSON.parse(text)
            if (data.user) {
              const uEmail = data.user.email ? data.user.email.toLowerCase().trim() : ''
              if (
                localStorage.getItem(`medplanner_onboarding_done_${uEmail}`) === 'true' ||
                (data.user.birth_date && data.user.current_semester && data.user.phone)
              ) {
                data.user.onboarding_completed = 1
                if (uEmail) localStorage.setItem(`medplanner_onboarding_done_${uEmail}`, 'true')
              }
              setUser(data.user)
              localStorage.setItem('medplanner_user', JSON.stringify(data.user))
            }
          } catch (e) {}
        } else if (res.status === 401 || res.status === 403) {
          // Token expired or forbidden
          localStorage.removeItem('medplanner_token')
          localStorage.removeItem('medplanner_user')
          setToken(null)
          setUser(null)
        }
      } catch (err) {
        console.warn('Backend unreachable, keeping local session:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMe()
  }, [token])

  const login = (newToken: string, newUser: User) => {
    const uEmail = newUser.email ? newUser.email.toLowerCase().trim() : ''
    if (
      localStorage.getItem(`medplanner_onboarding_done_${uEmail}`) === 'true' ||
      (newUser.birth_date && newUser.current_semester && newUser.phone)
    ) {
      newUser.onboarding_completed = 1
      if (uEmail) localStorage.setItem(`medplanner_onboarding_done_${uEmail}`, 'true')
    }
    localStorage.setItem('medplanner_token', newToken)
    localStorage.setItem('medplanner_user', JSON.stringify(newUser))
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('medplanner_token')
    localStorage.removeItem('medplanner_user')
    setToken(null)
    setUser(null)
  }

  const updateProfile = (updatedUser: User, newToken?: string) => {
    const uEmail = updatedUser.email ? updatedUser.email.toLowerCase().trim() : ''
    if (updatedUser.onboarding_completed && uEmail) {
      localStorage.setItem(`medplanner_onboarding_done_${uEmail}`, 'true')
    }
    setUser(updatedUser)
    localStorage.setItem('medplanner_user', JSON.stringify(updatedUser))
    if (newToken) {
      localStorage.setItem('medplanner_token', newToken)
      setToken(newToken)
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateProfile, isDark, toggleTheme }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

