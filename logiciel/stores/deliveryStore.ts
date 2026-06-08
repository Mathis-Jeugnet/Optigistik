import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  DeliverySession,
  DeliveryPoint,
  PivotNode,
  SessionMeta,
  ORToolsPayload,
} from '@/types/logistics'

interface DeliveryState {
  session: DeliverySession | null
  isDirty: boolean

  initSession: (meta: SessionMeta) => void
  setOriginNode: (node: Partial<PivotNode>) => void
  setEndNode: (node: Partial<PivotNode>) => void
  addDeliveryPoints: (points: DeliveryPoint[]) => void
  updateDeliveryPoint: (id: string, patch: Partial<DeliveryPoint>) => void
  removeDeliveryPoint: (id: string) => void
  reorderDeliveryPoints: (orderedIds: string[]) => void
  resetSession: () => void
  updateSessionName: (name: string) => void

  selectPayload: () => ORToolsPayload | null
  selectValidationErrors: () => string[]
  selectTotalDepotServiceTime: () => number
}

function isTimeWindowValid(start: string, end: string): boolean {
  return start < end
}

export const useDeliveryStore = create<DeliveryState>()(
  persist(
    (set, get) => ({
      session: null,
      isDirty: false,

      initSession: (meta) => {
        set({
          session: {
            id: crypto.randomUUID(),
            meta,
            origin_node: { address: '' },
            delivery_points: [],
            end_node: { address: '' },
            createdAt: new Date(),
            updatedAt: new Date(),
          },
          isDirty: true,
        })
      },

      setOriginNode: (node) => {
        const { session } = get()
        if (!session) return
        set({
          session: {
            ...session,
            origin_node: { ...session.origin_node, ...node },
            updatedAt: new Date(),
          },
          isDirty: true,
        })
      },

      setEndNode: (node) => {
        const { session } = get()
        if (!session) return
        set({
          session: {
            ...session,
            end_node: { ...session.end_node, ...node },
            updatedAt: new Date(),
          },
          isDirty: true,
        })
      },

      addDeliveryPoints: (points) => {
        const { session } = get()
        if (!session) return
        set({
          session: {
            ...session,
            delivery_points: [...session.delivery_points, ...points],
            updatedAt: new Date(),
          },
          isDirty: true,
        })
      },

      updateDeliveryPoint: (id, patch) => {
        const { session } = get()
        if (!session) return
        set({
          session: {
            ...session,
            delivery_points: session.delivery_points.map((p) =>
              p.id === id ? { ...p, ...patch } : p
            ),
            updatedAt: new Date(),
          },
          isDirty: true,
        })
      },

      removeDeliveryPoint: (id) => {
        const { session } = get()
        if (!session) return
        set({
          session: {
            ...session,
            delivery_points: session.delivery_points.filter((p) => p.id !== id),
            updatedAt: new Date(),
          },
          isDirty: true,
        })
      },

      reorderDeliveryPoints: (orderedIds) => {
        const { session } = get()
        if (!session) return
        const pointsMap = new Map(session.delivery_points.map((p) => [p.id, p]))
        const reordered = orderedIds.flatMap((id) => {
          const p = pointsMap.get(id)
          return p ? [p] : []
        })
        set({
          session: { ...session, delivery_points: reordered, updatedAt: new Date() },
          isDirty: true,
        })
      },

      resetSession: () => {
        set({ session: null, isDirty: false })
      },

      updateSessionName: (name) => {
        const { session } = get()
        if (!session) return
        set({
          session: { ...session, meta: { ...session.meta, name }, updatedAt: new Date() },
          isDirty: true,
        })
      },

      selectPayload: () => {
        const { session } = get()
        if (!session) return null

        const points = session.delivery_points.filter(
          (p) => p.pallets > 0 && isTimeWindowValid(p.time_window.start, p.time_window.end)
        )

        return {
          meta: session.meta,
          origin_node: { address: session.origin_node.address },
          delivery_points: points.map((p) => ({
            id: p.id,
            address: p.address,
            pallets: p.pallets,
            loading_time: p.loading_time_at_depot * 60,
            unloading_time: p.unloading_time_at_client * 60,
            time_window: p.time_window,
          })),
          end_node: { address: session.end_node.address },
        }
      },

      selectValidationErrors: () => {
        const { session } = get()
        if (!session) return ['Aucune session initialisée']
        const errors: string[] = []

        if (!session.origin_node.address)
          errors.push('Adresse de départ manquante')
        if (!session.end_node.address)
          errors.push('Adresse de retour manquante')

        const badWindowCount = session.delivery_points.filter(
          (p) => !isTimeWindowValid(p.time_window.start, p.time_window.end)
        ).length
        if (badWindowCount > 0)
          errors.push(`${badWindowCount} fenêtre(s) horaire(s) invalide(s) (fin ≤ début)`)

        const badPalletsCount = session.delivery_points.filter(
          (p) => p.pallets <= 0
        ).length
        if (badPalletsCount > 0)
          errors.push(`${badPalletsCount} point(s) avec un nombre de palettes invalide`)

        if (session.delivery_points.length === 0)
          errors.push('Aucun point de livraison ajouté')

        return errors
      },

      selectTotalDepotServiceTime: () => {
        const { session } = get()
        if (!session) return 0
        return session.delivery_points.reduce(
          (sum, p) => sum + p.loading_time_at_depot,
          0
        )
      },
    }),
    {
      name: 'delivery_draft',
      partialize: (state) => ({ session: state.session }),
    }
  )
)
