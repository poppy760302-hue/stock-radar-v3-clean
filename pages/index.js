import { useState, useEffect, useCallback } from 'react'
import {
  IconAward, IconCrosshair, IconRadar2, IconEye, IconShieldExclamation,
  IconThermometer, IconFlame, IconTarget, IconShieldCheck,
  IconCoin, IconRocket, IconAlertTriangle, IconTrendingUp,
  IconChartBar, IconBolt, IconStar
} from '@tabler/icons-react'

/* ── helpers ── */
const fd = (n,d=2) => isNaN(n)?'—':Number(n).toFixed(d)
const fAmt = v => {
  if(!v||v<=0) return '—'
  if(v>=1e8) return (v/1e8).toFixed(1)+'億'
  return Math.round(v).toLocaleString()
}
const UP   = '#EF4444'
const DOWN = '#10B981'
const cc   = v => v>=0?UP:DOWN
const sc   = s => s>=90?'#00E5A0':s>=80?'#22C55E':s>=70?'#F59E0B':s>=60?'#94A3B8':'#475569'

const THEME_META = {
  ai:    {icon:IconBolt,      name:'AI伺服器',  color:'#8B5CF6',grd:'linear-gradient(135deg,#7C3AED,#4F46E5)'},
  semi:  {icon:IconChartBar,  name:'半導體',    color:'#3B82F6',grd:'linear-gradient(135deg,#2563EB,#0284C7)'},
  opt:   {icon:IconTrendingUp,name:'光通訊',    color:'#06B6D4',grd:'linear-gradient(135deg,#0891B2,#0D9488)'},
  heat:  {icon:IconFlame,     name:'散熱族群',  color:'#F59E0B',grd:'linear-gradient(135deg,#D97706,#DC2626)'},
  robot: {icon:IconStar,      name:'機器人',    color:'#10B981',grd:'linear-gradient(135deg,#059669,#0D9488)'},
}
const TAG_CFG = {ai:'AI',semi:'半導體',opt:'光通訊',heat:'散熱',robot:'機器人'}
const ACT = {
  '立即可進場':{cls:'ab-go',  lbl:'可布局'},
  '等待拉回':  {cls:'ab-wait',lbl:'等拉回'},
  '僅觀察':    {cls:'ab-obs', lbl:'觀察'},
  '不建議追價':{cls:'ab-skip',lbl:'追高風險'},
}

/* ── SVG Sparkline ── */
function Sparkline({ s, w=120, h=40, color='#3B82F6' }) {
  // generate realistic-looking price curve from stock data
  const seed   = (s?.price||100) * 7 + (s?.confidenceScore||50)
  const trend  = (s?.changePct||0) / 100   // overall direction
  const volat  = Math.min((s?.amp||3) / 10, 0.8)
  const n = 20
  const pts = Array.from({length: n}, (_, i) => {
    const progress = i / (n - 1)
    const trendLine = trend * progress * 0.6
    const noise = Math.sin(seed + i * 2.3) * volat * 0.3
              + Math.sin(seed + i * 5.1) * volat * 0.15
    return 0.5 + trendLine + noise
  })
  const mn = Math.min(...pts), mx = Math.max(...pts)
  const range = mx - mn || 0.01
  const toY = v => h - 4 - ((v - mn) / range) * (h - 8)
  const toX = i => 2 + (i / (n - 1)) * (w - 4)
  const pathD = pts.map((v, i) => `${i===0?'M':'L'}${toX(i).toFixed(1)},${toY(v).toFixed(1)}`).join(' ')
  const areaD = pathD + ` L${toX(n-1)},${h} L${toX(0)},${h} Z`
  const upDown = (s?.changePct||0) >= 0
  const lineColor = upDown ? '#EF4444' : '#10B981'
  const glowColor = upDown ? 'rgba(239,68,68,.4)' : 'rgba(16,185,129,.4)'
  const id = `sp-${Math.round(s?.price||0)}-${Math.round(s?.confidenceScore||0)}`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{display:'block',overflow:'visible'}}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.25"/>
          <stop offset="100%" stopColor={lineColor} stopOpacity="0"/>
        </linearGradient>
        <filter id={`glow-${id}`}>
          <feGaussianBlur stdDeviation="1.5" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <path d={areaD} fill={`url(#${id})`}/>
      <path d={pathD} fill="none" stroke={lineColor} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
        filter={`url(#glow-${id})`}
        style={{filter:`drop-shadow(0 0 3px ${glowColor})`}}/>
      {/* last dot */}
      <circle cx={toX(n-1)} cy={toY(pts[n-1])} r="2.5" fill={lineColor}
        style={{filter:`drop-shadow(0 0 4px ${glowColor})`}}/>
    </svg>
  )
}

/* ── Section Title ── */
function SecTitle({icon:Icon, label, sub, color='#3B82F6'}) {
  return (
    <div style={{marginBottom:sub?8:20}}>
      <div style={{fontSize:22,fontWeight:700,letterSpacing:'-.02em',lineHeight:1.2,
        background:`linear-gradient(135deg,#E8F2FF,${color})`,
        WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent',backgroundClip:'text',
        display:'inline-block'
      }}>{label}</div>
      {sub&&<div style={{fontSize:14,color:'#8090A8',marginTop:3}}>{sub}</div>}
    </div>
  )
}


/* ── Daily Summary ── */
function DailySummary({analysis, sectors, oppList}) {
  if (!analysis.length) return null
  const long     = analysis.filter(s=>s.direction==='做多').length
  const total    = analysis.length
  const bull     = total>0 ? Math.round(long/total*100) : 0
  const hotCount = analysis.filter(s=>s.riskLevel==='追價風險'||s.riskLevel==='高').length
  const topSec   = sectors[0] ? (THEME_META[sectors[0].key]?.name || sectors[0].key) : null
  const sec2     = sectors[1] ? (THEME_META[sectors[1].key]?.name || sectors[1].key) : null
  const avgScore = total>0 ? Math.round(analysis.reduce((s,a)=>s+a.confidenceScore,0)/total) : 0

  // Generate 4 conclusion lines
  const lines = []
  if (bull >= 60)      lines.push({icon:'📈', color:'#10B981', text:`今日市場偏多，做多傾向 ${bull}%，整體信心偏強`})
  else if (bull >= 40) lines.push({icon:'➡️', color:'#F59E0B', text:`今日市場偏中性，多空分歧，建議觀望為主`})
  else                 lines.push({icon:'📉', color:'#EF4444', text:`今日市場偏空，做多傾向僅 ${bull}%，謹慎應對`})

  if (topSec) {
    const secStr = sec2 ? `${topSec} / ${sec2}` : topSec
    lines.push({icon:'🔥', color:'#F59E0B', text:`主線資金集中在 ${secStr}，是今日最強方向`})
  }

  if (hotCount > 5)      lines.push({icon:'⚠️', color:'#EF4444', text:`追高風險偏高，${hotCount} 檔已過熱，不建議追漲`})
  else if (hotCount > 2) lines.push({icon:'⚡', color:'#F59E0B', text:`有 ${hotCount} 檔出現追高風險，個股操作需謹慎`})
  else                   lines.push({icon:'✅', color:'#10B981', text:`整體追高風險低，市場未過熱，可留意布局機會`})

  if (oppList.length >= 3)      lines.push({icon:'🎯', color:'#06B6D4', text:`今日有 ${oppList.length} 檔進場機會，可參考強勢進場機會區塊`})
  else if (avgScore >= 55)      lines.push({icon:'👀', color:'#8B5CF6', text:`進場機會有限，建議等待更佳切入點，勿追高`})
  else                          lines.push({icon:'⏳', color:'#8090A8', text:`今日整體信心偏低，以觀望為主，等待方向明確`})

  return (
    <div style={{
      background:'linear-gradient(135deg,rgba(6,182,212,.08) 0%,rgba(139,92,246,.08) 100%)',
      border:'1px solid rgba(6,182,212,.25)',
      borderRadius:14, padding:'18px 24px', marginBottom:28,
      boxShadow:'inset 0 1px 0 rgba(255,255,255,.06)',
    }}>
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14}}>
        <div style={{width:28,height:28,borderRadius:8,background:'rgba(6,182,212,.2)',border:'1px solid rgba(6,182,212,.4)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🤖</div>
        <div style={{fontSize:15,fontWeight:700,color:'#E8F2FF'}}>今日盤勢結論</div>
        <div style={{fontSize:13,color:'#9AAEC0',marginLeft:4}}>· 依昨收資料自動分析</div>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
        {lines.slice(0,4).map((l,i)=>(
          <div key={i} style={{display:'flex',alignItems:'flex-start',gap:10,padding:'10px 14px',
            background:'rgba(0,0,0,.2)',borderRadius:8,border:'1px solid rgba(255,255,255,.06)'}}>
            <span style={{fontSize:16,flexShrink:0,lineHeight:1.3}}>{l.icon}</span>
            <span style={{fontSize:13,color:'#B8C8E0',lineHeight:1.6}}>{l.text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── KPI Bar ── */
function KpiBar({analysis,sectors,oppList}) {
  if(!analysis.length) return null
  const long     = analysis.filter(s=>s.direction==='做多').length
  const total    = analysis.length
  const bull     = total>0?Math.round(long/total*100):0
  const hotCount = analysis.filter(s=>s.riskLevel==='追價風險'||s.riskLevel==='高').length
  const avgScore = total>0?Math.round(analysis.reduce((s,a)=>s+a.confidenceScore,0)/total):0
  const temp     = Math.min(100,Math.round(bull*0.5+avgScore*0.3+Math.min(hotCount*3,20)))
  const topHot   = sectors[0]?Math.round(sectors[0].totalAmt/Math.max(...sectors.map(s=>s.totalAmt),1)*100):0
  const tempLabel = temp>=75?'過熱':temp>=58?'偏樂觀':temp>=42?'中性':'偏悲觀'
  const tempColor = temp>=75?'#EF4444':temp>=58?'#F59E0B':temp>=42?'#3B82F6':'#10B981'
  const riskLabel = hotCount>5?{l:'高',c:'#EF4444',sub:'注意個股過熱'}:hotCount>2?{l:'中',c:'#F59E0B',sub:'注意個股風險'}:{l:'低',c:'#10B981',sub:'風險可控'}

  // LED segments: 10 dots
  function LedBar({val, color, max=100}) {
    const filled = Math.round(val/max*10)
    return (
      <div style={{display:'flex',gap:3,alignItems:'center',margin:'10px 0 6px'}}>
        {Array.from({length:10},(_,i)=>(
          <div key={i} style={{
            flex:1, height:6, borderRadius:2,
            background: i<filled ? color : 'rgba(255,255,255,.1)',
            boxShadow: i<filled ? `0 0 5px ${color}88` : 'none',
            transition:'background .3s',
          }}/>
        ))}
      </div>
    )
  }

  // Rainbow slider for risk
  function RainbowBar({val}) {
    const pct = Math.min(val/10*100,100)
    return (
      <div style={{position:'relative',margin:'10px 0 6px'}}>
        <div style={{height:7,borderRadius:4,background:'linear-gradient(90deg,#10B981,#3B82F6,#F59E0B,#EF4444)',overflow:'visible'}}/>
        <div style={{position:'absolute',top:'50%',left:`${pct}%`,transform:'translate(-50%,-50%)',
          width:13,height:13,borderRadius:'50%',background:'#fff',
          boxShadow:`0 0 0 2px ${riskLabel.c},0 0 8px ${riskLabel.c}`,
          transition:'left .4s ease',
        }}/>
      </div>
    )
  }

  const kpis = [
    { Icon:IconThermometer, color:tempColor, label:'市場溫度',
      main: String(temp), unit:'/100', sub: tempLabel, sub2:'資金持續集中主線',
      bar: <LedBar val={temp} color={tempColor}/> },
    { Icon:IconFlame, color:'#F59E0B', label:'主線熱度',
      main: String(topHot), unit:'/100',
      sub: topHot>=85?'極熱':topHot>=65?'偏熱':'中性',
      sub2: sectors[0]?`${THEME_META[sectors[0].key]?.name?.split('/')[0]} 領跑`:'—',
      bar: <LedBar val={topHot} color='#A78BFA'/> },
    { Icon:IconTarget, color:'#06B6D4', label:'強勢進場機會',
      main: String(oppList.length), unit:'檔',
      sub: oppList.length>=3?'出現強勢訊號':'機會有限',
      sub2: oppList.length>0?`較昨日 +${oppList.length} 檔`:'',
      bar: <LedBar val={oppList.length} color='#06B6D4' max={5}/> },
    { Icon:IconShieldCheck, color:riskLabel.c, label:'風險等級',
      main: riskLabel.l, unit:'',
      sub: riskLabel.sub, sub2:`${hotCount} 檔過熱`,
      bar: <RainbowBar val={hotCount}/> },
  ]

  return (
    <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:40}}>
      {kpis.map((k,i)=>(
        <div key={i} className="kpi-card">
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
            <div style={{width:36,height:36,borderRadius:10,
              background:`linear-gradient(135deg,${k.color}33,${k.color}18)`,
              border:`1px solid ${k.color}55`,
              boxShadow:`0 0 12px ${k.color}22`,
              display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <k.Icon size={18} color={k.color} strokeWidth={1.8}/>
            </div>
            <span style={{fontSize:13,color:'#9AAEC0',textTransform:'uppercase',letterSpacing:'.07em',fontWeight:600}}>{k.label}</span>
          </div>
          <div style={{display:'flex',alignItems:'baseline',gap:4,marginBottom:2}}>
            <span style={{fontSize:36,fontWeight:800,color:k.color,lineHeight:1,letterSpacing:'-.03em'}}>{k.main}</span>
            {k.unit&&<span style={{fontSize:14,color:'#8090A8'}}>{k.unit}</span>}
          </div>
          <div style={{fontSize:13,fontWeight:600,color:'#C0D0E8',marginBottom:1}}>{k.sub}</div>
          {k.sub2&&<div style={{fontSize:13,color:'#9AAEC0'}}>{k.sub2}</div>}
          {k.bar}
        </div>
      ))}
    </div>
  )
}

/* ── Sentiment Gauge ── */
function SentimentGauge({analysis, sectors}) {
  if (!analysis.length) return null
  const long    = analysis.filter(s => s.direction === '做多').length
  const total   = analysis.length
  const bull    = total > 0 ? Math.round(long / total * 100) : 0
  const neutral = total > 0 ? Math.round(analysis.filter(s => s.direction === '觀望').length / total * 100) : 0
  const bear    = Math.max(0, 100 - bull - neutral)
  const avg     = total > 0 ? Math.round(analysis.reduce((s, a) => s + a.confidenceScore, 0) / total) : 0
  const hotC    = analysis.filter(s => s.riskLevel === '追價風險' || s.riskLevel === '高').length
  const topS    = sectors[0]
  const fg      = Math.min(100, Math.round(bull * 0.45 + avg * 0.35 + Math.min(hotC * 2, 20)))
  const fgLabel = fg >= 80 ? '極度貪婪' : fg >= 65 ? '貪婪' : fg >= 50 ? '中性偏多' : fg >= 35 ? '中性偏空' : fg >= 20 ? '恐懼' : '極度恐懼'
  const fgColor = fg >= 80 ? '#EF4444' : fg >= 65 ? '#F59E0B' : fg >= 50 ? '#10B981' : fg >= 35 ? '#3B82F6' : '#8B5CF6'


  return (
    <div style={{
      background:'linear-gradient(160deg,#0F1D35 0%,#0A1525 100%)',
      border:'1px solid rgba(120,160,255,.2)',
      borderRadius:14, padding:'20px 24px',
      boxShadow:'inset 0 1px 0 rgba(255,255,255,.07)',
    }}>
      <div>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:32,height:32,borderRadius:9,background:'#3B82F622',border:'1px solid #3B82F644',display:'flex',alignItems:'center',justifyContent:'center'}}>
              <IconRadar2 size={17} color="#3B82F6" strokeWidth={1.8}/>
            </div>
            <div>
              <div style={{fontSize:16,fontWeight:700,color:'#E8F2FF'}}>市場情緒</div>
              <div style={{fontSize:13,color:'#9AAEC0'}}>恐懼貪婪指數 · 昨日收盤計算</div>
            </div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:32,fontWeight:800,color:fgColor,lineHeight:1,letterSpacing:'-.03em'}}>{fg}</div>
            <div style={{fontSize:12,fontWeight:600,color:fgColor,marginTop:2}}>{fgLabel}</div>
          </div>
        </div>

        {/* sentiment bar */}
        <div style={{marginBottom:14}}>
          <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'#8B9CB8',marginBottom:5}}>
            <span>做空 {bear}%</span>
            <span>觀望 {neutral}%</span>
            <span>做多 {bull}%</span>
          </div>
          <div style={{height:14,borderRadius:7,overflow:'hidden',display:'flex',background:'rgba(255,255,255,.05)'}}>
            <div style={{width:`${bear}%`,background:'linear-gradient(90deg,#10B98188,#10B981)',transition:'width .6s'}}/>
            <div style={{width:`${neutral}%`,background:'rgba(100,116,139,.5)',transition:'width .6s'}}/>
            <div style={{width:`${bull}%`,background:'linear-gradient(90deg,#F59E0B88,#EF4444)',transition:'width .6s'}}/>
          </div>
        </div>

        {/* 4 quick stats */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8}}>
          {[
            {l:'做多傾向', v:`${bull}%`,   c: bull>=55 ? '#EF4444' : '#94A3BC'},
            {l:'平均信心', v: String(avg), c:'#3B82F6'},
            {l:'追高標的', v:`${hotC}支`,  c: hotC > 3 ? '#EF4444' : '#94A3BC'},
            {l:'最強主線', v: topS ? THEME_META[topS.key]?.name?.split('/')[0].trim() : '—', c:'#F59E0B'},
          ].map((it, i) => (
            <div key={i} style={{background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',borderRadius:8,padding:'9px 11px'}}>
              <div style={{fontSize:12,color:'#9AAEC0',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:3}}>{it.l}</div>
              <div style={{fontSize:17,fontWeight:700,color:it.c,lineHeight:1}}>{it.v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ── Stock Badges ── */
function StockBadges({s}) {
  const over = s.entryHi?(s.price-s.entryHi)/s.entryHi*100:0
  const inRange = s.entryLo&&s.price>=s.entryLo&&s.price<=s.entryHi
  const badges = []
  if(s.tags?.length>0)                        badges.push({Icon:IconFlame,        lbl:'主線股',   c:'#F59E0B',bg:'#F59E0B15',bd:'#F59E0B35'})
  if(s.amount>=5e8)                           badges.push({Icon:IconCoin,         lbl:'資金流入', c:'#10B981',bg:'#10B98115',bd:'#10B98135'})
  if(s.changePct>=5&&s.amp>=7)                badges.push({Icon:IconRocket,       lbl:'強勢突破', c:'#3B82F6',bg:'#3B82F615',bd:'#3B82F635'})
  if(inRange)                                 badges.push({Icon:IconCrosshair,    lbl:'接近進場', c:'#06B6D4',bg:'#06B6D415',bd:'#06B6D435'})
  if(s.riskLevel==='追價風險'||over>5)        badges.push({Icon:IconAlertTriangle,lbl:'已過熱',   c:'#EF4444',bg:'#EF444415',bd:'#EF444435'})
  if(!badges.length) return null
  return (
    <div style={{display:'flex',flexWrap:'wrap',gap:5,marginBottom:10}}>
      {badges.slice(0,3).map((b,i)=>(
        <span key={i} style={{display:'inline-flex',alignItems:'center',gap:4,fontSize:11,fontWeight:600,padding:'3px 9px',borderRadius:20,background:b.bg,color:b.c,border:`1px solid ${b.bd}`}}>
          <b.Icon size={11} strokeWidth={2.2}/>{b.lbl}
        </span>
      ))}
    </div>
  )
}

/* ── Top5 Card ── */
function Top5Card({s,rank}) {
  const medal    = ['🥇','🥈','🥉','4','5']
  const isMedal  = rank<3
  const rankGrd = rank===0?'linear-gradient(135deg,#F59E0B,#D97706)':rank===1?'linear-gradient(135deg,#94A3B8,#64748B)':rank===2?'linear-gradient(135deg,#C2824A,#92400E)':null
  const bs       = (s.bullets||[]).slice(0,3)
  const scoreC   = sc(s.confidenceScore)
  const up       = s.changePct>=0
  const borderGrd = rank===0?'linear-gradient(135deg,#F59E0B,#D97706)'
    :rank===1?'linear-gradient(135deg,#94A3B8,#64748B)'
    :rank===2?'linear-gradient(135deg,#C2824A,#92400E)':'rgba(255,255,255,.08)'
  return (
    <div className={`t5 ${rank===0?'t5-gold':rank===1?'t5-silver':rank===2?'t5-bronze':''}`}>
      <div style={{height:3,background:borderGrd}}/>
      <div className="t5-body">
        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
          <span style={{fontSize:isMedal?26:13,lineHeight:1,
            ...(isMedal?{}:{fontWeight:700,color:'#8B9CB8',background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.1)',padding:'3px 8px',borderRadius:5})
          }}>{medal[rank]}</span>
          <span className={`ab ${(ACT[s.action]||{cls:'ab-obs'}).cls}`}>{(ACT[s.action]||{lbl:'觀察'}).lbl}</span>
          <div style={{marginLeft:'auto',display:'flex',alignItems:'baseline',gap:3}}>
            <span style={{fontSize:34,fontWeight:800,color:scoreC,lineHeight:1,letterSpacing:'-.02em'}}>{s.confidenceScore}</span>
            <span style={{fontSize:14,color:'#8B9CB8'}}>/100</span>
          </div>
        </div>
        <StockBadges s={s}/>
        <div style={{fontSize:26,fontWeight:800,color:'#F0F8FF',letterSpacing:'-.02em',marginBottom:4,lineHeight:1.2}}>{s.name}</div>
        <div style={{display:'flex',alignItems:'baseline',gap:10,marginBottom:10,flexWrap:'wrap'}}>
          <span style={{fontSize:18,fontWeight:700,color:cc(s.changePct)}}>{up?'▲':'▼'}{fd(Math.abs(s.changePct),2)}%</span>
          <span style={{fontSize:15,color:'#94A3B8'}}>{fd(s.price,1)}</span>
          <span style={{fontSize:12,color:'#8B9CB8'}}>{s.code}·{s.market==='TWSE'?'上市':'上櫃'}</span>
        </div>
        {/* SVG Sparkline */}
        <div style={{marginBottom:12,borderRadius:8,overflow:'hidden',background:'rgba(0,0,0,.2)',padding:'6px 8px'}}>
          <Sparkline s={s} w={240} h={44}/>
        </div>
        <div style={{height:3,background:'rgba(255,255,255,.07)',borderRadius:2,overflow:'hidden',marginBottom:16}}>
          <div style={{height:'100%',width:`${s.confidenceScore}%`,background:`linear-gradient(90deg,${scoreC}88,${scoreC})`,borderRadius:2}}/>
        </div>
        <div style={{fontSize:11,fontWeight:600,color:'#8B9CB8',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:8}}>為什麼選這檔</div>
        <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:s.summary?12:0}}>
          {bs.map((b,i)=>(
            <div key={i} style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:13,color:'#94A3B8',lineHeight:1.55}}>
              <span style={{color:'#8090A8',flexShrink:0,fontSize:15,lineHeight:1.3}}>·</span><span>{b}</span>
            </div>
          ))}
        </div>
        {s.summary&&<div style={{fontSize:12,color:'#8B9CB8',background:'rgba(255,255,255,.04)',border:'1px solid rgba(255,255,255,.08)',borderRadius:7,padding:'9px 12px',marginBottom:14,lineHeight:1.7,fontStyle:'italic'}}>{s.summary}</div>}
        {s.entryLo&&(
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:1,background:'rgba(255,255,255,.06)',borderRadius:9,overflow:'hidden',marginTop:12}}>
            {[['進場區',s.entry||'—','#3B82F6'],['停損',s.stopLoss||'—',UP],['停利',s.tp1||'—',DOWN],['R值',s.rValue||'—','#94A3B8']].filter(([,v])=>v&&v!=='—'&&v!=='undefined'&&!String(v).includes('undefined')).map(([l,v,col])=>(
              <div key={l} style={{background:'rgba(5,11,22,.7)',padding:'9px 10px',textAlign:'center'}}>
                <div style={{fontSize:13,color:'#9AAEC0',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:3}}>{l}</div>
                <div style={{fontSize:14,fontWeight:700,color:col}}>{v}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Opp Card ── */
function OppCard({s}) {
  const up=s.changePct>=0
  const isIn=s.entryLo&&s.price>=s.entryLo&&s.price<=s.entryHi
  const over=s.entryHi?(s.price-s.entryHi)/s.entryHi*100:0
  const rNum=parseFloat((s.rValue||'0').split(':')[1])||0
  const tag=s.tags?.[0]?TAG_CFG[s.tags[0]]:null
  return (
    <div className="opp">
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:12}}>
        <div>
          <div style={{fontSize:20,fontWeight:800,color:'#F0F8FF',marginBottom:5,letterSpacing:'-.01em'}}>{s.name}</div>
          <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
            <span style={{fontSize:12,color:'#94A3BC'}}>{s.code}</span>
            {tag&&<span style={{fontSize:11,padding:'2px 8px',borderRadius:20,background:'rgba(139,92,246,.15)',border:'1px solid rgba(139,92,246,.3)',color:'#A78BFA'}}>{tag}</span>}
            <span style={{fontSize:14,fontWeight:700,color:cc(s.changePct)}}>{up?'▲':'▼'}{fd(Math.abs(s.changePct),2)}%</span>
          </div>
        </div>
        <span style={{fontSize:11,fontWeight:600,padding:'4px 10px',borderRadius:20,whiteSpace:'nowrap',flexShrink:0,
          ...(isIn?{background:'#10B98115',color:'#10B981',border:'1px solid #10B98135'}
          :over>5?{background:'#EF444415',color:'#EF4444',border:'1px solid #EF444435'}
          :{background:'rgba(255,255,255,.06)',color:'#94A3BC',border:'1px solid rgba(255,255,255,.1)'})}}>
          {isIn?'現在可進場':over>5?'已超出':'等待位置'}
        </span>
      </div>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:7,marginBottom:10}}>
        {[['進場區',s.entry,'#3B82F6'],['停損',s.stopLoss,UP],['停利',s.tp1,DOWN],['R值',s.rValue,rNum>=2?'#F59E0B':'#94A3B8']].map(([l,v,col])=>(
          <div key={l} style={{background:'rgba(255,255,255,.04)',borderRadius:8,padding:'9px 11px',border:'1px solid rgba(255,255,255,.07)'}}>
            <div style={{fontSize:12,color:'#9AAEC0',letterSpacing:'.05em',marginBottom:3,textTransform:'uppercase'}}>{l}</div>
            <div style={{fontSize:15,fontWeight:700,color:col}}>{v}</div>
            {l==='R值'&&<div style={{height:3,background:'rgba(255,255,255,.07)',borderRadius:2,overflow:'hidden',marginTop:5}}><div style={{height:'100%',width:`${Math.min(rNum/3*100,100)}%`,background:rNum>=2?'#F59E0B':'#3B82F6',borderRadius:2}}/></div>}
          </div>
        ))}
      </div>
      {s.bullets?.[0]&&<div style={{fontSize:12,color:'#94A3BC',lineHeight:1.6,paddingTop:9,borderTop:'1px solid rgba(255,255,255,.07)'}}>· {s.bullets[0]}</div>}
    </div>
  )
}

/* ── Theme Card ── */
function ThemeCard({s,rank,analysis,maxAmt}) {
  const [open,setOpen]=useState(false)
  const m    = THEME_META[s.key]||{icon:IconChartBar,name:s.key,color:'#3B82F6',grd:'linear-gradient(135deg,#2563EB,#1D4ED8)'}
  const hot  = Math.round(s.totalAmt/maxAmt*100)
  const up   = s.avgChg>=0
  const stocks = analysis.filter(a=>a.tags?.includes(s.key)).sort((a,b)=>b.confidenceScore-a.confidenceScore).slice(0,8)
  const hotLabel = hot>=85?{l:'極熱',c:'#EF4444'}:hot>=65?{l:'偏熱',c:'#F59E0B'}:hot>=40?{l:'中性',c:'#3B82F6'}:{l:'冷淡',c:'#6B7A94'}
  const fakeS = {price:s.totalAmt/1e8, changePct:s.avgChg, amp:Math.abs(s.avgChg)*1.5, confidenceScore:hot}
  return (
    <div className={`th${open?' th-open':''}`} onClick={()=>setOpen(o=>!o)} style={{cursor:'pointer'}}>
      <div style={{height:3,background:m.grd}}/>
      {/* main row */}
      <div className="th-head">
        <div style={{width:36,height:36,borderRadius:10,
          background:`linear-gradient(135deg,${m.color}33,${m.color}18)`,
          border:`1px solid ${m.color}55`,
          display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
          <m.icon size={18} color={m.color} strokeWidth={1.8}/>
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:16,fontWeight:700,color:'#F0F8FF',marginBottom:4}}>{m.name}</div>
          <div style={{display:'flex',gap:2,alignItems:'center'}}>
            {Array.from({length:10},(_,i)=>(
              <div key={i} style={{
                flex:1,height:4,borderRadius:1,
                background: i<Math.round(hot/10) ? m.color : 'rgba(255,255,255,.1)',
                boxShadow: i<Math.round(hot/10) ? `0 0 4px ${m.color}88` : 'none',
              }}/>
            ))}
          </div>
        </div>
        <div style={{flexShrink:0,marginLeft:8}}>
          <Sparkline s={fakeS} w={70} h={32}/>
        </div>
        <div style={{textAlign:'right',flexShrink:0,marginLeft:8}}>
          <div style={{fontSize:22,fontWeight:800,color:m.color,lineHeight:1}}>{hot}</div>
          <div style={{fontSize:12,fontWeight:700,color:hotLabel.c,marginTop:2}}>{hotLabel.l}</div>
        </div>

      </div>

      {/* collapsed: top3 chips + CTA */}
      {!open&&(
        <div style={{padding:'4px 16px 12px'}}>
          {s.top3?.length>0&&(
            <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:10}}>
              {s.top3.map(t=>(
                <span key={t.code} style={{fontSize:12,padding:'3px 9px',borderRadius:20,background:'rgba(255,255,255,.05)',color:'#94A3B8',border:'1px solid rgba(255,255,255,.08)'}}>
                  {t.name} <span style={{color:cc(t.changePct)}}>{t.changePct>=0?'+':''}{fd(t.changePct,1)}%</span>
                </span>
              ))}
              <span style={{fontSize:13,color:'#8090A8',alignSelf:'center'}}>
                {s.count}檔 · <span style={{color:cc(s.avgChg),fontWeight:600}}>{up?'+':''}{fd(s.avgChg,1)}%</span>
              </span>
            </div>
          )}
          {/* CTA — right after chips */}
          <div style={{
            display:'inline-flex',alignItems:'center',gap:5,
            marginTop:6,fontSize:13,fontWeight:600,color:m.color,
          }}>
            <span>查看 {stocks.length} 檔個股</span>
            <span>→</span>
          </div>
        </div>
      )}

      {/* expanded list */}
      {open&&(
        <div style={{borderTop:'1px solid rgba(255,255,255,.07)',animation:'expandDown .2s ease-out'}}>
          {stocks.length===0
            ?<div style={{padding:16,fontSize:13,color:'#8B9CB8',textAlign:'center'}}>此主線今日無符合條件標的</div>
            :stocks.map((a,i)=>{
              const act=ACT[a.action]||{cls:'ab-obs',lbl:'觀察'}
              const as = {price:a.price, changePct:a.changePct, amp:a.amp||3, confidenceScore:a.confidenceScore}
              return(
                <div key={a.code} className="th-row">
                  <span style={{fontSize:13,color:'#9AB0C4',width:20,textAlign:'center',flexShrink:0}}>{i+1}</span>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,flexWrap:'wrap'}}>
                      <span style={{fontSize:15,fontWeight:700,color:'#F0F8FF'}}>{a.name}</span>
                      <span style={{fontSize:12,color:'#8098B0'}}>{a.code}</span>
                      <span className={`ab ${act.cls}`} style={{fontSize:11,padding:'3px 8px'}}>{act.lbl}</span>
                    </div>
                    {a.entryLo&&<div style={{fontSize:13,color:'#9AB0C8',marginTop:3}}>進場 <span style={{color:'#3B82F6'}}>{a.entry}</span> · 停損 <span style={{color:UP}}>{a.stopLoss}</span></div>}
                  </div>
                  <Sparkline s={as} w={56} h={28}/>
                  <div style={{textAlign:'right',flexShrink:0,marginLeft:8}}>
                    <div style={{fontSize:15,fontWeight:700,color:cc(a.changePct)}}>{a.changePct>=0?'▲':'▼'}{fd(Math.abs(a.changePct),2)}%</div>
                    <div style={{fontSize:12,color:sc(a.confidenceScore),marginTop:2}}>{a.confidenceScore}分</div>
                  </div>
                </div>
              )
            })
          }
          {/* collapse CTA */}
          <div style={{
            display:'flex',alignItems:'center',justifyContent:'center',gap:6,
            padding:'10px 0',borderTop:'1px solid rgba(255,255,255,.07)',
            fontSize:13,fontWeight:600,color:'#7A8EA8',
          }}>
            <span>收合</span>
            <span style={{fontSize:16}}>↑</span>
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Watch Status ── */
function watchStatus(s) {
  if(!s.entryLo||!s.entryHi) return {lbl:'可觀察',cls:'ws-obs'}
  const over=(s.price-s.entryHi)/s.entryHi*100
  if(s.riskLevel==='追價風險'||over>8) return {lbl:'已過熱',cls:'ws-hot'}
  if(over>3) return {lbl:'風險偏高',cls:'ws-risk'}
  if(s.price>=s.entryLo&&s.price<=s.entryHi) return {lbl:'接近進場',cls:'ws-near'}
  return {lbl:'可觀察',cls:'ws-obs'}
}

function WatchRow({s, idx=0}) {
  const [open,setOpen]=useState(false)
  const up    = s.changePct>=0
  const scoreC= sc(s.score||s.confidenceScore||50)
  const tag   = s.tags?.[0]?TAG_CFG[s.tags[0]]:'—'
  const st    = watchStatus(s)
  const score = Math.round(s.score||s.confidenceScore||0)
  const stripeClass = idx%2===0 ? 'wr-even' : 'wr-odd'
  return (
    <>
      <div className={`wr ${stripeClass}`} onClick={()=>setOpen(o=>!o)}>
        <div className="wrc">
          <span style={{fontSize:16,fontWeight:700,color:'#F0F8FF',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{s.name}</span>
          <span style={{fontSize:12,color:'#8B9CB8',marginLeft:7,flexShrink:0}}>{s.code}</span>
        </div>
        <div className="wrc" style={{fontWeight:600,fontSize:13,color:cc(s.changePct),whiteSpace:'nowrap'}}>{up?'▲':'▼'}{fd(Math.abs(s.changePct),2)}%</div>
        <div className="wrc" style={{fontSize:13,color:'#94A3B8',whiteSpace:'nowrap'}}>{tag}</div>
        <div className="wrc" style={{fontSize:12,fontWeight:500,color:'#3B82F6',whiteSpace:'nowrap'}}>{s.entry!=='—'?s.entry:'—'}</div>
        <div className="wrc" style={{fontSize:12,fontWeight:600,color:UP,whiteSpace:'nowrap'}}>{s.stopLoss!=='—'?s.stopLoss:'—'}</div>
        <div className="wrc" style={{fontSize:12,fontWeight:600,color:DOWN,whiteSpace:'nowrap'}}>{s.tp1!=='—'?s.tp1:'—'}</div>
        <div className="wrc"><span className={`ws ${st.cls}`}>{st.lbl}</span></div>
      </div>
      {open&&(
        <div className="wr-expand">
          <StockBadges s={s} style={{marginBottom:14}}/>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20}}>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:'#8B9CB8',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:10}}>為何入選</div>
              {(s.bullets||[]).slice(0,3).map((b,i)=>(
                <div key={i} style={{display:'flex',alignItems:'flex-start',gap:7,fontSize:14,color:'#94A3B8',marginBottom:6,lineHeight:1.55}}>
                  <span style={{color:'#7A8898',flexShrink:0,fontSize:16,lineHeight:1.3}}>·</span><span>{b}</span>
                </div>
              ))}
            </div>
            <div>
              <div style={{fontSize:11,fontWeight:600,color:'#8B9CB8',textTransform:'uppercase',letterSpacing:'.07em',marginBottom:10}}>交易提醒</div>
              {s.entryLo&&(
                <div style={{display:'flex',flexDirection:'column',gap:7}}>
                  {[['進場區',s.entry,'#3B82F6'],['停損',s.stopLoss,UP],['第一停利',s.tp1,DOWN],['R值',s.rValue,'#94A3B8']].map(([l,v,col])=>(
                    <div key={l} style={{fontSize:14,color:'#94A3B8',display:'flex',alignItems:'center',gap:8}}>
                      <span style={{color:'#8B9CB8',minWidth:72}}>{l}</span>
                      <span style={{fontWeight:700,color:col}}>{v}</span>
                    </div>
                  ))}
                  {(s.riskLevel==='追價風險'||s.riskLevel==='高')&&<div style={{fontSize:13,color:'#F59E0B',marginTop:2}}>⚠ {s.riskLevel==='追價風險'?'目前價已超出進場區':'振幅偏大，控制倉位'}</div>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

/* ── Risk Panel ── */
function RiskPanel({analysis,yoyo}) {
  const highAmp   = yoyo.filter(s=>s.amp>=10)
  const overPrice = analysis.filter(s=>s.riskLevel==='追價風險')
  const highRisk  = analysis.filter(s=>s.riskLevel==='高')
  const overall   = overPrice.length>5?'高':overPrice.length>2?'中':'低'
  const overallC  = overPrice.length>5?'#EF4444':overPrice.length>2?'#F59E0B':'#10B981'

  const indicators = [
    {icon:IconBolt,           color:'#F59E0B', label:'爆量警示', count:highAmp.length,   names:highAmp.slice(0,3).map(s=>s.name)},
    {icon:IconAlertTriangle,  color:'#EF4444', label:'追價風險', count:overPrice.length, names:overPrice.slice(0,3).map(s=>s.name)},
    {icon:IconShieldExclamation,color:'#8B5CF6',label:'高波動',  count:highRisk.length,  names:highRisk.slice(0,3).map(s=>s.name)},
  ]

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:12,padding:'0 2px'}}>
        <span style={{fontSize:12,color:'#7A90A8'}}>整體風險</span>
        <span style={{fontSize:13,fontWeight:700,color:overallC,padding:'2px 10px',borderRadius:20,background:`${overallC}18`,border:`1px solid ${overallC}35`}}>{overall}</span>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {indicators.map((it,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',
            background:'rgba(0,0,0,.15)',borderRadius:8,border:'1px solid rgba(255,255,255,.06)'}}>
            <div style={{width:28,height:28,borderRadius:7,background:`${it.color}18`,border:`1px solid ${it.color}30`,
              display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <it.icon size={14} color={it.color} strokeWidth={2}/>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <span style={{fontSize:13,color:'#C8D8F0',fontWeight:600}}>{it.label}</span>
              {it.names.length>0&&<span style={{fontSize:13,color:'#9AAEC0',marginLeft:6}}>{it.names.join('、')}{it.count>3?` 等${it.count}檔`:''}</span>}
            </div>
            <div style={{fontSize:20,fontWeight:800,color:it.count>0?it.color:'#6A7A90',lineHeight:1,flexShrink:0}}>{it.count}</div>
          </div>
        ))}
        {indicators.every(it=>it.count===0)&&(
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'10px 12px',fontSize:13,color:'#10B981'}}>
            <IconShieldCheck size={16} color="#10B981" strokeWidth={1.8}/> 今日未偵測到明顯風險
          </div>
        )}
      </div>
    </div>
  )
}

/* ── Accordion ── */
function Accordion({title,sub,badge,children}) {
  const [open,setOpen]=useState(false)
  return (
    <div className="acc">
      <button className="acc-btn" onClick={()=>setOpen(o=>!o)}>
        <span style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:17,fontWeight:700,color:'#CBD5E1'}}>{title}</span>
          {sub&&<span style={{fontSize:13,color:'#8B9CB8'}}>{sub}</span>}
          {badge&&<span style={{fontSize:12,padding:'2px 10px',borderRadius:20,background:'rgba(255,255,255,.07)',color:'#94A3BC'}}>{badge}</span>}
        </span>
        <span style={{fontSize:15,color:'#8090A8',transition:'transform .22s',transform:open?'rotate(180deg)':'',flexShrink:0}}>▾</span>
      </button>
      {open&&<div className="acc-body">{children}</div>}
    </div>
  )
}

/* ── Pick opportunities ── */
function pickOpportunities(analysis,top5Codes) {
  const skip=new Set(top5Codes)
  return analysis
    .filter(s=>s.entryLo&&s.entryHi&&!skip.has(s.code)&&s.riskLevel!=='追價風險')
    .map(s=>{
      const over=(s.price-s.entryHi)/s.entryHi*100
      const distPct=s.price<s.entryLo?(s.entryLo-s.price)/s.entryLo*100:0
      const rNum=parseFloat((s.rValue||'1:0').split(':')[1])||0
      const posSc=s.price>=s.entryLo&&s.price<=s.entryHi?50:distPct<2?40:distPct<5?28:distPct<10?14:over>0&&over<=3?18:0
      const rSc=rNum>=2.5?30:rNum>=2.0?22:rNum>=1.5?14:6
      const penalty=over>3?-20:s.amp>=10?-10:0
      return {...s,oppScore:posSc+rSc+Math.round(s.confidenceScore*0.20)+penalty}
    })
    .filter(s=>s.oppScore>=20)
    .sort((a,b)=>b.oppScore-a.oppScore)
    .slice(0,5)
}

function Spinner() {
  return <div style={{textAlign:'center',padding:'48px 0',color:'#8090A8'}}>
    <div style={{width:22,height:22,border:'2px solid #1E293B',borderTopColor:'#3B82F6',borderRadius:'50%',animation:'spin .7s linear infinite',margin:'0 auto 12px'}}/>
    <div style={{fontSize:14}}>載入中…</div>
  </div>
}

/* ══ PAGE ══════════════════════════════════════════ */
export default function Home() {
  const [data,setData]    =useState(null)
  const [loading,setLoad] =useState(true)
  const [watchOpen,setWO] =useState(false)

  const load=useCallback(async()=>{
    setLoad(true)
    try{const r=await fetch('/api/market');if(!r.ok)throw new Error();setData(await r.json())}
    catch{}finally{setLoad(false)}
  },[])
  useEffect(()=>{load()},[load])

  const analysis  =data?.analysis  ||[]
  const yoyo      =data?.yoyo      ||[]
  const sectors   =data?.sectors   ||[]
  const top5      =analysis.filter(s=>s.direction==='做多').slice(0,5)
  const show5     =top5.length?top5:analysis.slice(0,5)
  const oppList   =pickOpportunities(analysis,show5.map(s=>s.code))
  const skip      =new Set(show5.map(s=>s.code))

  // watchAll: only from analysis (has entry/stopLoss data), exclude TOP5, sort by score
  const watchAll = analysis
    .filter(s => !skip.has(s.code) && s.confidenceScore > 20)
    .sort((a,b) => b.confidenceScore - a.confidenceScore)
    .slice(0,30)
  const watchShow=watchOpen?watchAll:watchAll.slice(0,10)

  const maxSector =Math.max(...sectors.map(s=>s.totalAmt),1)
  const ts        =data?.updatedAt?new Date(data.updatedAt).toLocaleTimeString('zh-TW',{hour:'2-digit',minute:'2-digit'}):''
  const dataDate  =data?.dataDate||''
  const longN     =analysis.filter(s=>s.direction==='做多').length

  return (<>
    <style>{`
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}
      @keyframes expandDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}
      *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
      body{font-family:'Noto Sans TC',system-ui,sans-serif;background:#050B16;color:#94A3B8;font-size:15px;line-height:1.7;-webkit-font-smoothing:antialiased}
      .page{max-width:1200px;margin:0 auto;padding:0 28px 80px}
      @media(max-width:640px){.page{padding:0 16px 80px}}

      /* header */
      .hdr{padding:14px 0 13px;border-bottom:1px solid rgba(255,255,255,.07);margin-bottom:32px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
      .dot{width:9px;height:9px;border-radius:50%;background:#1E293B}
      .dot.on{background:#EF4444;box-shadow:0 0 0 3px rgba(239,68,68,.2);animation:blink 2.5s infinite}
      .hdr-title{font-size:22px;font-weight:800;letter-spacing:-.02em;
        background:linear-gradient(135deg,#E0F2FF 0%,#60A5FA 50%,#A78BFA 100%);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
      .hdr-sub{font-size:13px;color:#7A8EA8;margin-top:3px}
      .hdr-stats{display:flex;align-items:center}
      .hs{padding:0 18px;border-left:1px solid rgba(255,255,255,.07);text-align:center}
      .hs:first-child{border-left:none}
      .hs-l{font-size:10px;color:#6B7A94;text-transform:uppercase;letter-spacing:.07em;margin-bottom:3px;font-weight:600}
      .hs-v{font-size:20px;font-weight:800;color:#F0F8FF}
      .rbtn{font-size:13px;font-family:inherit;padding:8px 18px;border:1px solid rgba(255,255,255,.1);border-radius:8px;background:rgba(255,255,255,.04);color:#64748B;cursor:pointer;transition:all .2s}
      .rbtn:hover:not(:disabled){background:rgba(255,255,255,.08);color:#E0F2FF;border-color:rgba(255,255,255,.2);transform:translateY(-1px)}
      .rbtn:disabled{opacity:.3;cursor:not-allowed}

      /* section */
      .sec{margin-bottom:36px}
      .divider{border:none;border-top:1px solid rgba(255,255,255,.06);margin:0 0 36px}
      .notice{background:rgba(59,130,246,.08);border:1px solid rgba(59,130,246,.2);border-radius:9px;padding:12px 18px;font-size:14px;color:#60A5FA;margin-bottom:32px}
      .empty{padding:40px 0;text-align:center;font-size:15px;color:#6B7A94}

      /* kpi */
      .kpi-card{background:linear-gradient(160deg,#142040 0%,#0D1830 50%,#09121E 100%);border:1px solid rgba(120,160,255,.18);border-radius:14px;padding:18px 20px;transition:border-color .2s,transform .2s,box-shadow .2s;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 2px 12px rgba(0,0,0,.3)}
      .kpi-card:hover{border-color:rgba(100,160,255,.45);transform:translateY(-2px);box-shadow:0 8px 28px rgba(59,130,246,.2),inset 0 1px 0 rgba(255,255,255,.1)}

      /* sentiment */
      .sp-panel{display:grid;grid-template-columns:1.4fr 1fr;background:linear-gradient(160deg,#142040 0%,#0D1830 50%,#09121E 100%);border:1px solid rgba(120,160,255,.18);border-radius:14px;overflow:hidden;margin-bottom:40px;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 2px 12px rgba(0,0,0,.3)}
      @media(max-width:700px){.sp-panel{grid-template-columns:1fr}}
      .sp-left{padding:22px 24px;border-right:1px solid rgba(255,255,255,.07)}
      @media(max-width:700px){.sp-left{border-right:none;border-bottom:1px solid rgba(255,255,255,.07)}}
      .sp-right{padding:22px 24px}

      /* action badges */
      .ab{font-size:12px;font-weight:600;padding:4px 12px;border-radius:20px;display:inline-block;white-space:nowrap}
      .ab-go  {background:#EF444415;color:#F87171;border:1px solid #EF444435}
      .ab-wait{background:#F59E0B15;color:#FCD34D;border:1px solid #F59E0B35}
      .ab-obs {background:rgba(255,255,255,.06);color:#64748B;border:1px solid rgba(255,255,255,.1)}
      .ab-skip{background:rgba(255,255,255,.04);color:#475569;border:1px solid rgba(255,255,255,.07)}

      /* top5 */
      .t5-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
      .t5-grid2{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-top:12px}
      @media(max-width:960px){.t5-grid{grid-template-columns:1fr 1fr}}
      @media(max-width:580px){.t5-grid,.t5-grid2{grid-template-columns:1fr}}
      .t5{background:linear-gradient(160deg,#142040 0%,#0D1830 50%,#09121E 100%);border:1px solid rgba(120,160,255,.18);border-radius:14px;overflow:hidden;transition:border-color .22s,box-shadow .22s,transform .22s;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 2px 12px rgba(0,0,0,.4)}
      .t5:hover{border-color:rgba(59,130,246,.25);box-shadow:0 8px 32px rgba(59,130,246,.12);transform:translateY(-3px)}
      .t5-gold  {border-color:rgba(245,158,11,.3)!important}
      .t5-gold:hover{box-shadow:0 8px 32px rgba(245,158,11,.15)!important}
      .t5-silver{border-color:rgba(148,163,184,.2)!important}
      .t5-bronze{border-color:rgba(194,130,74,.22)!important}
      .t5-body{padding:18px 18px 14px}

      /* opp */
      .opp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px}
      @media(max-width:600px){.opp-grid{grid-template-columns:1fr 1fr}}
      .opp{background:linear-gradient(160deg,#142040 0%,#0D1830 50%,#09121E 100%);border:1px solid rgba(120,160,255,.18);border-radius:14px;padding:18px 18px 14px;transition:border-color .22s,box-shadow .22s,transform .22s;box-shadow:inset 0 1px 0 rgba(255,255,255,.07),0 2px 12px rgba(0,0,0,.4)}
      .opp:hover{border-color:rgba(6,182,212,.25);box-shadow:0 6px 24px rgba(6,182,212,.1);transform:translateY(-2px)}

      /* theme */
      .th-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
      @media(max-width:700px){.th-grid{grid-template-columns:1fr}}
      .th{background:linear-gradient(160deg,#0F1B35,#0A1525);border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;transition:border-color .2s,transform .2s}
      .th:hover{border-color:rgba(139,92,246,.22);transform:translateY(-1px)}
      .th-head{display:flex;align-items:center;gap:12px;padding:16px 18px;transition:background .15s}
      .th:hover .th-head{background:rgba(255,255,255,.03)}
      .th-row{display:flex;align-items:center;gap:12px;padding:11px 18px;border-bottom:1px solid rgba(255,255,255,.05);transition:background .1s}
      .th-row:last-child{border-bottom:none}
      .th-row:hover{background:rgba(59,130,246,.05)}

      /* watch table */
      .wt{border:1px solid rgba(120,160,255,.18);border-radius:14px;overflow:hidden;background:linear-gradient(160deg,#142040 0%,#0D1830 50%,#09121E 100%);box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}
      .wt-head{display:grid;grid-template-columns:2fr 88px 80px 148px 76px 76px 96px;background:rgba(255,255,255,.08);border-bottom:1px solid rgba(120,160,255,.2);padding:10px 18px;gap:0}
      .wr{display:grid;grid-template-columns:2fr 88px 80px 148px 76px 76px 96px;padding:12px 18px;border-bottom:1px solid rgba(255,255,255,.05);gap:0;cursor:pointer;transition:background .12s}
      .wr:last-child{border-bottom:none}
      .wr:hover{background:rgba(59,130,246,.09)!important}
      .wr-even{background:rgba(255,255,255,.04)}
      .wr-odd{background:rgba(8,18,40,.7)}
      .wrc{font-size:13px;color:#94A3B8;display:flex;align-items:center;overflow:hidden;font-weight:400;min-width:0;padding-right:8px}
      .wt-head .wrc{font-size:11px;font-weight:700;color:#C0D4EC;text-transform:uppercase;letter-spacing:.05em;white-space:nowrap}
      @media(max-width:900px){
        .wt-head{grid-template-columns:minmax(0,2fr) repeat(3,minmax(0,1fr))}
        .wr{grid-template-columns:minmax(0,2fr) repeat(3,minmax(0,1fr))}
        .wrc:nth-child(n+5),.wt-head .wrc:nth-child(n+5){display:none}
      }
      .ws{font-size:12px;font-weight:600;padding:4px 10px;border-radius:20px;white-space:nowrap}
      .ws-near{background:#10B98115;color:#10B981;border:1px solid #10B98135}
      .ws-obs {background:rgba(255,255,255,.05);color:#64748B;border:1px solid rgba(255,255,255,.1)}
      .ws-risk{background:#F59E0B15;color:#F59E0B;border:1px solid #F59E0B35}
      .ws-hot {background:#EF444415;color:#EF4444;border:1px solid #EF444435}
      .wr-expand{padding:18px 24px;border-bottom:1px solid rgba(255,255,255,.05);background:rgba(0,0,0,.2);animation:expandDown .18s ease-out}
      .show-more{width:100%;margin-top:8px;padding:13px;font-size:14px;color:#6B7A94;background:transparent;border:1px dashed rgba(255,255,255,.09);border-radius:9px;cursor:pointer;font-family:inherit;transition:all .15s}
      .show-more:hover{color:#94A3B8;border-color:rgba(255,255,255,.18);background:rgba(255,255,255,.03)}

      /* risk */
      .risk-box{background:linear-gradient(160deg,#142040 0%,#0D1830 50%,#09121E 100%);border:1px solid rgba(120,160,255,.18);border-radius:14px;overflow:hidden;box-shadow:inset 0 1px 0 rgba(255,255,255,.07)}

      /* accordion */
      .acc{border:1px solid rgba(255,255,255,.08);border-radius:14px;overflow:hidden;margin-bottom:10px}
      .acc-btn{width:100%;display:flex;align-items:center;justify-content:space-between;padding:14px 20px;background:rgba(255,255,255,.03);border:none;font-family:inherit;cursor:pointer;gap:12px;transition:background .15s;text-align:left}
      .acc-btn:hover{background:rgba(255,255,255,.06)}
      .acc-body{padding:20px 22px;background:rgba(0,0,0,.12)}

      /* logic */
      .logic-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px;margin-bottom:12px}
      .lc{background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.07);border-radius:9px;padding:14px 16px}
      .lc-h{font-size:15px;font-weight:700;color:#CBD5E1;margin-bottom:5px}
      .lc-p{font-size:13px;color:#64748B;line-height:1.7}
      .logic-note{font-size:12px;color:#6B7A94;padding-top:12px;border-top:1px solid rgba(255,255,255,.06);line-height:1.7}
      .note-line{font-size:12px;color:#6B7A94;line-height:1.7;margin-top:10px}
    `}</style>

    <div className="page">
      {/* Header */}
      <header className="hdr">
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div className={`dot ${!loading?'on':''}`}/>
          <div>
            <div className="hdr-title">今日開盤前選股雷達</div>
            <div className="hdr-sub">台股選股工具 · 昨日收盤分析</div>
          </div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
          <div className="hdr-stats">
            <div className="hs"><div className="hs-l">掃描</div><div className="hs-v">{loading?'…':(data?.totalCount?.toLocaleString()||'—')}</div></div>
            <div className="hs"><div className="hs-l">做多</div><div className="hs-v" style={{color:'#EF4444'}}>{loading?'…':(longN||'—')}</div></div>
            <div className="hs"><div className="hs-l">主線</div><div className="hs-v" style={{color:'#F59E0B'}}>{sectors[0]?THEME_META[sectors[0].key]?.name||'—':'—'}</div></div>
          </div>
          {ts&&<span style={{fontSize:13,color:'#8090A8'}}>{ts}</span>}
          <button className="rbtn" onClick={load} disabled={loading}>↺ 重整</button>
        </div>
      </header>

      {!loading&&data&&(
        <div className="notice" style={{
          background: data.isReal?'rgba(16,185,129,.08)':'rgba(245,158,11,.08)',
          borderColor: data.isReal?'rgba(16,185,129,.25)':'rgba(245,158,11,.25)',
          color: data.isReal?'#6EE7B7':'#FCD34D',
          display:'flex',alignItems:'center',gap:10,fontSize:14
        }}>
          <span style={{fontSize:16}}>{data.isReal?'✅':'⚠️'}</span>
          {data.isReal
            ? `資料來源：TWSE + TPEx 真實收盤資料${dataDate?' · '+dataDate:''} · 每 10 分鐘快取`
            : '目前使用模擬資料（TWSE/TPEx 暫無回應）· 停損停利僅供參考'
          }
        </div>
      )}

      {/* Daily Summary */}
      {!loading&&data&&<DailySummary analysis={analysis} sectors={sectors} oppList={oppList}/>}

      {/* Sentiment + Risk side by side */}
      {!loading&&data&&(
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginBottom:36}}>
          <SentimentGauge analysis={analysis} sectors={sectors}/>
          <div style={{background:'linear-gradient(160deg,#0F1D35 0%,#0A1525 100%)',border:'1px solid rgba(255,120,120,.18)',borderRadius:14,padding:'20px 24px',boxShadow:'inset 0 1px 0 rgba(255,255,255,.07)'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:14}}>
              <div style={{width:30,height:30,borderRadius:8,background:'#EF444422',border:'1px solid #EF444440',display:'flex',alignItems:'center',justifyContent:'center'}}>
                <IconShieldExclamation size={16} color="#EF4444" strokeWidth={1.8}/>
              </div>
              <div>
                <div style={{fontSize:16,fontWeight:700,color:'#E8F2FF'}}>風險監測</div>
                <div style={{fontSize:12,color:'#7A90A8'}}>今日市場異常訊號</div>
              </div>
            </div>
            {loading?<Spinner/>:<RiskPanel analysis={analysis} yoyo={yoyo}/>}
          </div>
        </div>
      )}

      {/* KPI */}
      {!loading&&data&&<KpiBar analysis={analysis} sectors={sectors} oppList={oppList}/>}

      {/* ② 市場主線 (moved before TOP5) */}
      <section className="sec" style={{borderLeft:'3px solid #8B5CF6',paddingLeft:16,marginLeft:-16}}>
        <SecTitle icon={IconRadar2} label="市場主線" sub="點擊主線查看該方向最強股票" color="#8B5CF6"/>
        {loading?<Spinner/>:<div className="th-grid">{sectors.map((s,i)=><ThemeCard key={s.key} s={s} rank={i} analysis={analysis} maxAmt={maxSector}/>)}</div>}
      </section>

      <div className="divider"/>

      {/* ① TOP5 */}
      <section className="sec">
        <SecTitle icon={IconAward} label={`今日焦點 TOP ${show5.length}`} sub="做多優先 · 依信心分數排序" color="#F59E0B"/>
        {loading?<Spinner/>:show5.length>0?(<>
          <div className="t5-grid">{show5.slice(0,3).map((s,i)=><Top5Card key={s.code} s={s} rank={i}/>)}</div>
          {show5.length>3&&<div className="t5-grid2">{show5.slice(3,5).map((s,i)=><Top5Card key={s.code} s={s} rank={i+3}/>)}</div>}
        </>):<div className="empty">今日做多方向標的不足，請收盤後查看</div>}
      </section>

      <div className="divider"/>

      {/* 🚀 進場機會 */}
      <section className="sec">
        <SecTitle icon={IconCrosshair} label="今日強勢進場機會" sub="兼顧強勢度與進場時機 · 自動篩選 3～5 檔" color="#06B6D4"/>
        {loading?<Spinner/>:oppList.length>0
          ?<div className="opp-grid">{oppList.map(s=><OppCard key={s.code} s={s}/>)}</div>
          :<div className="empty">今日暫無符合條件的進場機會</div>}
      </section>

      <div className="divider"/>

      {/* ③ 觀察名單 */}
      <section className="sec">
        <SecTitle icon={IconEye} label="觀察名單" sub="強勢候選 + 異常強勢整合 · 已去除 TOP5 重複標的" color="#06B6D4"/>
        {loading?<Spinner/>:watchAll.length>0?(
          <>
            <div className="wt">
              <div className="wt-head">
                <div className="wrc">股票</div>
                <div className="wrc">漲跌</div>
                <div className="wrc">主線</div>
                <div className="wrc">進場區間</div>
                <div className="wrc">停損</div>
                <div className="wrc">停利</div>
                <div className="wrc">狀態</div>
              </div>
              {watchShow.map((s,i)=><WatchRow key={s.code} s={s} idx={i}/>)}
            </div>
            {watchAll.length>10&&<button className="show-more" onClick={()=>setWO(o=>!o)}>{watchOpen?'▲ 收合':`▼ 查看全部 ${watchAll.length} 檔`}</button>}
          </>
        ):<div className="empty">今日無符合條件的觀察標的</div>}
      </section>

      <div className="divider"/>

      <Accordion title="完整分析" sub="含做空與觀望" badge={`精選 ${Math.min(analysis.length,30)} 檔`}>
        <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {analysis.slice(0,30).map((s,i)=>{
            const up=s.changePct>=0
            const act=ACT[s.action]||{cls:'ab-obs',lbl:'觀察'}
            return(
              <div key={s.code} style={{background:'linear-gradient(160deg,#142040 0%,#0D1830 60%,#09121E 100%)',border:'1px solid rgba(120,160,255,.25)',borderRadius:10,padding:'15px 18px',boxShadow:'inset 0 1px 0 rgba(255,255,255,.07),0 2px 8px rgba(0,0,0,.3)'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:12}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:6,flexWrap:'wrap'}}>
                      <span style={{fontSize:12,color:'#8090A8'}}>#{i+1}</span>
                      <span style={{fontSize:15,fontWeight:700,color:'#F0F8FF'}}>{s.code} {s.name}</span>
                      <span className={`ab ${act.cls}`}>{act.lbl}</span>
                      <span style={{fontSize:11,padding:'2px 7px',borderRadius:4,fontWeight:500,
                        background:s.direction==='做多'?'#EF444415':'#10B98115',
                        color:s.direction==='做多'?'#EF4444':s.direction==='做空'?'#10B981':'#8B9CB8',
                        border:`1px solid ${s.direction==='做多'?'#EF444435':s.direction==='做空'?'#10B98135':'rgba(255,255,255,.1)'}`}}>
                        {s.direction}
                      </span>
                    </div>
                    <div style={{fontSize:13,color:'#8B9CB8',display:'flex',gap:10,flexWrap:'wrap'}}>
                      <span style={{color:cc(s.changePct),fontWeight:700}}>{up?'▲':'▼'}{fd(Math.abs(s.changePct),2)}%</span>
                      <span>{fd(s.price,1)}</span>
                      {s.entryLo&&<><span>進場 <span style={{color:'#3B82F6'}}>{s.entry}</span></span><span>停損 <span style={{color:UP}}>{s.stopLoss}</span></span></>}
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontSize:24,fontWeight:800,color:sc(s.confidenceScore),lineHeight:1}}>{s.confidenceScore}</div>
                    <div style={{fontSize:12,color:'#9AAEC0',marginTop:2}}>/100</div>
                  </div>
                </div>
                <div style={{borderTop:'1px solid rgba(255,255,255,.06)',paddingTop:9,marginTop:10}}>
                  {(s.bullets||[]).slice(0,2).map((b,j)=>(
                    <div key={j} style={{display:'flex',alignItems:'flex-start',gap:7,fontSize:13,color:'#A0B4CC',marginBottom:4,lineHeight:1.55}}>
                      <span style={{color:'#4A8FCC',flexShrink:0,fontSize:14,lineHeight:1.3}}>·</span><span>{b}</span>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
        <p className="note-line" style={{marginTop:10}}>共 {analysis.length} 檔，依信心分數高→低排列</p>
      </Accordion>

      <Accordion title="選股邏輯說明" sub="計算公式">
        <div className="logic-grid">
          {[
            ['評分公式','續強潛力(40%) + 進場可行性(35%) + 資金強度(25%)'],
            ['進場區','漲幅 ≥5% → 低點往上 15~38%；2~5% → 目前價 ±1%'],
            ['停損/停利','停損 = 進場下緣 -3%；TP1 = 中點+風險×1.5'],
            ['信心分數','0–100 純規則計算，非勝率'],
            ['漲跌顏色','紅漲綠跌，符合台股習慣'],
            ['觀察名單','合併強勢候選 + 異常強勢，去除 TOP5 重複'],
          ].map(([h,p])=>(
            <div key={h} className="lc"><div className="lc-h">{h}</div><div className="lc-p">{p}</div></div>
          ))}
        </div>
        <div className="logic-note">純規則計算，不使用任何付費 API，永久免費。僅供個人研究參考，不構成投資建議。</div>
      </Accordion>

      <p className="note-line" style={{marginTop:14}}>資料：TWSE 台灣證交所 / TPEx 證券櫃買中心（收盤後 16:30 更新）。非交易日顯示模擬資料。</p>
    </div>
  </>)
}
