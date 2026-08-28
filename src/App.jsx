import React, { useState, useMemo, useRef, useEffect } from "react";
import { Sunrise, CalendarDays, Settings as SettingsIcon, ChevronLeft, ChevronRight, Check, Plus, X, RefreshCw, ArrowLeft, Search, Info, Flame, Volume2, VolumeX } from "lucide-react";
import { supabase } from "./lib/supabase.js";

let POSES=[];



/* ---------- helpers ---------- */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
const LEVEL_LABEL={Easy:"Beginner",Medium:"Intermediate",Hard:"Expert"};
function levelAllows(level,p){
  if(level==="Easy") return p.levels.includes("Beginner");
  if(level==="Medium") return p.levels.includes("Beginner")||p.levels.includes("Intermediate");
  return true;
}
const GENTLE=["Restorative Yoga","Forward Bend Yoga","Seated Yoga"];
const pad2=n=>String(n).padStart(2,"0");
const todayKey=(d=new Date())=>`${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
function daysAgoKey(n){const d=new Date();d.setDate(d.getDate()-n);return todayKey(d);}
function currentStreak(sessions){
  const set=new Set(sessions.filter(s=>s.poseIds&&s.poseIds.length>0).map(s=>s.date));
  let count=0;const d=new Date();
  if(!set.has(todayKey(d)))d.setDate(d.getDate()-1);
  while(set.has(todayKey(d))){count++;d.setDate(d.getDate()-1);}
  return count;
}

function recommend({level,recentIds,sessions,seed}){
  const rng=mulberry32(seed>>>0);
  const allowed=POSES.filter(p=>levelAllows(level,p));
  // category load over the last 7 days
  const cutoff=daysAgoKey(7);
  const recentSessions=sessions.filter(s=>s.date>=cutoff);
  const doneIds=new Set(recentSessions.flatMap(s=>s.poseIds));
  const catLoad={};
  recentSessions.forEach(s=>s.poseIds.forEach(id=>{
    const p=POSES.find(x=>x.id===id); if(!p)return;
    p.categories.forEach(c=>{catLoad[c]=(catLoad[c]||0)+1;});
  }));
  const allCats=[...new Set(allowed.flatMap(p=>p.categories))];
  const deficit=new Set([...allCats].sort((a,b)=>(catLoad[a]||0)-(catLoad[b]||0)).slice(0,5));
  const topDone=Object.keys(catLoad).sort((a,b)=>catLoad[b]-catLoad[a])[0];

  const used=new Set();
  const avoid=(p)=>used.has(p.id)||recentIds.includes(p.id);
  function weightedPick(pool,scorer){
    const cand=pool.filter(p=>!avoid(p));
    const list=(cand.length?cand:pool.filter(p=>!used.has(p.id)));
    if(!list.length)return null;
    const weights=list.map(scorer);
    const total=weights.reduce((a,b)=>a+b,0)||1;
    let r=rng()*total;
    for(let i=0;i<list.length;i++){r-=weights[i];if(r<=0){used.add(list[i].id);return list[i];}}
    const last=list[list.length-1];used.add(last.id);return last;
  }
  const gentlePool=allowed.filter(p=>p.categories.some(c=>GENTLE.includes(c))||p.levels.includes("Beginner"));
  const warm=weightedPick(gentlePool,p=>(p.levels.includes("Beginner")?3:1)+(doneIds.has(p.id)?0:.5));
  const topLvl=LEVEL_LABEL[level];
  const mains=[];
  const mainCount=level==="Hard"?3:level==="Medium"?3:2;
  for(let i=0;i<mainCount;i++){
    const m=weightedPick(allowed,p=>{
      let s=1;
      if(p.categories.some(c=>deficit.has(c)))s*=3;
      if(p.levels.includes(topLvl))s*=2;
      if(doneIds.has(p.id))s*=0.35;
      return s;
    });
    if(m)mains.push(m);
  }
  const coolPool=allowed.filter(p=>p.categories.some(c=>GENTLE.includes(c)));
  const cool=weightedPick(coolPool.length?coolPool:gentlePool,p=>(p.categories.includes("Restorative Yoga")?3:1));

  const seq=[warm,...mains,cool].filter(Boolean);
  // rationale
  const mainCats=[...new Set(mains.flatMap(p=>p.categories.filter(c=>deficit.has(c))))].slice(0,2);
  let rationale;
  if(recentSessions.length===0){
    rationale=`A balanced ${topLvl.toLowerCase()} flow to begin with. Log a few sessions and this shifts toward whatever you have been skipping.`;
  }else{
    const focus=mainCats.length?mainCats.map(c=>c.replace(" Yoga","")).join(" and "):"a rounded mix";
    rationale=`You have leaned into ${(topDone||"standing").replace(" Yoga","")} lately, so today opens toward ${focus}. Gentle to start, a fold to finish.`;
  }
  return {seq,rationale};
}

/* ---------- audio engine (generated, no files) ---------- */
class AudioEngine{
  constructor(){this.ctx=null;this.master=null;this.pad=null;this.breath=null;}
  ensure(){
    if(this.ctx){if(this.ctx.state==="suspended")this.ctx.resume().catch(()=>{});return true;}
    try{
      const AC=window.AudioContext||window.webkitAudioContext;if(!AC)return false;
      this.ctx=new AC();
      this.master=this.ctx.createGain();this.master.gain.value=0.9;this.master.connect(this.ctx.destination);
      return true;
    }catch(e){this.ctx=null;return false;}
  }
  startPad(){
    if(!this.ensure()||this.pad)return;
    try{
      const ctx=this.ctx;
      const g=ctx.createGain();g.gain.value=0;g.connect(this.master);
      const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=550;lp.Q.value=0.5;lp.connect(g);
      const specs=[[110,"sine",0.5],[164.81,"triangle",0.26],[220,"triangle",0.2]];
      const oscs=specs.map(([f,type,vol])=>{
        const o=ctx.createOscillator();o.type=type;o.frequency.value=f;
        const og=ctx.createGain();og.gain.value=vol;o.connect(og);og.connect(lp);o.start();return o;
      });
      const lfo=ctx.createOscillator();lfo.frequency.value=0.05;
      const lfoGain=ctx.createGain();lfoGain.gain.value=160;lfo.connect(lfoGain);lfoGain.connect(lp.frequency);lfo.start();
      g.gain.linearRampToValueAtTime(0.13,ctx.currentTime+3);
      this.pad={g,oscs,lfo};
    }catch(e){}
  }
  stopPad(){
    if(!this.pad||!this.ctx)return;
    try{
      const ctx=this.ctx,{g,oscs,lfo}=this.pad;
      g.gain.cancelScheduledValues(ctx.currentTime);g.gain.setValueAtTime(g.gain.value,ctx.currentTime);
      g.gain.linearRampToValueAtTime(0,ctx.currentTime+1.2);
      const s=ctx.currentTime+1.4;oscs.forEach(o=>{try{o.stop(s);}catch(e){}});try{lfo.stop(s);}catch(e){}
    }catch(e){}
    this.pad=null;
  }
  breathStart(){
    if(!this.ensure()||this.breath)return;
    try{
      const ctx=this.ctx;
      const g=ctx.createGain();g.gain.value=0;g.connect(this.master);
      const lp=ctx.createBiquadFilter();lp.type="lowpass";lp.frequency.value=800;lp.connect(g);
      const o1=ctx.createOscillator();o1.type="sine";o1.frequency.value=110;
      const o2=ctx.createOscillator();o2.type="sine";o2.frequency.value=164.81;
      const g2=ctx.createGain();g2.gain.value=0.45;o1.connect(lp);o2.connect(g2);g2.connect(lp);
      o1.start();o2.start();this.breath={g,o1,o2};
    }catch(e){}
  }
  breathPhase(name,durMs){
    if(!this.breath||!this.ctx)return;
    try{
      const ctx=this.ctx,g=this.breath.g.gain,now=ctx.currentTime,dur=durMs/1000;
      g.cancelScheduledValues(now);g.setValueAtTime(g.value,now);
      if(name==="Breathe in")g.linearRampToValueAtTime(0.16,now+dur*0.95);
      else if(name==="Hold")g.linearRampToValueAtTime(0.16,now+0.2);
      else g.linearRampToValueAtTime(0.0001,now+Math.min(dur*0.95,dur));
    }catch(e){}
  }
  breathStop(){
    if(!this.breath||!this.ctx)return;
    try{
      const ctx=this.ctx,{g,o1,o2}=this.breath;
      g.gain.cancelScheduledValues(ctx.currentTime);g.gain.setValueAtTime(g.gain.value,ctx.currentTime);
      g.gain.linearRampToValueAtTime(0,ctx.currentTime+0.6);
      const s=ctx.currentTime+0.8;try{o1.stop(s);}catch(e){}try{o2.stop(s);}catch(e){}
    }catch(e){}
    this.breath=null;
  }
}
const audio=new AudioEngine();

/* ---------- local storage (per device) ---------- */
const LS={
  getSound(){try{return localStorage.getItem("sp_sound")==="1";}catch(e){return false;}},
  setSound(v){try{localStorage.setItem("sp_sound",v?"1":"0");}catch(e){}},
  getRecent(){try{return JSON.parse(localStorage.getItem("sp_recent")||"[]");}catch(e){return [];}},
  setRecent(a){try{localStorage.setItem("sp_recent",JSON.stringify(a.slice(-30)));}catch(e){}},
  getPoses(){try{return JSON.parse(localStorage.getItem("sp_poses")||"null");}catch(e){return null;}},
  setPoses(p){try{localStorage.setItem("sp_poses",JSON.stringify(p));}catch(e){}},
};

/* ---------- small UI atoms ---------- */
function BreatheMark({size=180,label=true}){
  return (
    <div style={{position:"relative",width:size,height:size,display:"grid",placeItems:"center"}}>
      <div className="ys-ring ys-breathe" style={{position:"absolute",width:size,height:size,borderColor:"var(--glow)",opacity:.5}}/>
      <div className="ys-ring ys-breathe" style={{position:"absolute",width:size*.7,height:size*.7,animationDelay:".2s"}}/>
      <div className="ys-ring ys-breathe" style={{position:"absolute",width:size*.42,height:size*.42,animationDelay:".4s",borderColor:"var(--pine)"}}/>
      {label&&<span style={{fontSize:12,color:"var(--muted)",letterSpacing:".18em",textTransform:"uppercase"}}>breathe</span>}
    </div>
  );
}
function Chip({children}){return <span className="ys-chip">{children}</span>;}

function PoseThumb({pose,size=64}){
  return <img className="ys-img" src={pose.img} alt={pose.name} width={size} height={size}
    style={{width:size,height:size,padding:6,border:"1px solid var(--line)"}}
    onError={e=>{e.currentTarget.style.opacity=.25;}}/>;
}

/* ---------- Splash ---------- */
function Splash({onBegin}){
  return (
    <div className="ys-root" style={{minHeight:"100dvh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24,textAlign:"center"}}>
      <div className="ys-fade"><BreatheMark size={210}/></div>
      <div className="ys-fade" style={{animationDelay:".15s"}}>
        <h1 className="ys-serif" style={{fontSize:44,fontWeight:500,margin:"22px 0 6px",letterSpacing:"-.01em"}}>Stillpoint</h1>
        <p style={{color:"var(--muted)",fontSize:15,maxWidth:260,margin:"0 auto 30px"}}>A quiet daily yoga practice, shaped around what you actually do.</p>
      </div>
      <button className="ys-btn ys-press ys-fade" onClick={onBegin} style={{animationDelay:".3s",background:"var(--pine)",color:"#fff",padding:"14px 40px",borderRadius:999,fontSize:16,fontWeight:600}}>Begin</button>
    </div>
  );
}

/* ---------- Login ---------- */
function Login(){
  const [email,setEmail]=useState("");
  const [pw,setPw]=useState("");
  const [err,setErr]=useState("");
  const [busy,setBusy]=useState(false);
  async function signIn(){
    if(busy)return;
    setBusy(true);setErr("");
    const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password:pw});
    if(error){setErr("That email and password did not match.");setBusy(false);}
  }
  return (
    <div className="ys-root" style={{minHeight:"100dvh",display:"flex",flexDirection:"column",justifyContent:"center",padding:"24px 22px"}}>
      <div style={{maxWidth:400,margin:"0 auto",width:"100%"}}>
        <div style={{display:"flex",justifyContent:"center",marginBottom:20}}><BreatheMark size={120} label={false}/></div>
        <h2 className="ys-serif" style={{fontSize:26,fontWeight:500,textAlign:"center",margin:"0 0 4px"}}>Welcome back</h2>
        <p style={{color:"var(--muted)",textAlign:"center",fontSize:14,margin:"0 0 26px"}}>Sign in to pick up your practice.</p>
        <div style={{display:"flex",flexDirection:"column",gap:12}}>
          <input className="ys-in" value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email" type="email" autoComplete="email"/>
          <input className="ys-in" type="password" value={pw} onChange={e=>setPw(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")signIn();}} placeholder="Password" autoComplete="current-password"/>
          {err&&<p style={{color:"var(--rose)",fontSize:13,margin:"2px 2px 0"}}>{err}</p>}
          <button className="ys-btn ys-press" onClick={signIn} disabled={busy} style={{background:"var(--pine)",color:"#fff",padding:"14px",borderRadius:14,fontSize:16,fontWeight:600,marginTop:6,opacity:busy?.6:1}}>{busy?"Signing in\u2026":"Sign in"}</button>
        </div>
        <p style={{color:"var(--muted)",fontSize:12,textAlign:"center",marginTop:18,lineHeight:1.5}}>Accounts are created for you in Supabase. Each person only ever sees their own practice, enforced by row-level security.</p>
      </div>
    </div>
  );
}

/* ---------- Pose viewer (sequence carousel) ---------- */
function Viewer({seq,startIndex=0,onClose,title,onLogPoses,sound,setSound}){
  const [i,setI]=useState(startIndex);
  const [showBenefits,setShowBenefits]=useState(false);
  const p=seq[i];
  useEffect(()=>{setShowBenefits(false);},[i]);
  useEffect(()=>{
    if(sound&&seq.length>1){audio.ensure();audio.startPad();}else{audio.stopPad();}
    return ()=>audio.stopPad();
  },[sound]);
  if(!p)return null;
  return (
    <div className="ys-root ys-fade" style={{position:"fixed",inset:0,zIndex:70,background:"var(--paper)",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px"}}>
        <button className="ys-btn ys-press" onClick={onClose} style={{display:"flex",alignItems:"center",gap:6,color:"var(--muted)",fontSize:14,fontWeight:600}}><ArrowLeft size={18}/>Close</button>
        <div style={{display:"flex",alignItems:"center",gap:14}}>
          {seq.length>1&&<button className="ys-btn ys-press" onClick={()=>{if(!sound)audio.ensure();setSound(!sound);}} style={{color:sound?"var(--pine)":"var(--muted)",display:"flex",alignItems:"center"}} aria-label={sound?"Mute ambient sound":"Play ambient sound"}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}</button>}
          <span style={{fontSize:12,color:"var(--muted)",fontWeight:600}}>{title} · {i+1} of {seq.length}</span>
        </div>
      </div>
      <div className="ys-scroll" style={{flex:1,overflowY:"auto",padding:"4px 20px 20px"}}>
        <div style={{maxWidth:440,margin:"0 auto"}}>
          <div style={{background:"#fff",border:"1px solid var(--line)",borderRadius:24,padding:18,display:"grid",placeItems:"center"}}>
            <img className="ys-img" src={p.img} alt={p.name} style={{width:"100%",maxWidth:300,height:260}} onError={e=>{e.currentTarget.style.opacity=.25;}}/>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:16}}>
            {p.categories.slice(0,3).map(c=><Chip key={c}>{c.replace(" Yoga","")}</Chip>)}
            <Chip>{p.levels.includes("Beginner")?"Beginner":p.levels[0]}</Chip>
          </div>
          <h2 className="ys-serif" style={{fontSize:28,fontWeight:500,margin:"12px 0 2px"}}>{p.name}</h2>
          <p style={{color:"var(--pine2)",fontStyle:"italic",fontSize:15,margin:"0 0 4px"}}>{p.sanskrit}</p>
          <p style={{color:"var(--muted)",fontSize:12,margin:"0 0 16px"}}>{p.translation}</p>
          <p style={{fontSize:15.5,lineHeight:1.62,margin:0}}>{p.description}</p>
          <button className="ys-btn ys-press" onClick={()=>setShowBenefits(v=>!v)} style={{display:"flex",alignItems:"center",gap:6,marginTop:16,color:"var(--pine)",fontWeight:700,fontSize:14}}>
            <Info size={16}/>{showBenefits?"Hide benefits":"Why this pose"}
          </button>
          {showBenefits&&<p className="ys-fade" style={{fontSize:14.5,lineHeight:1.6,color:"var(--muted)",marginTop:8,padding:"12px 14px",background:"var(--panel2)",borderRadius:14}}>{p.benefits}</p>}
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 20px",borderTop:"1px solid var(--line)",background:"var(--panel)"}}>
        <button className="ys-btn ys-press" disabled={i===0} onClick={()=>setI(i-1)} style={{opacity:i===0?.35:1,display:"flex",alignItems:"center",gap:4,fontWeight:600,color:"var(--ink)"}}><ChevronLeft size={20}/>Back</button>
        <div style={{flex:1,display:"flex",justifyContent:"center",gap:6}}>
          {seq.map((_,k)=><div key={k} style={{width:k===i?18:6,height:6,borderRadius:999,background:k===i?"var(--pine)":"var(--line)",transition:"all .2s"}}/>)}
        </div>
        {i<seq.length-1
          ?<button className="ys-btn ys-press" onClick={()=>setI(i+1)} style={{display:"flex",alignItems:"center",gap:4,fontWeight:700,color:"var(--pine)"}}>Next<ChevronRight size={20}/></button>
          :(onLogPoses&&seq.length>1)
            ?<button className="ys-btn ys-press" onClick={()=>onLogPoses(seq.map(p=>p.id))} style={{display:"flex",alignItems:"center",gap:5,fontWeight:700,color:"#fff",background:"var(--pine)",padding:"9px 15px",borderRadius:12}}><Check size={17}/>Log these</button>
            :<button className="ys-btn ys-press" onClick={onClose} style={{fontWeight:700,color:"var(--pine)"}}>Done</button>}
      </div>
    </div>
  );
}

/* ---------- Breathing guide (interactive) ---------- */
const BREATH_PHASES=[
  {name:"Breathe in",dur:4000,scale:1},
  {name:"Hold",dur:2000,scale:1},
  {name:"Breathe out",dur:6000,scale:0.5},
  {name:"Settle",dur:1500,scale:0.5},
];
function BreathingGuide({onClose,sound,setSound}){
  const reduce = typeof window!=="undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const [idx,setIdx]=useState(3);
  const [round,setRound]=useState(0);
  useEffect(()=>{
    const cur=BREATH_PHASES[idx];
    const t=setTimeout(()=>{
      const next=(idx+1)%BREATH_PHASES.length;
      if(next===0)setRound(r=>r+1);
      setIdx(next);
    },cur.dur);
    return ()=>clearTimeout(t);
  },[idx]);
  useEffect(()=>{
    if(sound){audio.ensure();audio.breathStart();audio.breathPhase(BREATH_PHASES[idx].name,BREATH_PHASES[idx].dur);}
    else{audio.breathStop();}
  },[sound]);
  useEffect(()=>{if(sound)audio.breathPhase(BREATH_PHASES[idx].name,BREATH_PHASES[idx].dur);},[idx]);
  useEffect(()=>()=>audio.breathStop(),[]);
  const phase=BREATH_PHASES[idx];
  const scale=reduce?0.82:phase.scale;
  return (
    <div className="ys-root ys-fade" style={{position:"fixed",inset:0,zIndex:80,background:"var(--paper)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:24}}>
      <button className="ys-btn ys-press" onClick={()=>{if(!sound)audio.ensure();setSound(!sound);}} style={{position:"absolute",top:16,left:16,color:sound?"var(--pine)":"var(--muted)",padding:8,display:"flex",alignItems:"center",gap:6,fontWeight:600,fontSize:14}}>{sound?<Volume2 size={18}/>:<VolumeX size={18}/>}{sound?"Sound on":"Sound off"}</button>
      <button className="ys-btn ys-press" onClick={onClose} style={{position:"absolute",top:16,right:16,color:"var(--muted)",padding:8,display:"flex",alignItems:"center",gap:6,fontWeight:600,fontSize:14}}><X size={18}/>Done</button>
      <p key={idx} className="ys-serif ys-fade" style={{fontSize:30,fontWeight:500,color:"var(--pine)",marginBottom:34,height:38,margin:"0 0 34px"}}>{phase.name}</p>
      <div style={{position:"relative",width:300,height:300,display:"grid",placeItems:"center"}}>
        <div className="ys-ring" style={{position:"absolute",width:300,height:300,borderColor:"var(--glow)",opacity:.4}}/>
        <div style={{width:300,height:300,borderRadius:"50%",border:"1.5px solid var(--pine2)",background:"radial-gradient(closest-side, rgba(51,80,63,.30), rgba(51,80,63,.08))",transform:`scale(${scale})`,transition:reduce?"none":`transform ${phase.dur}ms ease-in-out`}}/>
      </div>
      <p style={{marginTop:34,color:"var(--muted)",fontSize:14,fontWeight:600,letterSpacing:".04em"}}>{round===0?"Find a comfortable seat":`Breath ${round}`}</p>
    </div>
  );
}

/* ---------- Today ---------- */
function Today({profile,sessions,openViewer,sound,setSound}){
  const [nudge,setNudge]=useState(0);
  const [breathing,setBreathing]=useState(false);
  const daySeed=useMemo(()=>{const d=new Date();return d.getFullYear()*1000+ (Math.floor((d-new Date(d.getFullYear(),0,0))/86400000));},[]);
  const recentIds=useRef(LS.getRecent());
  const {seq,rationale}=useMemo(()=>{
    const salt=profile.level.length*97+nudge*613;
    const r=recommend({level:profile.level,recentIds:recentIds.current,sessions,seed:daySeed+salt});
    return r;
  },[profile.level,sessions,nudge,daySeed]);
  function another(){const m=[...recentIds.current,...seq.map(p=>p.id)].slice(-24);recentIds.current=m;LS.setRecent(m);setNudge(n=>n+1);}
  const streak=currentStreak(sessions);
  const hour=new Date().getHours();
  const greet=hour<12?"Good morning":hour<18?"Good afternoon":"Good evening";
  return (
    <div style={{padding:"8px 18px 20px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8}}>
        <div>
          <p style={{color:"var(--muted)",fontSize:13,margin:0}}>{greet}, {profile.name}</p>
          <h1 className="ys-serif" style={{fontSize:26,fontWeight:500,margin:"2px 0 0"}}>Today's practice</h1>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:6,background:streak>0?"var(--panel2)":"transparent",border:streak>0?"1px solid var(--line)":"1px dashed var(--line)",padding:"7px 12px",borderRadius:999}}>
          <Flame size={16} color={streak>0?"var(--rose)":"var(--muted)"}/>
          <span style={{fontSize:13,fontWeight:700,color:streak>0?"var(--ink)":"var(--muted)"}}>{streak>0?`${streak} day${streak>1?"s":""}`:"No streak"}</span>
        </div>
      </div>

      <button className="ys-btn ys-press ys-card" onClick={()=>setBreathing(true)} style={{width:"100%",marginTop:16,padding:"11px 14px",display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
        <div style={{flexShrink:0}}><BreatheMark size={46} label={false}/></div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{margin:0,fontWeight:700,fontSize:15}}>Take a breath</p>
          <p style={{margin:0,fontSize:12.5,color:"var(--muted)"}}>A minute to settle before you move</p>
        </div>
        <ChevronRight size={20} color="var(--muted)"/>
      </button>

      <div className="ys-card" style={{padding:"14px 16px",marginTop:12,display:"flex",gap:12,alignItems:"flex-start"}}>
        <div className="ys-dot" style={{marginTop:7,flexShrink:0}}/>
        <p style={{margin:0,fontSize:14.5,lineHeight:1.55,color:"var(--ink)"}}>{rationale}</p>
      </div>

      <div style={{display:"flex",flexDirection:"column",gap:10,marginTop:16}}>
        {seq.map((p,idx)=>(
          <button key={p.id+"-"+idx} className="ys-btn ys-press ys-card" onClick={()=>openViewer(seq,idx)} style={{padding:12,display:"flex",gap:14,alignItems:"center",textAlign:"left"}}>
            <PoseThumb pose={p} size={62}/>
            <div style={{flex:1,minWidth:0}}>
              <p style={{margin:0,fontSize:11,color:"var(--muted)",fontWeight:700,letterSpacing:".04em"}}>{idx===0?"WARM UP":idx===seq.length-1?"COOL DOWN":"FLOW "+idx}</p>
              <p className="ys-serif" style={{margin:"1px 0 2px",fontSize:18,fontWeight:500}}>{p.name}</p>
              <p style={{margin:0,fontSize:12.5,color:"var(--muted)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.categories[0].replace(" Yoga","")} · {p.sanskrit}</p>
            </div>
            <ChevronRight size={20} color="var(--muted)"/>
          </button>
        ))}
      </div>

      <div style={{display:"flex",gap:10,marginTop:18}}>
        <button className="ys-btn ys-press" onClick={()=>openViewer(seq,0)} style={{flex:1,background:"var(--pine)",color:"#fff",padding:"14px",borderRadius:14,fontWeight:700,fontSize:15}}>Start practice</button>
        <button className="ys-btn ys-press" onClick={another} title="Show another" style={{background:"var(--panel2)",color:"var(--ink)",padding:"0 16px",borderRadius:14,display:"flex",alignItems:"center",gap:6,fontWeight:700,fontSize:14}}><RefreshCw size={16}/>Another</button>
      </div>
      <p style={{color:"var(--muted)",fontSize:11.5,textAlign:"center",marginTop:14,lineHeight:1.5}}>This suggestion is a view only. Practising it does not log anything. Record what you actually did over in the calendar.</p>
      {breathing&&<BreathingGuide onClose={()=>setBreathing(false)} sound={sound} setSound={setSound}/>}
    </div>
  );
}

/* ---------- Calendar ---------- */
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
function CalendarScreen({sessions,openDay}){
  const [cur,setCur]=useState(()=>{const d=new Date();return{y:d.getFullYear(),m:d.getMonth()};});
  const first=new Date(cur.y,cur.m,1).getDay();
  const days=new Date(cur.y,cur.m+1,0).getDate();
  const byDate=useMemo(()=>{const o={};sessions.forEach(s=>o[s.date]=s);return o;},[sessions]);
  const cells=[];
  for(let i=0;i<first;i++)cells.push(null);
  for(let d=1;d<=days;d++)cells.push(d);
  const key=(d)=>`${cur.y}-${String(cur.m+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
  const tkey=todayKey();
  return (
    <div style={{padding:"8px 18px 20px"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginTop:8,marginBottom:4}}>
        <h1 className="ys-serif" style={{fontSize:26,fontWeight:500,margin:0}}>Practice log</h1>
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",margin:"10px 0 14px"}}>
        <button className="ys-btn ys-press" onClick={()=>setCur(c=>({y:c.m===0?c.y-1:c.y,m:c.m===0?11:c.m-1}))} style={{padding:6}}><ChevronLeft size={22} color="var(--muted)"/></button>
        <span style={{fontWeight:700,fontSize:16}}>{MONTHS[cur.m]} {cur.y}</span>
        <button className="ys-btn ys-press" onClick={()=>setCur(c=>({y:c.m===11?c.y+1:c.y,m:c.m===11?0:c.m+1}))} style={{padding:6}}><ChevronRight size={22} color="var(--muted)"/></button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(7,1fr)",gap:6}}>
        {["S","M","T","W","T","F","S"].map((d,i)=><div key={i} style={{textAlign:"center",fontSize:11,color:"var(--muted)",fontWeight:700,paddingBottom:2}}>{d}</div>)}
        {cells.map((d,i)=>{
          if(!d)return <div key={i}/>;
          const k=key(d);const s=byDate[k];const isToday=k===tkey;
          return (
            <button key={i} className="ys-btn ys-press" onClick={()=>openDay(k)} style={{aspectRatio:"1",borderRadius:12,border:isToday?"1.5px solid var(--pine)":"1px solid var(--line)",background:s?"var(--pine)":"var(--panel)",color:s?"#fff":"var(--ink)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,fontSize:13,fontWeight:600,position:"relative"}}>
              {d}
              {s&&<span style={{fontSize:9,opacity:.85}}>{s.poseIds.length}</span>}
            </button>
          );
        })}
      </div>
      <p style={{color:"var(--muted)",fontSize:12,textAlign:"center",marginTop:16,lineHeight:1.5}}>Filled days are sessions you logged. Tap any day to record or edit what you practised.</p>
    </div>
  );
}

function DayLog({dateKey,session,onClose,saveSession,openViewer,prefill}){
  const [picked,setPicked]=useState(()=>{
    const base=session?[...session.poseIds]:[];
    (prefill||[]).forEach(id=>{if(!base.includes(id))base.push(id);});
    return base;
  });
  const [note,setNote]=useState(session?session.note||"":"");
  const [adding,setAdding]=useState(false);
  const [q,setQ]=useState("");
  const chosen=picked.map(id=>POSES.find(p=>p.id===id)).filter(Boolean);
  function toggle(id){setPicked(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]);}
  function save(){ saveSession(dateKey,picked,note.trim()); onClose(); }
  const d=new Date(dateKey+"T00:00:00");
  const filtered=POSES.filter(p=>p.name.toLowerCase().includes(q.toLowerCase())||p.sanskrit.toLowerCase().includes(q.toLowerCase())).slice(0,40);
  return (
    <div className="ys-root ys-fade" style={{position:"fixed",inset:0,zIndex:60,background:"var(--paper)",display:"flex",flexDirection:"column"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"14px 16px",borderBottom:"1px solid var(--line)"}}>
        <button className="ys-btn ys-press" onClick={onClose} style={{color:"var(--muted)",fontWeight:600,fontSize:14,display:"flex",alignItems:"center",gap:6}}><X size={18}/>Cancel</button>
        <span style={{fontWeight:700,fontSize:14}}>{d.toLocaleDateString(undefined,{weekday:"short",day:"numeric",month:"short"})}</span>
        <button className="ys-btn ys-press" onClick={save} style={{color:"var(--pine)",fontWeight:700,fontSize:15}}>Save</button>
      </div>
      <div className="ys-scroll" style={{flex:1,overflowY:"auto",padding:"16px 18px"}}>
        {!adding&&<>
          <p style={{fontSize:12,color:"var(--muted)",fontWeight:700,letterSpacing:".04em",margin:"0 0 10px"}}>POSES PRACTISED ({chosen.length})</p>
          {chosen.length===0&&<p style={{color:"var(--muted)",fontSize:14,margin:"0 0 14px"}}>Nothing logged yet. Add the poses you moved through.</p>}
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            {chosen.map(p=>(
              <div key={p.id} className="ys-card" style={{padding:9,display:"flex",gap:12,alignItems:"center"}}>
                <PoseThumb pose={p} size={46}/>
                <div style={{flex:1,minWidth:0}} onClick={()=>openViewer([p],0)}>
                  <p className="ys-serif" style={{margin:0,fontSize:16,fontWeight:500}}>{p.name}</p>
                  <p style={{margin:0,fontSize:12,color:"var(--muted)"}}>{p.categories[0].replace(" Yoga","")}</p>
                </div>
                <button className="ys-btn ys-press" onClick={()=>toggle(p.id)} style={{color:"var(--muted)",padding:6}}><X size={18}/></button>
              </div>
            ))}
          </div>
          <button className="ys-btn ys-press" onClick={()=>setAdding(true)} style={{marginTop:12,display:"flex",alignItems:"center",gap:8,color:"var(--pine)",fontWeight:700,fontSize:15,padding:"6px 0"}}><Plus size={18}/>Add poses</button>
          <p style={{fontSize:12,color:"var(--muted)",fontWeight:700,letterSpacing:".04em",margin:"22px 0 8px"}}>NOTE</p>
          <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="How did it feel?" rows={3} className="ys-in" style={{resize:"none",fontFamily:"inherit"}}/>
        </>}
        {adding&&<>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
            <button className="ys-btn ys-press" onClick={()=>setAdding(false)} style={{color:"var(--pine)",fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:4}}><Check size={18}/>Done</button>
            <span style={{color:"var(--muted)",fontSize:13}}>{picked.length} selected</span>
          </div>
          <div style={{position:"relative",marginBottom:12}}>
            <Search size={17} color="var(--muted)" style={{position:"absolute",left:13,top:14}}/>
            <input className="ys-in" style={{paddingLeft:38}} value={q} onChange={e=>setQ(e.target.value)} placeholder="Search poses"/>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {filtered.map(p=>{const on=picked.includes(p.id);return(
              <button key={p.id} className="ys-btn ys-press" onClick={()=>toggle(p.id)} style={{display:"flex",gap:12,alignItems:"center",padding:8,borderRadius:14,border:"1px solid "+(on?"var(--pine)":"var(--line)"),background:on?"var(--panel2)":"var(--panel)",textAlign:"left"}}>
                <PoseThumb pose={p} size={44}/>
                <div style={{flex:1,minWidth:0}}>
                  <p className="ys-serif" style={{margin:0,fontSize:16,fontWeight:500}}>{p.name}</p>
                  <p style={{margin:0,fontSize:12,color:"var(--muted)",whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{p.categories.slice(0,2).map(c=>c.replace(" Yoga","")).join(" · ")}</p>
                </div>
                <div style={{width:24,height:24,borderRadius:8,border:"1.5px solid "+(on?"var(--pine)":"var(--line)"),background:on?"var(--pine)":"transparent",display:"grid",placeItems:"center",flexShrink:0}}>{on&&<Check size={15} color="#fff"/>}</div>
              </button>
            );})}
          </div>
        </>}
      </div>
    </div>
  );
}

/* ---------- Settings ---------- */
function SettingsScreen({profile,updateLevel,updateName,sound,setSound,onSignOut}){
  const [name,setName]=useState(profile.name||"");
  const levels=[
    {k:"Easy",d:"Gentle, beginner poses. Sessions still open softly."},
    {k:"Medium",d:"Beginner and intermediate poses mixed."},
    {k:"Hard",d:"The full range, weighted toward stronger poses."},
  ];
  return (
    <div style={{padding:"8px 18px 20px"}}>
      <h1 className="ys-serif" style={{fontSize:26,fontWeight:500,margin:"8px 0 18px"}}>Settings</h1>
      <p style={{fontSize:12,color:"var(--muted)",fontWeight:700,letterSpacing:".04em",margin:"0 0 8px"}}>YOUR NAME</p>
      <input className="ys-in" value={name} onChange={e=>setName(e.target.value)} onBlur={()=>{const n=name.trim();if(n&&n!==profile.name)updateName(n);}}/>
      <p style={{fontSize:12,color:"var(--muted)",fontWeight:700,letterSpacing:".04em",margin:"22px 0 8px"}}>DIFFICULTY</p>
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {levels.map(l=>{const on=profile.level===l.k;return(
          <button key={l.k} className="ys-btn ys-press ys-card" onClick={()=>updateLevel(l.k)} style={{padding:14,textAlign:"left",border:"1px solid "+(on?"var(--pine)":"var(--line)"),background:on?"var(--panel2)":"var(--panel)",display:"flex",gap:12,alignItems:"center"}}>
            <div style={{width:22,height:22,borderRadius:999,border:"2px solid "+(on?"var(--pine)":"var(--line)"),display:"grid",placeItems:"center",flexShrink:0}}>{on&&<div style={{width:11,height:11,borderRadius:999,background:"var(--pine)"}}/>}</div>
            <div>
              <p style={{margin:0,fontWeight:700,fontSize:16}}>{l.k}<span style={{color:"var(--muted)",fontWeight:500}}> \u00b7 {LEVEL_LABEL[l.k]}</span></p>
              <p style={{margin:"2px 0 0",fontSize:13,color:"var(--muted)",lineHeight:1.4}}>{l.d}</p>
            </div>
          </button>
        );})}
      </div>
      <p style={{fontSize:12,color:"var(--muted)",fontWeight:700,letterSpacing:".04em",margin:"22px 0 8px"}}>SOUND</p>
      <button className="ys-btn ys-press ys-card" onClick={()=>{if(!sound)audio.ensure();setSound(!sound);}} style={{width:"100%",padding:14,display:"flex",alignItems:"center",gap:12,textAlign:"left"}}>
        {sound?<Volume2 size={20} color="var(--pine)"/>:<VolumeX size={20} color="var(--muted)"/>}
        <div style={{flex:1,minWidth:0}}>
          <p style={{margin:0,fontWeight:700,fontSize:15}}>Ambient sound</p>
          <p style={{margin:"2px 0 0",fontSize:12.5,color:"var(--muted)",lineHeight:1.4}}>Soft generated tones, no files. A low pad during practice, a breath tone in the breathing guide.</p>
        </div>
        <div style={{width:44,height:26,borderRadius:999,background:sound?"var(--pine)":"var(--line)",position:"relative",flexShrink:0,transition:"background .2s"}}>
          <div style={{position:"absolute",top:3,left:sound?21:3,width:20,height:20,borderRadius:999,background:"#fff",transition:"left .2s"}}/>
        </div>
      </button>
      <div className="ys-card" style={{padding:14,marginTop:22,background:"var(--panel2)"}}>
        <p style={{margin:0,fontSize:13.5,lineHeight:1.6,color:"var(--ink)"}}>Difficulty is a ceiling, not a filter. Today\u2019s suggestion also reads your log and leans toward the pose categories you have practised least this week, so it keeps adapting to you rather than a preset.</p>
      </div>
      <button className="ys-btn ys-press" onClick={onSignOut} style={{width:"100%",marginTop:22,padding:"13px",borderRadius:14,border:"1px solid var(--line)",color:"var(--muted)",fontWeight:700,fontSize:14,background:"transparent"}}>Sign out</button>
    </div>
  );
}

/* ---------- Shell ---------- */
function Shell({profile,updateLevel,updateName,sessions,saveSession,sound,setSound,onSignOut}){
  const [tab,setTab]=useState("today");
  const [viewer,setViewer]=useState(null);
  const [dayLog,setDayLog]=useState(null);
  const openViewer=(seq,idx)=>setViewer({seq,idx});
  const openDay=(dateKey,prefill=null)=>setDayLog({dateKey,prefill});
  const logFromPractice=(ids)=>{setViewer(null);setTab("calendar");setDayLog({dateKey:todayKey(),prefill:ids});};
  return (
    <div className="ys-root" style={{minHeight:"100dvh",display:"flex",flexDirection:"column",maxWidth:480,margin:"0 auto",position:"relative",borderLeft:"1px solid var(--line)",borderRight:"1px solid var(--line)"}}>
      <div className="ys-scroll" style={{flex:1,overflowY:"auto",paddingBottom:74}}>
        {tab==="today"&&<Today profile={profile} sessions={sessions} openViewer={openViewer} sound={sound} setSound={setSound}/>}
        {tab==="calendar"&&<CalendarScreen sessions={sessions} openDay={openDay}/>}
        {tab==="settings"&&<SettingsScreen profile={profile} updateLevel={updateLevel} updateName={updateName} sound={sound} setSound={setSound} onSignOut={onSignOut}/>}
      </div>
      <nav style={{position:"absolute",bottom:0,left:0,right:0,display:"flex",background:"var(--panel)",borderTop:"1px solid var(--line)",paddingBottom:"env(safe-area-inset-bottom)"}}>
        <button className={"ys-btn ys-navitem"+(tab==="today"?" on":"")} onClick={()=>setTab("today")}><Sunrise size={22}/>Today</button>
        <button className={"ys-btn ys-navitem"+(tab==="calendar"?" on":"")} onClick={()=>setTab("calendar")}><CalendarDays size={22}/>Log</button>
        <button className={"ys-btn ys-navitem"+(tab==="settings"?" on":"")} onClick={()=>setTab("settings")}><SettingsIcon size={22}/>Settings</button>
      </nav>
      {viewer&&<Viewer seq={viewer.seq} startIndex={viewer.idx} title={viewer.seq.length>1?"Practice":"Pose"} onClose={()=>setViewer(null)} onLogPoses={logFromPractice} sound={sound} setSound={setSound}/>}
      {dayLog&&<DayLog dateKey={dayLog.dateKey} session={sessions.find(s=>s.date===dayLog.dateKey)} prefill={dayLog.prefill} onClose={()=>setDayLog(null)} saveSession={saveSession} openViewer={openViewer}/>}
    </div>
  );
}

/* ---------- Root ---------- */
function Loading(){
  return <div className="ys-root" style={{minHeight:"100dvh",display:"grid",placeItems:"center"}}><BreatheMark size={140}/></div>;
}

export default function App(){
  const [stage,setStage]=useState("splash");
  const [session,setSession]=useState(null);
  const [profile,setProfile]=useState(null);
  const [sessions,setSessions]=useState([]);
  const [ready,setReady]=useState(false);
  const [sound,setSoundState]=useState(LS.getSound());

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      if(data.session){setSession(data.session);setStage("app");}
    });
    const {data:listener}=supabase.auth.onAuthStateChange((event,s)=>{
      setSession(s||null);
      if(event==="SIGNED_IN"||(s&&event==="INITIAL_SESSION")){setStage("app");}
      else if(event==="SIGNED_OUT"){setProfile(null);setSessions([]);setReady(false);setStage("login");}
    });
    return ()=>{try{listener.subscription.unsubscribe();}catch(e){}};
  },[]);

  useEffect(()=>{
    if(!session)return;
    let cancelled=false;
    (async()=>{
      let poses=LS.getPoses();
      try{const r=await fetch("/poses.json");if(r.ok){poses=await r.json();LS.setPoses(poses);}}catch(e){}
      if(poses&&poses.length){POSES.length=0;poses.forEach(p=>POSES.push(p));}
      const uid=session.user.id;
      let prof=null;
      try{const {data}=await supabase.from("profiles").select("*").eq("id",uid).maybeSingle();prof=data;}catch(e){}
      if(!prof){
        const nm=(session.user.email||"Friend").split("@")[0];
        try{const {data}=await supabase.from("profiles").insert({id:uid,name:nm,level:"Medium"}).select().maybeSingle();prof=data;}catch(e){}
        if(!prof)prof={id:uid,name:nm,level:"Medium"};
      }
      let sess=[];
      try{const {data}=await supabase.from("sessions").select("*").eq("user_id",uid).order("date",{ascending:true});sess=data||[];}catch(e){}
      if(cancelled)return;
      setProfile(prof);
      setSessions(sess.map(s=>({date:s.date,poseIds:s.pose_ids||[],note:s.note||""})));
      setReady(true);
    })();
    return ()=>{cancelled=true;};
  },[session]);

  const setSound=(v)=>{setSoundState(v);LS.setSound(v);};
  const updateLevel=(level)=>{setProfile(p=>({...p,level}));if(session)supabase.from("profiles").update({level}).eq("id",session.user.id).then(()=>{},()=>{});};
  const updateName=(name)=>{setProfile(p=>({...p,name}));if(session)supabase.from("profiles").update({name}).eq("id",session.user.id).then(()=>{},()=>{});};
  const saveSession=async(date,poseIds,note)=>{
    if(!session)return;
    const uid=session.user.id;
    if((!poseIds||poseIds.length===0)&&!(note&&note.trim())){
      setSessions(prev=>prev.filter(s=>s.date!==date));
      try{await supabase.from("sessions").delete().eq("user_id",uid).eq("date",date);}catch(e){}
      return;
    }
    setSessions(prev=>[...prev.filter(s=>s.date!==date),{date,poseIds,note:note||""}]);
    try{await supabase.from("sessions").upsert({user_id:uid,date,pose_ids:poseIds,note:note||""},{onConflict:"user_id,date"});}catch(e){}
  };

  if(stage==="splash")return <Splash onBegin={()=>setStage(session?"app":"login")}/>;
  if(stage==="login")return <Login/>;
  if(stage==="app"){
    if(ready&&profile)return <Shell profile={profile} updateLevel={updateLevel} updateName={updateName} sessions={sessions} saveSession={saveSession} sound={sound} setSound={setSound} onSignOut={()=>supabase.auth.signOut()}/>;
    return <Loading/>;
  }
  return <Loading/>;
}
