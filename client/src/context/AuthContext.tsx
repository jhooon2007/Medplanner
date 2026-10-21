import React, { createContext, useContext, useState, useEffect } from 'react'
import { User } from '@/types'
import { API_UNAVAILABLE_MESSAGE } from '@/lib/api'

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  serverError: string | null
  retryConnection: () => void
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
  const [serverError, setServerError] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)
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
        const text = await res.text()
        let data: any = null
        try { data = JSON.parse(text) } catch (e) {}

        if (res.ok && data?.user) {
          setServerError(null)
          setUser(data.user)
          localStorage.setItem('medplanner_user', JSON.stringify(data.user))
        } else if (res.ok) {
          // 200 sem JSON de usuário: a hospedagem devolveu a página do site no lugar da API
          setServerError(API_UNAVAILABLE_MESSAGE)
        } else if (res.status === 401 || res.status === 403) {
          // Token expired or forbidden
          localStorage.removeItem('medplanner_token')
          localStorage.removeItem('medplanner_user')
          setToken(null)
          setUser(null)
        } else {
          setServerError(data?.error || `O servidor respondeu com erro ${res.status}.`)
        }
      } catch (err) {
        setServerError('Sem conexão com o servidor. Verifique sua internet e tente de novo.')
      } finally {
        setLoading(false)
      }
    }

    fetchMe()
  }, [token, retryKey])

  const retryConnection = () => {
    setServerError(null)
    setLoading(true)
    setRetryKey(k => k + 1)
  }

  const login = (newToken: string, newUser: User) => {
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
    setUser(updatedUser)
    localStorage.setItem('medplanner_user', JSON.stringify(updatedUser))
    if (newToken) {
      localStorage.setItem('medplanner_token', newToken)
      setToken(newToken)
    }
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, serverError, retryConnection, login, logout, updateProfile, isDark, toggleTheme }}>
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

