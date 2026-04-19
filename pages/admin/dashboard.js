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

export default function AdminDashboard() {
  const router = useRouter()
  const ready = useAdminGuard(router)
  const [hunts, setHunts] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(null)

  useEffect(() => {
    if (!ready) return
    loadHunts()
  }, [ready])

  async function loadHunts() {
    const { data } = await supabase
      .from('hunts')
      .select('*, items(count), teams(count)')
      .order('created_at', { ascending: false })
    setHunts(data || [])
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)
    await supabase.from('hunts').insert({ name: name.trim(), description: description.trim() || null })
    setName('')
    setDescription('')
    setShowForm(false)
    setSaving(false)
    loadHunts()
  }

  async function handleToggleActive(hunt) {
    await supabase.from('hunts').update({ is_active: !hunt.is_active }).eq('id', hunt.id)
    loadHunts()
  }

  async function handleDelete(huntId) {
    if (!confirm('Delete this hunt and all its data? This cannot be undone.')) return
    setDeleting(huntId)
    await supabase.from('hunts').delete().eq('id', huntId)
    setDeleting(null)
    loadHunts()
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    router.push('/admin')
  }

  if (!ready) return null

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-indigo-600 text-white shadow-md">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <Link href="/" className="font-bold text-xl">Snap Hunt</Link>
            <span className="text-indigo-200 text-sm ml-2">Admin</span>
          </div>
          <button onClick={handleSignOut} className="text-indigo-200 hover:text-white text-sm">
            Sign Out
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Hunts</h1>
          <button
            onClick={() => setShowForm(!showForm)}
            className="bg-indigo-600 text-white font-semibold px-4 py-2 rounded-lg hover:bg-indigo-700 text-sm transition-colors"
          >
            {showForm ? 'Cancel' : '+ New Hunt'}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 mb-6 space-y-3">
            <h2 className="font-semibold text-gray-800">Create New Hunt</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g. Summer Campus Hunt"
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description (optional)</label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                rows={2}
                placeholder="Brief description of the hunt..."
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="bg-indigo-600 text-white font-semibold px-5 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm transition-colors"
            >
              {saving ? 'Creating...' : 'Create Hunt'}
            </button>
          </form>
        )}

        {hunts.length === 0 && (
          <div className="text-center text-gray-400 py-12">No hunts yet. Create one above.</div>
        )}

        <div className="space-y-3">
          {hunts.map(hunt => (
            <div key={hunt.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900 truncate">{hunt.name}</h2>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                      hunt.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {hunt.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {hunt.description && (
                    <p className="text-gray-500 text-sm mt-0.5 truncate">{hunt.description}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {hunt.items?.[0]?.count ?? 0} items &bull; {hunt.teams?.[0]?.count ?? 0} teams
                  </p>
                </div>
              </div>

              <div className="flex gap-2 mt-3 flex-wrap">
                <Link
                  href={`/admin/hunt?id=${hunt.id}`}
                  className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
                >
                  Manage Items
                </Link>
                <Link
                  href={`/hunt?id=${hunt.id}`}
                  target="_blank"
                  className="text-xs bg-gray-50 text-gray-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  View Hunt
                </Link>
                <Link
                  href={`/results?hunt=${hunt.id}`}
                  target="_blank"
                  className="text-xs bg-gray-50 text-gray-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Results
                </Link>
                <button
                  onClick={() => handleToggleActive(hunt)}
                  className="text-xs bg-gray-50 text-gray-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  {hunt.is_active ? 'Deactivate' : 'Activate'}
                </button>
                <button
                  onClick={() => handleDelete(hunt.id)}
                  disabled={deleting === hunt.id}
                  className="text-xs bg-red-50 text-red-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-50"
                >
                  {deleting === hunt.id ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
