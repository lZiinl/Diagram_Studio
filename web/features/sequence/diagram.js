(function(root){
'use strict';
const color='#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3}';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const decode=s=>s.replace(/\\n/g,'\n').replace(/\\"/g,'"');
function parse(source){
 const components=[],units=[],events=[];let current=null;
 source.split(/\r?\n/).forEach((raw,i)=>{const s=raw.trim();if(!s||s.startsWith('//')||s==='@startuml'||s==='@enduml')return;let m;
 const fail=msg=>{throw Error(`${i+1}행: ${msg}`)};
 if(m=s.match(new RegExp('^component\\s+"((?:\\\\.|[^"\\\\])*)"(?:\\s+('+color+'))?\\s*\\{$'))){if(current)fail('컴포넌트 안에 컴포넌트를 넣을 수 없습니다.');current={name:decode(m[1]),color:m[2]||'#f8cfc8',units:[]};components.push(current);}
 else if(s==='}'){if(!current)fail('닫을 컴포넌트가 없습니다.');current=null;}
 else if(m=s.match(new RegExp('^unit\\s+([A-Za-z_][\\w]*)\\s+"((?:\\\\.|[^"\\\\])*)"(?:\\s+('+color+'))?$'))){if(!current)fail('unit은 component 안에 선언하세요.');if(units.some(u=>u.id===m[1]))fail('중복된 유닛 ID: '+m[1]);const u={id:m[1],label:decode(m[2]),color:m[3]||'#ffebcc'};units.push(u);current.units.push(u);}
 else if(m=s.match(new RegExp('^([A-Za-z_][\\w]*)\\s*(-->|->)\\s*([A-Za-z_][\\w]*)(?:\\s+('+color+'))?\\s*:\\s*(.+)$'))){events.push({from:m[1],to:m[3],dashed:m[2]==='-->',color:m[4]||'#3030ff',label:decode(m[5]),line:i+1});}
 else if(m=s.match(/^space\s+(\d+)$/)){if(+m[1]>1000)fail('space는 0~1000입니다.');events.push({space:+m[1]});}
 else fail('문법을 확인하세요. component, unit, 메시지 또는 space를 사용할 수 있습니다.');
 });
 if(current)throw Error('컴포넌트의 닫는 중괄호(})가 필요합니다.');
 if(!units.length)throw Error('컴포넌트 안에 unit을 하나 이상 선언하세요.');
 if(components.some(c=>!c.units.length))throw Error('빈 컴포넌트에 unit을 추가하세요.');
 for(const e of events)if(e.from&&(!units.some(u=>u.id===e.from)||!units.some(u=>u.id===e.to)))throw Error(`${e.line}행: 선언하지 않은 유닛이 있습니다.`);
 return {components,units,events};
}
const measure=s=>Array.from(s).reduce((n,c)=>n+(/[^\x00-\xff]/.test(c)?12:7),0);
function render(model,options={}){
 const gap=Math.max(24,Math.min(240,+options.gap||42)),row=Math.max(30,Math.min(160,+options.row||48));
 const {components,units,events}=model;const byId=Object.fromEntries(units.map(u=>[u.id,u]));
 const top=16,unitY=49,unitH=Math.max(70,...units.map(u=>u.label.split('\n').length*18+22)),bottom=unitY+unitH+12;
 let x=24;for(const c of components){c.x=x;let inner=x+20;for(const u of c.units){u.w=Math.max(126,...u.label.split('\n').map(t=>measure(t)+26));u.x=inner+u.w/2;inner+=u.w+gap;}c.w=Math.max(inner-gap+20-x,measure(c.name)+24);x+=c.w+30;}
 // Reserve room for long labels between adjacent participants, shifting following columns together.
 for(const e of events){if(!e.from||e.from===e.to)continue;const a=units.indexOf(byId[e.from]),b=units.indexOf(byId[e.to]),lo=Math.min(a,b),hi=Math.max(a,b);const needed=Math.max(...e.label.split('\n').map(measure))+36;const delta=needed-(units[hi].x-units[lo].x);if(delta>0){for(let j=hi;j<units.length;j++)units[j].x+=delta;}}
 for(const c of components){c.x=c.units[0].x-c.units[0].w/2-20;c.w=Math.max(c.units.at(-1).x+c.units.at(-1).w/2+20-c.x,measure(c.name)+24);}
 let y=bottom+56;for(const e of events){if(e.space!==undefined){y+=e.space;continue;}y+=Math.max(0,(e.label.split('\n').length-1)*17);e.y=y;y+=Math.max(row,e.from===e.to?62:30);}
 const height=y+28,width=Math.max(...components.map(c=>c.x+c.w))+24+Math.max(0,...events.filter(e=>e.from!==undefined&&e.from===e.to).map(e=>byId[e.from].x+Math.max(65,measure(e.label)+30)+30-(Math.max(...components.map(c=>c.x+c.w)))));
 let s=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="소프트웨어 컴포넌트 시퀀스 다이어그램"><rect width="100%" height="100%" fill="white"/>`;
 const text=(label,x,y,anchor='middle',fill='#111827',size=12)=>label.split('\n').map((t,i)=>`<text x="${x}" y="${y+i*18}" text-anchor="${anchor}" fill="${fill}" font-family="Arial, sans-serif" font-size="${size}">${esc(t)}</text>`).join('');
 for(const c of components){s+=`<rect x="${c.x}" y="${top}" width="${c.w}" height="${bottom-top}" fill="${c.color}" stroke="#b88787"/>`+text(c.name,c.x+c.w/2,34);for(const u of c.units)s+=`<rect x="${u.x-u.w/2}" y="${unitY}" width="${u.w}" height="${unitH}" fill="${u.color}" stroke="#ceab66"/>`+text(u.label,u.x,unitY+22);}
 for(const u of units)s+=`<path d="M${u.x} ${bottom} V${height-16}" fill="none" stroke="#202020" stroke-width="2" stroke-dasharray="7 6"/>`;
 for(const e of events){if(!e.from)continue;const a=byId[e.from].x,b=byId[e.to].x,yy=e.y,dir=b>=a?1:-1;let endY=yy;const self=a===b;
 if(self){endY=yy+25;const sx=a+Math.max(65,measure(e.label)+30);s+=`<path d="M${a} ${yy} H${sx} V${endY} H${a+10}" fill="none" stroke="${e.color}" stroke-width="2" ${e.dashed?'stroke-dasharray="6 4"':''}/>`;s+=`<polygon points="${a},${endY} ${a+11},${endY-5} ${a+11},${endY+5}" fill="${e.color}"/>`;}
 else{s+=`<path d="M${a} ${yy} H${b-dir*10}" stroke="${e.color}" stroke-width="2" ${e.dashed?'stroke-dasharray="6 4"':''}/><polygon points="${b},${yy} ${b-dir*11},${yy-5} ${b-dir*11},${yy+5}" fill="${e.color}"/>`;}
 s+=text(e.label,Math.min(a,b)+15,yy-8-(e.label.split('\n').length-1)*18,'start','#111827',11);
 for(const [xx,by] of [[a,yy],[b,endY]])s+=`<rect x="${xx}" y="${by+1}" width="14" height="15" fill="${xx===a?byId[e.from].color:byId[e.to].color}" stroke="#ecad3d" stroke-width="1"/>`;
 }
 return s+'</svg>';
}
root.Diagram={parse,render};if(typeof module!=='undefined')module.exports=root.Diagram;
})(typeof window!=='undefined'?window:globalThis);

