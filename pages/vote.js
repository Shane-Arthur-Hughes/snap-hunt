import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import HuntTimer from '../components/HuntTimer'
// ensureAnonSession gives every voter a unique anonymous ID without requiring sign-up
import { supabase, ensureAnonSession } from '../lib/supabase'

// URL: /vote?hunt=<huntId>
export default function VotePage() {
  const router = useRouter()
  // Read the 'hunt' query parameter from the URL (e.g. /vote?hunt=abc → huntId = 'abc')
  const { hunt: huntId } = router.query

  const [hunt, setHunt] = useState(null)
  const [items, setItems] = useState([])
  // The currently selected item tab
  const [selectedItem, setSelectedItem] = useState(null)
  // Array of team submission groups for the selected item
  const [teams, setTeams] = useState([])
  // A Set of team IDs that the current user has already voted for on this item.
  // Set is used instead of an array because checking membership (has()) is faster.
  const [myVotes, setMyVotes] = useState(new Set())
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  // Stores the team ID currently being voted on (to show a loading state on that button)
  const [voting, setVoting] = useState(null)
  // Lightbox state: { photos, index } when open, null when closed
  const [lightbox, setLightbox] = useState(null)

  // On page load: get/create an anonymous session, then load hunt and items
  useEffect(() => {
    if (!huntId) return
    async function init() {
      // Ensure the user has an anonymous Supabase session so votes can be attributed to them
      const user = await ensureAnonSession()
      setUserId(user?.id)

      const { data: huntData } = await supabase
        .from('hunts')
        .select('*')
        .eq('id', huntId)
        .single()
      setHunt(huntData)

      const { data: itemsData } = await supabase
        .from('items')
        .select('*')
        .eq('hunt_id', huntId)
        .order('sort_order', { ascending: true })
      setItems(itemsData || [])

      // Auto-select the first item tab
      if (itemsData?.length) {
        setSelectedItem(itemsData[0].id)
      }
      setLoading(false)
    }
    init()
  }, [huntId])

  // Whenever the selected item tab changes (or userId becomes available),
  // reload the submissions and votes for that item
  useEffect(() => {
    if (!selectedItem || !userId) return
    loadTeams(selectedItem, userId)
  }, [selectedItem, userId])

  // Fetches all submissions for the selected item, groups them by team,
  // and attaches vote counts + the current user's votes
  async function loadTeams(itemId, uid) {
    // Fetch all submissions for this item, including the team name via a join
    const { data: subs } = await supabase
      .from('submissions')
      .select('photo_url, caption, team_id, teams(id, name)')
      .eq('item_id', itemId)
      .order('created_at', { ascending: true })

    // Group the flat submissions list into a map keyed by team ID.
    // Each entry holds all of that team's photos together.
    const teamMap = {}
    for (const sub of subs || []) {
      const tid = sub.teams?.id
      if (!tid) continue
      if (!teamMap[tid]) teamMap[tid] = { teamId: tid, teamName: sub.teams.name, photos: [], voteCount: 0 }
      teamMap[tid].photos.push({ url: sub.photo_url, caption: sub.caption })
    }
    // Convert the object map to an array for rendering
    const grouped = Object.values(teamMap)

    if (grouped.length > 0) {
      const teamIds = grouped.map(t => t.teamId)

      // Run both vote queries in parallel using Promise.all — faster than running them sequentially
      const [{ data: voteCounts }, { data: myVoteData }] = await Promise.all([
        // All votes for this item (to display total counts)
        supabase.from('votes').select('team_id').eq('item_id', itemId).in('team_id', teamIds),
        // Just this user's votes (to know which Vote buttons to disable)
        supabase.from('votes').select('team_id').eq('item_id', itemId).eq('anon_user_id', uid).in('team_id', teamIds),
      ])

      // Count votes per team: { teamId: count }
      const countMap = {}
      for (const v of voteCounts || []) {
        countMap[v.team_id] = (countMap[v.team_id] || 0) + 1
      }
      // Attach the count to each team entry
      for (const t of grouped) t.voteCount = countMap[t.teamId] || 0

      // Build a Set of team IDs the current user has already voted for
      setMyVotes(new Set((myVoteData || []).map(v => v.team_id)))
    }

    setTeams(grouped)
  }

  async function handleVote(teamId) {
    // Guard: don't vote if we have no user ID, or another vote is already in progress
    if (!userId || voting) return
    setVoting(teamId)

    // Insert a vote row. The unique constraint in the DB prevents duplicate votes.
    const { error } = await supabase
      .from('votes')
      .insert({ item_id: selectedItem, team_id: teamId, anon_user_id: userId })

    if (!error) {
      // Optimistically update the UI without waiting for a re-fetch:
      // 1. Add this team to the user's voted set
      setMyVotes(prev => new Set([...prev, teamId]))
      // 2. Increment the vote count on the matching team card
      setTeams(prev => prev.map(t => t.teamId === teamId ? { ...t, voteCount: t.voteCount + 1 } : t))
    }
    setVoting(null)
  }

  if (loading) return <Layout><div className="text-center py-12 text-gray-400">Loading...</div></Layout>
  if (!hunt) return <Layout><div className="text-center py-12 text-gray-500">Hunt not found.</div></Layout>

  return (
    <Layout backHref={`/hunt?id=${huntId}`} backLabel={hunt.name} title="Vote on Photos">
      <HuntTimer endTime={hunt.end_time} />

      {/* Horizontal scrollable row of item tabs */}
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {items.map(item => (
          <button
            key={item.id}
            onClick={() => setSelectedItem(item.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedItem === item.id
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-300 text-gray-600 hover:border-indigo-400'
            }`}
          >
            {item.title}
          </button>
        ))}
      </div>

      <div className="mb-3">
        <Link href={`/results?hunt=${huntId}`} className="text-sm text-indigo-600 hover:underline">
          See results &rarr;
        </Link>
      </div>

      {teams.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          No submissions for this item yet.
        </div>
      )}

      {/* One card per team showing all their photos together */}
      <div className="grid grid-cols-1 gap-4">
        {teams.map(team => {
          const hasVoted = myVotes.has(team.teamId)
          return (
            <div key={team.teamId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Single photo: full width. Multiple photos: 2-column grid.
                  Each photo is tappable to open the lightbox. */}
              {team.photos.length === 1 ? (
                <img
                  src={team.photos[0].url}
                  alt={team.teamName}
                  className="w-full object-cover max-h-72 cursor-pointer"
                  onClick={() => setLightbox({ photos: team.photos, index: 0 })}
                />
              ) : (
                <div className="grid grid-cols-2 gap-0.5">
                  {team.photos.map((photo, i) => (
                    <img
                      key={i}
                      src={photo.url}
                      alt={`${team.teamName} photo ${i + 1}`}
                      className="w-full object-cover h-40 cursor-pointer"
                      onClick={() => setLightbox({ photos: team.photos, index: i })}
                    />
                  ))}
                </div>
              )}

              {/* Only render the captions section if at least one photo has a caption.
                  .some() returns true if any element in the array matches the condition. */}
              {team.photos.some(p => p.caption) && (
                <div className="px-3 pt-2 space-y-0.5">
                  {team.photos.map((photo, i) => photo.caption && (
                    <p key={i} className="text-sm text-gray-600">
                      {/* Show a photo number prefix only if there are multiple photos */}
                      {team.photos.length > 1 && <span className="text-xs text-gray-400 mr-1">#{i + 1}</span>}
                      {photo.caption}
                    </p>
                  ))}
                </div>
              )}

              <div className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{team.teamName}</p>
                  {/* Ternary to handle singular/plural: "1 vote" vs "2 votes" */}
                  <p className="text-xs text-gray-400">{team.voteCount} {team.voteCount === 1 ? 'vote' : 'votes'}</p>
                </div>
                <button
                  onClick={() => handleVote(team.teamId)}
                  // Disable if already voted, or while any vote is being processed
                  disabled={hasVoted || !!voting}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                    hasVoted
                      ? 'bg-pink-100 text-pink-600 cursor-default'
                      : 'bg-white border border-gray-300 text-gray-600 hover:border-pink-400 hover:text-pink-500'
                  }`}
                >
                  {hasVoted ? '♥ Voted' : '♡ Vote'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {/* Lightbox modal — renders on top of everything when a photo is tapped */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center"
          onClick={() => setLightbox(null)}
        >
          {/* Stop click propagation on the image so tapping the photo doesn't close the modal */}
          <div className="relative w-full max-w-lg px-4" onClick={e => e.stopPropagation()}>
            <img
              src={lightbox.photos[lightbox.index].url}
              alt={`Photo ${lightbox.index + 1}`}
              className="w-full max-h-[75vh] object-contain rounded-lg"
            />
            {lightbox.photos[lightbox.index].caption && (
              <p className="text-white/80 text-sm text-center mt-2">
                {lightbox.photos[lightbox.index].caption}
              </p>
            )}

            {/* Previous / Next buttons — only shown when there are multiple photos */}
            {lightbox.photos.length > 1 && (
              <div className="flex justify-between mt-4">
                <button
                  onClick={() => setLightbox(prev => ({ ...prev, index: prev.index - 1 }))}
                  disabled={lightbox.index === 0}
                  className="text-white/70 hover:text-white disabled:opacity-20 text-2xl px-4"
                >
                  ‹
                </button>
                <span className="text-white/50 text-sm self-center">
                  {lightbox.index + 1} / {lightbox.photos.length}
                </span>
                <button
                  onClick={() => setLightbox(prev => ({ ...prev, index: prev.index + 1 }))}
                  disabled={lightbox.index === lightbox.photos.length - 1}
                  className="text-white/70 hover:text-white disabled:opacity-20 text-2xl px-4"
                >
                  ›
                </button>
              </div>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 text-white/70 hover:text-white text-3xl leading-none"
          >
            &times;
          </button>
        </div>
      )}
    </Layout>
  )
}
