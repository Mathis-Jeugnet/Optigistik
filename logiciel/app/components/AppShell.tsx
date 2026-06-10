'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '../context/AuthContext'
import { Menu, AlertTriangle, X } from 'lucide-react'
import Sidebar from './Sidebar'
import { MessagingProvider } from '../context/MessagingContext'
import TrafficIncidentsPanel from './TrafficIncidentsPanel' // NOUVEL IMPORT

interface AppShellProps {
  children: React.ReactNode
}

export default function AppShell({ children }: AppShellProps) {
  const { user, profile, loading, logout } = useAuth() 
  
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isMobileOpen, setIsMobileOpen] = useState(false)
  
  // ÉTAT POUR LE PANNEAU DE TRAFIC
  const [isTrafficPanelOpen, setIsTrafficPanelOpen] = useState(false)
  
  const router = useRouter()

  // Déconnecté sur une page protégée (ex : accès direct à /tournees ou session
  // expirée) → redirection vers la page de connexion, quelle que soit l'URL.
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/')
    }
  }, [user, loading, router])

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
      <div className="flex min-h-screen bg-white font-sans relative overflow-hidden">
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

        {/* BOUTON FLOTTANT : CENTRE DE TRAFIC (Z-INDEX 9990) */}
        <button
          onClick={() => setIsTrafficPanelOpen(true)}
          className="fixed bottom-8 right-8 z-[9990] flex items-center gap-2 px-5 py-3 rounded-full bg-white text-opti-blue font-bold shadow-xl border border-gray-200 hover:border-opti-red hover:text-opti-red transition-all group"
        >
          <div className="relative">
            <AlertTriangle className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-opti-red opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-opti-red"></span>
            </span>
          </div>
          <span className="hidden group-hover:inline-block">Trafic</span>
        </button>

        {/* PANNEAU LATÉRAL GLISSANT POUR LE TRAFIC */}
        <>
          {/* Overlay sombre */}
          {isTrafficPanelOpen && (
            <div 
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[9998] transition-opacity"
              onClick={() => setIsTrafficPanelOpen(false)}
            />
          )}

          {/* Panneau */}
          <div 
            className={`fixed top-0 right-0 h-full w-full max-w-md bg-slate-50 shadow-2xl z-[9999] transform transition-transform duration-300 ease-in-out overflow-y-auto ${
              isTrafficPanelOpen ? 'translate-x-0' : 'translate-x-full'
            }`}
          >
            <div className="p-4 flex items-center justify-between border-b border-gray-200 bg-white sticky top-0 z-[10000]">
              <h3 className="font-bold text-opti-blue">Centre de Contrôle</h3>
              <button 
                onClick={() => setIsTrafficPanelOpen(false)}
                className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6">
              <TrafficIncidentsPanel />
            </div>
          </div>
        </>
      </div>
    </MessagingProvider>
  )
}