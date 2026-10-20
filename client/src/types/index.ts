export interface User {
  id: number
  name: string
  email: string
  phone?: string | null
  photo_url?: string | null
  role: 'admin' | 'student'
  birth_date?: string | null
  current_semester?: number | null
  onboarding_completed?: boolean | number
  created_at?: string
  completed_subtopics_count?: number
  last_login_at?: string | null
  grades_filled_count?: number
  custom_events_count?: number
  custom_classes_count?: number
}

export type AnnouncementLevel = 'info' | 'warning' | 'urgent'

export interface Announcement {
  id: number
  title: string
  message: string
  level: AnnouncementLevel
  active?: number
  expires_at?: string | null
  created_at?: string
}

export interface Semester {
  id: string
  number: number
  name: string
  year_period?: string
  is_current?: boolean
}

export interface ClassItem {
  id: number
  user_id?: number | null
  semester?: number | string
  day_of_week: number // 1=Seg, 2=Ter, 3=Qua, 4=Qui, 5=Sex, 6=Sab
  start_time: string
  end_time: string
  subject_name: string
  room?: string
  teacher?: string
  type: 'Teórica' | 'Prática' | 'TBL' | 'Seminário' | 'Laboratório'
  color?: string
}

export interface ImportantEvent {
  id: number
  user_id?: number | null
  semester?: number | string
  title: string
  module_or_subject: string
  start_date: string // YYYY-MM-DD
  end_date?: string | null
  type: string
  topics: string[]
  is_custom?: number
}

export interface Subtopic {
  id: number
  topic_id: number
  name: string
  order_index?: number
  completed: boolean
}

export interface Topic {
  id: number
  subject_id: number
  name: string
  order_index?: number
  subtopics: Subtopic[]
}

export interface Subject {
  id: number
  user_id?: number | null
  semester?: number | string
  name: string
  code?: string
  icon?: string
  color: string
  description?: string
  order_index?: number
  topics: Topic[]
  totalSubtopics?: number
  completedSubtopics?: number
  percentage?: number
}

export interface GradeItem {
  id?: number
  user_id?: number
  module: string
  discipline?: string
  item_key: string
  item_name: string
  score?: number | null
  weight?: number
}

