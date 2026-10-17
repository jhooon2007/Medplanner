import { User } from '@/types'

const STORAGE_KEY = 'medplanner_registered_users'

export const INITIAL_REGISTERED_USERS: User[] = [
  {
    id: 1,
    name: 'Administrador UFG',
    email: 'admin@medplanner.com',
    phone: '(62) 98888-0000',
    role: 'admin',
    birth_date: '1998-05-20',
    current_semester: 4,
    onboarding_completed: 1,
    created_at: '2026-10-15T01:50:57.000Z',
    completed_subtopics_count: 42
  },
  {
    id: 2,
    name: 'João Victor',
    email: 'jvictor8573@gmail.com',
    phone: '(62) 99999-0000',
    role: 'student',
    birth_date: '2004-03-15',
    current_semester: 4,
    onboarding_completed: 1,
    created_at: '2026-10-15T12:00:00.000Z',
    completed_subtopics_count: 28
  }
]

export function isUserOnboardingPending(user: User | null | undefined): boolean {
  if (!user) return false
  if (user.role === 'admin') return false // Admins are system operators

  // Mandatory fields check
  const hasName = Boolean(user.name && user.name.trim().length >= 2)
  const hasEmail = Boolean(user.email && user.email.includes('@'))
  const hasPhone = Boolean(user.phone && user.phone.trim().length >= 8)
  const hasBirthDate = Boolean(user.birth_date && user.birth_date.trim().length >= 4)
  const hasSemester = Boolean(user.current_semester && user.current_semester >= 1 && user.current_semester <= 12)
  const isMarkedCompleted = Boolean(user.onboarding_completed)

  // If any required field is missing or not marked as completed
  return !isMarkedCompleted || !hasName || !hasEmail || !hasPhone || !hasBirthDate || !hasSemester
}

export function getRegisteredUsersLocally(): User[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Ensure standard users (admin and João Victor) are always present
        const map = new Map<string, User>()
        INITIAL_REGISTERED_USERS.forEach(u => map.set(u.email.toLowerCase(), u))
        parsed.forEach((u: User) => {
          if (u && u.email) {
            const existing = map.get(u.email.toLowerCase())
            map.set(u.email.toLowerCase(), { ...existing, ...u })
          }
        })
        return Array.from(map.values())
      }
    }
  } catch (e) {
    console.warn('Error reading registered users from localStorage:', e)
  }

  // First time initialization
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_REGISTERED_USERS))
  } catch (e) {}
  return INITIAL_REGISTERED_USERS
}

export function saveRegisteredUserLocally(user: Partial<User> & { email: string }): User {
  const current = getRegisteredUsersLocally()
  const normalizedEmail = user.email.toLowerCase().trim()
  const existingIndex = current.findIndex(u => u.email.toLowerCase() === normalizedEmail)

  let updatedUser: User
  if (existingIndex >= 0) {
    updatedUser = {
      ...current[existingIndex],
      ...user,
      id: current[existingIndex].id,
      email: normalizedEmail,
    }
    current[existingIndex] = updatedUser
  } else {
    updatedUser = {
      id: user.id || Date.now(),
      name: user.name || normalizedEmail.split('@')[0],
      email: normalizedEmail,
      phone: user.phone || null,
      photo_url: user.photo_url || null,
      role: user.role || 'student',
      birth_date: user.birth_date || null,
      current_semester: user.current_semester || null,
      onboarding_completed: user.onboarding_completed || 0,
      created_at: user.created_at || new Date().toISOString(),
      completed_subtopics_count: user.completed_subtopics_count || 0
    }
    current.unshift(updatedUser)
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current))
  } catch (e) {}

  return updatedUser
}

export function deleteRegisteredUserLocally(idOrEmail: number | string): User[] {
  const current = getRegisteredUsersLocally()
  const updated = current.filter(u => {
    if (typeof idOrEmail === 'number') {
      return u.id !== idOrEmail
    }
    return u.email.toLowerCase() !== String(idOrEmail).toLowerCase()
  })

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
  } catch (e) {}

  return updated
}

export function mergeUsers(serverUsers: User[] = []): User[] {
  const localUsers = getRegisteredUsersLocally()
  const map = new Map<string, User>()

  // 1. Populate with local users (includes any client offline registrations or Google logins)
  localUsers.forEach(u => {
    if (u && u.email) map.set(u.email.toLowerCase(), u)
  })

  // 2. Overlay server data
  serverUsers.forEach(u => {
    if (u && u.email) {
      const email = u.email.toLowerCase()
      const existing = map.get(email)
      map.set(email, {
        ...(existing || {}),
        ...u,
        completed_subtopics_count: u.completed_subtopics_count ?? existing?.completed_subtopics_count ?? 0
      })
    }
  })

  const merged = Array.from(map.values())
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch (e) {}

  return merged
}
