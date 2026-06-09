'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { Menu } from 'lucide-react'
import Sidebar from './Sidebar'
import { MessagingProvider } from '../context/MessagingContext'

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { user, profile, loading, logout } = useAuth() 
  
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  const router = useRouter()


  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-900" />
      </div>
    )
  }

  if (!user) return null

  return (
    <MessagingProvider>
    <div className="flex min-h-screen bg-white font-sans">
      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/30 md:hidden"
          onClick={() => setIsMobileOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div className={`
        fixed md:sticky top-0 h-screen z-30 shrink-0
        transition-transform duration-300 ease-in-out
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <Sidebar
          user={user}
          profile={profile} 
          onLogout={logout} 
          isCollapsed={isCollapsed}
          toggleSidebar={() => {
            if (typeof window !== 'undefined' && window.innerWidth < 768) {
              setIsMobileOpen(false)
            } else {
              setIsCollapsed((v) => !v)
            }
          }}
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 bg-gray-50">
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-100 sticky top-0 z-10">
          <button
            onClick={() => setIsMobileOpen(true)}
            aria-label="Ouvrir le menu"
            className="p-2 rounded-lg hover:bg-gray-100 text-opti-blue transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <span className="font-bold text-opti-blue font-display text-base">Optigistik</span>
        </div>

        <main className="flex-1 p-4 md:p-8 overflow-auto">
          {children}
        </main>
      </div>
    </div>
    </MessagingProvider>
  )
}