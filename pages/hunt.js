import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

function TeamRegistration({ hunt, onRegistered }) {
  const [mode, setMode] = useState('create')
  const [existingTeams, setExistingTeams] = useState([])
  const [loadingTeams, setLoadingTeams] = useState(false)

  // Create team state
  const [teamName, setTeamName] = useState('')
  const [members, setMembers] = useState(['', ''])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (mode !== 'join') return
    setLoadingTeams(true)
    supabase
      .from('teams')
      .select('id, name, members')
      .eq('hunt_id', hunt.id)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        setExistingTeams(data || [])
        setLoadingTeams(false)
      })
  }, [mode, hunt.id])

  function saveAndJoin(team) {
    localStorage.setItem(`snap-hunt-team-${hunt.id}`, JSON.stringify({
      teamId: team.id,
      teamName: team.name,
      members: team.members,
    }))
    onRegistered({ teamId: team.id, teamName: team.name, members: team.members })
  }

  function updateMember(i, val) {
    const next = [...members]
    next[i] = val
    setMembers(next)
  }

  async function handleCreate(e) {
    e.preventDefault()
    if (!teamName.trim()) return setError('Team name is required.')
    setSaving(true)
    setError('')

    const filteredMembers = members.map(m => m.trim()).filter(Boolean)
    const { data, error: err } = await supabase
      .from('teams')
      .insert({ hunt_id: hunt.id, name: teamName.trim(), members: filteredMembers })
      .select()
      .single()

    if (err) {
      setError('Could not register team. Please try again.')
      setSaving(false)
      return
    }

    saveAndJoin(data)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
      <h2 className="text-lg font-bold text-gray-800 mb-1">Join this Hunt</h2>

      <div className="flex gap-2 mt-3 mb-5">
        <button
          onClick={() => setMode('create')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'create'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          New Team
        </button>
        <button
          onClick={() => setMode('join')}
          className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
            mode === 'join'
              ? 'bg-indigo-600 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Join Existing
        </button>
      </div>

      {mode === 'create' ? (
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
            <input
              type="text"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="e.g. The Snappers"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Members</label>
            <div className="space-y-2">
              {members.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={m}
                    onChange={e => updateMember(i, e.target.value)}
                    placeholder={`Member ${i + 1}`}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {members.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setMembers(members.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600 text-lg px-2"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setMembers([...members, ''])}
              className="mt-2 text-sm text-indigo-600 hover:underline"
            >
              + Add member
            </button>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-indigo-600 text-white font-semibold py-2.5 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Registering...' : 'Start Hunt'}
          </button>
        </form>
      ) : (
        <div>
          {loadingTeams ? (
            <p className="text-center text-gray-400 py-6 text-sm">Loading teams...</p>
          ) : existingTeams.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">No teams yet — create one first.</p>
          ) : (
            <div className="space-y-2">
              {existingTeams.map(team => (
                <button
                  key={team.id}
                  onClick={() => saveAndJoin(team)}
                  className="w-full text-left bg-gray-50 hover:bg-indigo-50 border border-gray-200 hover:border-indigo-300 rounded-lg px-4 py-3 transition-colors"
                >
                  <p className="font-semibold text-gray-800">{team.name}</p>
                  {team.members?.length > 0 && (
                    <p className="text-xs text-gray-500 mt-0.5">{team.members.join(', ')}</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function ItemCard({ item, teamId, submissions, onSubmitted, onRemoved }) {
  const [expanded, setExpanded] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(null)
  const [error, setError] = useState('')
  const inputRef = useRef()

  async function handleRemove(sub) {
    setRemoving(sub.id)
    await supabase.from('submissions').delete().eq('id', sub.id)
    onRemoved(item.id, sub.id)
    setRemoving(null)
  }

  const required = item.photo_count ?? 1
  const submittedCount = submissions.length
  const isComplete = submittedCount >= required

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setError('')
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')

    const ext = file.name.split('.').pop()
    const path = `${teamId}/${item.id}/${Date.now()}.${ext}`

    const { error: uploadErr } = await supabase.storage
      .from('photos')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      setError('Upload failed. Please try again.')
      setUploading(false)
      return
    }

    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)

    const { error: insertErr } = await supabase
      .from('submissions')
      .insert({ item_id: item.id, team_id: teamId, photo_url: publicUrl, caption: caption.trim() || null })

    if (insertErr) {
      setError('Could not save submission. Please try again.')
      setUploading(false)
      return
    }

    const { data: inserted } = await supabase
      .from('submissions')
      .select('id')
      .eq('item_id', item.id)
      .eq('team_id', teamId)
      .eq('photo_url', publicUrl)
      .single()

    onSubmitted(item.id, { id: inserted?.id, url: publicUrl, caption: caption.trim() || null })
    setFile(null)
    setPreview(null)
    setCaption('')
    setUploading(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-center gap-3"
      >
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          isComplete ? 'bg-green-100 text-green-700' :
          submittedCount > 0 ? 'bg-yellow-100 text-yellow-700' :
          'bg-gray-100 text-gray-400'
        }`}>
          {isComplete ? '✓' : submittedCount > 0 ? submittedCount : '○'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{item.title}</p>
          {item.description && (
            <p className="text-gray-500 text-xs mt-0.5 truncate">{item.description}</p>
          )}
          <div className="flex gap-2 mt-0.5 flex-wrap">
            {required > 1 && (
              <span className="text-xs text-gray-400">{submittedCount}/{required} photos</span>
            )}
            {(item.base_points ?? 0) > 0 && (
              <span className="text-xs text-indigo-500 font-medium">{item.base_points} base pts</span>
            )}
          </div>
        </div>
        {isComplete && (
          <span className="text-xs text-green-600 font-medium flex-shrink-0">Done</span>
        )}
        <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {submissions.length > 0 && (
            <div className="space-y-3">
              {submissions.map((sub, i) => (
                <div key={sub.id ?? i} className="relative">
                  <img
                    src={sub.url}
                    alt={`Photo ${i + 1}`}
                    className="w-full rounded-lg object-cover max-h-64"
                  />
                  <button
                    onClick={() => handleRemove(sub)}
                    disabled={removing === sub.id}
                    className="absolute top-2 right-2 bg-black/50 hover:bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded-full transition-colors disabled:opacity-50"
                  >
                    {removing === sub.id ? '...' : 'Remove'}
                  </button>
                  {sub.caption && (
                    <p className="text-xs text-gray-500 mt-1 px-0.5">{sub.caption}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {!isComplete && (
            <div className="space-y-3">
              {required > 1 && (
                <p className="text-xs text-gray-500 font-medium">
                  Photo {submittedCount + 1} of {required}
                </p>
              )}
              {preview && (
                <img src={preview} alt="Preview" className="w-full rounded-lg object-cover max-h-64" />
              )}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileChange}
                className="hidden"
              />
              <button
                onClick={() => inputRef.current.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
              >
                {file ? 'Change photo' : 'Take or select a photo'}
              </button>
              {file && (
                <>
                  <input
                    type="text"
                    value={caption}
                    onChange={e => setCaption(e.target.value)}
                    placeholder="Add a caption (optional)"
                    maxLength={120}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <button
                    onClick={handleUpload}
                    disabled={uploading}
                    className="w-full bg-indigo-600 text-white font-semibold py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                  >
                    {uploading ? 'Uploading...' : 'Submit Photo'}
                  </button>
                </>
              )}
              {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function HuntPage() {
  const router = useRouter()
  const { id: huntId } = router.query
  const [hunt, setHunt] = useState(null)
  const [items, setItems] = useState([])
  const [team, setTeam] = useState(null)
  const [submissions, setSubmissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    if (!huntId) return
    async function load() {
      const { data: huntData } = await supabase
        .from('hunts')
        .select('*')
        .eq('id', huntId)
        .single()

      if (!huntData) { setNotFound(true); setLoading(false); return }
      setHunt(huntData)

      const { data: itemsData } = await supabase
        .from('items')
        .select('*')
        .eq('hunt_id', huntId)
        .order('sort_order', { ascending: true })
      setItems(itemsData || [])

      const stored = localStorage.getItem(`snap-hunt-team-${huntId}`)
      if (stored) {
        const teamData = JSON.parse(stored)
        setTeam(teamData)
        await loadSubmissions(teamData.teamId, itemsData || [])
      }

      setLoading(false)
    }
    load()
  }, [huntId])

  async function loadSubmissions(teamId, itemList) {
    if (!itemList.length) return
    const itemIds = itemList.map(i => i.id)
    const { data } = await supabase
      .from('submissions')
      .select('id, item_id, photo_url, caption')
      .eq('team_id', teamId)
      .in('item_id', itemIds)
      .order('created_at', { ascending: true })

    const map = {}
    for (const s of data || []) {
      if (!map[s.item_id]) map[s.item_id] = []
      map[s.item_id].push({ id: s.id, url: s.photo_url, caption: s.caption })
    }
    setSubmissions(map)
  }

  function handleRegistered(teamData) {
    setTeam(teamData)
  }

  function handleSubmitted(itemId, photo) {
    setSubmissions(prev => ({
      ...prev,
      [itemId]: [...(prev[itemId] || []), photo],
    }))
  }

  function handleRemoved(itemId, submissionId) {
    setSubmissions(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || []).filter(s => s.id !== submissionId),
    }))
  }

  const completedCount = items.filter(item =>
    (submissions[item.id]?.length ?? 0) >= (item.photo_count ?? 1)
  ).length

  if (loading) return <Layout><div className="text-center py-12 text-gray-400">Loading...</div></Layout>
  if (notFound) return <Layout><div className="text-center py-12 text-gray-500">Hunt not found.</div></Layout>

  return (
    <Layout backHref="/" backLabel="All Hunts" title={hunt.name}>
      {hunt.description && (
        <p className="text-gray-500 text-sm mb-4">{hunt.description}</p>
      )}

      {!team ? (
        <TeamRegistration hunt={hunt} onRegistered={handleRegistered} />
      ) : (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="font-semibold text-gray-800">{team.teamName}</p>
              {team.members?.length > 0 && (
                <p className="text-xs text-gray-500">{team.members.join(', ')}</p>
              )}
            </div>
            <span className="text-sm font-medium text-indigo-600">
              {completedCount}/{items.length} done
            </span>
          </div>

          <div className="flex gap-2 mb-5">
            <Link
              href={`/vote?hunt=${huntId}`}
              className="flex-1 text-center bg-white border border-indigo-300 text-indigo-600 font-semibold py-2 rounded-lg text-sm hover:bg-indigo-50 transition-colors"
            >
              Vote on Photos
            </Link>
            <Link
              href={`/results?hunt=${huntId}`}
              className="flex-1 text-center bg-white border border-gray-300 text-gray-600 font-semibold py-2 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            >
              See Results
            </Link>
          </div>

          {items.length === 0 && (
            <div className="text-center text-gray-400 py-8">No items yet. Check back soon.</div>
          )}

          <div className="space-y-3">
            {items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                teamId={team.teamId}
                submissions={submissions[item.id] || []}
                onSubmitted={handleSubmitted}
                onRemoved={handleRemoved}
              />
            ))}
          </div>
        </div>
      )}
    </Layout>
  )
}
