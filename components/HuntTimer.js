import { useEffect, useState } from 'react'

// Displays a sticky countdown bar at the top of the page.
// Shows green/amber/red depending on time remaining, and "Hunt has ended" when expired.
// Returns null if no end_time is set on the hunt.
export default function HuntTimer({ endTime }) {
  const [timeLeft, setTimeLeft] = useState(null)

  useEffect(() => {
    if (!endTime) return

    function tick() {
      const diff = new Date(endTime) - new Date()
      setTimeLeft(diff > 0 ? diff : 0)
    }

    tick()
    // Update the countdown every second
    const interval = setInterval(tick, 1000)
    // Clean up the interval when the component is removed from the page
    return () => clearInterval(interval)
  }, [endTime])

  if (!endTime || timeLeft === null) return null

  const isExpired = timeLeft === 0
  const isUrgent = !isExpired && timeLeft < 5 * 60 * 1000  // under 5 minutes

  const hours = Math.floor(timeLeft / 3600000)
  const minutes = Math.floor((timeLeft % 3600000) / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)

  const display = isExpired
    ? 'Hunt has ended'
    : hours > 0
      ? `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s remaining`
      : `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')} remaining`

  return (
    <div className={`sticky top-0 z-20 text-center py-2 text-sm font-semibold tracking-wide ${
      isExpired ? 'bg-red-500 text-white' :
      isUrgent  ? 'bg-orange-500 text-white' :
                  'bg-indigo-600 text-white'
    }`}>
      {display}
    </div>
  )
}
