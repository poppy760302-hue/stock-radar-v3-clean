export default async function handler(req, res) {
  try {
    const r = await fetch('https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json', { signal: AbortSignal.timeout(10000) })
    const j = await r.json()
    // Return first 3 rows + fields info
    res.status(200).json({
      stat: j.stat,
      date: j.date,
      fields: j.fields,
      totalRows: j.data?.length,
      first5: j.data?.slice(0, 5)
    })
  } catch(e) {
    res.status(500).json({ error: e.message })
  }
}
