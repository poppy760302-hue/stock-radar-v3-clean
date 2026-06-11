export const THEME_KW = {
  ai:    ['廣達','緯創','英業達','鴻海','台達電','聯發科','智原','創意','奇景','力旺','世芯','晶心','譜瑞','宜鼎','緯穎','技嘉','微星','華碩','雲達','和碩'],
  semi:  ['台積電','聯電','南亞科','華邦電','旺宏','日月光','矽格','京元電','超豐','力成','欣銓','漢磊','嘉晶','環球晶','力積電','晶豪','世界先進'],
  opt:   ['波若威','訊芯','前鼎','正淩','智邦','中磊','亞旭','合勤','友訊','聯亞','全新','光聖','台揚','光環','昇達科','上詮','華星光'],
  heat:  ['奇鋐','雙鴻','建準','超衆','力致','泰碩','勤誠','廣運','協禧'],
  robot: ['上銀','東元','精機工業','大銀微','直得','世芯','晶心科','創意電子'],
}

export const THEME_META = {
  ai:    { icon: '🤖', name: 'AI / 伺服器',    color: '#9b7ef8' },
  semi:  { icon: '💎', name: '半導體',          color: '#5b9cf6' },
  opt:   { icon: '💡', name: '光通訊 / CoWoS',  color: '#3dd68c' },
  heat:  { icon: '🌡️', name: '散熱',            color: '#f0894a' },
  robot: { icon: '🦾', name: '機器人 / ASIC',   color: '#f5c842' },
}

export function pn(v) {
  return parseFloat(String(v || 0).replace(/,/g, '')) || 0
}

export function isJunk(code, name) {
  const c = String(code || '')
  if (c.length > 6) return true
  if (/^00\d{3}|^0050|^0051|^0052|^006|^008/.test(c)) return true
  if (name && /ETF|認購|認售|牛證|熊證/.test(name)) return true
  return false
}

export function getTags(name) {
  return Object.entries(THEME_KW)
    .filter(([, kws]) => kws.some(k => name.includes(k)))
    .map(([k]) => k)
}

export function buildCandidates(all) {
  const filtered = all.filter(s => !isJunk(s.code, s.name) && s.price >= 100 && s.amount >= 1e7)
  const maxAmt = Math.max(...filtered.map(s => s.amount), 1)
  return filtered.map(s => {
    const amp = (!s.high || !s.low || s.low === 0) ? 0 : (s.high - s.low) / s.low * 100
    const tags = getTags(s.name)
    const score = (s.amount / maxAmt) * 40 + Math.min(amp / 8 * 25, 25) + (tags.length ? 20 : 0) + Math.min(Math.max((s.inst || 0) / 5000 * 15, 0), 15)
    return { ...s, amp, tags, score }
  }).sort((a, b) => b.score - a.score).slice(0, 80)
}

// ── 新評分公式 ─────────────────────────────────────────────
function calcContinuationScore(s) {
  let score = 0
  const chg = Math.abs(s.changePct)
  if (chg >= 3 && chg < 5)       score += 35
  else if (chg >= 5 && chg < 8)  score += 25
  else if (chg >= 8 && chg < 10) score += 15
  else if (chg >= 2 && chg < 3)  score += 20
  else if (chg >= 10)             score += 10
  else                            score += 5
  if (s.inst > 5000)      score += 35
  else if (s.inst > 2000) score += 25
  else if (s.inst > 0)    score += 15
  if (s.tags?.length > 0) score += 30
  return Math.min(100, score)
}

function calcEntryScore(s, entryLo, entryHi, rVal) {
  let score = 0
  if (entryLo && entryHi) {
    const over = (s.price - entryHi) / entryHi * 100
    if (s.price >= entryLo && s.price <= entryHi) score += 50
    else if (s.price < entryLo) score += 35
    else if (over <= 3)         score += 20
    else if (over <= 5)         score += 10
    else                        score += 0
  } else { score += 20 }
  if (rVal >= 2.0)      score += 30
  else if (rVal >= 1.5) score += 20
  else if (rVal >= 1.0) score += 10
  if (s.amp < 4)       score += 20
  else if (s.amp < 6)  score += 15
  else if (s.amp < 8)  score += 8
  return Math.min(100, score)
}

function calcCapitalScore(s) {
  if (s.amount >= 30e8)      return 100
  if (s.amount >= 15e8)      return 85
  if (s.amount >= 8e8)       return 70
  if (s.amount >= 3e8)       return 55
  if (s.amount >= 1e8)       return 40
  if (s.amount >= 3e7)       return 25
  return 10
}

function calcCompositeScore(s, entryLo, entryHi, rVal) {
  const c = calcContinuationScore(s)
  const e = calcEntryScore(s, entryLo, entryHi, rVal)
  const k = calcCapitalScore(s)
  return Math.max(1, Math.min(100, Math.round(c * 0.40 + e * 0.35 + k * 0.25)))
}

function calcRisk(s, entryHi) {
  const over = entryHi ? (s.price - entryHi) / entryHi * 100 : 0
  if (over > 5) return '追價風險'
  if (s.amp >= 8 || Math.abs(s.changePct) >= 8) return '高'
  if (s.amp >= 4 || Math.abs(s.changePct) >= 4) return '中'
  return '低'
}

// ── 快速標籤 ──────────────────────────────────────────────
function buildQuickTags(s, dir, entryLo, entryHi, rVal) {
  const tags = []
  if (dir === '做多') {
    if (Math.abs(s.changePct) >= 5 && s.amp >= 7) tags.push({ key:'break', label:'🚀 強勢突破', type:'main' })
    else if (rVal >= 2.0 && s.amp < 5)            tags.push({ key:'lowrisk', label:'💎 低風險佈局', type:'main' })
    else if (s.price < (entryLo || 0))             tags.push({ key:'wait', label:'👀 等待時機', type:'main' })
    else if (Math.abs(s.changePct) >= 3)           tags.push({ key:'strong', label:'📈 趨勢延續', type:'main' })
  }
  if (s.amount >= 10e8)          tags.push({ key:'capital', label:'🔥 資金集中', type:'sector' })
  else if (s.tags?.length > 0 && s.inst > 0) tags.push({ key:'trend', label:'📈 族群+法人', type:'sector' })
  else if (s.tags?.length > 0) {
    const m = { ai:'🤖 AI族群', semi:'💎 半導體', opt:'💡 光通訊', heat:'🌡️ 散熱', robot:'🦾 機器人' }
    tags.push({ key:'sector', label: m[s.tags[0]] || '族群熱門', type:'sector' })
  } else if (s.amount >= 3e8) tags.push({ key:'vol', label:'🔥 量能放大', type:'sector' })

  const over = entryHi ? (s.price - entryHi) / entryHi * 100 : 0
  if (over > 5)    tags.push({ key:'chase', label:'⚠️ 追價風險', type:'risk' })
  else if (s.amp >= 8) tags.push({ key:'volatile', label:'⚠️ 高波動', type:'risk' })

  return [
    ...tags.filter(t => t.type === 'main').slice(0, 1),
    ...tags.filter(t => t.type === 'sector').slice(0, 1),
    ...tags.filter(t => t.type === 'risk').slice(0, 1),
  ]
}

// ── 入選原因標籤（給候選池/異常強勢股用）────────────────
export function buildEntryReasons(s, sectorRank) {
  const reasons = []
  // 爆量
  if (s.amount >= 20e8)      reasons.push('爆量 ' + (s.amount / 1e8).toFixed(1) + ' 億')
  else if (s.amount >= 10e8) reasons.push('大量 ' + (s.amount / 1e8).toFixed(1) + ' 億')
  else if (s.amount >= 3e8)  reasons.push('量能充足 ' + (s.amount / 1e8).toFixed(1) + ' 億')
  // 法人
  if (s.inst > 5000)      reasons.push('法人大買 ' + s.inst.toLocaleString() + ' 張')
  else if (s.inst > 1000) reasons.push('法人買超 ' + s.inst.toLocaleString() + ' 張')
  // 族群
  if (s.tags?.length > 0) {
    const m = { ai:'AI主流', semi:'半導體', opt:'光通訊/CoWoS', heat:'散熱', robot:'機器人' }
    const rank = sectorRank !== undefined ? `族群熱度第 ${sectorRank + 1}` : m[s.tags[0]]
    reasons.push(rank)
  }
  // 振幅
  if (s.amp >= 8)       reasons.push('振幅 ' + s.amp.toFixed(1) + '%，異常活躍')
  else if (s.amp >= 5)  reasons.push('振幅 ' + s.amp.toFixed(1) + '%')
  // 漲幅
  if (Math.abs(s.changePct) >= 7) reasons.push('強勢上漲 +' + s.changePct.toFixed(1) + '%')

  return reasons.slice(0, 3)
}

// ── 摘要結論（一句話）──────────────────────────────────────
export function buildSummary(s, dir, action) {
  const chg = s.changePct
  const hasInst = s.inst > 0
  const hasSector = s.tags?.length > 0
  const bigVol = s.amount >= 5e8
  const highAmp = s.amp >= 8

  if (dir === '觀望') return '方向尚不明確，建議先觀察後續量價配合。'

  if (action === '不建議追價') {
    if (highAmp) return '今日振幅過大，追高停損空間不足，建議等待回調。'
    return `距進場區已有距離，追高風險偏高，等回測再評估。`
  }
  if (action === '立即可進場') {
    if (hasSector && hasInst) return `族群資金同步流入，法人站在買方，目前位置可分批佈局。`
    if (bigVol && hasInst)    return `爆量伴隨法人進場，動能強勁，可考慮佈局。`
    if (hasSector)            return `族群方向明確，現價在進場區內，可考慮小量試單。`
    return `技術面偏強，目前在進場區內，可嘗試佈局，停損設於 ${s.stopLoss}。`
  }
  if (action === '等待拉回') {
    if (highAmp) return `今日振幅較大，建議等開盤回測進場區 ${s.entryLo}–${s.entryHi} 再進場。`
    return `動能延續中，等回測進場區 ${s.entryLo}–${s.entryHi} 可介入，追高風險較低。`
  }
  // 僅觀察
  if (hasSector) return `族群熱度尚可，但個股動能不足，列入觀察名單，等量能放大再行動。`
  return `目前條件尚未符合進場標準，可列入觀察，等待更好的切入機會。`
}

// ── 推薦理由條列 ──────────────────────────────────────────
function buildReasonBullets(s, dir) {
  const p = []
  if (dir === '做多') {
    if (s.tags?.length > 0 && s.inst > 0) {
      const m = { ai:'AI 主流', semi:'半導體', opt:'光通訊 / CoWoS', heat:'散熱', robot:'機器人 / ASIC' }
      p.push(`${s.tags.map(t => m[t] || t).join('、')} 族群熱度高，法人同步買超`)
    } else if (s.tags?.length > 0) {
      const m = { ai:'AI 主流', semi:'半導體', opt:'光通訊 / CoWoS', heat:'散熱', robot:'機器人 / ASIC' }
      p.push(`屬於 ${s.tags.map(t => m[t] || t).join('、')} 族群，方向有支撐`)
    }
    if (s.amount >= 20e8)      p.push(`成交值爆量 ${(s.amount / 1e8).toFixed(1)} 億，資金高度集中`)
    else if (s.amount >= 10e8) p.push(`成交值 ${(s.amount / 1e8).toFixed(1)} 億，大額資金進場`)
    else if (s.amount >= 3e8)  p.push(`成交值 ${(s.amount / 1e8).toFixed(1)} 億，量能充足`)
    if (s.changePct >= 7)      p.push(`昨日強勢大漲 +${s.changePct.toFixed(1)}%，動能延續機率高`)
    else if (s.changePct >= 4) p.push(`漲幅 +${s.changePct.toFixed(1)}% 在甜蜜區間，追高壓力小`)
    else if (s.changePct >= 2) p.push(`漲幅溫和 +${s.changePct.toFixed(1)}%，低風險切入機會`)
    if (s.inst > 3000)         p.push(`法人大買 ${s.inst.toLocaleString()} 張，非散戶一日行情`)
    else if (s.inst > 0)       p.push(`法人買超 ${s.inst.toLocaleString()} 張`)
  } else if (dir === '做空') {
    p.push(`急跌 ${s.changePct.toFixed(1)}%，技術面明顯偏弱`)
    if (s.amp >= 5) p.push(`振幅 ${s.amp.toFixed(1)}%，波動劇烈，需嚴格控管停損`)
  } else {
    p.push(`漲跌幅 ${s.changePct.toFixed(1)}%，方向尚不明確`)
    p.push('建議觀察後續量價配合後再行動')
  }
  return p.slice(0, 3)
}

// ── 主分析 ────────────────────────────────────────────────
const r2 = n => Math.round(n * 100) / 100
const rN = (n, d = 1) => { const f = Math.pow(10, d); return Math.round(n * f) / f }

export function analyzeStock(s) {
  const { price, changePct, amp, high, low } = s
  let dir = '觀望'
  if (changePct >= 2 && amp >= 3) dir = '做多'
  else if (changePct <= -3 && amp >= 4) dir = '做空'

  if (dir === '觀望') {
    return {
      ...s, direction: dir, action: '僅觀察',
      entry: '—', entryLo: null, entryHi: null,
      stopLoss: '—', tp1: '—', tp2: '—', rValue: '—',
      riskLevel: '低', confidenceScore: 30,
      quickTags: [], bullets: buildReasonBullets(s, '觀望'),
      summary: buildSummary(s, '觀望', '僅觀察'),
      entryReasons: buildEntryReasons(s),
      reason: '',
    }
  }

  let lo, hi
  if (dir === '做多') {
    if (changePct >= 5) { lo = rN(low + (high - low) * 0.15); hi = rN(low + (high - low) * 0.38) }
    else { lo = rN(price * 0.988); hi = rN(price * 1.005) }
  } else { lo = rN(price * 0.995); hi = rN(price * 1.012) }

  const mid  = (lo + hi) / 2
  const sl   = dir === '做多' ? rN(Math.min(lo * 0.97, low * 0.985)) : rN(hi * 1.03)
  const risk = Math.abs(mid - sl)
  const tp1  = dir === '做多' ? rN(mid + risk * 1.5) : rN(mid - risk * 1.5)
  const tp2  = dir === '做多' ? rN(mid + risk * 3.0) : rN(mid - risk * 3.0)
  const rVal = risk > 0 ? r2((tp1 - mid) / risk) : 0

  const over = (price - hi) / hi * 100
  let action
  if (price >= lo && price <= hi)        action = '立即可進場'
  else if (dir === '做多' && price < lo) action = '等待拉回'
  else if (over <= 5)                    action = '等待拉回'
  else                                   action = '不建議追價'

  const compositeScore = calcCompositeScore(s, lo, hi, rVal)
  const quickTags      = buildQuickTags(s, dir, lo, hi, rVal)
  const bullets        = buildReasonBullets(s, dir)
  const summary        = buildSummary(s, dir, action)
  const entryReasons   = buildEntryReasons(s)

  return {
    ...s, direction: dir, action,
    entry: `${lo}–${hi}`, entryLo: lo, entryHi: hi,
    stopLoss: sl, tp1, tp2,
    rValue: `1:${rVal.toFixed(1)}`,
    riskLevel: calcRisk(s, hi),
    confidenceScore: compositeScore,
    quickTags, bullets, summary, entryReasons,
    reason: bullets.join('，') + '。',
  }
}

export function analyzeAll(candidates) {
  return candidates.map(s => analyzeStock(s)).sort((a, b) => b.confidenceScore - a.confidenceScore)
}

export function buildYoyo(all) {
  const pool = all.filter(s => !isJunk(s.code, s.name) && s.price >= 100 && s.high && s.low && s.low > 0)
  const mxA  = Math.max(...pool.map(s => (s.high - s.low) / s.low * 100), 1)
  const mxV  = Math.max(...pool.map(s => s.amount), 1)
  // 計算全市場成交值排名
  const allAmounts = [...pool].sort((a, b) => b.amount - a.amount)
  return pool.map(s => {
    const amp      = (s.high - s.low) / s.low * 100
    const yoyo     = (amp / mxA) * 0.6 + (s.amount / mxV) * 0.4
    const amtRank  = allAmounts.findIndex(x => x.code === s.code) + 1
    return { ...s, amp, yoyo, amtRank }
  }).sort((a, b) => b.yoyo - a.yoyo).slice(0, 5)
}

export function buildSectors(all) {
  const clean = all.filter(s => !isJunk(s.code, s.name))
  return Object.entries(THEME_KW).map(([key, kws]) => {
    const stocks   = clean.filter(s => kws.some(k => s.name.includes(k)))
    const totalAmt = stocks.reduce((sum, s) => sum + (s.amount || 0), 0)
    const avgChg   = stocks.length ? stocks.reduce((sum, s) => sum + s.changePct, 0) / stocks.length : 0
    const top3     = [...stocks].sort((a, b) => b.amount - a.amount).slice(0, 3)
      .map(s => ({ code: s.code, name: s.name, changePct: s.changePct }))
    return { key, count: stocks.length, totalAmt, avgChg, top3 }
  }).sort((a, b) => b.totalAmt - a.totalAmt)
}
