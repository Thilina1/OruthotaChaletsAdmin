'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import catalog from './catalog.json';
import { allMenuItems } from '@/lib/route-config';
import { useUserContext } from '@/context/user-context';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { keepReferencePage, referenceDepartment, readableScreenTitle } from './academy-utils';

import { advice } from './feature-guidance';
const kinds: Record<string,string> = {action:'Actions',field:'Form Fields',tab:'Tabs',column:'Table Columns',section:'Sections'};

export function FeatureReference() {
  const { user,hasPathAccess }=useUserContext();
  const [query,setQuery]=useState('');
  const [module,setModule]=useState('all');
  const [kind,setKind]=useState('all');
  const [mine,setMine]=useState(false);
  const [limit,setLimit]=useState(12);
  const title=(p:typeof catalog[number])=>allMenuItems.find(i=>i.href===p.route)?.label || readableScreenTitle(p.title);
  const moduleOf=referenceDepartment;
  const allowed=useCallback((route:string)=>Boolean(user?.role==='admin'&&!user.restrict_admin_permissions)||hasPathAccess(route.split('/[')[0]),[user,hasPathAccess]);
  const results=useMemo(()=>catalog.flatMap(p=>{
    if(module!=='all' && moduleOf(p.route)!==module)return [];
    if(mine&&!allowed(p.route))return [];
    const q=query.trim().toLowerCase();
    const screenMatch=`${title(p)} ${p.route} ${moduleOf(p.route)}`.toLowerCase().includes(q);
    const controls=p.controls.filter(c=>(kind==='all'||c.kind===kind)&&(screenMatch||`${c.label} ${kinds[c.kind]} ${advice(c)}`.toLowerCase().includes(q)));
    return keepReferencePage(screenMatch, controls.length, kind) ? [{...p,controls}] : [];
  }),[query,module,kind,mine,moduleOf,allowed]);
  return <section className="space-y-4 rounded-2xl border bg-card p-4 sm:p-6">
    <div><h2 className="text-xl font-bold">Feature Guide</h2><p className="mt-2 text-sm text-muted-foreground">බොත්තමක්, පුරවන තොරතුරක්, tab එකක් හෝ වගුවක තීරුවක් සොයන්න. Screen එකේ English නම සමඟ Sinhala භාවිත උපදෙස් මෙහි තිබේ. මේවා පාලකය හඳුනාගැනීමට සාමාන්‍ය උපදෙස් වේ. සම්පූර්ණ වැඩ පිළිවෙළ සඳහා Learn a Workflow බලන්න. සමහර controls අදාළ record එක හෝ form එක විවෘත කළ විට පමණක් පෙනේ.</p></div>
    <div className="grid gap-3 sm:grid-cols-2"><Input aria-label="විශේෂාංග සොයන්න" placeholder="උදා: discount, refund, date, මුදල, delete…" value={query} onChange={e=>{setQuery(e.target.value);setLimit(12);}}/><select aria-label="අංශය" className="rounded-md border bg-background p-2" value={module} onChange={e=>{setModule(e.target.value);setLimit(12);}}><option value="all">All Departments</option>{[...new Set(catalog.map(p=>moduleOf(p.route)))].map(m=><option key={m}>{m}</option>)}</select></div>
    <details className="rounded-xl border p-3"><summary className="cursor-pointer text-sm text-muted-foreground">More Filters</summary><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant={mine?'default':'outline'} aria-pressed={mine} onClick={()=>{setMine(!mine);setLimit(12);}}>My Screens {mine?'✓':''}</Button><Button size="sm" variant={kind==='all'?'default':'outline'} aria-pressed={kind==='all'} onClick={()=>{setKind('all');setLimit(12);}}>All Types</Button>{Object.entries(kinds).map(([k,v])=><Button key={k} size="sm" variant={kind===k?'default':'outline'} aria-pressed={kind===k} onClick={()=>{setKind(k);setLimit(12);}}>{v}</Button>)}</div></details>
    {module === 'all' && !query.trim() && kind === 'all' && !mine ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{[...new Set(catalog.map(p=>moduleOf(p.route)))].map((m,i)=><button key={m} type="button" onClick={()=>{setModule(m);setLimit(12);}} className="rounded-2xl border bg-background p-5 text-left transition-colors hover:border-primary focus-visible:ring-2 focus-visible:ring-primary"><span className="mb-3 flex size-8 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">{String(i+1).padStart(2,'0')}</span><span className="block font-semibold">{m}</span><span className="mt-2 block text-sm text-muted-foreground">Explore →</span></button>)}</div> : <>
    <Button size="sm" variant="ghost" onClick={()=>{setQuery('');setModule('all');setKind('all');setMine(false);setLimit(12);}}>← All Departments / Clear Filters</Button>
    <p role="status" className="text-sm text-muted-foreground">Screens {results.length} / {catalog.length} · පෙන්වන විස්තර {results.reduce((n,p)=>n+p.controls.length,0)}</p>
    <div className="space-y-2">{results.slice(0,limit).map(p=><details key={p.route} className="rounded-xl border p-4"><summary className="cursor-pointer font-semibold">{title(p)} <span className="font-normal text-muted-foreground">({p.controls.length})</span>{p.unavailable&&<span className="ml-2 text-sm text-amber-700">තවම සූදානම් නැත</span>}</summary><div className="mt-4 space-y-3"><p className="text-xs text-muted-foreground">{moduleOf(p.route)}</p>{p.unavailable?<p className="text-sm">මෙම screen එක දැනට Under Migration ලෙස පෙන්වයි. මෙහි කාර්යය තවම භාවිත කළ නොහැක.</p>:p.dynamic?<p className="text-sm">අදාළ ලැයිස්තුවෙන් record එකක් තෝරා මෙම detail/edit screen එක විවෘත කරන්න.</p>:allowed(p.route)?<Button asChild size="sm" variant="outline"><Link href={p.route}>Open Screen</Link></Button>:<p className="text-sm text-muted-foreground">Screen එක විවෘත කිරීමට ඔබගේ account එකට අවසර අවශ්‍යයි.</p>}{!p.controls.length&&!p.unavailable&&<p className="text-sm">මෙම screen එකේ සාරාංශ තොරතුරු බලන්න. වෙනස් කළ හැකි controls මෙහි ලැයිස්තුගත කර නැත.</p>}{p.controls.map((c,i)=><details key={`${c.kind}-${c.label}-${i}`} className="rounded-lg bg-muted/40 p-3"><summary className="cursor-pointer text-sm"><span className="mr-2 text-xs text-muted-foreground">{kinds[c.kind]}</span>{c.label}</summary><p className="mt-3 text-sm leading-7">{advice(c)}</p></details>)}</div></details>)}</div>
    {results.length > limit && <Button variant="outline" onClick={()=>setLimit(limit+12)}>More Screens</Button>}
    {!results.length&&<p>මෙම සෙවුමට ප්‍රතිඵල නැත. සෙවුම හෝ filters වෙනස් කරන්න.</p>}
    </>}
  </section>;
}
