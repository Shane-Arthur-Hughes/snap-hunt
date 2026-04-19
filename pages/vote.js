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
  const [submissions, setSubmissions] = useState([])
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
    loadSubmissions(selectedItem, userId)
  }, [selectedItem, userId])

  async function loadSubmissions(itemId, uid) {
    const { data: subs } = await supabase
      .from('submissions')
      .select('id, photo_url, created_at, teams(name), votes(id)')
      .eq('item_id', itemId)
      .order('created_at', { ascending: true })

    const { data: myVoteData } = await supabase
      .from('votes')
      .select('submission_id')
      .eq('anon_user_id', uid)
      .in('submission_id', (subs || []).map(s => s.id))

    setSubmissions(subs || [])
    setMyVotes(new Set((myVoteData || []).map(v => v.submission_id)))
  }

  async function handleVote(submissionId) {
    if (!userId || voting) return
    setVoting(submissionId)

    const { error } = await supabase
      .from('votes')
      .insert({ submission_id: submissionId, anon_user_id: userId })

    if (!error) {
      setMyVotes(prev => new Set([...prev, submissionId]))
      setSubmissions(prev =>
        prev.map(s =>
          s.id === submissionId
            ? { ...s, votes: [...s.votes, { id: 'new' }] }
            : s
        )
      )
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

      {submissions.length === 0 && (
        <div className="text-center text-gray-400 py-12">
          No submissions for this item yet.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4">
        {submissions.map(sub => {
          const voteCount = sub.votes?.length ?? 0
          const hasVoted = myVotes.has(sub.id)
          return (
            <div key={sub.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <img
                src={sub.photo_url}
                alt={`Submission by ${sub.teams?.name}`}
                className="w-full object-cover max-h-72"
              />
              <div className="p-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-800">{sub.teams?.name || 'Unknown team'}</p>
                  <p className="text-xs text-gray-400">{voteCount} {voteCount === 1 ? 'vote' : 'votes'}</p>
                </div>
                <button
                  onClick={() => handleVote(sub.id)}
                  disabled={hasVoted || voting === sub.id}
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
