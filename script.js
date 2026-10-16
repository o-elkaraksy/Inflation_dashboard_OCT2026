(() => {
"use strict";
const DATA_URL = "https://raw.githubusercontent.com/o-elkaraksy/Inflation_dashboard_OCT2026/refs/heads/main/dashboard_data.csv";
const COLORS = ["#3267d6","#4e8dca","#54a39a","#7a9d8d","#a4b7c7","#8c83c7","#c7a36b","#d28c8c","#7c9aaf","#a4b77a","#6d88a8","#b19bce"];
const ICONS = ["utensils","cigarette","shirt","house","sofa","heart-pulse","bus","wifi","graduation-cap","coffee","landmark","package"];
const $ = id => document.getElementById(id);
const state = {rows:[], dates:[], dateKeys:[], latestIndex:-1, weightsChart:null, contributionChart:null, historyChart:null, historyCategory:null, historyRange:12, contributionRange:12, expanded:new Set(), historySelected:[], colors:{}};
const fmt = n => Number.isFinite(n) ? `${n.toFixed(1)}%` : "—";
const pp = n => Number.isFinite(n) ? `${n.toFixed(2)} pp` : "—";
const num = v => { if(v===null||v===undefined||String(v).trim()==="") return null; const n=Number(String(v).replace(/,/g,"")); return Number.isFinite(n)?n:null; };
const escapeHtml = s => String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function toast(message){const el=$("toast");el.textContent=message;el.classList.add("show");setTimeout(()=>el.classList.remove("show"),2800);}
function parseDate(label){const m=String(label).match(/^([A-Za-z]{3})-(\d{2}|\d{4})$/);if(!m)return null;const months={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};let y=Number(m[2]);if(y<100)y+=2000;return new Date(y,months[m[1]],1);}
function monthLabel(d){return d.toLocaleDateString("en-GB",{month:"short",year:"numeric"});}
function indexFor(row,idx){return row.values[idx]??null;}
function inflation(row,idx,period){const back=period==="yoy"?12:1;if(idx<back)return null;const a=indexFor(row,idx),b=indexFor(row,idx-back);if(a===null||b===null||b===0)return null;return (a/b-1)*100;}
function rowKind(row){const s=String(row.family||"").toLowerCase().trim();if(s.startsWith("main category"))return "main";if(s.startsWith("sub category"))return "sub";if(s.startsWith("sub item"))return "item";return row.name==="All Items"?"all":"other";}
function rowOrder(row){const m=String(row.family||"").match(/(\d+(?:\.\d+)?)/);return m?Number(m[1]):999;}
function normalizeRow(row){return {...row,kind:rowKind(row),order:rowOrder(row),weight:num(row.weight),values:row.values};}
function parentKey(row){if(row.kind==="sub")return String(row.order).split(".")[0];if(row.kind==="item")return String(row.order).split(".")[0];return null;}
function getMainRows(){return state.rows.filter(r=>r.kind==="main");}
function getAllRow(){return state.rows.find(r=>r.kind==="all")||state.rows.find(r=>r.name.toLowerCase()==="all items");}
function getChildren(main){return state.rows.filter(r=>(r.kind==="sub"||r.kind==="item")&&parentKey(r)===String(main.order));}
function getDescendants(main){return state.rows.filter(r=>(r.kind==="sub"||r.kind==="item")&&parentKey(r)===String(main.order));}
function getChildRows(main){
 const descendants=getDescendants(main);
 // For contribution analysis, use one hierarchy level at a time to avoid double-counting
 // subcategories and their subitems together. Category-card tables still show all descendants.
 const directSubs=descendants.filter(r=>r.kind==="sub");
 if(main.kind==="main" && directSubs.length) return directSubs;
 if(main.kind==="sub") return descendants.filter(r=>r.kind==="item");
 return descendants.filter(r=>r.kind==="item");
}
function getItemsWithin(parent){const p=String(parent.order);if(parent.kind==="main")return state.rows.filter(r=>(r.kind==="sub"||r.kind==="item")&&parentKey(r)===p);if(parent.kind==="sub")return state.rows.filter(r=>r.kind==="item"&&String(r.order).split(".")[0]===p.split(".")[0]&&String(r.order).split(".").slice(0,2).join(".")===p);return [];}
function aggregateRow(){return getAllRow();}
function categoryIcon(i){return ICONS[i%ICONS.length];}
function setStatus(text,ok=true){$("dataStatus").textContent=text;const dot=document.querySelector(".live-dot");if(dot)dot.style.background=ok?"#2ca782":"#c45151";}
function rate(row,period,idx=state.latestIndex){return inflation(row,idx,period);}
function previousValidRate(row,period,idx=state.latestIndex){return idx>0?inflation(row,idx-1,period):null;}
function changeChip(current,previous){if(!Number.isFinite(current)||!Number.isFinite(previous))return "—";const d=current-previous;return `${d>0?"+":""}${d.toFixed(1)} pp`;}
function setChange(id,current,previous){const el=$(id);el.textContent=changeChip(current,previous);el.classList.toggle("negative",Number.isFinite(current)&&Number.isFinite(previous)&&current<previous);}
function contributionRaw(rows,period,idx,parent=null){
  const agg=parent?rate(parent,period,idx):rate(aggregateRow(),period,idx);
  const valid=rows.map(r=>({row:r,r:inflation(r,idx,period),w:Math.max(0,r.weight??0)})).filter(x=>x.r!==null&&Number.isFinite(x.r));
  if(agg===null||!valid.length)return {agg,items:[]};
  let raw=valid.map(x=>({...x,raw:x.w*x.r}));
  let denom=raw.reduce((s,x)=>s+x.raw,0);
  if(Math.abs(denom)<1e-9){denom=raw.reduce((s,x)=>s+x.w,0);raw=raw.map(x=>({...x,raw:x.w}));}
  const totalAbs=raw.reduce((s,x)=>s+Math.abs(x.raw),0);
  const sum=raw.reduce((s,x)=>s+x.raw,0);
  // Scale weighted contributions to the aggregate, preserving the relative weighted contributions.
  if(Math.abs(sum)>1e-9){
    raw=raw.map(x=>({...x,contribution:x.raw*(agg/sum)}));
  } else if(totalAbs>0){
    raw=raw.map(x=>({...x,contribution:x.raw*(agg/totalAbs)}));
  } else raw=raw.map(x=>({...x,contribution:0}));
  return {agg,items:raw};
}
function getMainContribution(rows,period,idx){return contributionRaw(rows,period,idx,null);}
function childContribution(parent,rows,period,idx){
  const agg=rate(parent,period,idx);
  const result=contributionRaw(rows,period,idx,parent);
  return {...result,agg};
}
function populateOverview(){
 const all=aggregateRow();if(!all)return;
 const yoy=rate(all,"yoy"),mom=rate(all,"mom"),py=previousValidRate(all,"yoy"),pm=previousValidRate(all,"mom");
 $("headlineYoY").textContent=fmt(yoy);$("headlineMoM").textContent=fmt(mom);
 $("headlineYoYPrev").textContent=`Previous month: ${fmt(py)}`;$("headlineMoMPrev").textContent=`Previous month: ${fmt(pm)}`;
 setChange("headlineYoYChange",yoy,py);setChange("headlineMoMChange",mom,pm);
 $("latestMonth").textContent=monthLabel(state.dates[state.latestIndex]);
 const mains=getMainRows();
 for(const period of ["yoy","mom"]){const c=getMainContribution(mains,period,state.latestIndex);const top=[...c.items].sort((a,b)=>b.contribution-a.contribution)[0];const nameId=period==="yoy"?"topYoYName":"topMoMName",valId=period==="yoy"?"topYoYValue":"topMoMValue";$(nameId).textContent=top?top.row.name:"—";$(valId).textContent=top?`${pp(top.contribution)} contribution`:"—";}
}
function buildWeightChart(){
 const mains=getMainRows().slice().sort((a,b)=>(b.weight||0)-(a.weight||0));
 const ctx=$("weightsChart").getContext("2d");if(state.weightsChart)state.weightsChart.destroy();
 state.weightsChart=new Chart(ctx,{type:"doughnut",data:{labels:mains.map(r=>r.name),datasets:[{data:mains.map(r=>r.weight||0),backgroundColor:mains.map((r,i)=>COLORS[i%COLORS.length]),borderColor:"#fff",borderWidth:3,hoverOffset:8}]},options:{responsive:true,maintainAspectRatio:false,cutout:"65%",plugins:{legend:{display:false},tooltip:{callbacks:{label:c=>`${c.label}: ${Number(c.raw).toFixed(1)}%`}}}}});
 $("weightsLegend").innerHTML=mains.map((r,i)=>`<div class="legend-item"><span class="legend-dot" style="background:${COLORS[i%COLORS.length]}"></span><span class="legend-name">${escapeHtml(r.name)}</span><span class="legend-weight">${(r.weight||0).toFixed(1)}%</span></div>`).join("");
}
function categoryCardHtml(row,i){
 const y=rate(row,"yoy"),m=rate(row,"mom"),children=getChildRows(row),expanded=state.expanded.has(row.family);
 const details=expanded?detailHtml(row):"";
 return `<article class="category-card ${expanded?"expanded":""}" data-family="${escapeHtml(row.family)}">
 <div class="category-top" role="button" tabindex="0" aria-expanded="${expanded}" data-expand="${escapeHtml(row.family)}">
 <div class="category-title-row"><div class="category-name">${escapeHtml(row.name)}</div><div class="category-weight">${(row.weight||0).toFixed(1)}% weight</div></div>
 <div class="category-metrics"><div class="category-metric"><strong>${fmt(y)}</strong><span>Annual · YoY</span></div><div class="category-metric"><strong>${fmt(m)}</strong><span>Monthly · MoM</span></div></div></div>
 <div class="category-card-actions"><button class="history-button" data-history="${escapeHtml(row.family)}"><i data-lucide="chart-no-axes-combined"></i> Historical</button><span class="expand-hint" data-expand="${escapeHtml(row.family)}">${expanded?"Hide details":"Explore components"} <i data-lucide="chevron-down"></i></span></div>
 ${details}</article>`;
}
function detailHtml(main){
 const children=getDescendants(main);if(!children.length)return `<div class="category-details"><p class="section-note">No child rows were found for this category.</p></div>`;
 const sortKey=state[`sort_${main.family}`]||"source";
 const sorted=children.slice().sort((a,b)=>{if(sortKey==="yoy-desc")return (rate(b,"yoy")??-Infinity)-(rate(a,"yoy")??-Infinity);if(sortKey==="yoy-asc")return (rate(a,"yoy")??Infinity)-(rate(b,"yoy")??Infinity);if(sortKey==="mom-desc")return (rate(b,"mom")??-Infinity)-(rate(a,"mom")??-Infinity);if(sortKey==="mom-asc")return (rate(a,"mom")??Infinity)-(rate(b,"mom")??Infinity);if(sortKey==="weight-desc")return (b.weight||0)-(a.weight||0);return a.order-b.order;});
 return `<div class="category-details"><div class="detail-toolbar"><label>${children.length} components</label><select aria-label="Sort components" data-detail-sort="${escapeHtml(main.family)}"><option value="source" ${sortKey==="source"?"selected":""}>Source order</option><option value="yoy-desc" ${sortKey==="yoy-desc"?"selected":""}>YoY · high to low</option><option value="yoy-asc" ${sortKey==="yoy-asc"?"selected":""}>YoY · low to high</option><option value="mom-desc" ${sortKey==="mom-desc"?"selected":""}>MoM · high to low</option><option value="mom-asc" ${sortKey==="mom-asc"?"selected":""}>MoM · low to high</option><option value="weight-desc" ${sortKey==="weight-desc"?"selected":""}>Weight · high to low</option></select></div>
 <div class="detail-table-wrap"><table class="detail-table"><thead><tr><th>Category / item</th><th>Weight</th><th>YoY</th><th>MoM</th></tr></thead><tbody>${sorted.map(r=>`<tr><td>${r.kind==="item"?"↳ ":""}${escapeHtml(r.name)}</td><td>${(r.weight||0).toFixed(1)}%</td><td class="${(rate(r,"yoy")??0)<0?"negative-value":"positive-value"}">${fmt(rate(r,"yoy"))}</td><td class="${(rate(r,"mom")??0)<0?"negative-value":"positive-value"}">${fmt(rate(r,"mom"))}</td></tr>`).join("")}</tbody></table></div></div>`;
}
function renderCategories(){
 const mains=getMainRows();const sort=$("categorySort").value;const sorted=mains.slice().sort((a,b)=>{if(sort==="yoy-desc")return (rate(b,"yoy")??-Infinity)-(rate(a,"yoy")??-Infinity);if(sort==="yoy-asc")return (rate(a,"yoy")??Infinity)-(rate(b,"yoy")??Infinity);if(sort==="mom-desc")return (rate(b,"mom")??-Infinity)-(rate(a,"mom")??-Infinity);if(sort==="mom-asc")return (rate(a,"mom")??Infinity)-(rate(b,"mom")??Infinity);if(sort==="weight-desc")return (b.weight||0)-(a.weight||0);return a.order-b.order;});
 $("categoryGrid").innerHTML=sorted.map((r,i)=>categoryCardHtml(r,i)).join("");bindCategoryEvents();if(window.lucide)lucide.createIcons();
}
function bindCategoryEvents(){
 document.querySelectorAll("[data-expand]").forEach(el=>{el.addEventListener("click",e=>{if(e.target.closest("[data-history]"))return;toggleExpanded(el.dataset.expand);});if(el.classList.contains("category-top"))el.addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault();toggleExpanded(el.dataset.expand);}});});
 document.querySelectorAll("[data-detail-sort]").forEach(el=>el.addEventListener("change",()=>{state[`sort_${el.dataset.detailSort}`]=el.value;renderCategories();state.expanded.add(el.dataset.detailSort);renderCategories();}));
 document.querySelectorAll("[data-history]").forEach(el=>el.addEventListener("click",e=>{e.stopPropagation();const row=state.rows.find(r=>r.family===el.dataset.history);if(row)openHistory(row);}));
}
function toggleExpanded(key){if(state.expanded.has(key))state.expanded.delete(key);else state.expanded.add(key);renderCategories();}
function populateParentSelect(){
 const mains=getMainRows();$("parentSelect").innerHTML=mains.map(r=>`<option value="${escapeHtml(r.family)}">${escapeHtml(r.name)}</option>`).join("");
 $("parentSelectWrap").classList.toggle("hidden",$("contributionLevel").value==="main");
}
function selectedContributionRows(idx){
 const level=$("contributionLevel").value;
 if(level==="main")return {rows:getMainRows(),parent:null,aggregate:aggregateRow()};
 const parent=state.rows.find(r=>r.family===$("parentSelect").value)||getMainRows()[0];
 return {rows:getChildRows(parent),parent,aggregate:parent};
}
function currentRange(range,idx=state.latestIndex){if(range==="all")return 0;return Math.max(0,idx-Number(range)+1);}
function renderContribution(){
 if(!state.rows.length)return;
 const period=$("contributionMeasure").value,level=$("contributionLevel").value;
 $("parentSelectWrap").classList.toggle("hidden",level==="main");
 const selection=selectedContributionRows();const rows=selection.rows;const start=currentRange(state.contributionRange);
 const labels=state.dates.slice(start,state.latestIndex+1).map(monthLabel);
 const mainLevel=level==="main";
 const totalRow=selection.aggregate;
 const totalValues=[],contributionsByRow=rows.map(r=>({row:r,data:[]}));
 for(let idx=start;idx<=state.latestIndex;idx++){
   const agg=rate(totalRow,period,idx);totalValues.push(agg);
   const result=mainLevel?getMainContribution(rows,period,idx):childContribution(selection.parent,rows,period,idx);
   const byFamily=new Map(result.items.map(x=>[x.row.family,x.contribution]));
   contributionsByRow.forEach(x=>x.data.push(byFamily.has(x.row.family)?byFamily.get(x.row.family):null));
 }
 const datasets=[{type:"line",label:mainLevel?"Headline inflation":`${selection.parent.name} inflation`,data:totalValues,borderColor:"#172b4d",backgroundColor:"#172b4d",borderWidth:2.5,pointRadius:labels.length>36?0:2.5,pointHoverRadius:5,tension:.25,yAxisID:"y",order:0}];
 contributionsByRow.forEach((item,i)=>datasets.push({type:"bar",label:item.row.name,data:item.data,backgroundColor:COLORS[i%COLORS.length],borderColor:"#fff",borderWidth:1,stack:"contrib",yAxisID:"y",order:2}));
 if(state.contributionChart)state.contributionChart.destroy();
 state.contributionChart=new Chart($("contributionChart"),{data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:8,boxHeight:8,padding:14,font:{size:10}}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${Number.isFinite(c.raw)?c.raw.toFixed(2)+" pp":"—"}`}}},scales:{x:{stacked:true,grid:{display:false},ticks:{maxTicksLimit:10,maxRotation:0,color:"#77859a",font:{size:10}}},y:{stacked:false,title:{display:true,text:"Inflation / contribution (percentage points)",color:"#77859a",font:{size:10}},grid:{color:"#edf1f6"},ticks:{color:"#77859a",font:{size:10},callback:v=>v+" pp"}}}}});
 $("rangeLabel").textContent=`${labels[0]||"—"} – ${labels[labels.length-1]||"—"}`;
 $("contributionNote").textContent=mainLevel?"Main-category contributions are allocated using their CPI weights and reconciled to the All Items inflation rate for each month. This is an analytical allocation, not an official statistical decomposition.":"Component contributions are allocated using weights relative to the selected parent and reconciled to that parent's inflation rate. This is an analytical allocation, not an official statistical decomposition.";
}
function openHistory(row){
 state.historyCategory=row;state.historyRange=12;state.historySelected=[];
 $("historyTitle").textContent=row.name;$("historySubtitle").textContent=`${(row.weight||0).toFixed(1)}% basket weight · choose additional components to compare`;
 const descendants=getDescendants(row);
 $("historyItems").innerHTML=descendants.map(r=>`<option value="${escapeHtml(r.family)}">${r.kind==="item"?"↳ ":""}${escapeHtml(r.name)}</option>`).join("");
 $("historyModal").classList.remove("hidden");document.body.style.overflow="hidden";document.querySelectorAll(".history-ranges button").forEach(b=>b.classList.toggle("active",b.dataset.range==="12"));renderHistory();if(window.lucide)lucide.createIcons();
}
function closeHistory(){$("historyModal").classList.add("hidden");document.body.style.overflow="";}
function renderHistory(){
 const row=state.historyCategory;if(!row)return;const period=$("historyMeasure").value,start=currentRange(state.historyRange);
 const labels=state.dates.slice(start,state.latestIndex+1).map(monthLabel);
 const chosen=Array.from($("historyItems").selectedOptions).map(o=>o.value).map(k=>state.rows.find(r=>r.family===k)).filter(Boolean);
 const series=[row,...chosen.filter(r=>r.family!==row.family)];
 const datasets=series.map((r,i)=>({label:r.name,data:state.dates.slice(start,state.latestIndex+1).map((_,offset)=>rate(r,period,start+offset)),borderColor:i===0?"#172b4d":COLORS[(i-1)%COLORS.length],backgroundColor:"transparent",borderWidth:i===0?2.8:2,pointRadius:labels.length>36?0:2,tension:.25,spanGaps:false}));
 if(state.historyChart)state.historyChart.destroy();
 state.historyChart=new Chart($("historyChart"),{type:"line",data:{labels,datasets},options:{responsive:true,maintainAspectRatio:false,interaction:{mode:"index",intersect:false},plugins:{legend:{position:"bottom",labels:{usePointStyle:true,boxWidth:8,padding:14,font:{size:10}}},tooltip:{callbacks:{label:c=>`${c.dataset.label}: ${fmt(c.raw)}`}}},scales:{x:{grid:{display:false},ticks:{maxTicksLimit:10,maxRotation:0,color:"#77859a",font:{size:10}}},y:{title:{display:true,text:period==="yoy"?"YoY inflation (%)":"MoM inflation (%)",color:"#77859a",font:{size:10}},grid:{color:"#edf1f6"},ticks:{color:"#77859a",callback:v=>v+"%"}}}}});
 $("historyRangeLabel").textContent=`${labels[0]||"—"} – ${labels[labels.length-1]||"—"}`;
}
function parseCsv(text){
 const parsed=Papa.parse(text,{header:true,skipEmptyLines:true,dynamicTyping:false});
 if(parsed.errors.length)console.warn("CSV parsing warnings",parsed.errors);
 const fields=parsed.meta.fields||[];const dateFields=fields.slice(3).filter(f=>parseDate(f));
 state.dates=dateFields.map(parseDate);state.dateKeys=dateFields;
 state.rows=parsed.data.map(r=>normalizeRow({family:r["category family"],name:r["Category"],weight:num(r["Weights Rebased"]),values:dateFields.map(k=>num(r[k]))})).filter(r=>r.name);
 state.latestIndex=state.dates.length-1;
}
async function loadData(){
 setStatus("Fetching latest CSV…");
 $("refreshBtn").disabled=true;
 try{
  const response=await fetch(DATA_URL,{cache:"no-store"});
  if(!response.ok)throw new Error(`GitHub returned ${response.status}`);
  const text=await response.text();parseCsv(text);
  if(!state.rows.length||!state.dates.length)throw new Error("No valid CPI rows or monthly columns were found.");
  populateOverview();buildWeightChart();renderCategories();populateParentSelect();renderContribution();
  $("updatedAt").textContent=`Source: GitHub CSV · loaded ${new Date().toLocaleString()}`;
  setStatus(`${state.rows.length} series loaded`,true);
 }catch(err){
  console.error(err);setStatus("Data could not load",false);
  $("categoryGrid").innerHTML=`<div class="error-card"><b>Unable to load the source CSV.</b><br>Check that the GitHub file is public and that the URL is correct, then refresh. ${escapeHtml(err.message)}</div>`;
  toast("Could not fetch the CSV from GitHub.");
 }finally{$("refreshBtn").disabled=false;if(window.lucide)lucide.createIcons();}
}
function bindGlobalEvents(){
 $("refreshBtn").addEventListener("click",loadData);
 $("weightsToggle").addEventListener("click",()=>{const panel=$("weightsPanel");const opening=panel.classList.contains("hidden");panel.classList.toggle("hidden");$("weightsToggle").querySelector("span").textContent=opening?"Hide weight breakdown":"Show weight breakdown";if(opening&&state.weightsChart)state.weightsChart.resize();});
 $("categorySort").addEventListener("change",renderCategories);
 $("contributionMeasure").addEventListener("change",renderContribution);
 $("contributionLevel").addEventListener("change",()=>{populateParentSelect();renderContribution();});
 $("parentSelect").addEventListener("change",renderContribution);
 document.querySelectorAll(".range-buttons:not(.history-ranges) button").forEach(b=>b.addEventListener("click",()=>{state.contributionRange=b.dataset.range;document.querySelectorAll(".range-buttons:not(.history-ranges) button").forEach(x=>x.classList.toggle("active",x===b));renderContribution();}));
 document.querySelectorAll(".history-ranges button").forEach(b=>b.addEventListener("click",()=>{state.historyRange=b.dataset.range;document.querySelectorAll(".history-ranges button").forEach(x=>x.classList.toggle("active",x===b));renderHistory();}));
 $("historyMeasure").addEventListener("change",renderHistory);$("historyItems").addEventListener("change",renderHistory);
 document.querySelectorAll("[data-close-modal]").forEach(el=>el.addEventListener("click",closeHistory));
 document.addEventListener("keydown",e=>{if(e.key==="Escape"&& !$("historyModal").classList.contains("hidden"))closeHistory();});
}
bindGlobalEvents();loadData();
})();