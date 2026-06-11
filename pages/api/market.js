import { getMockData } from '../../lib/mockData'
import { pn, isJunk, buildCandidates, analyzeAll, buildYoyo, buildSectors } from '../../lib/rules'

let _cache = null
let _cacheTime = 0
const CACHE_TTL = 5 * 60 * 1000  // 5 minutes

const GITHUB_RAW = 'https://raw.githubusercontent.com/poppy760302-hue/stock-radar-v3-clean/main/public/data.json'

async function fetchFromGitHub() {
  try {
    const res = await fetch(GITHUB_RAW + '?t=' + Date.now(), {
      headers: { 'Cache-Control': 'no-cache' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return null
    const data = await res.json()
    if (!data?.stocks || data.stocks.length < 100) return null
    console.log(`GitHub: ${data.stocks.length} stocks, date: ${data.dataDate}`)
    return data
  } catch(e) {
    console.log('GitHub fetch error:', e.message)
    return null
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end()

  const now = Date.now()
  const forceRefresh = req.query.refresh === '1'

  // Return cache if fresh
  if (_cache && !forceRefresh && (now - _cacheTime) < CACHE_TTL) {
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60')
    res.setHeader('X-Cache', 'HIT')
    return res.status(200).json(_cache)
  }

  // Try GitHub first
  const ghData = await fetchFromGitHub()

  let allStocks = []
  let isReal = false
  let dataDate = ''

  if (ghData) {
    allStocks = ghData.stocks
    isReal = true
    dataDate = ghData.dataDate || ''
  } else {
    // Fallback to mock
    allStocks = getMockData()
    isReal = false
  }

  const candidates = buildCandidates(allStocks)
  const analysis   = analyzeAll(candidates)
  const yoyo       = buildYoyo(allStocks)
  const sectors    = buildSectors(allStocks)

  const twseArr = allStocks.filter(s => s.market === 'TWSE' && !isJunk(s.code, s.name) && s.changePct > 0).sort((a, b) => b.changePct - a.changePct)
  const tpexArr = allStocks.filter(s => s.market === 'TPEx' && !isJunk(s.code, s.name) && s.changePct > 0).sort((a, b) => b.changePct - a.changePct)

  const result = {
    isReal,
    dataDate,
    totalCount: allStocks.length,
    candidates,
    analysis,
    yoyo,
    sectors,
    topTWSE: twseArr[0] || null,
    topTPEx: tpexArr[0] || null,
    updatedAt: new Date().toISOString(),
  }

  _cache = result
  _cacheTime = now

  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=60')
  res.setHeader('X-Cache', 'MISS')
  res.status(200).json(result)
}
