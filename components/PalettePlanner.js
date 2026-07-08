'use client'
import { useState, useMemo, useRef, useEffect } from 'react'

// 삼색 — 3원색으로 색상휠(물감식 감산 기본)을 만들고, 추천 대비 · 6:3:1 면적을 잡아
// "색 계획 카드" PNG + palette JSON으로 기록에 저장하는 모달. (학생·참여작가 공용)

const DEF = [{ h:53, s:85, l:55 }, { h:224, s:72, l:48 }, { h:330, s:75, l:58 }]
const KW = {
  '정오 원색': [{ h:52, s:88, l:55 }, { h:224, s:78, l:48 }, { h:334, s:80, l:56 }],
  '가을 흙':   [{ h:38, s:70, l:52 }, { h:158, s:34, l:36 }, { h:8, s:62, l:46 }],
  '새벽 냉색': [{ h:206, s:56, l:56 }, { h:168, s:40, l:52 }, { h:268, s:40, l:56 }],
  '살구 파스텔':[{ h:24, s:70, l:70 }, { h:196, s:44, l:66 }, { h:338, s:52, l:72 }],
}
const BG='#0b0b0e', CARD='#131318', BORD='#23232c', TX='#ededf2', TX2='#9a9aa8', MUT='#6f6f80'

const cl=(v,a,b)=>Math.max(a,Math.min(b,v))
const cssH=c=>`hsl(${Math.round(c.h)} ${Math.round(c.s)}% ${Math.round(c.l)}%)`
const cssR=a=>`rgb(${a[0]} ${a[1]} ${a[2]})`
function hsl2rgb(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1));return [f(0),f(8),f(4)].map(x=>Math.round(x*255))}
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){if(mx===r)h=((g-b)/d+6)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60}const l=(mx+mn)/2,s=d?d/(1-Math.abs(2*l-1)):0;return {h,s:s*100,l:l*100}}
function hx(h,s,l){const r=hsl2rgb(h,s,l),t=x=>x.toString(16).padStart(2,'0');return '#'+t(r[0])+t(r[1])+t(r[2])}
const warm=h=>Math.cos((h-42)*Math.PI/180)
const tint=c=>({h:c.h,s:c.s*0.5,l:c.l+(100-c.l)*0.5})
function mixHSL(a,b,t){const dh=((b.h-a.h+540)%360)-180;return {h:(a.h+dh*t+360)%360,s:a.s+(b.s-a.s)*t,l:a.l+(b.l-a.l)*t}}
function pureSub(a,b,t){const ra=hsl2rgb(a.h,a.s,a.l),rb=hsl2rgb(b.h,b.s,b.l),g=i=>Math.round(Math.pow(Math.max(ra[i],4)/255,1-t)*Math.pow(Math.max(rb[i],4)/255,t)*255);return rgb2hsl(g(0),g(1),g(2))}
function avgRGB(P){let r=0,g=0,b=0;P.forEach(c=>{const x=hsl2rgb(c.h,c.s,c.l);r+=x[0];g+=x[1];b+=x[2]});return [r/3,g/3,b/3].map(Math.round)}
const hd=(a,b)=>{let d=Math.abs(a-b)%360;return d>180?360-d:d}
function makePureAt(P,mix){return function(th){th=((th%360)+360)%360;let a,b,t;if(th<120){a=P[0];b=P[1];t=th/120}else if(th<240){a=P[1];b=P[2];t=(th-120)/120}else{a=P[2];b=P[0];t=(th-240)/120}return mix==='sub'?pureSub(a,b,t):mixHSL(a,b,t)}}

function contrastsOf(P){
  const Ls=P.map(c=>c.l),sat=P.map(c=>c.s),w=P.map(c=>warm(c.h))
  const Ls2=Math.round(Math.max(...Ls)-Math.min(...Ls)),wc=w.filter(x=>x>0.15).length,cc=w.filter(x=>x<-0.15).length
  let mx=0;for(let i=0;i<3;i++)for(let j=i+1;j<3;j++)mx=Math.max(mx,hd(P[i].h,P[j].h));mx=Math.round(mx)
  const avgS=(sat[0]+sat[1]+sat[2])/3,set=new Set(['면적'])
  if(Ls2>32)set.add('명도');if(wc>0&&cc>0)set.add('한난');if(mx>=138)set.add('보색');if(mx<=56)set.add('유사');if(mx>=138&&avgS>54)set.add('동시')
  const pr=[['한난','한난대비'],['명도','명도대비'],['보색','보색대비'],['유사','유사대비'],['동시','동시대비']],pk=pr.filter(p=>set.has(p[0]))
  const headline=pk.slice(0,2).map(p=>p[1]).join(' + ')||'면적대비 중심'
  const RS={한난:`따뜻한 색 ${wc} · 차가운 색 ${cc}개라 한난대비가 또렷해요`,명도:`명도 차이가 ${Ls2}%라 명도대비가 잘 살아요`,보색:`가장 먼 두 색이 ${mx}° 벌어져 보색대비가 가능해요`,유사:`색이 ${mx}° 안에 모여 유사대비가 안정적이에요`,동시:`고채도 보색이라 동시대비 효과가 강해요`}
  const reco=pk.slice(0,2).map(p=>RS[p[0]]).join('. ')||'면적으로 균형을 잡아요'
  return { set, headline, keys:pk.slice(0,2).map(p=>p[0]), reco, chips:['명도','보색','유사','한난','동시','면적'].map(k=>({k,on:set.has(k)})) }
}

function derive(P,mix,ratio,domCrit,accentSel){
  const pureAt=makePureAt(P,mix),pure=[],tin=[]
  for(let i=0;i<12;i++){const p=pureAt(i*30);pure.push(p);tin.push(tint(p))}
  const gray=avgRGB(P),ctr=gray.map(v=>Math.round(v*0.5+127.5))
  const vivid=()=>{let m=-1,i0=0;P.forEach((c,i)=>{const w=(warm(c.h)+1)/2,sc=c.s/100*(0.6+0.4*w);if(sc>m){m=sc;i0=i}});return i0}
  const pick=idx=>{if(domCrit==='sat')return idx.reduce((m,i)=>P[i].s<P[m].s?i:m,idx[0]);if(domCrit==='light')return idx.reduce((m,i)=>P[i].l>P[m].l?i:m,idx[0]);return idx.reduce((m,i)=>Math.abs(P[i].l-50)<Math.abs(P[m].l-50)?i:m,idx[0])}
  let domI,secI,acc,rec=!accentSel
  if(accentSel){acc={...accentSel};domI=pick([0,1,2]);const rest=[0,1,2].filter(i=>i!==domI);secI=rest.sort((a,b)=>P[b].s-P[a].s)[0]}
  else{const ai=vivid();acc={...P[ai]};const rest=[0,1,2].filter(i=>i!==ai);domI=pick(rest);secI=rest.find(i=>i!==domI)}
  const dom=tint(P[domI]),domD={h:P[domI].h,s:P[domI].s,l:cl(P[domI].l-18,10,90)},sec=P[secI],secT=tint(P[secI])
  const wd=ratio==='631'?[60,30,10]:[60,20,20],con=contrastsOf(P)
  const dS=Math.round(P[domI].s),dL=Math.round(P[domI].l),sHd=Math.round(hd(P[domI].h,P[secI].h)),aS=Math.round(acc.s),aHd=Math.round(hd(P[domI].h,acc.h))
  const dW=warm(P[domI].h),sW=warm(P[secI].h),aW=warm(acc.h)
  let rDom=domCrit==='sat'?`채도가 ${dS}%로 셋 중 가장 낮아, 넓게 깔아도 눈이 피로하지 않아요`:domCrit==='light'?`명도가 ${dL}%로 가장 밝아, 화면을 열어주는 바탕이 돼요`:`명도 ${dL}%의 중간 톤이라, 어떤 색과도 무난히 어울리는 바탕이에요`
  let rSec=sHd<=45?`주체와 색상이 ${sHd}°만 떨어져 톤이 이어지며 자연스럽게 받쳐줘요`:`주체와 ${sHd}° 떨어져 단조로움을 깨고 화면에 리듬을 줘요`
  if((dW>0.15&&sW<-0.15)||(dW<-0.15&&sW>0.15))rSec+=` (주체와 한난이 갈려요)`
  let rAcc=accentSel?`직접 고른 색이에요. 채도 ${aS}%로 좁게 써도 시선을 잡아요`:`추천 포인트예요. 채도 ${aS}%로 가장 선명해 10%만 써도 시선이 꽂혀요`
  if(aHd>=120)rAcc+=` — 주체의 반대편 색이라 강조가 강해요`
  else if((dW>0.15&&aW<-0.15)||(dW<-0.15&&aW>0.15))rAcc+=` — 주체와 한난 대비로 도드라져요`
  return { pureAt,pure,tin,gray,ctr,domI,secI,acc,rec,dom,domD,sec,secT,wd,con,reasons:{rDom,rSec,rAcc} }
}

function wedge(ctx,cx,cy,r0,r1,a0,a1,f){ctx.beginPath();ctx.arc(cx,cy,r1,a0,a1);ctx.arc(cx,cy,r0,a1,a0,true);ctx.closePath();ctx.fillStyle=f;ctx.fill()}
function drawWheelOn(ctx,cx,cy,R,D){
  const rPure=R,rTint=R*0.70,rBand=R*0.46,rIn=R*0.34
  for(let i=0;i<12;i++){const a0=(i*30-15-90)*Math.PI/180,a1=(i*30+15-90)*Math.PI/180,pu=D.pureAt(i*30)
    wedge(ctx,cx,cy,rTint,rPure,a0,a1,cssH(pu));wedge(ctx,cx,cy,rBand,rTint,a0,a1,cssH(tint(pu)))}
  ctx.beginPath();ctx.arc(cx,cy,rBand,0,7);ctx.fillStyle=cssR(D.gray);ctx.fill()
  ctx.beginPath();ctx.arc(cx,cy,rIn,0,7);ctx.fillStyle=cssR(D.ctr);ctx.fill()
  for(let i=0;i<12;i++){const a=(i*30+15-90)*Math.PI/180;ctx.beginPath();ctx.moveTo(cx+Math.cos(a)*rBand,cy+Math.sin(a)*rBand);ctx.lineTo(cx+Math.cos(a)*rPure,cy+Math.sin(a)*rPure);ctx.strokeStyle='rgba(8,8,11,0.4)';ctx.lineWidth=Math.max(1,R/95);ctx.stroke()}
  ;[rPure,rTint,rBand,rIn].forEach(r=>{ctx.beginPath();ctx.arc(cx,cy,r,0,7);ctx.strokeStyle='rgba(8,8,11,0.35)';ctx.lineWidth=Math.max(1,R/120);ctx.stroke()})
  ctx.fillStyle='#ededf2';ctx.font=`500 ${Math.round(R*0.15)}px Nunito, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle'
  ;[0,120,240].forEach(th=>{const a=(th-90)*Math.PI/180;ctx.fillText('P',cx+Math.cos(a)*(R+R*0.1),cy+Math.sin(a)*(R+R*0.1))})
}
function rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function drawCard(ctx,W,H,D,P){
  ctx.fillStyle=BG;ctx.fillRect(0,0,W,H)
  ctx.fillStyle=TX;ctx.textAlign='left';ctx.textBaseline='alphabetic'
  ctx.font='500 40px Nunito, sans-serif';ctx.fillText('삼색 · 색 계획',44,72)
  ctx.fillStyle=TX2;ctx.font='400 22px Nunito, sans-serif';ctx.fillText('3원색으로 잡은 배색',44,104)
  drawWheelOn(ctx,W/2,300,168,D)
  const swW=200,gap=16,x0=(W-(swW*3+gap*2))/2,sy=500
  P.forEach((c,i)=>{const x=x0+i*(swW+gap);rrect(ctx,x,sy,swW,74,16);ctx.fillStyle=cssH(c);ctx.fill()
    ctx.fillStyle=TX2;ctx.font='400 22px Nunito, sans-serif';ctx.textAlign='center';ctx.fillText(hx(c.h,c.s,c.l).toUpperCase(),x+swW/2,sy+108)})
  ctx.textAlign='left';ctx.fillStyle=TX2;ctx.font='400 24px Nunito, sans-serif'
  ctx.fillText(`면적 ${D.wd[0]} : ${D.wd[1]} : ${D.wd[2]}`,44,690)
  const groups=[[[D.dom,D.domD],D.wd[0],'주체'],[[D.sec,D.secT],D.wd[1],'부수'],[[D.acc],D.wd[2],'종속']]
  const barX=44,barY=712,barW=W-88,barH=96;let cx=barX
  groups.forEach(g=>{const segW=barW*g[1]/100,each=segW/g[0].length
    g[0].forEach((c,j)=>{ctx.fillStyle=cssH(c);ctx.fillRect(cx+j*each,barY,each+0.5,barH)});cx+=segW})
  cx=barX;groups.forEach(g=>{const segW=barW*g[1]/100;ctx.fillStyle=TX2;ctx.font='400 22px Nunito, sans-serif';ctx.textAlign='center';ctx.fillText(`${g[2]} ${g[1]}%`,cx+segW/2,barY+barH+34);cx+=segW})
  ctx.textAlign='left';ctx.fillStyle=cssH(D.acc);ctx.font='500 30px Nunito, sans-serif';ctx.fillText(`추천 대비 · ${D.con.headline}`,44,912)
  ctx.fillStyle=MUT;ctx.font='400 21px Nunito, sans-serif';ctx.fillText(`혼합 ${'물감식'} · ${D.con.reco}`.slice(0,60),44,946)
}

export default function PalettePlanner({ initial, role, saving, onClose, onSave }){
  const [P,setP]=useState(()=> initial?.primaries?.length===3 ? initial.primaries.map(c=>({...c})) : DEF.map(c=>({...c})))
  const [act,setAct]=useState(0)
  const [mix,setMix]=useState(initial?.mix==='bright'?'bright':'sub')
  const [ratio,setRatio]=useState(initial?.ratio==='622'?'622':'631')
  const [domCrit,setDomCrit]=useState(['sat','light','mid'].includes(initial?.domCrit)?initial.domCrit:'sat')
  const [accentSel,setAccentSel]=useState(()=> initial?.accentManual && initial?.accent ? {...initial.accent} : null)
  const cv=useRef(null)

  const D=useMemo(()=>derive(P,mix,ratio,domCrit,accentSel),[P,mix,ratio,domCrit,accentSel])

  useEffect(()=>{ const c=cv.current; if(!c)return; drawWheelOn(c.getContext('2d'),105,105,89,D) },[D])

  const setField=(f,v)=>setP(prev=>prev.map((c,i)=>i===act?{...c,[f]:v}:c))
  const brickSel=c=>accentSel&&Math.abs(accentSel.h-c.h)<0.6&&Math.abs(accentSel.l-c.l)<0.6&&Math.abs(accentSel.s-c.s)<0.6

  async function save(){
    const c=document.createElement('canvas');c.width=720;c.height=1000
    drawCard(c.getContext('2d'),720,1000,D,P)
    const blob=await new Promise(res=>c.toBlob(res,'image/png'))
    const palette={ v:1, primaries:P, mix, ratio, domCrit, accentManual:!!accentSel, accent:D.acc,
      hex:[...P.map(p=>hx(p.h,p.s,p.l)), hx(D.acc.h,D.acc.s,D.acc.l)], contrasts:D.con.keys }
    onSave(blob,palette)
  }

  const seg=(on)=>({ fontSize:11, padding:'5px 11px', borderRadius:20, cursor:'pointer', fontFamily:'inherit',
    background:on?'#ededf2':'#1c1c22', color:on?'#141018':'#b6b6c4', border:`1px solid ${on?'transparent':'#2b2b35'}` })
  const sub={ fontSize:11, color:TX2, marginBottom:5 }
  const wg={ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:5 }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(4,4,7,0.86)', zIndex:1500, display:'flex', justifyContent:'center', overflowY:'auto' }}>
      <div style={{ width:'100%', maxWidth:400, background:BG, minHeight:'100%', paddingBottom:32 }}>

        <div style={{ position:'sticky', top:0, zIndex:2, background:BG, borderBottom:`1px solid ${BORD}`, display:'flex', alignItems:'center', gap:10, padding:'12px 14px' }}>
          <button onClick={onClose} style={{ width:32, height:32, borderRadius:'50%', border:`1px solid ${BORD}`, background:CARD, color:TX2, fontSize:14, cursor:'pointer', flexShrink:0 }}>✕</button>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontSize:15, fontWeight:500, color:TX }}>🎨 색 계획</div>
            <div style={{ fontSize:11, color:TX2 }}>3원색으로 배색 잡고 기록에 저장</div>
          </div>
          <button onClick={save} disabled={saving}
            style={{ fontSize:13, fontWeight:500, padding:'8px 16px', borderRadius:11, border:'none', cursor: saving?'default':'pointer', background: saving?'#3a3a44':'#ededf2', color:'#141018', fontFamily:'inherit' }}>
            {saving?'저장 중…':'기록에 저장'}
          </button>
        </div>

        <div style={{ textAlign:'center', padding:'14px 16px 0' }}>
          <div style={{ display:'flex', justifyContent:'center', gap:6, marginBottom:4 }}>
            <button onClick={()=>setMix('sub')} style={seg(mix==='sub')}>물감식 감산</button>
            <button onClick={()=>setMix('bright')} style={seg(mix==='bright')}>밝은 보간</button>
          </div>
          <canvas ref={cv} width={210} height={210} style={{ width:210, height:210, display:'block', margin:'2px auto 0' }}/>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px 12px', marginTop:10, maxWidth:250, margin:'10px auto 0' }}>
            {[['바깥 · 순색',cssH(D.pureAt(0))],['중간 · +화이트50%',cssH(tint(D.pureAt(0)))],['띠 · 3원색 순회색',cssR(D.gray)],['중앙 · 회색+화이트',cssR(D.ctr)]].map(([t,bg])=>(
              <span key={t} style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'#9a9aa8' }}>
                <i style={{ width:12, height:12, borderRadius:3, background:bg, display:'inline-block' }}/>{t}
              </span>
            ))}
          </div>
        </div>

        <div style={{ padding:'16px 16px 0' }}>
          <div style={{ fontSize:12.5, fontWeight:500, color:TX, marginBottom:9 }}>🎨 3원색 (P) <span style={{ color:TX2, fontWeight:400, fontSize:11 }}>— 탭해서 조절</span></div>
          <div style={{ display:'flex', gap:8 }}>
            {P.map((c,i)=>(
              <button key={i} onClick={()=>setAct(i)} style={{ flex:1, border:'none', padding:0, background:'none', cursor:'pointer', textAlign:'center' }}>
                <div style={{ height:52, borderRadius:12, border:`2px solid ${act===i?'#ededf2':'transparent'}`, background:cssH(c) }}/>
                <span style={{ fontFamily:'monospace', fontSize:11, color:TX2, marginTop:5, display:'block' }}>{hx(c.h,c.s,c.l).toUpperCase()}</span>
              </button>
            ))}
          </div>
          <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:8, background:CARD, border:`1px solid ${BORD}`, borderRadius:12, padding:'11px' }}>
            {[['색상','h',0,360],['채도','s',5,95],['명도','l',8,92]].map(([lab,f,mn,mx])=>(
              <div key={f} style={{ display:'flex', alignItems:'center', gap:9 }}>
                <span style={{ fontSize:11, color:TX2, width:34, flexShrink:0 }}>{lab}</span>
                <input type="range" min={mn} max={mx} step={1} value={Math.round(P[act][f])} onChange={e=>setField(f,+e.target.value)}
                  style={{ flex:1, accentColor:cssH(D.acc) }}/>
              </div>
            ))}
          </div>
          <div style={{ marginTop:9, display:'flex', flexWrap:'wrap', gap:6 }}>
            {Object.keys(KW).map(k=>(
              <button key={k} onClick={()=>{ setP(KW[k].map(c=>({...c}))); setAccentSel(null) }} style={seg(false)}>{k}</button>
            ))}
          </div>
        </div>

        <div style={{ padding:'16px 16px 0' }}>
          <div style={{ fontSize:12.5, fontWeight:500, color:TX, marginBottom:9 }}>◐ 추천 대비</div>
          <div style={{ background:CARD, border:`1px solid ${BORD}`, borderRadius:12, padding:'10px 12px' }}>
            <div style={{ fontSize:13.5, fontWeight:500, color:cssH(D.acc), marginBottom:3 }}>{D.con.headline}</div>
            <div style={{ fontSize:11, color:'#a0a0b0', lineHeight:1.5 }}>{D.con.reco}</div>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
            {D.con.chips.map(ch=>(
              <span key={ch.k} style={{ fontSize:11, padding:'5px 9px', borderRadius:20, fontWeight: ch.on?500:400,
                background: ch.on?cssH(D.acc):'#1c1c22', color: ch.on?'#141018':'#87879a', border:`1px solid ${ch.on?'transparent':'#2b2b35'}` }}>{ch.k}대비</span>
            ))}
          </div>
        </div>

        <div style={{ padding:'16px 16px 0' }}>
          <div style={{ fontSize:12.5, fontWeight:500, color:TX, marginBottom:9 }}>▦ 벽돌 팔레트 <span style={{ color:TX2, fontWeight:400, fontSize:11 }}>— 탭하면 종속(포인트)</span></div>
          <div style={sub}>순색</div>
          <div style={wg}>{D.pure.map((c,i)=><button key={'p'+i} onClick={()=>setAccentSel({h:c.h,s:c.s,l:c.l})} style={{ height:32, borderRadius:7, border:`2px solid ${brickSel(c)?'#fff':'transparent'}`, background:cssH(c), cursor:'pointer', padding:0 }}/>)}</div>
          <div style={{ ...sub, marginTop:9 }}>틴트 · +화이트 50%</div>
          <div style={wg}>{D.tin.map((c,i)=><button key={'t'+i} onClick={()=>setAccentSel({h:c.h,s:c.s,l:c.l})} style={{ height:32, borderRadius:7, border:`2px solid ${brickSel(c)?'#fff':'transparent'}`, background:cssH(c), cursor:'pointer', padding:0 }}/>)}</div>
        </div>

        <div style={{ padding:'16px 16px 0' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:9 }}>
            <span style={{ fontSize:12.5, fontWeight:500, color:TX }}>▧ 면적 구성</span>
            <span style={{ display:'flex', gap:6 }}>
              <button onClick={()=>setRatio('631')} style={seg(ratio==='631')}>6 : 3 : 1</button>
              <button onClick={()=>setRatio('622')} style={seg(ratio==='622')}>6 : 2 : 2</button>
            </span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10, flexWrap:'wrap' }}>
            <span style={{ fontSize:11, color:TX2 }}>주체 기준</span>
            <button onClick={()=>setDomCrit('sat')} style={seg(domCrit==='sat')}>저채도</button>
            <button onClick={()=>setDomCrit('light')} style={seg(domCrit==='light')}>최고명도</button>
            <button onClick={()=>setDomCrit('mid')} style={seg(domCrit==='mid')}>중명도</button>
          </div>
          <div style={{ display:'flex', gap:8 }}>
            {[[[D.dom,D.domD],D.wd[0],'주체'],[[D.sec,D.secT],D.wd[1],'부수'],[[D.acc],D.wd[2],'종속',D.rec?'추천':'선택']].map((g,gi)=>(
              <div key={gi} style={{ flex:`0 0 ${g[1]}%`, display:'flex', flexDirection:'column', gap:4 }}>
                <div style={{ display:'flex', height:50, borderRadius:8, overflow:'hidden' }}>
                  {g[0].map((c,j)=><div key={j} style={{ flex:1, background:cssH(c) }}/>)}
                </div>
                <div style={{ fontSize:11, color:'#9a9aa8', textAlign:'center' }}>{g[2]} <span style={{ color:'#d6d6de' }}>{g[1]}%</span>{g[3]?<span style={{ color:MUT }}> · {g[3]}</span>:null}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop:10, background:CARD, border:`1px solid ${BORD}`, borderRadius:12, padding:'10px 12px', display:'flex', flexDirection:'column', gap:9 }}>
            <div style={{ fontSize:11, color:MUT }}>이렇게 나눈 이유</div>
            {[['주체',cssH(D.dom),D.reasons.rDom],['부수',cssH(D.sec),D.reasons.rSec],['종속',cssH(D.acc),D.reasons.rAcc]].map((r,i)=>(
              <div key={i} style={{ display:'flex', gap:9, alignItems:'flex-start' }}>
                <span style={{ width:16, height:16, borderRadius:5, flexShrink:0, marginTop:2, background:r[1] }}/>
                <div style={{ minWidth:0 }}>
                  <span style={{ fontSize:11.5, fontWeight:500, color:'#e6e6ee' }}>{r[0]}</span>
                  <span style={{ fontSize:11, color:'#9a9aa8', display:'block', lineHeight:1.5, marginTop:1 }}>{r[2]}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ padding:'14px 16px 0', display:'flex', gap:10, alignItems:'center' }}>
          <span style={{ fontSize:11, color:TX2 }}>포인트 <span style={{ fontFamily:'monospace', color:'#c9c9d4' }}>{hx(D.acc.h,D.acc.s,D.acc.l).toUpperCase()}</span></span>
          {accentSel && <button onClick={()=>setAccentSel(null)} style={{ ...seg(false), display:'inline-flex', alignItems:'center', gap:5 }}>↺ 추천으로</button>}
        </div>

      </div>
    </div>
  )
}
