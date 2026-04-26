import { useEffect, useState, useRef } from 'react'
// useRouter lets us read the URL query string (e.g. ?id=abc)
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import HuntTimer from '../components/HuntTimer'
import { supabase } from '../lib/supabase'

// ─────────────────────────────────────────────
// TeamRegistration component
// Shown before the user has joined a team.
// Props:
//   hunt        — the current hunt object
//   onRegistered — callback called once the user has a team
// ─────────────────────────────────────────────
function TeamRegistration({ hunt, onRegistered }) {
  // 'create' shows the new team form; 'join' shows the existing teams list
  const [mode, setMode] = useState('create')
  const [existingTeams, setExistingTeams] = useState([])
  const [loadingTeams, setLoadingTeams] = useState(false)

  // Create team form state
  const [teamName, setTeamName] = useState('')
  const [members, setMembers] = useState(['', ''])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // When the user switches to "Join Existing", fetch the teams from Supabase.
  // The dependency array [mode, hunt.id] means this runs whenever mode or hunt.id changes.
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

  // Saves the team to localStorage so the user is automatically
  // recognised as part of this team if they refresh or return later.
  function saveAndJoin(team) {
    localStorage.setItem(`snap-hunt-team-${hunt.id}`, JSON.stringify({
      teamId: team.id,
      teamName: team.name,
      members: team.members,
    }))
    onRegistered({ teamId: team.id, teamName: team.name, members: team.members })
  }

  // Updates a single member name in the members array by index.
  // We spread [...members] to create a new array (React requires immutable state updates).
  function updateMember(i, val) {
    const next = [...members]
    next[i] = val
    setMembers(next)
  }

  async function handleCreate(e) {
    // Prevent the default form submission (which would reload the page)
    e.preventDefault()
    if (!teamName.trim()) return setError('Team name is required.')
    setSaving(true)
    setError('')

    // Filter out any empty member name inputs before saving
    const filteredMembers = members.map(m => m.trim()).filter(Boolean)

    // Insert a new team row and return the created row with .select().single()
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

      {/* Toggle between New Team and Join Existing tabs */}
      <div className="flex gap-2 mt-3 mb-5">
        <button
          onClick={() => setMode('create')}
          // Tailwind template literal: apply different classes based on active mode
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

      {/* Conditionally render either the create form or the join list */}
      {mode === 'create' ? (
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Team Name</label>
            {/* Controlled input: value is always driven by React state */}
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
              {/* Render one input per member. i is the array index. */}
              {members.map((m, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    type="text"
                    value={m}
                    onChange={e => updateMember(i, e.target.value)}
                    placeholder={`Member ${i + 1}`}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  {/* Only show the remove button if there's more than one member input */}
                  {members.length > 1 && (
                    <button
                      type="button"
                      // .filter() returns a new array excluding the item at index i
                      onClick={() => setMembers(members.filter((_, idx) => idx !== i))}
                      className="text-red-400 hover:text-red-600 text-lg px-2"
                    >
                      &times;
                    </button>
                  )}
                </div>
              ))}
            </div>
            {/* Spread syntax [...members, ''] creates a new array with an empty string appended */}
            <button
              type="button"
              onClick={() => setMembers([...members, ''])}
              className="mt-2 text-sm text-indigo-600 hover:underline"
            >
              + Add member
            </button>
          </div>

          {/* Only render the error message if there is one */}
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
                  {/* .join(', ') converts the members array to a comma-separated string */}
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

// ─────────────────────────────────────────────
// ItemCard component
// Renders a single hunt item as a collapsible card.
// Props:
//   item        — the item object (title, description, photo_count, etc.)
//   teamId      — the current team's ID, used when uploading
//   submissions — array of { id, url, caption } objects for this item
//   onSubmitted — callback to notify the parent when a new photo is uploaded
//   onRemoved   — callback to notify the parent when a photo is deleted
// ─────────────────────────────────────────────
function ItemCard({ item, teamId, submissions, onSubmitted, onRemoved }) {
  const [expanded, setExpanded] = useState(false)
  const [file, setFile] = useState(null)           // the selected File object
  const [preview, setPreview] = useState(null)     // a local preview URL for the selected image
  const [caption, setCaption] = useState('')
  const [uploading, setUploading] = useState(false)
  const [removing, setRemoving] = useState(null)   // stores the ID of the submission being removed
  const [error, setError] = useState('')
  // useRef gives us a direct reference to the hidden file input DOM element
  // so we can trigger it programmatically when the user clicks our styled button
  const inputRef = useRef()

  async function handleRemove(sub) {
    setRemoving(sub.id)
    // Delete the submission row from the database
    await supabase.from('submissions').delete().eq('id', sub.id)
    // Notify the parent page to remove it from local state too
    onRemoved(item.id, sub.id)
    setRemoving(null)
  }

  // How many photos are required for this item (defaults to 1)
  const required = item.photo_count ?? 1
  const submittedCount = submissions.length
  const isComplete = submittedCount >= required

  function handleFileChange(e) {
    const f = e.target.files[0]
    if (!f) return
    setFile(f)
    // createObjectURL creates a temporary local URL to display the image as a preview
    setPreview(URL.createObjectURL(f))
    setError('')
  }

  async function handleUpload() {
    if (!file) return
    setUploading(true)
    setError('')

    // Build a unique storage path using the team ID, item ID, and current timestamp.
    // This ensures no two uploads ever overwrite each other.
    const ext = file.name.split('.').pop()
    const path = `${teamId}/${item.id}/${Date.now()}.${ext}`

    // Upload the file to Supabase Storage (the 'photos' bucket)
    // upsert: true means "overwrite if this path already exists"
    const { error: uploadErr } = await supabase.storage
      .from('photos')
      .upload(path, file, { upsert: true })

    if (uploadErr) {
      setError('Upload failed. Please try again.')
      setUploading(false)
      return
    }

    // Get the permanent public URL for the uploaded file
    const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(path)

    // Save the submission record to the database
    const { error: insertErr } = await supabase
      .from('submissions')
      .insert({ item_id: item.id, team_id: teamId, photo_url: publicUrl, caption: caption.trim() || null })

    if (insertErr) {
      setError('Could not save submission. Please try again.')
      setUploading(false)
      return
    }

    // Fetch back the new submission's ID so we can support deleting it later
    const { data: inserted } = await supabase
      .from('submissions')
      .select('id')
      .eq('item_id', item.id)
      .eq('team_id', teamId)
      .eq('photo_url', publicUrl)
      .single()

    // Notify the parent with the new photo so it updates without a page refresh
    onSubmitted(item.id, { id: inserted?.id, url: publicUrl, caption: caption.trim() || null })

    // Reset the upload form
    setFile(null)
    setPreview(null)
    setCaption('')
    setUploading(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      {/* Clicking this button toggles the expanded state */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-center gap-3"
      >
        {/* Status indicator: green tick if complete, yellow count if partial, grey circle if not started */}
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
            // line-clamp-2 limits to 2 lines when collapsed; removed when expanded for full text
            <p className={`text-gray-500 text-xs mt-0.5 ${expanded ? '' : 'line-clamp-2'}`}>{item.description}</p>
          )}
          <div className="flex gap-2 mt-0.5 flex-wrap">
            {/* Only show photo count badge if more than 1 photo is required */}
            {required > 1 && (
              <span className="text-xs text-gray-400">{submittedCount}/{required} photos</span>
            )}
            {/* Only show completion points badge if points are set */}
            {(item.base_points ?? 0) > 0 && (
              <span className="text-xs text-indigo-500 font-medium">{item.base_points} completion pts</span>
            )}
          </div>
        </div>
        {isComplete && (
          <span className="text-xs text-green-600 font-medium flex-shrink-0">Done</span>
        )}
        {/* Arrow icon flips direction based on expanded state */}
        <span className="text-gray-400 text-sm">{expanded ? '▲' : '▼'}</span>
      </button>

      {/* Expanded content — only rendered when expanded is true */}
      {expanded && (
        <div className="border-t border-gray-100 p-4 space-y-3">

          {/* Show all submitted photos with a remove button on each */}
          {submissions.length > 0 && (
            <div className="space-y-3">
              {submissions.map((sub, i) => (
                // sub.id ?? i: use the DB id as key, fall back to array index if no id
                <div key={sub.id ?? i} className="relative">
                  <img
                    src={sub.url}
                    alt={`Photo ${i + 1}`}
                    className="w-full rounded-lg object-cover max-h-64"
                  />
                  {/* Absolutely positioned remove button overlaid on the photo */}
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

          {/* Upload area — only shown if the item isn't fully complete yet */}
          {!isComplete && (
            <div className="space-y-3">
              {/* Tell the user which photo number they're on (only relevant if photo_count > 1) */}
              {required > 1 && (
                <p className="text-xs text-gray-500 font-medium">
                  Photo {submittedCount + 1} of {required}
                </p>
              )}
              {preview && (
                <img src={preview} alt="Preview" className="w-full rounded-lg object-cover max-h-64" />
              )}
              {/* Hidden file input — triggered by the styled button below */}
              <input
                ref={inputRef}
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
              />
              {/* This button triggers the hidden file input */}
              <button
                onClick={() => inputRef.current.click()}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg py-3 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-500 transition-colors"
              >
                {file ? 'Change photo' : 'Take or select a photo'}
              </button>
              {/* Caption and submit button only appear once a file has been selected */}
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

// ─────────────────────────────────────────────
// HuntPage — the main page component
// URL: /hunt?id=<huntId>
// ─────────────────────────────────────────────
export default function HuntPage() {
  // useRouter gives access to the URL — we read the 'id' query parameter
  const router = useRouter()
  const { id: huntId } = router.query  // destructure and rename: id → huntId

  const [hunt, setHunt] = useState(null)
  const [items, setItems] = useState([])
  const [team, setTeam] = useState(null)
  // submissions is a map of { [itemId]: [{ id, url, caption }, ...] }
  const [submissions, setSubmissions] = useState({})
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Load hunt data when the huntId becomes available.
  // huntId starts as undefined on first render (Next.js hydration),
  // so we wait until it's defined before fetching.
  useEffect(() => {
    if (!huntId) return
    async function load() {
      // Fetch the hunt by its ID. .single() returns one object instead of an array.
      const { data: huntData } = await supabase
        .from('hunts')
        .select('*')
        .eq('id', huntId)
        .single()

      if (!huntData) { setNotFound(true); setLoading(false); return }
      setHunt(huntData)

      // Fetch all items for this hunt, ordered by sort_order
      const { data: itemsData } = await supabase
        .from('items')
        .select('*')
        .eq('hunt_id', huntId)
        .order('sort_order', { ascending: true })
      setItems(itemsData || [])

      // Check if this browser already has a team saved in localStorage.
      // This means the user previously joined and can skip registration.
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

  // Fetch all submissions this team has made for this hunt,
  // then group them by item ID into an object/map.
  async function loadSubmissions(teamId, itemList) {
    if (!itemList.length) return
    const itemIds = itemList.map(i => i.id)
    const { data } = await supabase
      .from('submissions')
      .select('id, item_id, photo_url, caption')
      .eq('team_id', teamId)
      .in('item_id', itemIds)  // .in() is like SQL's WHERE item_id IN (...)
      .order('created_at', { ascending: true })

    // Build a map: { itemId: [photo1, photo2, ...] }
    const map = {}
    for (const s of data || []) {
      if (!map[s.item_id]) map[s.item_id] = []
      map[s.item_id].push({ id: s.id, url: s.photo_url, caption: s.caption })
    }
    setSubmissions(map)
  }

  // Called by TeamRegistration when the user joins or creates a team
  function handleRegistered(teamData) {
    setTeam(teamData)
  }

  // Called by ItemCard when a new photo is submitted.
  // Uses the spread operator to add the new photo to the existing array for that item.
  function handleSubmitted(itemId, photo) {
    setSubmissions(prev => ({
      ...prev,  // keep all existing item entries
      [itemId]: [...(prev[itemId] || []), photo],  // append new photo to this item's array
    }))
  }

  // Called by ItemCard when a photo is removed.
  // Filters out the deleted submission by its ID.
  function handleRemoved(itemId, submissionId) {
    setSubmissions(prev => ({
      ...prev,
      [itemId]: (prev[itemId] || []).filter(s => s.id !== submissionId),
    }))
  }

  // Count how many items the team has fully completed (all required photos submitted)
  const completedCount = items.filter(item =>
    (submissions[item.id]?.length ?? 0) >= (item.photo_count ?? 1)
  ).length

  // Early returns: show a loading or error state before the main render
  if (loading) return <Layout><div className="text-center py-12 text-gray-400">Loading...</div></Layout>
  if (notFound) return <Layout><div className="text-center py-12 text-gray-500">Hunt not found.</div></Layout>

  return (
    <Layout backHref="/" backLabel="All Hunts" title={hunt.name}>
      <HuntTimer endTime={hunt.end_time} />
      {hunt.description && (
        <p className="text-gray-500 text-sm mb-4">{hunt.description}</p>
      )}

      {/* If no team yet, show registration. Otherwise show the item list. */}
      {!team ? (
        <TeamRegistration hunt={hunt} onRegistered={handleRegistered} />
      ) : (
        <div>
          {/* Team info and progress counter */}
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

          {/* Navigation links to Vote and Results pages */}
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

          {/* Render one ItemCard per hunt item */}
          <div className="space-y-3">
            {items.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                teamId={team.teamId}
                // Pass this item's submissions array, or empty array if none yet
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
