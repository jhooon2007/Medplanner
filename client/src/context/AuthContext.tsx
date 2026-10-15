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
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('medplanner_token'))
  const [loading, setLoading] = useState(true)
  const [isDark, setIsDark] = useState<boolean>(() => {
    return localStorage.getItem('medplanner_theme') === 'dark' ||
      window.matchMedia('(prefers-color-scheme: dark)').matches
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
          const data = await res.json()
          setUser(data.user)
        } else {
          // Token expired or invalid
          localStorage.removeItem('medplanner_token')
          setToken(null)
          setUser(null)
        }
      } catch (err) {
        console.error('Failed to authenticate token:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchMe()
  }, [token])

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('medplanner_token', newToken)
    setToken(newToken)
    setUser(newUser)
  }

  const logout = () => {
    localStorage.removeItem('medplanner_token')
    setToken(null)
    setUser(null)
  }

  const updateProfile = (updatedUser: User, newToken?: string) => {
    setUser(updatedUser)
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

