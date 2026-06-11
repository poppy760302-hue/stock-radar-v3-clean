export default async function handler(req, res) {
  const results = {}

  // Test TWSE
  try {
    const r = await fetch('https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json', { signal: AbortSignal.timeout(10000) })
    const j = await r.json()
    results.twse = { status: r.status, count: j?.data?.length || 0, stat: j?.stat, date: j?.date }
  } catch(e) {
    results.twse = { error: e.message }
  }

  // Test TPEx
  try {
    const today = new Date()
    const d = `${today.getFullYear()-1911}/${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}`
    const r = await fetch(`https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?l=zh-tw&o=json&d=${d}&s=0,asc`, { signal: AbortSignal.timeout(10000) })
    const j = await r.json()
    results.tpex = { status: r.status, count: j?.aaData?.length || 0, date: d }
  } catch(e) {
    results.tpex = { error: e.message }
  }

  results.serverTime = new Date().toISOString()
  res.status(200).json(results)
}
