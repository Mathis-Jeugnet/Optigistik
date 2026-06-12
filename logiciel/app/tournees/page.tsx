'use client'

import { useEffect, useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import AppShell from '@/app/components/AppShell'
import RoleGuard from '@/app/components/RoleGuard'
import { listSessions, deleteSession } from '@/services/firestoreSession'
import { useDeliveryStore } from '@/stores/deliveryStore'
import type { DeliverySession } from '@/types/logistics'

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-slate-400 shrink-0" aria-hidden>
      <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.4"/>
      <path d="M10.5 10.5l3 3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
    </svg>
  )
}

export default function TourneesPage() {
  const router = useRouter()
  const resetSession = useDeliveryStore((s) => s.resetSession)
  const [sessions, setSessions] = useState<DeliverySession[]>([])
  const [loading, setLoading] = useState(true)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return
      listSessions()
        .then(setSessions)
        .catch(console.error)
        .finally(() => setLoading(false))
    })
    return () => unsubscribe()
  }, [])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    return sessions.filter((s) => {
      const matchesSearch = !q ||
        (s.meta.name ?? '').toLowerCase().includes(q) ||
        s.origin_node.address.toLowerCase().includes(q) ||
        s.end_node.address.toLowerCase().includes(q) ||
        s.meta.date.includes(q)
      const matchesDate = !dateFilter || s.meta.date === dateFilter
      return matchesSearch && matchesDate
    })
  }, [sessions, search, dateFilter])

  const handleNew = () => {
    resetSession()
    router.push('/tournees/saisie')
  }

  const handleOpen = (session: DeliverySession) => {
    useDeliveryStore.setState({ session, isDirty: false })
    router.push('/tournees/saisie')
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await deleteSession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      console.error(err)
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const hasFilters = search !== '' || dateFilter !== ''

  return (
    <AppShell>
      <RoleGuard allowedRoles={["Admin", "Gestionnaire", "Lecteur", "Chauffeur"]}>
      <div className="animate-in space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-opti-blue font-display">Mes tournées</h1>
            <p className="text-sm text-slate-500 mt-1">Retrouvez et continuez vos saisies en cours.</p>
          </div>
          <button
            onClick={handleNew}
            className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-opti-red hover:bg-opti-red-dark transition-colors"
          >
            + Nouvelle tournée
          </button>
        </div>

        {/* Search + date filter */}
        {!loading && sessions.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2">
                <SearchIcon />
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher par nom, adresse dépôt…"
                className="w-full border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-opti-blue placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors bg-white"
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red transition-colors bg-white"
              />
              {hasFilters && (
                <button
                  onClick={() => { setSearch(''); setDateFilter('') }}
                  className="px-4 py-2.5 rounded-xl border border-gray-200 text-sm font-bold text-slate-400 hover:text-opti-blue hover:bg-gray-50 transition-colors"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center text-sm text-slate-400">
            Chargement…
          </div>
        )}

        {/* Empty (no sessions at all) */}
        {!loading && sessions.length === 0 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center space-y-3">
            <p className="text-sm text-slate-400">Aucune tournée sauvegardée.</p>
            <button
              onClick={handleNew}
              className="px-5 py-2.5 rounded-xl text-sm font-bold text-white bg-opti-red hover:bg-opti-red-dark transition-colors"
            >
              Créer ma première tournée
            </button>
          </div>
        )}

        {/* No results after filter */}
        {!loading && sessions.length > 0 && filtered.length === 0 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 text-center text-sm text-slate-400">
            Aucune tournée ne correspond à votre recherche.
          </div>
        )}

        {/* List */}
        {!loading && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((session) => {
              const name = session.meta.name || `Tournée du ${formatDate(session.meta.date)}`
              const isConfirming = confirmDeleteId === session.id
              const isDeleting = deletingId === session.id

              return (
                <div
                  key={session.id}
                  className="bg-white rounded-3xl px-4 sm:px-6 py-4 shadow-sm border border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-opti-blue truncate">{name}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {session.origin_node.address || 'Dépôt non défini'}
                      {' · '}
                      {session.delivery_points.length} point{session.delivery_points.length > 1 ? 's' : ''}
                      {' · '}
                      Modifié le {formatDate(session.updatedAt)}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 sm:shrink-0">
                    {isConfirming ? (
                      <>
                        <span className="text-xs text-slate-500 mr-1">Supprimer ?</span>
                        <button
                          onClick={() => handleDelete(session.id)}
                          disabled={isDeleting}
                          className="px-3 py-1.5 rounded-xl text-xs font-bold text-white bg-opti-red hover:bg-opti-red-dark transition-colors disabled:opacity-40"
                        >
                          {isDeleting ? '…' : 'Oui'}
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold text-opti-blue hover:bg-gray-50 transition-colors"
                        >
                          Non
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setConfirmDeleteId(session.id)}
                          className="px-4 py-2 rounded-xl border border-gray-200 text-sm font-bold text-slate-400 hover:text-opti-red hover:border-red-100 hover:bg-red-50 transition-colors"
                        >
                          Supprimer
                        </button>
                        <button
                          onClick={() => handleOpen(session)}
                          className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-opti-red hover:bg-opti-red-dark transition-colors"
                        >
                          Ouvrir
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
      </RoleGuard>
    </AppShell>
  )
}
