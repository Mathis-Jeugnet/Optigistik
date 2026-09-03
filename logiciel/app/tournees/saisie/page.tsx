'use client'

import Link from 'next/link'
import DashboardLayout from '@/app/components/DashboardLayout' 
import AppShell from '@/app/components/AppShell'
import RoleGuard from '@/app/components/RoleGuard'
import TourneeInput from '@/app/components/TourneeInput'

export default function TourneeSaisiePage() {
  return (
    <DashboardLayout>
      <RoleGuard allowedRoles={["Admin", "Gestionnaire", "Lecteur", "Chauffeur"]}>
      <div className="space-y-4 max-w-7xl mx-auto">
        <Link
          href="/tournees"
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-opti-blue transition-colors"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
            <path d="M9 2L4 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Mes tournées
        </Link>
        <TourneeInput />
      </div>
      </RoleGuard>
    </DashboardLayout>
  )
}
