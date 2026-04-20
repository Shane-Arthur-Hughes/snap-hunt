import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import { supabase, ensureAnonSession } from '../lib/supabase'

export default function VotePage() {
  const router = useRouter()
  const { hunt: huntId } = router.query
  const [hunt, setHunt] = useState(null)
  const [items, setItems] = useState([])
  const [selectedItem, setSelectedItem] = useState(null)
  const [teams, setTeams] = useState([])
  const [myVotes, setMyVotes] = useState(new Set())
  const [userId, setUserId] = useState(null)
  const [loading, setLoading] = useState(true)
  const [voting, setVoting] = useState(null)

  useEffect(() => {
    if (!huntId) return
    async function init() {
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

      if (itemsData?.length) {
        setSelectedItem(itemsData[0].id)
      }
      setLoading(false)
    }
    init()
  }, [huntId])

  useEffect(() => {
    if (!selectedItem || !userId) return
    loadTeams(selectedItem, userId)
  }, [selectedItem, userId])

  async function loadTeams(itemId, uid) {
    const { data: subs } = await supabase
      .from('submissions')
      .select('photo_url, caption, team_id, teams(id, name)')
      .eq('item_id', itemId)
      .order('created_at', { ascending: true })

    const teamMap = {}
    for (const sub of subs || []) {
      const tid = sub.teams?.id
      if (!tid) continue
      if (!teamMap[tid]) teamMap[tid] = { teamId: tid, teamName: sub.teams.name, photos: [], voteCount: 0 }
      teamMap[tid].photos.push({ url: sub.photo_url, caption: sub.caption })
    }
    const grouped = Object.values(teamMap)

    if (grouped.length > 0) {
      const teamIds = grouped.map(t => t.teamId)

      const [{ data: voteCounts }, { data: myVoteData }] = await Promise.all([
        supabase.from('votes').select('team_id').eq('item_id', itemId).in('team_id', teamIds),
        supabase.from('votes').select('team_id').eq('item_id', itemId).eq('anon_user_id', uid).in('team_id', teamIds),
      ])

      const countMap = {}
      for (const v of voteCounts || []) {
        countMap[v.team_id] = (countMap[v.team_id] || 0) + 1
      }
      for (const t of grouped) t.voteCount = countMap[t.teamId] || 0

      setMyVotes(new Set((myVoteData || []).map(v => v.team_id)))
    }

    setTeams(grouped)
  }

  async function handleVote(teamId) {
    if (!userId || voting) return
    setVoting(teamId)

    const { error } = await supabase
      .from('votes')
      .insert({ item_id: selectedItem, team_id: teamId, anon_user_id: userId })

    if (!error) {
      setMyVotes(prev => new Set([...prev, teamId]))
      setTeams(prev => prev.map(t => t.teamId === teamId ? { ...t, voteCount: t.voteCount + 1 } : t))
    }
    setVoting(null)
  }

  if (loading) return <Layout><div className="text-center py-12 text-gray-400">Loading...</div></Layout>
  if (!hunt) return <Layout><div className="text-center py-12 text-gray-500">Hunt not found.</div></Layout>

  return (
    <Layout backHref={`/hunt?id=${huntId}`} backLabel={hunt.name} title="Vote on Photos">
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

      <div className="grid grid-cols-1 gap-4">
        {teams.map(team => {
          const hasVoted = myVotes.has(team.teamId)
          return (
            <div key={team.teamId} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {team.photos.length === 1 ? (
                <img
                  src={team.photos[0].url}
                  alt={team.teamName}
                  className="w-full object-cover max-h-72"
                />
              ) : (
                <div className="grid grid-cols-2 gap-0.5">
                  {team.photos.map((photo, i) => (
                    <img
                      key={i}
                      src={photo.url}
                      alt={`${team.teamName} photo ${i + 1}`}
                      className="w-full object-cover h-40"
                    />
                  ))}
                </div>
              )}
              {team.photos.some(p => p.caption) && (
                <div className="px-3 pt-2 space-y-0.5">
                  {team.photos.map((photo, i) => photo.caption && (
                    <p key={i} className="text-sm text-gray-600">
                      {team.photos.length > 1 && <span className="text-xs text-gray-400 mr-1">#{i + 1}</span>}
                      {photo.caption}
                    </p>
                  ))}
                </div>
              )}
              <div className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{team.teamName}</p>
                  <p className="text-xs text-gray-400">{team.voteCount} {team.voteCount === 1 ? 'vote' : 'votes'}</p>
                </div>
                <button
                  onClick={() => handleVote(team.teamId)}
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
    </Layout>
  )
}
