import { useState, useEffect, useRef } from 'react'
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

async function uploadIcon(file, huntId) {
  const ext = file.name.split('.').pop()
  const path = `hunt-icons/${huntId}.${ext}`
  const { error } = await supabase.storage.from('photos').upload(path, file, { upsert: true })
  if (error) return null
  const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)
  return publicUrl
}

export default function AdminDashboard() {
  const router = useRouter()
  const ready = useAdminGuard(router)
  const [hunts, setHunts] = useState([])

  // Create form state
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [iconFile, setIconFile] = useState(null)
  const [iconPreview, setIconPreview] = useState(null)
  const [saving, setSaving] = useState(false)

  // Per-hunt timer input: { [huntId]: minutesString }
  const [timerMinutes, setTimerMinutes] = useState({})
  const [startingTimer, setStartingTimer] = useState(null)

  const [deleting, setDeleting] = useState(null)
  const [duplicating, setDuplicating] = useState(null)
  const [editingIcon, setEditingIcon] = useState(null)
  const [editIconFile, setEditIconFile] = useState(null)
  const [editIconPreview, setEditIconPreview] = useState(null)
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const newIconRef = useRef()
  const editIconRef = useRef()

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

  function handleIconChange(e, setter, previewSetter) {
    const f = e.target.files[0]
    if (!f) return
    setter(f)
    previewSetter(URL.createObjectURL(f))
  }

  async function handleCreate(e) {
    e.preventDefault()
    setSaving(true)

    const { data: hunt } = await supabase
      .from('hunts')
      .insert({ name: name.trim(), description: description.trim() || null })
      .select()
      .single()

    if (hunt && iconFile) {
      const url = await uploadIcon(iconFile, hunt.id)
      if (url) await supabase.from('hunts').update({ icon_url: url }).eq('id', hunt.id)
    }

    setName('')
    setDescription('')
    setIconFile(null)
    setIconPreview(null)
    setShowForm(false)
    setSaving(false)
    loadHunts()
  }

  // Sets end_time to now + entered minutes, starting the countdown for all users
  async function handleStartTimer(hunt) {
    const mins = parseInt(timerMinutes[hunt.id] || 0)
    if (!mins || mins <= 0) return
    setStartingTimer(hunt.id)
    const endTime = new Date(Date.now() + mins * 60 * 1000).toISOString()
    await supabase.from('hunts').update({ end_time: endTime }).eq('id', hunt.id)
    setStartingTimer(null)
    loadHunts()
  }

  // Clears end_time, stopping the countdown
  async function handleStopTimer(hunt) {
    await supabase.from('hunts').update({ end_time: null }).eq('id', hunt.id)
    loadHunts()
  }

  async function handleSaveIcon(hunt) {
    if (!editIconFile) return
    setUploadingIcon(true)
    const url = await uploadIcon(editIconFile, hunt.id)
    if (url) {
      await supabase.from('hunts').update({ icon_url: url }).eq('id', hunt.id)
      loadHunts()
    }
    setEditingIcon(null)
    setEditIconFile(null)
    setEditIconPreview(null)
    setUploadingIcon(false)
  }

  async function handleDuplicate(hunt) {
    setDuplicating(hunt.id)

    const { data: newHunt } = await supabase
      .from('hunts')
      .insert({
        name: `${hunt.name} (Copy)`,
        description: hunt.description,
        icon_url: hunt.icon_url,
        is_active: false,
      })
      .select()
      .single()

    if (newHunt) {
      const { data: items } = await supabase
        .from('items')
        .select('title, description, photo_count, base_points, sort_order')
        .eq('hunt_id', hunt.id)
        .order('sort_order', { ascending: true })

      if (items?.length) {
        await supabase.from('items').insert(
          items.map(item => ({ ...item, hunt_id: newHunt.id }))
        )
      }
    }

    setDuplicating(null)
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Icon (optional)</label>
              <input
                ref={newIconRef}
                type="file"
                accept="image/*"
                onChange={e => handleIconChange(e, setIconFile, setIconPreview)}
                className="hidden"
              />
              {iconPreview ? (
                <div className="flex items-center gap-3">
                  <img src={iconPreview} className="w-16 h-16 rounded-xl object-cover" />
                  <button
                    type="button"
                    onClick={() => { setIconFile(null); setIconPreview(null) }}
                    className="text-xs text-red-500 hover:underline"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => newIconRef.current.click()}
                  className="border-2 border-dashed border-gray-300 rounded-xl w-16 h-16 flex items-center justify-center text-gray-400 hover:border-indigo-400 hover:text-indigo-400 transition-colors text-2xl"
                >
                  +
                </button>
              )}
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
          {hunts.map(hunt => {
            const timerActive = hunt.end_time && new Date(hunt.end_time) > new Date()
            const timerExpired = hunt.end_time && new Date(hunt.end_time) <= new Date()

            return (
              <div key={hunt.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <div className="flex items-start gap-3">
                  {/* Hunt icon */}
                  <div className="flex-shrink-0">
                    {editingIcon === hunt.id ? (
                      <div className="space-y-1">
                        <input
                          ref={editIconRef}
                          type="file"
                          accept="image/*"
                          onChange={e => handleIconChange(e, setEditIconFile, setEditIconPreview)}
                          className="hidden"
                        />
                        <div
                          onClick={() => editIconRef.current.click()}
                          className="w-14 h-14 rounded-xl overflow-hidden cursor-pointer border-2 border-dashed border-indigo-400 flex items-center justify-center bg-indigo-50"
                        >
                          {editIconPreview
                            ? <img src={editIconPreview} className="w-full h-full object-cover" />
                            : <span className="text-indigo-400 text-xl">+</span>
                          }
                        </div>
                        <div className="flex gap-1">
                          <button
                            onClick={() => handleSaveIcon(hunt)}
                            disabled={!editIconFile || uploadingIcon}
                            className="text-xs text-indigo-600 font-semibold hover:underline disabled:opacity-40"
                          >
                            {uploadingIcon ? '...' : 'Save'}
                          </button>
                          <span className="text-gray-300 text-xs">·</span>
                          <button
                            onClick={() => { setEditingIcon(null); setEditIconFile(null); setEditIconPreview(null) }}
                            className="text-xs text-gray-400 hover:underline"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => setEditingIcon(hunt.id)} className="group relative w-14 h-14 rounded-xl overflow-hidden bg-gray-100 flex items-center justify-center flex-shrink-0">
                        {hunt.icon_url
                          ? <img src={hunt.icon_url} className="w-full h-full object-cover" />
                          : <span className="text-gray-300 text-2xl">📷</span>
                        }
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <span className="text-white text-xs font-semibold">Edit</span>
                        </div>
                      </button>
                    )}
                  </div>

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

                    {/* Timer controls */}
                    <div className="mt-2">
                      {timerActive ? (
                        // Timer is running — show a stop button
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-600 font-medium">
                            Timer running · ends {new Date(hunt.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <button
                            onClick={() => handleStopTimer(hunt)}
                            className="text-xs text-red-500 hover:underline font-medium"
                          >
                            Stop
                          </button>
                        </div>
                      ) : (
                        // Timer not running — show minutes input + Start button
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            placeholder="mins"
                            value={timerMinutes[hunt.id] || ''}
                            onChange={e => setTimerMinutes(prev => ({ ...prev, [hunt.id]: e.target.value }))}
                            className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <button
                            onClick={() => handleStartTimer(hunt)}
                            disabled={!timerMinutes[hunt.id] || startingTimer === hunt.id}
                            className="text-xs bg-indigo-600 text-white font-semibold px-3 py-1 rounded-lg hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                          >
                            {startingTimer === hunt.id ? '...' : 'Start Timer'}
                          </button>
                          {timerExpired && (
                            <span className="text-xs text-red-500 font-medium">Ended</span>
                          )}
                        </div>
                      )}
                    </div>
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
                    onClick={() => handleDuplicate(hunt)}
                    disabled={duplicating === hunt.id}
                    className="text-xs bg-gray-50 text-gray-600 font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    {duplicating === hunt.id ? 'Copying...' : 'Duplicate'}
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
            )
          })}
        </div>
      </main>
    </div>
  )
}
