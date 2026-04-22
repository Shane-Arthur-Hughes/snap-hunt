import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import { supabase } from '../../lib/supabase'

function useAdminGuard(router) {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session || session.user.is_anonymous) {
        router.replace('/admin')
      } else {
        setReady(true)
      }
    })
  }, [router])
  return ready
}

export default function AdminHunt() {
  const router = useRouter()
  const { id: huntId } = router.query
  const ready = useAdminGuard(router)

  const [hunt, setHunt] = useState(null)
  const [items, setItems] = useState([])
  const [teams, setTeams] = useState([])
  const [deletingTeam, setDeletingTeam] = useState(null)
  const [newTitle, setNewTitle] = useState('')
  const [newDesc, setNewDesc] = useState('')
  const [newPhotoCount, setNewPhotoCount] = useState(1)
  const [newBasePoints, setNewBasePoints] = useState(0)
  const [adding, setAdding] = useState(false)
  const [editing, setEditing] = useState(null)
  const [editTitle, setEditTitle] = useState('')
  const [editDesc, setEditDesc] = useState('')
  const [editPhotoCount, setEditPhotoCount] = useState(1)
  const [editBasePoints, setEditBasePoints] = useState(0)

  useEffect(() => {
    if (!ready || !huntId) return
    loadData()
  }, [ready, huntId])

  async function loadData() {
    const { data: huntData } = await supabase
      .from('hunts')
      .select('*')
      .eq('id', huntId)
      .single()
    setHunt(huntData)

    const { data: itemsData } = await supabase
      .from('items')
      .select('*, submissions(count)')
      .eq('hunt_id', huntId)
      .order('sort_order', { ascending: true })
    setItems(itemsData || [])

    const { data: teamsData } = await supabase
      .from('teams')
      .select('*')
      .eq('hunt_id', huntId)
      .order('created_at', { ascending: true })
    setTeams(teamsData || [])
  }

  async function handleDeleteTeam(teamId) {
    if (!confirm('Remove this team and all their submissions?')) return
    setDeletingTeam(teamId)
    await supabase.from('teams').delete().eq('id', teamId)
    setDeletingTeam(null)
    loadData()
  }

  async function handleAdd(e) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    const nextOrder = items.length > 0 ? Math.max(...items.map(i => i.sort_order)) + 1 : 0
    await supabase.from('items').insert({
      hunt_id: huntId,
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      photo_count: Math.max(1, parseInt(newPhotoCount) || 1),
      base_points: Math.max(0, parseInt(newBasePoints) || 0),
      sort_order: nextOrder,
    })
    setNewTitle('')
    setNewDesc('')
    setNewPhotoCount(1)
    setNewBasePoints(0)
    setAdding(false)
    loadData()
  }

  async function handleDelete(itemId) {
    if (!confirm('Delete this item and all its submissions?')) return
    await supabase.from('items').delete().eq('id', itemId)
    loadData()
  }

  async function handleMoveUp(index) {
    if (index === 0) return
    const a = items[index]
    const b = items[index - 1]
    await Promise.all([
      supabase.from('items').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('items').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    loadData()
  }

  async function handleMoveDown(index) {
    if (index === items.length - 1) return
    const a = items[index]
    const b = items[index + 1]
    await Promise.all([
      supabase.from('items').update({ sort_order: b.sort_order }).eq('id', a.id),
      supabase.from('items').update({ sort_order: a.sort_order }).eq('id', b.id),
    ])
    loadData()
  }

  function startEdit(item) {
    setEditing(item.id)
    setEditTitle(item.title)
    setEditDesc(item.description || '')
    setEditPhotoCount(item.photo_count ?? 1)
    setEditBasePoints(item.base_points ?? 0)
  }

  async function handleSaveEdit(itemId) {
    await supabase.from('items').update({
      title: editTitle.trim(),
      description: editDesc.trim() || null,
      photo_count: Math.max(1, parseInt(editPhotoCount) || 1),
      base_points: Math.max(0, parseInt(editBasePoints) || 0),
    }).eq('id', itemId)
    setEditing(null)
    loadData()
  }

  if (!ready) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center gap-3">
          <Link href="/admin/dashboard" className="text-indigo-200 hover:text-white text-sm">
            &larr; Dashboard
          </Link>
          <span className="font-bold text-xl flex-1">Snap Hunt</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        {hunt && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{hunt.name}</h1>
            <div className="flex gap-3 mt-2">
              <Link href={`/hunt?id=${huntId}`} target="_blank" className="text-sm text-indigo-600 hover:underline">
                View hunt page
              </Link>
              <Link href={`/results?hunt=${huntId}`} target="_blank" className="text-sm text-indigo-600 hover:underline">
                View results
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleAdd} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6">
          <h2 className="font-semibold text-gray-800 mb-3">Add Item</h2>
          <div className="space-y-3">
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              placeholder="Item title (e.g. A red door)"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <input
              type="text"
              value={newDesc}
              onChange={e => setNewDesc(e.target.value)}
              placeholder="Hint or description (optional)"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Photos required</label>
                <input
                  type="number"
                  min="1"
                  value={newPhotoCount}
                  onChange={e => setNewPhotoCount(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs font-medium text-gray-600 mb-1">Completion points</label>
                <input
                  type="number"
                  min="0"
                  value={newBasePoints}
                  onChange={e => setNewBasePoints(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={adding}
              className="bg-indigo-600 text-white font-semibold px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm transition-colors"
            >
              {adding ? 'Adding...' : 'Add Item'}
            </button>
          </div>
        </form>

        <h2 className="font-semibold text-gray-800 mb-3">
          Items ({items.length})
        </h2>

        {items.length === 0 && (
          <div className="text-center text-gray-400 py-8">No items yet. Add the first one above.</div>
        )}

        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              {editing === item.id ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    placeholder="Hint or description (optional)"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Photos required</label>
                      <input
                        type="number"
                        min="1"
                        value={editPhotoCount}
                        onChange={e => setEditPhotoCount(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs font-medium text-gray-600 mb-1">Completion points</label>
                      <input
                        type="number"
                        min="0"
                        value={editBasePoints}
                        onChange={e => setEditBasePoints(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(item.id)}
                      className="text-xs bg-indigo-600 text-white font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditing(null)}
                      className="text-xs bg-gray-100 text-gray-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMoveUp(index)}
                      disabled={index === 0}
                      className="text-gray-300 hover:text-gray-600 disabled:opacity-0 text-xs leading-none"
                    >
                      ▲
                    </button>
                    <button
                      onClick={() => handleMoveDown(index)}
                      disabled={index === items.length - 1}
                      className="text-gray-300 hover:text-gray-600 disabled:opacity-0 text-xs leading-none"
                    >
                      ▼
                    </button>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{item.title}</p>
                    {item.description && (
                      <p className="text-gray-500 text-sm">{item.description}</p>
                    )}
                    <div className="flex gap-3 mt-0.5">
                      <p className="text-xs text-gray-400">
                        {item.submissions?.[0]?.count ?? 0} submissions
                      </p>
                      <p className="text-xs text-gray-400">
                        {item.photo_count ?? 1} photo{(item.photo_count ?? 1) !== 1 ? 's' : ''}
                      </p>
                      <p className="text-xs text-indigo-500 font-medium">
                        {item.base_points ?? 0} completion pts
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button
                      onClick={() => startEdit(item)}
                      className="text-xs text-indigo-600 hover:underline font-medium"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(item.id)}
                      className="text-xs text-red-500 hover:underline font-medium"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <h2 className="font-semibold text-gray-800 mb-3 mt-8">
          Teams ({teams.length})
        </h2>

        {teams.length === 0 ? (
          <div className="text-center text-gray-400 py-6">No teams have joined yet.</div>
        ) : (
          <div className="space-y-2">
            {teams.map(team => (
              <div key={team.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900">{team.name}</p>
                  {team.members?.length > 0 && (
                    <p className="text-sm text-gray-500 mt-0.5">{team.members.join(', ')}</p>
                  )}
                </div>
                <button
                  onClick={() => handleDeleteTeam(team.id)}
                  disabled={deletingTeam === team.id}
                  className="text-xs text-red-500 hover:underline font-medium flex-shrink-0 disabled:opacity-50"
                >
                  {deletingTeam === team.id ? 'Removing...' : 'Remove'}
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
