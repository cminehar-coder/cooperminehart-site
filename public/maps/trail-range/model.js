(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OffroadModel=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const PARAMETERS=[
  {key:'clearance',label:'Ground clearance',unit:'in',min:6,max:13,weight:30,help:'Room beneath the vehicle. Higher is better.'},
  {key:'approach',label:'Approach angle',unit:'°',min:15,max:50,weight:20,help:'Steeper entry before the front bumper contacts an obstacle.'},
  {key:'departure',label:'Departure angle',unit:'°',min:15,max:45,weight:20,help:'Steeper exit before the rear bumper contacts an obstacle.'},
  {key:'breakover',label:'Breakover angle',unit:'°',min:10,max:35,weight:20,help:'Ability to crest a ridge without contacting the belly.'},
  {key:'tire',label:'Tire diameter',unit:'in',min:26,max:37,weight:10,help:'Nominal outside diameter, not wheel diameter. Tread and compound are not scored.'},
  {key:'wheelbase',label:'Short wheelbase',unit:'in',min:90,max:150,weight:0,inverse:true,help:'Shorter earns more points. Default zero avoids overlap with breakover; longer can help stability.'}
 ];
 const DEFAULTS=Object.fromEntries(PARAMETERS.map(p=>[p.key,p.weight]));
 const clamp=(x,lo,hi)=>Math.min(hi,Math.max(lo,x));
 function normalizedWeights(weights){const clean=Object.fromEntries(PARAMETERS.map(p=>[p.key,Number.isFinite(+weights[p.key])?clamp(+weights[p.key],0,100):0]));const total=Object.values(clean).reduce((a,b)=>a+b,0);return Object.fromEntries(PARAMETERS.map(p=>[p.key,total?clean[p.key]/total:0]));}
 function tireDiameter(size){const f=String(size).match(/^(\d+(?:\.\d+)?)x\d+(?:\.\d+)?R\d+/i);if(f)return +f[1];const m=String(size).match(/(?:LT|P)?(\d{3})\/(\d{2})R(\d{2})/i);return m?+m[3]+2*(+m[1])*(+m[2]/100)/25.4:null;}
 function estimatedBreakover(clearance,wheelbase){return 2*Math.atan(2*clearance/wheelbase)*180/Math.PI;}
 function component(value,p){if(!Number.isFinite(value))return null;const n=clamp((value-p.min)/(p.max-p.min),0,1);return (p.inverse?1-n:n)*100;}
 function evaluate(vehicle,weights,allowEstimates=true){
  const w=normalizedWeights(weights);if(!Object.values(w).some(x=>x>0))return {score:null,components:[],estimated:false,reason:'Set at least one weight above zero.'};
  const vals={...vehicle,tire:tireDiameter(vehicle.tireSize)};let estimated=false;
  if(vals.breakover==null&&w.breakover>0&&allowEstimates&&Number.isFinite(vals.clearance)&&Number.isFinite(vals.wheelbase)){vals.breakover=estimatedBreakover(vals.clearance,vals.wheelbase);estimated=true;}
  const components=PARAMETERS.map(p=>{const value=vals[p.key],normalized=component(value,p);return {key:p.key,value,normalized,weight:w[p.key],contribution:normalized==null?null:normalized*w[p.key],estimated:p.key==='breakover'&&estimated};});
  if(components.some(c=>c.weight>0&&c.normalized==null))return {score:null,components,estimated,reason:'Missing a positively weighted dimension.'};
  return {score:components.reduce((sum,c)=>sum+(c.weight>0?c.contribution:0),0),components,estimated,reason:null};
 }
 function energyCost(v,gas,electricity){return v.fuel==='Electric'?v.kwhPer100Miles*electricity:100/v.mpg*gas;}
 function dominates(a,b,metric='mpg'){const e=1e-9, av=metric==='cost'?-a.cost:a[metric],bv=metric==='cost'?-b.cost:b[metric];return a.score>=b.score-e&&av>=bv-e&&(a.score>b.score+e||av>bv+e);}
 function frontier(rows,metric='mpg'){const valid=rows.filter(r=>Number.isFinite(r.score)&&Number.isFinite(r[metric]));return valid.filter(a=>!valid.some(b=>a.id!==b.id&&dominates(b,a,metric))).sort((a,b)=>(metric==='cost'?b[metric]-a[metric]:a[metric]-b[metric])||b.score-a.score);}
 function eligible(v,filters){return (!filters.electric||v.fuel==='Electric')&&(!filters.combustion||v.fuel!=='Electric')&&(!filters.hybrid||v.fuel==='Hybrid')&&(!filters.gas||v.fuel==='Gasoline')&&(!filters.drive||filters.drive==='all'||(filters.drive==='awd'&&v.drivetrain!=='Front-Wheel Drive'&&v.drivetrain!=='Rear-Wheel Drive')||(filters.drive==='low'&&v.lowRange)||(filters.drive==='rear'&&v.rearLocker)||(filters.drive==='both'&&v.frontLocker&&v.rearLocker))&&v.year>=filters.yearMin&&v.year<=filters.yearMax;}
 return {PARAMETERS,DEFAULTS,normalizedWeights,tireDiameter,estimatedBreakover,component,evaluate,energyCost,dominates,frontier,eligible};
});
