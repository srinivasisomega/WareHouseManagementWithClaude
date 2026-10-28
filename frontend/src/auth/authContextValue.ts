import { createContext } from 'react'
import type { Role, Session } from '../api/types'

export interface AuthContextValue {
  user: { username: string; role: Role } | null
  login: (username: string, password: string) => Promise<Session>
  logout: () => void
}

export const AuthContext = createContext<AuthContextValue | null>(null)
