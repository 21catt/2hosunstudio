'use client'
import { useState, useMemo, useRef, useEffect, Fragment } from 'react'

// PIGMENT — 3원색으로 색상휠(물감식 감산 기본)을 만들고, 먼셀 추천 대비 · 6:3:1 면적을 잡아
// "색 계획 카드" PNG + palette JSON으로 기록에 저장하는 모달. (학생·참여작가 공용)

const DEF = [{ h:53, s:85, l:55 }, { h:224, s:72, l:48 }, { h:330, s:75, l:58 }]
const KW = {
  '정오 원색': [{ h:52, s:88, l:55 }, { h:224, s:78, l:48 }, { h:334, s:80, l:56 }],
  '가을 흙':   [{ h:38, s:70, l:52 }, { h:158, s:34, l:36 }, { h:8, s:62, l:46 }],
  '새벽 냉색': [{ h:206, s:56, l:56 }, { h:168, s:40, l:52 }, { h:268, s:40, l:56 }],
  '살구 파스텔':[{ h:24, s:70, l:70 }, { h:196, s:44, l:66 }, { h:338, s:52, l:72 }],
}
// 프리미엄 플럼 다크 테마
const BG='#0e0a12', PANEL='#17131e', INSET='#0f0b16', WHEEL='#221d2a'
const BORD='rgba(255,255,255,0.07)', BORD2='rgba(255,255,255,0.14)'
const TX='#F0ECF4', TX2='#a49cae', MUT='#726a7c', DIM='#5f5869'
const FSANS="'Pretendard','Nunito',sans-serif", FMONO="'JetBrains Mono',monospace", FDISP="'Space Grotesk','Pretendard',sans-serif"

const cl=(v,a,b)=>Math.max(a,Math.min(b,v))
const cssH=c=>`hsl(${Math.round(c.h)} ${Math.round(c.s)}% ${Math.round(c.l)}%)`
const cssHA=(c,a)=>`hsl(${Math.round(c.h)} ${Math.round(c.s)}% ${Math.round(c.l)}% / ${a})`
const cssR=a=>`rgb(${a[0]} ${a[1]} ${a[2]})`
function hsl2rgb(h,s,l){s/=100;l/=100;const k=n=>(n+h/30)%12,a=s*Math.min(l,1-l),f=n=>l-a*Math.max(-1,Math.min(k(n)-3,9-k(n),1));return [f(0),f(8),f(4)].map(x=>Math.round(x*255))}
function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;if(d){if(mx===r)h=((g-b)/d+6)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60}const l=(mx+mn)/2,s=d?d/(1-Math.abs(2*l-1)):0;return {h,s:s*100,l:l*100}}
// 먼셀 색채대비 분석용 — sRGB → CIELAB(D65). 먼셀 명도 V≈L*/10, 채도 C≈C*ab, 보색=대립색공간 마주봄.
function srgbLin(c){c/=255;return c<=0.04045?c/12.92:Math.pow((c+0.055)/1.055,2.4)}
function rgb2lab([r,g,b]){const R=srgbLin(r),G=srgbLin(g),B=srgbLin(b)
  let X=(R*0.4124+G*0.3576+B*0.1805)/0.95047,Y=R*0.2126+G*0.7152+B*0.0722,Z=(R*0.0193+G*0.1192+B*0.9505)/1.08883
  const f=t=>t>0.008856?Math.cbrt(t):7.787*t+16/116,fx=f(X),fy=f(Y),fz=f(Z)
  return { L:116*fy-16, a:500*(fx-fy), b:200*(fy-fz) }}
// 먼셀 H V/C 표기 — 명도 V는 ASTM D1535 역변환(정확), 색상 H·채도 C는 CIELAB 보정 근사.
function relLum([r,g,b]){return srgbLin(r)*0.2126+srgbLin(g)*0.7152+srgbLin(b)*0.0722}
function munsellValue(Yrel){const Y=Yrel*100;let lo=0,hi=10;for(let k=0;k<36;k++){const V=(lo+hi)/2,y=1.2219*V-0.23111*V*V+0.23951*V**3-0.021009*V**4+0.0008404*V**5;if(y<Y)lo=V;else hi=V}return (lo+hi)/2}
const HANCH=[[34,5],[52,15],[86,25],[120,35],[158,45],[192,55],[248,65],[296,75],[330,85],[356,95],[394,105]]
function labHueToMunsell(h){let x=h;if(x<34)x+=360;for(let i=0;i<HANCH.length-1;i++){const[h0,m0]=HANCH[i],[h1,m1]=HANCH[i+1];if(x>=h0&&x<=h1){const t=(x-h0)/(h1-h0);return ((m0+(m1-m0)*t)%100+100)%100}}return 5}
function munsellHueStr(m){const fam=['R','YR','Y','GY','G','BG','B','PB','P','RP'];let mm=((Math.round(m/2.5)*2.5)%100+100)%100,idx=Math.floor(mm/10)%10,step=mm-idx*10;if(step===0){step=10;idx=(idx-1+10)%10}return `${step}${fam[idx]}`}
function munsell(c){const rgb=hsl2rgb(c.h,c.s,c.l),lab=rgb2lab(rgb),Cab=Math.hypot(lab.a,lab.b),hab=(Math.atan2(lab.b,lab.a)*180/Math.PI+360)%360
  const V=Math.round(munsellValue(relLum(rgb))*2)/2,C=Math.round(Cab/5.2)
  return C<1?`N ${V}`:`${munsellHueStr(labHueToMunsell(hab))} ${V}/${C}`}
// 색채가 주는 느낌 — 한난·채도·명도 평균으로 인상 태그(먼셀 명도·CIELAB 채도 기준)
function moodOf(P){
  const M=P.map(c=>{const rgb=hsl2rgb(c.h,c.s,c.l),lab=rgb2lab(rgb),h=(Math.atan2(lab.b,lab.a)*180/Math.PI+360)%360
    return { V:munsellValue(relLum(rgb)), C:Math.hypot(lab.a,lab.b), warm:Math.cos((h-50)*Math.PI/180) }})
  const avgV=(M[0].V+M[1].V+M[2].V)/3,avgC=(M[0].C+M[1].C+M[2].C)/3,avgW=(M[0].warm+M[1].warm+M[2].warm)/3
  const wc=M.filter(m=>m.warm>0.2).length,cc=M.filter(m=>m.warm<-0.2).length
  const temp=(wc>0&&cc>0)?'한난 공존':avgW>0.15?'따뜻함':avgW<-0.15?'서늘함':'중성'
  const chroma=avgC>55?'선명·활기':avgC<30?'은은·차분':'부드러움'
  const value=avgV>6.5?'밝고 경쾌':avgV<4?'묵직·깊음':'안정'
  return `${temp} · ${chroma} · ${value}`
}
const DOMWHY={ sat:'넓은 60% 바탕은 차분해야 눈이 편하고 포인트가 살아나요', light:'밝은 바탕으로 화사하고 열린 하이키 느낌을 내요', mid:'중간 명도라 어느 색과도 무난한 균형형 바탕이에요' }
// 적용 가이드 — 화면 어디에 쓸까 (주체는 기준별로 놓일 자리가 달라짐)
const DOMTIP={ sat:'빛·어둠 양쪽에 조금씩 섞는 기조색으로 — 배경·중간톤·넓은 여백에 깔아 화면을 하나로 묶어요', light:'빛 받는 밝은 면·하늘·열린 공간에 — 밝은 쪽을 지배해 화사한 하이키로', mid:'사물의 고유색(몸통)에 — 하이라이트도 그림자도 아닌 중간 명암 면을 채워요' }
const SECTIP='주체의 반대 명암을 맡아요 — 주체가 빛이면 부수는 그림자·덩어리로 짝을 이뤄 명암 뼈대를 세워요'
const ACCTIP='초점(주인공·빛과 그림자가 만나는 경계)에만 좁게 — 넓히지 말고 가장 대비 강한 한 곳에'
const DISTRIB=[['공간 · 깊이','따뜻한 역할 앞으로 · 차가운 역할 뒤로'],['시선 유도','주체로 쉬는 면 → 종속을 시선 도착점에'],['덩어리 · 실루엣','주체=큰 형태 · 부수=인접 덩어리 · 종속=구두점'],['온도 리듬','주체 면 사이에 반대 온도의 종속으로 리듬']]
function hx(h,s,l){const r=hsl2rgb(h,s,l),t=x=>x.toString(16).padStart(2,'0');return '#'+t(r[0])+t(r[1])+t(r[2])}
const warm=h=>Math.cos((h-42)*Math.PI/180)
const tint=c=>({h:c.h,s:c.s*0.5,l:c.l+(100-c.l)*0.5})
// 암청색 검정 — 순검정 대신 섞어 그림자가 죽지 않게. 셰이드=색+암청색검정 50% (RGB 혼합)
const BLACK={h:222,s:38,l:9}
const shade=c=>{const a=hsl2rgb(c.h,c.s,c.l),b=hsl2rgb(BLACK.h,BLACK.s,BLACK.l),m=i=>Math.round(a[i]*0.5+b[i]*0.5);return rgb2hsl(m(0),m(1),m(2))}
function mixHSL(a,b,t){const dh=((b.h-a.h+540)%360)-180;return {h:(a.h+dh*t+360)%360,s:a.s+(b.s-a.s)*t,l:a.l+(b.l-a.l)*t}}
function pureSub(a,b,t){const ra=hsl2rgb(a.h,a.s,a.l),rb=hsl2rgb(b.h,b.s,b.l),g=i=>Math.round(Math.pow(Math.max(ra[i],4)/255,1-t)*Math.pow(Math.max(rb[i],4)/255,t)*255);return rgb2hsl(g(0),g(1),g(2))}
function avgRGB(P){let r=0,g=0,b=0;P.forEach(c=>{const x=hsl2rgb(c.h,c.s,c.l);r+=x[0];g+=x[1];b+=x[2]});return [r/3,g/3,b/3].map(Math.round)}
const hd=(a,b)=>{let d=Math.abs(a-b)%360;return d>180?360-d:d}
function makePureAt(P,mix){return function(th){th=((th%360)+360)%360;let a,b,t;if(th<120){a=P[0];b=P[1];t=th/120}else if(th<240){a=P[1];b=P[2];t=(th-120)/120}else{a=P[2];b=P[0];t=(th-240)/120}return mix==='sub'?pureSub(a,b,t):mixHSL(a,b,t)}}

// 먼셀 색채대비 기준 분석 — CIELAB 근사. 3속성(색상·명도·채도) + 보색·한난·동시·면적.
function contrastsOf(P){
  const M=P.map(c=>{const lab=rgb2lab(hsl2rgb(c.h,c.s,c.l)),C=Math.hypot(lab.a,lab.b),h=(Math.atan2(lab.b,lab.a)*180/Math.PI+360)%360
    return { L:lab.L, C, h, warm:Math.cos((h-50)*Math.PI/180) }})
  let dL=0,dC=0,dH=0,comp=0
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){dL=Math.max(dL,Math.abs(M[i].L-M[j].L));dC=Math.max(dC,Math.abs(M[i].C-M[j].C));const dh=hd(M[i].h,M[j].h);dH=Math.max(dH,dh);comp=Math.max(comp,dh)}
  const wc=M.filter(m=>m.warm>0.2).length,cc=M.filter(m=>m.warm<-0.2).length
  const warmSpread=Math.max(...M.map(m=>m.warm))-Math.min(...M.map(m=>m.warm)),avgC=(M[0].C+M[1].C+M[2].C)/3
  const compSt=comp>=150?cl((comp-120)/60,0,1):0
  const st={ 색상:cl(dH/170,0,1), 명도:cl(dL/60,0,1), 채도:cl(dC/70,0,1), 보색:compSt, 한난:(wc>0&&cc>0)?cl(warmSpread/1.6,0,1):0, 동시:compSt*cl(avgC/60,0,1) }
  const present=[]
  if(st.색상>=0.30)present.push('색상')
  if(st.명도>=0.32)present.push('명도')
  if(st.채도>=0.30)present.push('채도')
  if(st.보색>=0.35)present.push('보색')
  if(st.한난>0)present.push('한난')
  if(st.동시>=0.30)present.push('동시')
  present.push('면적')
  const setObj=new Set(present)
  const ranked=present.filter(k=>k!=='면적').sort((a,b)=>st[b]-st[a])
  const label={색상:'색상대비',명도:'명도대비',채도:'채도대비',보색:'보색대비',한난:'한난대비',동시:'동시대비'}
  const headline=ranked.slice(0,2).map(k=>label[k]).join(' + ')||'면적대비 중심'
  const dV=Math.round(dL/10*10)/10,dh0=Math.round(dH),dCr=Math.round(dC)
  const RS={ 색상:`먼셀 색상차가 ${dh0}°로 색상대비가 또렷해요`, 명도:`먼셀 명도차 ΔV ${dV}로 명도대비가 강해요`, 채도:`채도차 ΔC ${dCr}로 선명↔차분 대비가 생겨요`, 보색:`두 색이 색상환에서 마주봐(보색) 대비가 최대예요`, 한난:`따뜻한 색 ${wc} · 차가운 색 ${cc}개라 한난대비가 또렷해요`, 동시:`고채도 보색이 인접해 동시대비로 서로 더 강해 보여요` }
  const reco=ranked.slice(0,2).map(k=>RS[k]).join('. ')||'면적으로 균형을 잡아요'
  return { headline, keys:ranked.slice(0,2), reco, chips:['색상','명도','채도','보색','한난','동시','면적'].map(k=>({k,on:setObj.has(k)})) }
}

function derive(P,mix,ratio,domCrit,accentSel,blackMix){
  const pureAt=makePureAt(P,mix),pure=[],tin=[]
  for(let i=0;i<12;i++){const p=pureAt(i*30);pure.push(p);tin.push(tint(p))}
  const gray=avgRGB(P),ctr=gray.map(v=>Math.round(v*0.5+127.5))
  const vivid=()=>{let m=-1,i0=0;P.forEach((c,i)=>{const w=(warm(c.h)+1)/2,sc=c.s/100*(0.6+0.4*w);if(sc>m){m=sc;i0=i}});return i0}
  const pick=idx=>{if(domCrit==='sat')return idx.reduce((m,i)=>P[i].s<P[m].s?i:m,idx[0]);if(domCrit==='light')return idx.reduce((m,i)=>P[i].l>P[m].l?i:m,idx[0]);return idx.reduce((m,i)=>Math.abs(P[i].l-50)<Math.abs(P[m].l-50)?i:m,idx[0])}
  let domI,secI,acc,rec=!accentSel
  if(accentSel){acc={...accentSel};domI=pick([0,1,2]);const rest=[0,1,2].filter(i=>i!==domI);secI=rest.sort((a,b)=>P[b].s-P[a].s)[0]}
  else{const ai=vivid();acc={...P[ai]};const rest=[0,1,2].filter(i=>i!==ai);domI=pick(rest);secI=rest.find(i=>i!==domI)}
  const dom=tint(P[domI]),domD={h:P[domI].h,s:P[domI].s,l:cl(P[domI].l-18,10,90)},sec=P[secI],secT=tint(P[secI])
  const domGroup=blackMix?[dom,P[domI],shade(P[domI])]:[dom,domD]
  const secGroup=blackMix?[sec,shade(P[secI])]:[sec,secT]
  const accGroup=[acc]
  const wd=ratio==='631'?[60,30,10]:[60,20,20],con=contrastsOf(P)
  const dS=Math.round(P[domI].s),dL=Math.round(P[domI].l),sHd=Math.round(hd(P[domI].h,P[secI].h)),aS=Math.round(acc.s),aHd=Math.round(hd(P[domI].h,acc.h))
  const dW=warm(P[domI].h),sW=warm(P[secI].h),aW=warm(acc.h)
  let rDom=domCrit==='sat'?`채도가 ${dS}%로 셋 중 가장 낮아, 넓게 깔아도 눈이 피로하지 않아요`:domCrit==='light'?`명도가 ${dL}%로 가장 밝아, 화면을 열어주는 바탕이 돼요`:`명도 ${dL}%의 중간 톤이라, 어떤 색과도 무난히 어울리는 바탕이에요`
  let rSec=sHd<=45?`주체와 색상이 ${sHd}°만 떨어져 톤이 이어지며 자연스럽게 받쳐줘요`:`주체와 ${sHd}° 떨어져 단조로움을 깨고 화면에 리듬을 줘요`
  if((dW>0.15&&sW<-0.15)||(dW<-0.15&&sW>0.15))rSec+=` (주체와 한난이 갈려요)`
  let rAcc=accentSel?`직접 고른 색이에요. 채도 ${aS}%로 좁게 써도 시선을 잡아요`:`추천 포인트예요. 채도 ${aS}%로 가장 선명해 10%만 써도 시선이 꽂혀요`
  if(aHd>=120)rAcc+=` — 주체의 반대편 색이라 강조가 강해요`
  else if((dW>0.15&&aW<-0.15)||(dW<-0.15&&aW>0.15))rAcc+=` — 주체와 한난 대비로 도드라져요`
  return { pureAt,pure,tin,gray,ctr,domI,secI,acc,rec,dom,sec,domGroup,secGroup,accGroup,wd,con,reasons:{rDom,rSec,rAcc} }
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
  ctx.font=`700 ${Math.round(R*0.16)}px ${FDISP}`;ctx.textAlign='center';ctx.textBaseline='middle'
  ;[0,120,240].forEach(th=>{const a=(th-90)*Math.PI/180,px=cx+Math.cos(a)*(R+R*0.11),py=cy+Math.sin(a)*(R+R*0.11)
    ctx.save();ctx.shadowColor='rgba(0,0,0,0.55)';ctx.shadowBlur=3;ctx.shadowOffsetY=1;ctx.fillStyle=cssH(D.pureAt(th));ctx.fillText('P',px,py);ctx.restore()})
}
function rrect(ctx,x,y,w,h,r){ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath()}
function drawCard(ctx,W,H,D,P,mood,ratioStr,domLabel){
  ctx.fillStyle=BG;ctx.fillRect(0,0,W,H)
  ctx.fillStyle=TX;ctx.textAlign='left';ctx.textBaseline='alphabetic'
  ctx.font='700 40px Pretendard, sans-serif';ctx.fillText('색 계획',44,74)
  ctx.fillStyle=cssH(D.acc);ctx.font=`600 18px ${FMONO}`;ctx.fillText('PIGMENT',44,104)
  drawWheelOn(ctx,W/2,300,168,D)
  const swW=200,gap=16,x0=(W-(swW*3+gap*2))/2,sy=500
  P.forEach((c,i)=>{const x=x0+i*(swW+gap);rrect(ctx,x,sy,swW,74,16);ctx.fillStyle=cssH(c);ctx.fill()
    ctx.textAlign='center';ctx.fillStyle='#EAE4F0';ctx.font=`600 22px ${FMONO}`;ctx.fillText(hx(c.h,c.s,c.l).toUpperCase(),x+swW/2,sy+106)
    ctx.fillStyle=MUT;ctx.font=`500 19px ${FMONO}`;ctx.fillText(munsell(c),x+swW/2,sy+132)})
  ctx.textAlign='left';ctx.fillStyle=TX2;ctx.font='600 24px Pretendard, sans-serif'
  ctx.fillText(`면적 ${D.wd[0]} : ${D.wd[1]} : ${D.wd[2]}`,44,690)
  const groups=[[D.domGroup,D.wd[0],'주체'],[D.secGroup,D.wd[1],'부수'],[D.accGroup,D.wd[2],'종속']]
  const barX=44,barY=712,barW=W-88,barH=96;let cx=barX
  groups.forEach(g=>{const segW=barW*g[1]/100,each=segW/g[0].length
    g[0].forEach((c,j)=>{ctx.fillStyle=cssH(c);ctx.fillRect(cx+j*each,barY,each+0.5,barH)});cx+=segW})
  cx=barX;groups.forEach(g=>{const segW=barW*g[1]/100;ctx.fillStyle=TX2;ctx.font='600 22px Pretendard, sans-serif';ctx.textAlign='center';ctx.fillText(`${g[2]} ${g[1]}%`,cx+segW/2,barY+barH+34);cx+=segW})
  ctx.textAlign='left';ctx.fillStyle=TX2;ctx.font='500 23px Pretendard, sans-serif';ctx.fillText(`느낌 · ${mood}`,44,884)
  ctx.fillStyle=cssH(D.acc);ctx.font='700 30px Pretendard, sans-serif';ctx.fillText(`추천 대비 · ${D.con.headline}`,44,922)
  ctx.fillStyle=MUT;ctx.font='500 21px Pretendard, sans-serif';ctx.fillText(`면적 ${ratioStr} · 주체 ${domLabel} 기준`,44,954)
}

export default function PalettePlanner({ initial, role, saving, onClose, onSave }){
  const [P,setP]=useState(()=> initial?.primaries?.length===3 ? initial.primaries.map(c=>({...c})) : DEF.map(c=>({...c})))
  const [act,setAct]=useState(0)
  const [mix,setMix]=useState(initial?.mix==='bright'?'bright':'sub')
  const [ratio,setRatio]=useState(initial?.ratio==='622'?'622':'631')
  const [domCrit,setDomCrit]=useState(['sat','light','mid'].includes(initial?.domCrit)?initial.domCrit:'sat')
  const [accentSel,setAccentSel]=useState(()=> initial?.accentManual && initial?.accent ? {...initial.accent} : null)
  const [guideOpen,setGuideOpen]=useState(false)
  const [blackMix,setBlackMix]=useState(()=> initial?.blackMix!==false)
  const cv=useRef(null)

  const D=useMemo(()=>derive(P,mix,ratio,domCrit,accentSel,blackMix),[P,mix,ratio,domCrit,accentSel,blackMix])
  const mood=useMemo(()=>moodOf(P),[P])

  useEffect(()=>{ const c=cv.current; if(!c)return; drawWheelOn(c.getContext('2d'),120,120,100,D) },[D])

  const setField=(f,v)=>setP(prev=>prev.map((c,i)=>i===act?{...c,[f]:v}:c))
  const brickSel=c=>accentSel&&Math.abs(accentSel.h-c.h)<0.6&&Math.abs(accentSel.l-c.l)<0.6&&Math.abs(accentSel.s-c.s)<0.6

  async function save(){
    const domLabel=domCrit==='sat'?'저채도':domCrit==='light'?'최고명도':'중명도'
    const ratioStr=ratio==='631'?'6:3:1':'6:2:2'
    const c=document.createElement('canvas');c.width=720;c.height=1000
    drawCard(c.getContext('2d'),720,1000,D,P,mood,ratioStr,domLabel)
    const blob=await new Promise(res=>c.toBlob(res,'image/png'))
    const palette={ v:1, primaries:P, mix, ratio, domCrit, blackMix, accentManual:!!accentSel, accent:D.acc,
      hex:[...P.map(p=>hx(p.h,p.s,p.l)), hx(D.acc.h,D.acc.s,D.acc.l)], munsell:P.map(munsell), mood, contrasts:D.con.keys }
    const note=`🎨 색 계획\n· 느낌: ${mood}\n· 추천 대비: ${D.con.headline}\n· 면적 ${ratioStr} · 주체 ${domLabel} 기준`
    onSave(blob,palette,note)
  }

  const accent=cssH(D.acc)
  const section={ background:PANEL, border:`1px solid ${BORD}`, borderRadius:24, padding:'20px 16px 18px', margin:'0 15px 14px' }
  const eb={ font:`600 10px ${FMONO}`, letterSpacing:'0.18em', textTransform:'uppercase', color:accent }
  const eyeRow={ display:'flex', alignItems:'baseline', gap:9 }
  const h2s={ margin:'7px 0 0', font:`700 21px/1.1 ${FSANS}`, color:TX, letterSpacing:'-0.01em' }
  const dash={ font:`500 11px ${FSANS}`, color:DIM }
  const pill=(on)=>({ padding:'8px 14px', borderRadius:99, font:`600 12px ${FSANS}`, cursor:'pointer', border:`1px solid ${on?'transparent':BORD2}`, background:on?'#EFEAF4':'transparent', color:on?'#17131e':'#8f8799' })
  const pillM=(on)=>({ padding:'8px 12px', borderRadius:10, font:`700 12px ${FMONO}`, cursor:'pointer', border:`1px solid ${on?'transparent':BORD2}`, background:on?'#EFEAF4':'transparent', color:on?'#17131e':'#8f8799' })
  const modeBtn=(on)=>({ flex:1, textAlign:'center', padding:'10px 0', borderRadius:12, cursor:'pointer', border:`1px solid ${on?'transparent':BORD2}`, background:on?'#EFEAF4':'transparent', color:on?'#17131e':'#8f8799', font:`600 13px ${FSANS}` })
  const pctf=(v,mn,mx)=>Math.round((v-mn)/(mx-mn)*100)

  return (
    <div className="pp-overlay" style={{ position:'fixed', inset:0, zIndex:1500, overflowY:'auto', display:'flex', justifyContent:'center',
      background:'radial-gradient(120% 80% at 50% -10%, #17121d 0%, #0a0810 45%, #050406 100%)' }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:ital,wght@0,600;0,700;1,500&family=JetBrains+Mono:wght@400;500;600;700&display=swap');@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
        .pp-range{-webkit-appearance:none;appearance:none;height:7px;border-radius:99px;outline:none;cursor:pointer}
        .pp-range::-webkit-slider-thumb{-webkit-appearance:none;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 1px 4px rgba(0,0,0,.5);cursor:pointer}
        .pp-range::-moz-range-thumb{width:18px;height:18px;border-radius:50%;background:#fff;border:none;box-shadow:0 1px 4px rgba(0,0,0,.5);cursor:pointer}
        .pp-range::-moz-range-track{background:transparent}
        .pp-sc::-webkit-scrollbar{width:0;height:0}
        .pp-sc button{transition:transform .13s cubic-bezier(.34,1.4,.64,1),filter .15s,box-shadow .2s}
        @media(hover:hover){.pp-sc button:hover{filter:brightness(1.08)}}
        .pp-sc button:active{transform:scale(.93)}
        .pp-seg{transition:flex-grow .35s cubic-bezier(.22,1,.36,1)}
        .pp-reveal{animation:pp-rev .3s cubic-bezier(.22,1,.36,1)}
        @keyframes pp-rev{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:none}}
        .pp-overlay{animation:pp-fade .28s ease}
        @keyframes pp-fade{from{opacity:0}to{opacity:1}}`}</style>

      <div className="pp-sc" style={{ width:406, maxWidth:'100%', minHeight:'100%', background:BG, borderLeft:`1px solid rgba(255,255,255,0.06)`, borderRight:`1px solid rgba(255,255,255,0.06)`, display:'flex', flexDirection:'column', fontFamily:FSANS }}>

        <div style={{ position:'sticky', top:0, zIndex:5, background:'rgba(14,10,18,0.9)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', borderBottom:`1px solid ${BORD}`, display:'flex', alignItems:'center', gap:11, padding:'14px 16px' }}>
          <button onClick={onClose} aria-label="닫기" style={{ width:34, height:34, borderRadius:'50%', border:`1px solid ${BORD2}`, background:'transparent', color:TX2, fontSize:15, cursor:'pointer', flexShrink:0 }}>✕</button>
          <div style={{ display:'flex', alignItems:'center', gap:9, flex:1, minWidth:0 }}>
            <div style={{ width:16, height:16, borderRadius:5, background:`conic-gradient(${cssH(P[0])},${cssH(P[1])},${cssH(P[2])},${cssH(P[0])})` }}/>
            <span style={{ font:`600 12px ${FMONO}`, letterSpacing:'0.14em', color:'#C9C3D2' }}>PIGMENT</span>
          </div>
          <button onClick={save} disabled={saving}
            style={{ padding:'9px 16px', borderRadius:11, border:'none', cursor: saving?'default':'pointer', font:`600 13px ${FSANS}`, background: saving?'#3a3540':'#EFEAF4', color: saving?'#8f8799':'#17131e' }}>
            {saving?'저장 중…':'저장'}
          </button>
        </div>

        <div style={{ padding:'14px 0 0' }}>

          <section style={section}>
            <div style={eb}>Color Wheel</div>
            <h2 style={h2s}>{mix==='sub'?'물감식 감산 ':'밝은 보간 '}<span style={{ fontFamily:FDISP, fontStyle:'italic', fontWeight:500, color:'#9B6FD4' }}>색상환</span></h2>
            <div style={{ display:'flex', gap:8, marginTop:14 }}>
              <button onClick={()=>setMix('sub')} style={modeBtn(mix==='sub')}>물감식 감산</button>
              <button onClick={()=>setMix('bright')} style={modeBtn(mix==='bright')}>밝은 보간</button>
            </div>
            <div style={{ marginTop:14, background:WHEEL, border:`1px solid rgba(255,255,255,0.05)`, borderRadius:20, padding:'12px 0', display:'flex', justifyContent:'center' }}>
              <canvas ref={cv} width={240} height={240} style={{ width:240, height:240, maxWidth:'100%', display:'block' }}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px 14px', marginTop:16 }}>
              {[['바깥 · 순색',cssH(D.pureAt(0))],['중간 · +화이트50%',cssH(tint(D.pureAt(0)))],['띠 · 3원색 순회색',cssR(D.gray)],['중앙 · 회색+화이트',cssR(D.ctr)]].map(([t,bg])=>(
                <div key={t} style={{ display:'flex', alignItems:'center', gap:9 }}>
                  <span style={{ width:14, height:14, borderRadius:4, background:bg, flexShrink:0 }}/>
                  <span style={{ font:`500 12px ${FSANS}`, color:TX2 }}>{t}</span>
                </div>
              ))}
            </div>
          </section>

          <section style={section}>
            <div style={eyeRow}><div style={eb}>Primaries</div><span style={dash}>— 탭해서 조절</span></div>
            <h2 style={h2s}>3원색 <span style={{ fontFamily:FDISP, color:'#6f6879', fontWeight:600 }}>(P)</span></h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginTop:16 }}>
              {P.map((c,i)=>(
                <button key={i} onClick={()=>setAct(i)} style={{ border:'none', background:'none', padding:0, cursor:'pointer', textAlign:'left' }}>
                  <div style={{ height:94, borderRadius:16, background:cssH(c), boxShadow: act===i?`0 0 0 2px ${cssH(c)}, 0 0 0 4px ${cssHA(c,0.28)}`:'none' }}/>
                  <div style={{ marginTop:10, font:`600 12px ${FMONO}`, color:'#EAE4F0' }}>{hx(c.h,c.s,c.l).toUpperCase()}</div>
                  <div style={{ marginTop:3, font:`500 11px ${FMONO}`, color:MUT }}>{munsell(c)}</div>
                </button>
              ))}
            </div>
            <div style={{ textAlign:'center', marginTop:14, font:`500 11px ${FSANS}`, color:'#6a6374' }}>표기 = 먼셀 H V/C <span style={{ color:'#4f4959' }}>(명도 정확 · 색상·채도 근사)</span></div>
            <div style={{ marginTop:14, background:INSET, border:`1px solid rgba(255,255,255,0.05)`, borderRadius:16, padding:16, display:'flex', flexDirection:'column', gap:15 }}>
              {[['색상','h',0,360],['채도','s',5,95],['명도','l',8,92]].map(([lab,f,mn,mx])=>{const v=Math.round(P[act][f]),p=pctf(v,mn,mx);return (
                <div key={f} style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <span style={{ width:34, font:`600 12px ${FSANS}`, color:'#9a92a4' }}>{lab}</span>
                  <input className="pp-range" type="range" min={mn} max={mx} step={1} value={v} onChange={e=>setField(f,+e.target.value)}
                    style={{ flex:1, background:`linear-gradient(to right, ${accent} 0%, ${accent} ${p}%, #2a2431 ${p}%)` }}/>
                </div>
              )})}
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:14 }}>
              {Object.keys(KW).map(k=>(<button key={k} onClick={()=>{ setP(KW[k].map(c=>({...c}))); setAccentSel(null) }} style={pill(false)}>{k}</button>))}
            </div>
          </section>

          <section style={section}>
            <div style={eyeRow}><div style={eb}>Contrast</div><span style={dash}>— 먼셀 색채대비 기준</span></div>
            <h2 style={h2s}>추천 대비</h2>
            <div style={{ marginTop:14, background:INSET, border:`1px solid rgba(255,255,255,0.05)`, borderRadius:16, padding:16 }}>
              <div style={{ font:`500 12px ${FSANS}`, color:'#8a8294' }}>색채 느낌 · {mood}</div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginTop:12 }}>
                <span style={{ width:12, height:12, borderRadius:'50%', background:accent, flex:'none' }}/>
                <span style={{ font:`700 17px ${FSANS}`, color:TX }}>{D.con.headline}</span>
              </div>
              <p style={{ margin:'12px 0 0', font:`500 13px/1.65 ${FSANS}`, color:'#9a92a4' }}>{D.con.reco}</p>
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginTop:14 }}>
              {D.con.chips.map(ch=>(<span key={ch.k} style={pill(ch.on)}>{ch.k}대비</span>))}
            </div>
          </section>

          <section style={section}>
            <div style={eyeRow}><div style={eb}>Bricks</div><span style={dash}>— 탭하면 종속(포인트)</span></div>
            <h2 style={h2s}>벽돌 팔레트</h2>
            <div style={{ marginTop:16, font:`600 11px ${FMONO}`, letterSpacing:'0.06em', color:MUT }}>순색</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:7, marginTop:9 }}>
              {D.pure.map((c,i)=><button key={'p'+i} onClick={()=>setAccentSel({h:c.h,s:c.s,l:c.l})} style={{ height:46, borderRadius:9, border:'none', background:cssH(c), cursor:'pointer', padding:0, boxShadow: brickSel(c)?`0 0 0 2px ${BG}, 0 0 0 4px #F0ECF4`:'none' }}/>)}
            </div>
            <div style={{ marginTop:18, font:`600 11px ${FMONO}`, letterSpacing:'0.06em', color:MUT }}>틴트 · +화이트 50%</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:7, marginTop:9 }}>
              {D.tin.map((c,i)=><button key={'t'+i} onClick={()=>setAccentSel({h:c.h,s:c.s,l:c.l})} style={{ height:46, borderRadius:9, border:'none', background:cssH(c), cursor:'pointer', padding:0, boxShadow: brickSel(c)?`0 0 0 2px ${BG}, 0 0 0 4px #F0ECF4`:'none' }}/>)}
            </div>
          </section>

          <section style={section}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
              <div><div style={eb}>Value · Shade</div><h2 style={h2s}>명암 분석</h2></div>
              <button onClick={()=>setBlackMix(v=>!v)} style={{ ...pill(blackMix), padding:'8px 13px', flex:'none' }}>암청색 검정 {blackMix?'ON':'OFF'}</button>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginTop:14 }}>
              <span style={{ width:26, height:26, borderRadius:7, background:cssH(BLACK), flex:'none', border:`1px solid ${BORD2}` }}/>
              <div style={{ minWidth:0 }}>
                <div style={{ font:`600 11px ${FMONO}`, color:'#c9c3d2' }}>{hx(BLACK.h,BLACK.s,BLACK.l).toUpperCase()} · 암청색 검정 <span style={{ color:MUT }}>{munsell(BLACK)}</span></div>
                <div style={{ font:`500 11px ${FSANS}`, color:'#8a8294', marginTop:2 }}>순검정 대신 섞으면 그림자가 죽지 않고 깊어져요</div>
              </div>
            </div>
            <div style={{ marginTop:15, display:'grid', gridTemplateColumns: blackMix?'30px 1fr 1fr 1fr':'30px 1fr 1fr', gap:'10px 7px', alignItems:'center' }}>
              <div/>
              {blackMix && <div style={{ font:`600 10px ${FMONO}`, letterSpacing:'0.05em', color:MUT }}>셰이드</div>}
              <div style={{ font:`600 10px ${FMONO}`, letterSpacing:'0.05em', color:MUT }}>순색</div>
              <div style={{ font:`600 10px ${FMONO}`, letterSpacing:'0.05em', color:MUT }}>틴트</div>
              {P.map((c,i)=>{const cells=blackMix?[shade(c),c,tint(c)]:[c,tint(c)];return (
                <Fragment key={i}>
                  <div style={{ font:`700 11px ${FMONO}`, color:TX2 }}>P{i+1}</div>
                  {cells.map((cc,j)=>(
                    <button key={j} onClick={()=>setAccentSel({h:cc.h,s:cc.s,l:cc.l})} style={{ border:'none', background:'none', padding:0, cursor:'pointer', textAlign:'left' }}>
                      <div style={{ height:38, borderRadius:8, background:cssH(cc), boxShadow: brickSel(cc)?`0 0 0 2px ${BG}, 0 0 0 4px #F0ECF4`:'none' }}/>
                      <div style={{ marginTop:5, font:`600 10px ${FMONO}`, color:'#c9c3d2' }}>{hx(cc.h,cc.s,cc.l).toUpperCase()}</div>
                      <div style={{ marginTop:1, font:`500 9.5px ${FMONO}`, color:MUT }}>{munsell(cc)}</div>
                    </button>
                  ))}
                </Fragment>
              )})}
            </div>
          </section>

          <section style={section}>
            <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
              <div><div style={eb}>Area</div><h2 style={h2s}>면적 구성</h2></div>
              <div style={{ display:'flex', gap:6, flex:'none' }}>
                <button onClick={()=>setRatio('631')} style={pillM(ratio==='631')}>6:3:1</button>
                <button onClick={()=>setRatio('622')} style={pillM(ratio==='622')}>6:2:2</button>
              </div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:16, flexWrap:'wrap' }}>
              <span style={{ font:`600 12px ${FSANS}`, color:MUT }}>주체 기준</span>
              {[['sat','저채도'],['light','최고명도'],['mid','중명도']].map(([k,lab])=>(<button key={k} onClick={()=>setDomCrit(k)} style={{ ...pill(domCrit===k), padding:'7px 13px' }}>{lab}</button>))}
            </div>
            <div style={{ marginTop:12, font:`500 12px ${FSANS}`, color:'#8a8294', lineHeight:1.55 }}><span style={{ color:accent }}>ⓘ</span> {DOMWHY[domCrit]}</div>
            <div style={{ marginTop:14 }}>
              <div style={{ display:'flex', gap:6, height:78 }}>
                {[[D.domGroup,D.wd[0]],[D.secGroup,D.wd[1]],[D.accGroup,D.wd[2]]].map((g,gi)=>(
                  <div key={gi} className="pp-seg" style={{ flex:g[1], display:'flex', borderRadius:12, overflow:'hidden' }}>
                    {g[0].map((c,j)=><div key={j} style={{ flex:1, background:cssH(c) }}/>)}
                  </div>
                ))}
              </div>
              <div style={{ display:'flex', gap:6, marginTop:8, textAlign:'center' }}>
                {[['주체',D.wd[0],false],['부수',D.wd[1],false],['종속',D.wd[2],true]].map(([n,w,ac],i)=>(<div key={i} style={{ flex:w, font:`600 ${ac?10:11}px ${FSANS}`, color: ac?accent:TX2 }}>{n} {w}%</div>))}
              </div>
              {blackMix && <div style={{ marginTop:9, display:'flex', alignItems:'center', gap:6, font:`500 11px ${FSANS}`, color:'#8a8294' }}><span style={{ width:8, height:8, borderRadius:2, background:accent, flexShrink:0 }}/>주체·부수 그림자 = 암청색 검정 셰이드로 깊게</div>}
            </div>
            <div style={{ marginTop:16, background:INSET, border:`1px solid rgba(255,255,255,0.05)`, borderRadius:16, padding:16 }}>
              <div style={{ font:`700 13px ${FSANS}`, color:'#cfc8d8' }}>이렇게 나눈 이유</div>
              {[['주체',cssH(D.dom),D.reasons.rDom],['부수',cssH(D.sec),D.reasons.rSec],['종속',cssH(D.acc),D.reasons.rAcc]].map((r,i)=>(
                <div key={i} style={{ display:'flex', gap:11, marginTop:14 }}>
                  <span style={{ width:16, height:16, borderRadius:5, background:r[1], flex:'none', marginTop:2 }}/>
                  <div style={{ minWidth:0 }}>
                    <div style={{ font:`700 13px ${FSANS}`, color:'#eae4f0' }}>{r[0]}</div>
                    <div style={{ marginTop:3, font:`500 12.5px/1.6 ${FSANS}`, color:'#948c9e' }}>{r[2]}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section style={section}>
            <button onClick={()=>setGuideOpen(v=>!v)} style={{ width:'100%', textAlign:'left', background:'none', border:'none', padding:0, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div><div style={eyeRow}><div style={eb}>Guide</div><span style={dash}>— 화면 어디에 쓸까</span></div><h2 style={h2s}>적용 가이드</h2></div>
              <span style={{ color:MUT, fontSize:12, flexShrink:0, marginLeft:10 }}>{guideOpen?'▲':'▼'}</span>
            </button>
            {guideOpen && (<div className="pp-reveal">
              <div style={{ marginTop:16, display:'flex', flexDirection:'column', gap:14 }}>
                {[['주체',D.dom,DOMTIP[domCrit]],['부수',D.sec,SECTIP],['종속',D.acc,ACCTIP]].map(([name,c,tip],i)=>(
                  <div key={i}>
                    <span style={{ display:'inline-block', padding:'5px 11px', borderRadius:99, background:cssHA(c,0.18), color:cssH(c), font:`700 11px ${FSANS}` }}>{name}</span>
                    <p style={{ margin:'9px 0 0', font:`500 13px/1.65 ${FSANS}`, color:'#9a92a4' }}>{tip}</p>
                  </div>
                ))}
              </div>
              <div style={{ height:1, background:BORD, margin:'18px 0' }}/>
              <div style={{ font:`600 11px ${FMONO}`, letterSpacing:'0.06em', color:MUT }}>다른 배분 방식</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:9, marginTop:11 }}>
                {DISTRIB.map(([title,desc],i)=>(
                  <div key={i} style={{ background:INSET, border:`1px solid rgba(255,255,255,0.05)`, borderRadius:14, padding:13 }}>
                    <div style={{ font:`700 11px ${FMONO}`, color:accent }}>{String(i+1).padStart(2,'0')}</div>
                    <div style={{ marginTop:6, font:`700 13px ${FSANS}`, color:'#eae4f0' }}>{title}</div>
                    <div style={{ marginTop:5, font:`500 12px/1.55 ${FSANS}`, color:'#8a8294' }}>{desc}</div>
                  </div>
                ))}
              </div>
            </div>)}
          </section>

        </div>

        <div style={{ position:'sticky', bottom:0, marginTop:'auto', background:'rgba(14,10,18,0.86)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)', borderTop:`1px solid ${BORD}`, padding:'15px 20px', display:'flex', alignItems:'center', gap:13 }}>
          <span style={{ width:34, height:34, borderRadius:10, background:accent, flex:'none', boxShadow:`0 0 20px ${cssHA(D.acc,0.4)}` }}/>
          <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap', minWidth:0 }}>
            <span style={{ font:`600 12px ${FMONO}`, color:MUT, letterSpacing:'0.08em' }}>포인트</span>
            <span style={{ font:`700 15px ${FMONO}`, color:TX }}>{hx(D.acc.h,D.acc.s,D.acc.l).toUpperCase()}</span>
            <span style={{ font:`500 12px ${FMONO}`, color:MUT }}>· {munsell(D.acc)}</span>
          </div>
          {accentSel && <button onClick={()=>setAccentSel(null)} style={{ marginLeft:'auto', ...pill(false), padding:'7px 12px', flexShrink:0 }}>↺ 추천</button>}
        </div>

      </div>
    </div>
  )
}
