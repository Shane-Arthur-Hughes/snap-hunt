import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

function TeamRegistration({ hunt, onRegistered }) {
  const [teamName, setTeamName] = useState('')
  const [members, setMembers] = useState(['', ''])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateMember(i, val) {
    const next = [...members]
    next[i] = val
    setMembers(next)
  }

  function addMember() {
    setMembers([...members, ''])
  }

  function removeMember(i) {
    setMembers(members.filter((_, idx) => idx !== i))
  }

  async function handleSubmit(e) {
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

    localStorage.setItem(`snap-hunt-team-${hunt.id}`, JSON.stringify({
      teamId: data.id,
      teamName: data.name,
      members: data.members,
    }))
    onRegistered({ teamId: data.id, teamName: data.name, members: data.members })
  }

  return (
    <div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
        <h2 className="text-lg font-bold text-gray-800 mb-1">Join this Hunt</h2>
        <p className="text-sm text-gray-500 mb-4">Create your team to start submitting photos.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
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
                      onClick={() => removeMember(i)}
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
              onClick={addMember}
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
      </div>
    </div>
  )
}

function ItemCard({ item, teamId, submission, onSubmitted }) {
  const [expanded, setExpanded] = useState(false)
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef()

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
      .insert({ item_id: item.id, team_id: teamId, photo_url: publicUrl })

    if (insertErr) {
      setError('Could not save submission. Please try again.')
      setUploading(false)
      return
    }

    onSubmitted(item.id, publicUrl)
    setExpanded(false)
    setFile(null)
    setPreview(null)
    setUploading(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-center gap-3"
      >
        <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
          submission ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
        }`}>
          {submission ? '✓' : '○'}
        </span>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 truncate">{item.title}</p>
          {item.description && (
            <p className="text-gray-500 text-xs mt-0.5 truncate">{item.description}</p>
          )}
        </div>
        {submission && (
          <span className="text-xs text-green-600 font-medium flex-shrink-0">Submitted</span>
        )}
        <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-4">
          {submission ? (
            <div>
              <img
                src={submission}
                alt="Your submission"
                className="w-full rounded-lg object-cover max-h-64"
              />
              <p className="text-xs text-green-600 text-center mt-2 font-medium">Photo submitted!</p>
            </div>
          ) : (
            <div className="space-y-3">
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
                <button
                  onClick={handleUpload}
                  disabled={uploading}
                  className="w-full bg-indigo-600 text-white font-semibold py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
                >
                  {uploading ? 'Uploading...' : 'Submit Photo'}
                </button>
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
      .select('item_id, photo_url')
      .eq('team_id', teamId)
      .in('item_id', itemIds)

    const map = {}
    for (const s of data || []) map[s.item_id] = s.photo_url
    setSubmissions(map)
  }

  function handleRegistered(teamData) {
    setTeam(teamData)
  }

  function handleSubmitted(itemId, photoUrl) {
    setSubmissions(prev => ({ ...prev, [itemId]: photoUrl }))
  }

  const submittedCount = Object.keys(submissions).length

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
              {submittedCount}/{items.length} done
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
                submission={submissions[item.id] || null}
                onSubmitted={handleSubmitted}
              />
            ))}
          </div>
        </div>
      )}
    </Layout>
  )
}
