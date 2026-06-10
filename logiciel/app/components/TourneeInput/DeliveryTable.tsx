'use client'

import { useState, useEffect } from 'react'
import { useReactTable, getCoreRowModel, getPaginationRowModel, flexRender, createColumnHelper } from '@tanstack/react-table'
import { useDeliveryStore } from '@/stores/deliveryStore'
import AddressCell from './AddressCell'
import type { DeliveryPoint } from '@/types/logistics'
import { getVehicleTypes, getSpecialties, VehicleType, Specialty } from '@/services/fleet'

function PencilIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M9.5 2.5l2 2L4 12H2v-2L9.5 2.5z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M5.5 2h3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M2 3.5h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M3.2 3.5l.8 8.5h5.9l.9-8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5.5 5.5v4.5M8.5 5.5v4.5" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden>
      <path d="M2.5 7l3.5 3.5 5.5-6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

const PAGE_SIZE = 25

function EditableCell({ value, type = 'number', onSave, forceEdit = false }: { value: string | number; type?: 'number' | 'time'; onSave: (v: string) => void; forceEdit?: boolean }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(String(value))

  const isEditing = editing || forceEdit

  const commit = () => { onSave(draft); if (!forceEdit) setEditing(false) }

  if (!isEditing) {
    return (
      <span
        role="button"
        tabIndex={0}
        aria-label={`Modifier la valeur ${value}`}
        className="cursor-pointer text-opti-blue hover:underline decoration-dotted"
        onDoubleClick={() => { setDraft(String(value)); setEditing(true) }}
        onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
      >
        {value}
      </span>
    )
  }

  return (
    <input
      aria-label="Modifier la valeur"
      type={type}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape' && !forceEdit) setEditing(false) }}
      className="w-full border border-gray-200 rounded-lg px-2 py-1 text-sm text-opti-blue focus:outline-none focus:ring-2 focus:ring-opti-red/20 focus:border-opti-red"
    />
  )
}

export default function DeliveryTable() {
  const session = useDeliveryStore((s) => s.session)
  const updateDeliveryPoint = useDeliveryStore((s) => s.updateDeliveryPoint)
  const removeDeliveryPoint = useDeliveryStore((s) => s.removeDeliveryPoint)
  const [editingRowId, setEditingRowId] = useState<string | null>(null)
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null)
  
  // États pour les options des flottes
  const [vehicleTypes, setVehicleTypes] = useState<VehicleType[]>([])
  const [specialties, setSpecialties] = useState<Specialty[]>([])

  useEffect(() => {
    Promise.all([getVehicleTypes(), getSpecialties()]).then(([types, specs]) => {
      setVehicleTypes(types)
      setSpecialties(specs)
    })
  }, [])

  const startRowEdit = (id: string) => { setEditingRowId(id); setEditingAddressId(id) }
  const stopRowEdit = () => { setEditingRowId(null); setEditingAddressId(null) }

  const points = session?.delivery_points ?? []

  const col = createColumnHelper<DeliveryPoint>()

  const columns = [
    col.accessor('address', {
      header: 'Adresse',
      size: 250,
      cell: ({ row }) => {
        const id = row.original.id
        if (editingAddressId === id) {
          return <AddressCell point={row.original} onDone={() => setEditingAddressId(null)} />
        }
        if (editingRowId === id) {
          return (
            <button
              className="block max-w-xs truncate text-sm text-opti-blue underline decoration-dotted text-left"
              title="Cliquer pour modifier l'adresse"
              onClick={() => setEditingAddressId(id)}
            >
              {row.original.address}
            </button>
          )
        }
        return <span className="block max-w-xs truncate text-sm text-opti-blue" title={row.original.address}>{row.original.address}</span>
      },
    }),
    col.accessor('pallets', {
      header: 'Palettes',
      size: 80,
      cell: ({ row }) => (
        <EditableCell value={row.original.pallets} type="number"
          forceEdit={editingRowId === row.original.id}
          onSave={(v) => updateDeliveryPoint(row.original.id, { pallets: Math.max(1, Math.round(Number(v))) })} />
      ),
    }),
    col.display({
      id: 'time_window',
      header: 'Horaires',
      size: 130,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm">
          <EditableCell value={row.original.time_window.start} type="time"
            forceEdit={editingRowId === row.original.id}
            onSave={(v) => updateDeliveryPoint(row.original.id, { time_window: { ...row.original.time_window, start: v } })} />
          <span className="text-slate-400">–</span>
          <EditableCell value={row.original.time_window.end} type="time"
            forceEdit={editingRowId === row.original.id}
            onSave={(v) => updateDeliveryPoint(row.original.id, { time_window: { ...row.original.time_window, end: v } })} />
        </div>
      ),
    }),
    col.display({
      id: 'temps_service',
      header: 'Tps (Chgt/Décht)',
      size: 110,
      cell: ({ row }) => (
        <div className="flex items-center gap-1 text-sm text-slate-500">
          <EditableCell value={row.original.loading_time_at_depot} type="number"
            forceEdit={editingRowId === row.original.id}
            onSave={(v) => updateDeliveryPoint(row.original.id, { loading_time_at_depot: Math.max(1, Math.round(Number(v))) })} />
          <span>/</span>
          <EditableCell value={row.original.unloading_time_at_client} type="number"
            forceEdit={editingRowId === row.original.id}
            onSave={(v) => updateDeliveryPoint(row.original.id, { unloading_time_at_client: Math.max(1, Math.round(Number(v))) })} />
        </div>
      ),
    }),
    // NOUVELLE COLONNE : Typologie de camion
    col.display({
      id: 'vehicle_constraints',
      header: 'Typologie de camion',
      size: 150,
      cell: ({ row }) => {
        const isEditing = editingRowId === row.original.id;
        const currentTypeId = row.original.allowed_vehicle_types?.[0] || '';

        if (isEditing) {
          return (
            <select
              value={currentTypeId}
              onChange={(e) => {
                const val = e.target.value;
                updateDeliveryPoint(row.original.id, { allowed_vehicle_types: val ? [val] : [] })
              }}
              className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs text-opti-blue focus:outline-none focus:border-opti-red bg-white"
            >
              <option value="">Aucune typologie particulière</option>
              {vehicleTypes.map(vt => (
                <option key={vt.id} value={vt.id}>{vt.name}</option>
              ))}
            </select>
          )
        }

        const typeName = vehicleTypes.find(vt => vt.id === currentTypeId)?.name;
        return (
          <span className="text-xs font-semibold text-slate-600 bg-slate-100 px-2 py-1 rounded-md border border-slate-200 truncate inline-block max-w-[140px]" title={typeName || "Standard"}>
            {typeName || "Standard"}
          </span>
        )
      },
    }),
    // NOUVELLE COLONNE : Équipement requis (Choix unique)
    col.display({
      id: 'skills_constraints',
      header: 'Équipement',
      size: 150,
      cell: ({ row }) => {
        const isEditing = editingRowId === row.original.id;
        const currentSkills = row.original.required_skills || [];

        if (isEditing) {
          return (
            <div className="flex flex-wrap gap-1 max-w-[150px]">
              {specialties.map(spec => {
                const isActive = currentSkills.includes(spec.name);
                return (
                  <button
                    key={spec.id}
                    onClick={() => {
                      // Si déjà actif, on désélectionne (tableau vide). Sinon, on remplace par cet unique équipement.
                      const newSkills = isActive ? [] : [spec.name];
                      updateDeliveryPoint(row.original.id, { required_skills: newSkills })
                    }}
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors border ${
                      isActive 
                        ? 'bg-opti-red text-white border-opti-red' 
                        : 'bg-white text-slate-400 border-slate-200 hover:border-opti-red/50'
                    }`}
                  >
                    {spec.name}
                  </button>
                )
              })}
            </div>
          )
        }

        if (currentSkills.length === 0) return <span className="text-xs text-slate-400 italic">Aucun</span>;

        return (
          <div className="flex flex-wrap gap-1">
            {currentSkills.map(skill => (
              <span key={skill} className="text-[10px] font-bold text-opti-blue bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded truncate max-w-[140px]" title={skill}>
                {skill}
              </span>
            ))}
          </div>
        )
      },
    }),
    col.display({
      id: 'actions',
      header: '',
      size: 70,
      cell: ({ row }) => {
        const isEditing = editingRowId === row.original.id
        return (
          <div className="flex gap-1">
            {isEditing ? (
              <button
                aria-label="Valider les modifications"
                title="Valider"
                onClick={stopRowEdit}
                className="rounded-lg p-1.5 transition-colors bg-green-50 text-green-600 hover:bg-green-100"
              ><CheckIcon /></button>
            ) : (
              <button
                aria-label="Modifier la ligne"
                title="Modifier"
                onClick={() => startRowEdit(row.original.id)}
                className="rounded-lg p-1.5 hover:bg-gray-100 text-slate-400 hover:text-opti-blue transition-colors"
              ><PencilIcon /></button>
            )}
            <button
              aria-label="Supprimer ce point"
              title="Supprimer"
              onClick={() => removeDeliveryPoint(row.original.id)}
              className="rounded-lg p-1.5 hover:bg-red-50 text-slate-400 hover:text-opti-red transition-colors"
            ><TrashIcon /></button>
          </div>
        )
      },
    }),
  ]

  const table = useReactTable({
    data: points,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: PAGE_SIZE } },
  })

  if (points.length === 0) {
    return (
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center text-sm text-slate-400">
        Aucun point de livraison. Importez un fichier ou ajoutez un point manuellement.
      </div>
    )
  }

  const rows = table.getRowModel().rows

  return (
    <div className="bg-white rounded-3xl shadow-sm border border-gray-100">
      {/* Toolbar */}
      <div className="flex items-center px-4 sm:px-6 py-4 border-b border-gray-100">
        <span className="text-sm text-slate-500">
          <span className="font-bold text-opti-blue">{points.length}</span>
          {' point(s) de livraison'}
        </span>
      </div>

      {/* Vue carte — petit écran */}
      <div className="lg:hidden divide-y divide-gray-100">
        {rows.map((row) => {
          const p = row.original
          return (
            <div
              key={row.id}
              className="px-4 py-4 space-y-2"
            >
              {/* Ligne 1 : adresse + actions */}
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  {editingAddressId === p.id
                    ? <AddressCell point={p} onDone={() => setEditingAddressId(null)} />
                    : editingRowId === p.id
                      ? <button className="text-sm font-medium text-opti-blue underline decoration-dotted text-left break-words" onClick={() => setEditingAddressId(p.id)}>{p.address}</button>
                      : <p className="text-sm font-medium text-opti-blue break-words">{p.address}</p>
                  }
                </div>
                <div className="flex gap-1 shrink-0">
                  {editingRowId === p.id ? (
                    <button
                      aria-label="Valider les modifications"
                      onClick={stopRowEdit}
                      className="rounded-lg p-1.5 transition-colors bg-green-50 text-green-600 hover:bg-green-100"
                    ><CheckIcon /></button>
                  ) : (
                    <button
                      aria-label="Modifier la ligne"
                      onClick={() => startRowEdit(p.id)}
                      className="rounded-lg p-1.5 hover:bg-gray-100 text-slate-400 hover:text-opti-blue transition-colors"
                    ><PencilIcon /></button>
                  )}
                  <button
                    aria-label="Supprimer ce point"
                    onClick={() => removeDeliveryPoint(p.id)}
                    className="rounded-lg p-1.5 hover:bg-red-50 text-slate-400 hover:text-opti-red transition-colors"
                  ><TrashIcon /></button>
                </div>
              </div>
              
              {/* Détails ajoutés pour Mobile */}
              <div className="flex flex-wrap gap-2 text-xs mt-2 p-2 bg-slate-50 rounded-lg">
                 {/* Typologie (Mobile) */}
                 <div className="w-full flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="text-slate-500 font-semibold">Typologie de camion</span>
                    {editingRowId === p.id ? (
                      <select
                        value={p.allowed_vehicle_types?.[0] || ''}
                        onChange={(e) => updateDeliveryPoint(p.id, { allowed_vehicle_types: e.target.value ? [e.target.value] : [] })}
                        className="border border-gray-200 rounded px-2 py-0.5 text-opti-blue bg-white max-w-[150px] truncate"
                      >
                        <option value="">Aucune typologie particulière</option>
                        {vehicleTypes.map(vt => <option key={vt.id} value={vt.id}>{vt.name}</option>)}
                      </select>
                    ) : (
                      <span className="font-bold text-opti-blue bg-white px-2 rounded border border-slate-200 max-w-[150px] truncate" title={vehicleTypes.find(vt => vt.id === (p.allowed_vehicle_types?.[0]))?.name || "Standard"}>
                        {vehicleTypes.find(vt => vt.id === (p.allowed_vehicle_types?.[0]))?.name || "Standard"}
                      </span>
                    )}
                 </div>
                 
                 {/* Équipement (Mobile) */}
                 <div className="w-full pt-1">
                   <span className="text-slate-500 font-semibold block mb-1">Équipement</span>
                   {editingRowId === p.id ? (
                      <div className="flex flex-wrap gap-1">
                        {specialties.map(spec => {
                          const isActive = (p.required_skills || []).includes(spec.name);
                          return (
                            <button key={spec.id} onClick={() => {
                                // Logique unique équipement
                                const newSkills = isActive ? [] : [spec.name];
                                updateDeliveryPoint(p.id, { required_skills: newSkills })
                              }}
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${isActive ? 'bg-opti-red text-white border-opti-red' : 'bg-white text-slate-400 border-slate-200'}`}
                            >
                              {spec.name}
                            </button>
                          )
                        })}
                      </div>
                   ) : (
                     <div className="flex gap-1">
                       {(p.required_skills || []).length === 0 ? <span className="text-slate-400 italic">Aucun équipement</span> : p.required_skills?.map(skill => (
                          <span key={skill} className="text-[10px] font-bold text-opti-blue bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded truncate max-w-[150px]" title={skill}>{skill}</span>
                       ))}
                     </div>
                   )}
                 </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Vue tableau — grand écran */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm" role="grid" aria-label="Tableau des points de livraison">
          <thead className="bg-gray-50 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th key={h.id} style={{ width: h.column.getSize() }} className="px-4 py-3 whitespace-nowrap">
                    {flexRender(h.column.columnDef.header, h.getContext())}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-gray-50">
            {rows.map((row) => (
              <tr
                key={row.id}
                className="transition-colors hover:bg-gray-50"
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 align-middle">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-t border-gray-100 text-sm text-slate-500">
          <span>Page {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}</span>
          <div className="flex gap-2">
            <button
              aria-label="Page précédente"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-4 py-2 rounded-xl border border-gray-200 font-bold text-opti-blue hover:bg-gray-50 transition-colors disabled:opacity-40"
            >←</button>
            <button
              aria-label="Page suivante"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-4 py-2 rounded-xl border border-gray-200 font-bold text-opti-blue hover:bg-gray-50 transition-colors disabled:opacity-40"
            >→</button>
          </div>
        </div>
      )}
    </div>
  )
}