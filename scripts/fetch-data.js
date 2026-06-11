const fs = require('fs')
const path = require('path')

function pn(v) {
  return parseFloat(String(v||0).replace(/,/g,'')) || 0
}

async function fetchTWSE() {
  try {
    const res = await fetch(
      'https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' } }
    )
    const text = await res.text()
    console.log('TWSE status:', res.status, 'body preview:', text.slice(0,100))
    if (!res.ok) return null
    const data = JSON.parse(text)
    if (!data?.data || data.data.length < 100) {
      console.log('TWSE stat:', data?.stat)
      return null
    }
    console.log(`TWSE: ${data.data.length} stocks, date: ${data.date}`)
    return {
      date: data.date || '',
      stocks: data.data.map(row => {
        const price = pn(row[7]), ch = pn(row[8]), prev = price - ch
        return {
          code: row[0].trim(), name: row[1].trim(), price, change: ch,
          changePct: prev > 0 ? ch/prev*100 : 0,
          vol: pn(row[2]), amount: pn(row[3]),
          high: pn(row[5]), low: pn(row[6]),
          market: 'TWSE', inst: 0,
        }
      }).filter(s => s.price > 0)
    }
  } catch(e) { console.log('TWSE error:', e.message); return null }
}

async function fetchTPEx() {
  // Try last 5 weekdays
  for (let i = 0; i <= 4; i++) {
    const d = new Date()
    d.setDate(d.getDate() - i)
    if (d.getDay() === 0 || d.getDay() === 6) continue
    const tw = `${d.getFullYear()-1911}/${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}`
    try {
      const res = await fetch(
        `https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?l=zh-tw&o=json&d=${tw}&s=0,asc`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' } }
      )
      if (!res.ok) continue
      const data = await res.json()
      if (!data?.aaData || data.aaData.length < 10) continue
      console.log(`TPEx: ${data.aaData.length} stocks, date: ${tw}`)
      return {
        date: tw,
        stocks: data.aaData.map(row => {
          const price = pn(row[2]), prev = pn(row[3]), ch = price - prev
          return {
            code: row[0].trim(), name: row[1].trim(), price, change: ch,
            changePct: prev > 0 ? ch/prev*100 : 0,
            vol: pn(row[8]), amount: pn(row[9])*1000,
            high: pn(row[5]), low: pn(row[6]),
            market: 'TPEx', inst: 0,
          }
        }).filter(s => s.price > 0)
      }
    } catch(e) { console.log(`TPEx ${tw} error:`, e.message) }
  }
  return null
}

async function main() {
  console.log('Fetching stock data...')
  const [twse, tpex] = await Promise.all([fetchTWSE(), fetchTPEx()])

  const allStocks = [...(twse?.stocks||[]), ...(tpex?.stocks||[])]
  console.log('Total stocks:', allStocks.length)

  if (allStocks.length < 100) {
    console.log('Not enough data, aborting')
    process.exit(1)  // fail loudly so we see the error
  }

  const result = {
    fetchedAt: new Date().toISOString(),
    dataDate: twse?.date || tpex?.date || '',
    totalCount: allStocks.length,
    stocks: allStocks,
  }

  const outPath = path.join(__dirname, '../public/data.json')
  fs.mkdirSync(path.dirname(outPath), {recursive:true})
  fs.writeFileSync(outPath, JSON.stringify(result))
  console.log(`✅ Saved ${allStocks.length} stocks → ${outPath}`)
}

main().catch(e => { console.error(e); process.exit(1) })
