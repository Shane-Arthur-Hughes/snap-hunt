import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import Link from 'next/link'
import Layout from '../components/Layout'
import { supabase } from '../lib/supabase'

export default function ResultsPage() {
  const router = useRouter()
  const { hunt: huntId } = router.query
  const [hunt, setHunt] = useState(null)
  const [items, setItems] = useState([])
  const [leaderboard, setLeaderboard] = useState([])
  const [itemResults, setItemResults] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!huntId) return
    async function load() {
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

      const { data: allSubs } = await supabase
        .from('submissions')
        .select('id, photo_url, item_id, team_id, teams(id, name), votes(id)')
        .in('item_id', (itemsData || []).map(i => i.id))

      const byItem = {}
      const teamScores = {}

      for (const sub of allSubs || []) {
        const count = sub.votes?.length ?? 0
        if (!byItem[sub.item_id]) byItem[sub.item_id] = []
        byItem[sub.item_id].push({ ...sub, voteCount: count })

        const tid = sub.teams?.id
        if (!tid) continue
        if (!teamScores[tid]) teamScores[tid] = { name: sub.teams.name, total: 0 }
        teamScores[tid].total += count
      }

      for (const id in byItem) {
        byItem[id].sort((a, b) => b.voteCount - a.voteCount)
      }

      const board = Object.values(teamScores).sort((a, b) => b.total - a.total)
      setLeaderboard(board)
      setItemResults(byItem)
      setLoading(false)
    }
    load()
  }, [huntId])

  if (loading) return <Layout><div className="text-center py-12 text-gray-400">Loading...</div></Layout>
  if (!hunt) return <Layout><div className="text-center py-12 text-gray-500">Hunt not found.</div></Layout>

  return (
    <Layout backHref={`/hunt?id=${huntId}`} backLabel={hunt.name} title="Results">
      <div className="flex gap-2 mb-6">
        <Link
          href={`/vote?hunt=${huntId}`}
          className="text-sm text-indigo-600 hover:underline"
        >
          &larr; Back to voting
        </Link>
      </div>

      {/* Leaderboard */}
      <section className="mb-8">
        <h2 className="text-lg font-bold text-gray-800 mb-3">Team Leaderboard</h2>
        {leaderboard.length === 0 ? (
          <p className="text-gray-400 text-sm">No votes yet.</p>
        ) : (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            {leaderboard.map((team, i) => (
              <div
                key={team.name}
                className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? 'border-t border-gray-50' : ''}`}
              >
                <span className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-yellow-100 text-yellow-700' :
                  i === 1 ? 'bg-gray-100 text-gray-600' :
                  i === 2 ? 'bg-orange-100 text-orange-600' :
                  'bg-gray-50 text-gray-400'
                }`}>
                  {i + 1}
                </span>
                <span className="flex-1 font-medium text-gray-800">{team.name}</span>
                <span className="text-indigo-600 font-semibold">{team.total} pts</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Per-item results */}
      <section>
        <h2 className="text-lg font-bold text-gray-800 mb-3">By Item</h2>
        <div className="space-y-6">
          {items.map(item => {
            const subs = itemResults[item.id] || []
            return (
              <div key={item.id}>
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  {item.title}
                </h3>
                {subs.length === 0 ? (
                  <p className="text-gray-400 text-sm">No submissions.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {subs.map((sub, i) => (
                      <div
                        key={sub.id}
                        className={`relative rounded-xl overflow-hidden border-2 ${
                          i === 0 ? 'border-yellow-400' : 'border-gray-100'
                        }`}
                      >
                        <img
                          src={sub.photo_url}
                          alt={sub.teams?.name}
                          className="w-full h-32 object-cover"
                        />
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                          <p className="text-white text-xs font-semibold truncate">{sub.teams?.name}</p>
                          <p className="text-white/80 text-xs">{sub.voteCount} votes</p>
                        </div>
                        {i === 0 && (
                          <div className="absolute top-2 left-2 bg-yellow-400 text-yellow-900 text-xs font-bold px-1.5 py-0.5 rounded">
                            #1
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>
    </Layout>
  )
}
