const fs = require('fs')
const path = require('path')

async function fetchTWSE() {
  try {
    const res = await fetch(
      'https://www.twse.com.tw/rwd/zh/afterTrading/STOCK_DAY_ALL?response=json',
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    )
    if (!res.ok) { console.log('TWSE not ok:', res.status); return null }
    const data = await res.json()
    if (!data?.data || data.data.length < 100) { console.log('TWSE no data'); return null }
    console.log(`TWSE: ${data.data.length} stocks, date: ${data.date}`)
    return {
      date: data.date || '',
      stocks: data.data.map(row => {
        const price = parseFloat(String(row[7]||0).replace(/,/g,'')) || 0
        const ch    = parseFloat(String(row[8]||0).replace(/,/g,'')) || 0
        const prev  = price - ch
        return {
          code: row[0].trim(), name: row[1].trim(), price, change: ch,
          changePct: prev > 0 ? ch / prev * 100 : 0,
          vol:    parseFloat(String(row[2]||0).replace(/,/g,'')) || 0,
          amount: parseFloat(String(row[3]||0).replace(/,/g,'')) || 0,
          high:   parseFloat(String(row[5]||0).replace(/,/g,'')) || 0,
          low:    parseFloat(String(row[6]||0).replace(/,/g,'')) || 0,
          market: 'TWSE', inst: 0,
        }
      }).filter(s => s.price > 0)
    }
  } catch(e) { console.log('TWSE error:', e.message); return null }
}

async function fetchTPEx() {
  try {
    const today = new Date()
    const tw = `${today.getFullYear()-1911}/${String(today.getMonth()+1).padStart(2,'0')}/${String(today.getDate()).padStart(2,'0')}`
    const res = await fetch(
      `https://www.tpex.org.tw/web/stock/aftertrading/daily_close_quotes/stk_quote_result.php?l=zh-tw&o=json&d=${tw}&s=0,asc`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' } }
    )
    if (!res.ok) { console.log('TPEx not ok:', res.status); return null }
    const data = await res.json()
    if (!data?.aaData || data.aaData.length < 10) { console.log('TPEx no data'); return null }
    console.log(`TPEx: ${data.aaData.length} stocks`)
    return {
      date: tw,
      stocks: data.aaData.map(row => {
        const price = parseFloat(String(row[2]||0).replace(/,/g,'')) || 0
        const prev  = parseFloat(String(row[3]||0).replace(/,/g,'')) || 0
        const ch    = price - prev
        return {
          code: row[0].trim(), name: row[1].trim(), price, change: ch,
          changePct: prev > 0 ? ch / prev * 100 : 0,
          vol:    parseFloat(String(row[8]||0).replace(/,/g,'')) || 0,
          amount: (parseFloat(String(row[9]||0).replace(/,/g,'')) || 0) * 1000,
          high:   parseFloat(String(row[5]||0).replace(/,/g,'')) || 0,
          low:    parseFloat(String(row[6]||0).replace(/,/g,'')) || 0,
          market: 'TPEx', inst: 0,
        }
      }).filter(s => s.price > 0)
    }
  } catch(e) { console.log('TPEx error:', e.message); return null }
}

async function main() {
  console.log('Fetching stock data...')
  const [twse, tpex] = await Promise.all([fetchTWSE(), fetchTPEx()])

  if (!twse && !tpex) {
    console.log('Both APIs failed, keeping existing data')
    process.exit(0)
  }

  const allStocks = [
    ...(twse?.stocks || []),
    ...(tpex?.stocks || []),
  ]

  const result = {
    fetchedAt: new Date().toISOString(),
    dataDate: twse?.date || tpex?.date || '',
    totalCount: allStocks.length,
    stocks: allStocks,
  }

  const outPath = path.join(__dirname, '../public/data.json')
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(result))
  console.log(`✅ Saved ${allStocks.length} stocks to public/data.json`)
}

main().catch(e => { console.error(e); process.exit(1) })
