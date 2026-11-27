(function(root){
  const cats=['top','bottom','shoes'];
  function same(a,b){return !!a&&!!b&&cats.every(c=>a[c]===b[c]);}
  function dayNumber(start,today){const days=Math.floor((Date.parse(today+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000);return Number.isFinite(days)?Math.max(0,Math.min(14,days+1)):0;}
  function inTrial(date,start){const n=(Date.parse(date+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000;return Number.isFinite(n)&&n>=0&&n<14;}
  function summary(trial,today){
    const f=Object.values(trial.feedback||{}).filter(x=>trial.startDate&&inTrial(x.date,trial.startDate)&&x.date<=today);
    const recs=(trial.recommendations||[]).filter(x=>trial.startDate&&inTrial(x.date,trial.startDate)&&x.date<=today);
    const recDays=new Set(recs.map(x=>x.date));
    const eligible=f.filter(x=>x.recommended&&x.mode!=='no-outing');
    const adopted=eligible.filter(x=>same(x.recommended,x.actual));
    const reasons={};f.forEach(x=>(x.reasons||[]).forEach(r=>reasons[r]=(reasons[r]||0)+1));
    const quality=Object.values(trial.tryonFeedback||{});const worn=f.filter(x=>x.actual&&Number.isFinite(x.comfort));
    return {day:trial.startDate?dayNumber(trial.startDate,today):0,feedbackDays:new Set(f.map(x=>x.date)).size,recommendationDays:recDays.size,eligibleDays:eligible.length,adoptedDays:adopted.length,adoptionRate:eligible.length?Math.round(adopted.length/eligible.length*100):null,comfort:worn.length?+(worn.reduce((n,x)=>n+x.comfort,0)/worn.length).toFixed(1):null,repeatUseDays:new Set(f.filter(x=>x.actual).map(x=>x.date)).size,reasons,tryonRated:quality.length,tryonTrusted:quality.filter(x=>x.trusted===true).length};
  }
  function validateFeedback(f,items){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(f.date||''))return '请选择反馈日期';
    if(!['adopted','changed','rejected','no-outing'].includes(f.mode))return '请选择实际穿着情况';
    if(f.mode!=='no-outing'&&!cats.every(c=>(f.actual?.[c]==='outside:'+c||items.some(i=>i.id===f.actual?.[c]&&i.cat===c))))return '请完整选择实际穿着的上衣、下装和鞋履';
    if(f.mode==='adopted'&&!same(f.actual,f.recommended))return '实际穿着与推荐不同，请选择「调整了搭配」';
    if(['changed','rejected'].includes(f.mode)&&!f.reasons?.length)return '请告诉我们没有照穿的主要原因';
    if(f.mode!=='no-outing'&&(!Number.isInteger(f.comfort)||f.comfort<1||f.comfort>5))return '请选择 1–5 分的舒适度';
    return null;
  }
  const api={same,dayNumber,inTrial,summary,validateFeedback};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TrialCore=api;
})(typeof window!=='undefined'?window:globalThis);

;
(function(root){
  function recommend({items,history=[],dirty={},today,occasion='日常通勤',temperature=null,offset=0}) {
    const cats=['top','bottom','shoes'];
    const missing=cats.filter(cat=>!items.some(i=>i.cat===cat&&!dirty[i.id]));
    if(missing.length)return {selected:null,missing};
    const recent=history.filter(h=>h.date!==today&&h.date<today).sort((a,b)=>b.date.localeCompare(a.date)).slice(0,7);
    const useCount={};recent.forEach((h,n)=>Object.values(h.selected).forEach(id=>useCount[id]=(useCount[id]||0)+Math.max(1,7-n)));
    let selected={};
    cats.forEach(cat=>{
      const pool=items.filter(i=>i.cat===cat&&!dirty[i.id]).map((i,index)=>{
        let score=(i.image?4:0)-(useCount[i.id]||0)*3;
        if(occasion==='重要会议')score+=i.occasion==='formal'?5:i.occasion==='casual'?-3:0;
        if(occasion==='休闲出游')score+=i.occasion==='casual'?4:0;
        if(temperature!==null&&cat==='top')score+=temperature<18?(i.warmth==='warm'?5:i.warmth==='light'?-4:0):temperature>25?(i.warmth==='light'?5:i.warmth==='warm'?-4:0):i.warmth==='mid'?2:0;
        return {i,score,index};
      }).sort((a,b)=>b.score-a.score||a.index-b.index);
      // Offset deliberately permits exploring alternatives; every candidate remains clean.
      selected[cat]=pool[offset%pool.length].i.id;
    });
    return {selected,missing:[],hasRecent:recent.length>0};
  }
  const api={recommend};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.DailyEngine=api;
})(typeof window!=='undefined'?window:globalThis);

;
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const defaults=[{id:'t1',name:'燕麦色针织衫',cat:'top',color:'#c8bda6',kind:'knit',tag:'柔软针织 · 日常百搭'},{id:'t2',name:'纯白基础 T 恤',cat:'top',color:'#eeeee8',kind:'tee',tag:'棉质基础 · 干净清爽'},{id:'t3',name:'蓝调牛仔衬衫',cat:'top',color:'#9fbbc5',kind:'shirt',tag:'轻盈棉质 · 随性自然'},{id:'b1',name:'深蓝直筒牛仔裤',cat:'bottom',color:'#4f6270',kind:'jeans',tag:'直筒版型 · 经典耐看'},{id:'b2',name:'奶油白阔腿裤',cat:'bottom',color:'#dedccf',kind:'wide',tag:'舒适垂感 · 松弛有度'},{id:'b3',name:'摩卡色半身裙',cat:'bottom',color:'#9c8d7b',kind:'skirt',tag:'温柔 A 字 · 轻松优雅'},{id:'s1',name:'复古白色运动鞋',cat:'shoes',color:'#e6e4d8',kind:'sneaker',tag:'轻便舒适 · 全天在线'},{id:'s2',name:'可可棕乐福鞋',cat:'shoes',color:'#6e5140',kind:'loafer',tag:'复古皮革 · 通勤首选'},{id:'s3',name:'黑色简约短靴',cat:'shoes',color:'#41423d',kind:'boot',tag:'利落线条 · 酷感日常'},{id:'t4',name:'森林绿卫衣',cat:'top',color:'#65745b',kind:'knit',tag:'慵懒休闲 · 温暖陪伴'},{id:'t5',name:'暖灰针织开衫',cat:'top',color:'#b8b7ad',kind:'shirt',tag:'层次叠穿 · 低调柔和'},{id:'b4',name:'炭灰通勤西裤',cat:'bottom',color:'#777a73',kind:'wide',tag:'利落剪裁 · 职场日常'}];
function read(){try{return JSON.parse(localStorage.getItem('yiyi-v1')||'null')}catch{return null}}const saved=read();let state={items:defaults,selected:{top:'t1',bottom:'b1',shoes:'s1'},avatar:{skin:'#d4a78a',hair:'#40382e',style:'feminine',hairstyle:'long',size:100,height:168},plans:{},city:{name:'上海',lat:31.23,lon:121.47},joined:false,...saved};let filter='all',planDay=0,uploadData='',forecast=null;
function persist(){try{localStorage.setItem('yiyi-v1',JSON.stringify(state, (key, value) => window.YIYI_PUBLIC && key === 'items' ? value.map(({image, ...garment}) => garment.imageStored ? garment : {...garment, image}) : value));return true}catch{toast('设备存储空间不足，请减少上传照片后重试');return false}}
function toast(msg){$('#toast').textContent=msg;$('#toast').classList.add('show');clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),3200)}
function open(id){$(id).showModal()}$$('.close').forEach(b=>b.onclick=()=>b.closest('dialog').close());$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close()}}));
function item(id){return state.items.find(i=>i.id===id)}function current(){return Object.fromEntries(Object.entries(state.selected).map(([k,id])=>[k,item(id)]))}
function garment(i){if(!i)return '';const c=i.color;let shape='';if(i.cat==='top'){shape=i.kind==='tee'?`<path d="M52 23 34 30 16 58 39 72 48 57 48 133 122 133 122 57 131 72 154 58 136 30 118 23 102 20Q85 38 68 20Z"/>`:`<path d="M64 23 40 33 29 52 14 117 39 124 56 66 53 137 117 137 114 66 131 124 156 117 141 52 130 33 106 23Q85 36 64 23Z"/>`;shape+=`<path d="M65 23Q85 50 106 23M56 128H115M22 110 41 116M129 116 149 110" fill="none" stroke="#000" opacity=".09" stroke-width="3"/>`;if(i.kind==='shirt')shape+=`<path d="M64 23 72 45 85 35 98 45 106 23M85 35V135" fill="none" stroke="#ffffff66" stroke-width="2"/><g fill="#fff8" stroke="none"><circle cx="88" cy="57" r="1.4"/><circle cx="88" cy="77" r="1.4"/><circle cx="88" cy="97" r="1.4"/></g>`;if(i.kind==='knit')shape+=`<path d="M63 52H107M60 60H110M58 68H112M58 76H112M57 84H113M57 92H113M57 100H113M57 108H113M57 116H113" stroke="#ffffff" opacity=".12" stroke-width="1"/>`}
else if(i.cat==='bottom'){shape=i.kind==='skirt'?`<path d="M58 20H113L139 135Q86 148 31 135Z"/><path d="M67 30 60 133M87 30V140M104 30 116 135" fill="none" stroke="#0001" stroke-width="2"/>`:`<path d="M51 17H120L128 140 94 142 84 63 77 142 43 140Z"/><path d="M52 27H119M85 28V62M55 35Q69 44 73 28M98 28Q100 43 118 35" fill="none" stroke="#fff5" stroke-width="1.5"/>`}
else{shape=i.kind==='boot'?`<path d="M47 30H84V94L110 112Q124 119 122 135H30V119L45 105Z"/><path d="M91 25H124V89L147 108Q160 117 157 129H126Q125 112 110 105L91 96Z"/><path d="M30 130H123M128 123H157" stroke="#222" stroke-width="5"/>`:`<path d="M26 82 37 61 65 57 86 77 128 91Q144 95 143 116L25 118Q16 111 26 82Z"/><path d="M45 48 55 29 79 31 99 50 139 64Q157 70 156 89L120 91 85 76 65 55Z"/><path d="M24 110H143M123 83H156" fill="none" stroke="#f8f7ee" stroke-width="9"/><path d="M67 71 57 81M75 78 65 87M84 84 74 93M85 44 77 54M94 51 86 61" stroke="#fff8" fill="none" stroke-width="3"/>`}
return `<svg viewBox="0 0 170 160" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><g fill="${c}" stroke="#00000013" stroke-width="1" stroke-linejoin="round">${shape}</g></svg>`}
function modelSVG(sel=state.selected,mini=false){const a=state.avatar,top=item(sel.top)||defaults[0],bottom=item(sel.bottom)||defaults[3],shoes=item(sel.shoes)||defaults[6];const wide=bottom.kind==='wide';const skirt=bottom.kind==='skirt';const shoulder=a.style==='neutral'?6:0;const k=(a.size/100);let hair=a.hairstyle==='long'?`<path d="M94 63Q83 18 121 17Q159 20 153 67L164 149Q144 167 131 116L104 119Q93 148 80 135Z" fill="${a.hair}"/>`:a.hairstyle==='bob'?`<path d="M92 63Q85 17 123 17Q160 18 154 66L157 94Q125 110 89 93Z" fill="${a.hair}"/>`:`<path d="M92 57Q83 20 118 17Q160 11 153 59Z" fill="${a.hair}"/>`;
return `<svg viewBox="0 0 245 440" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="当前搭配的示意模特"><defs><linearGradient id="clothShade" x1="0" x2="1"><stop stop-color="#fff" stop-opacity=".1"/><stop offset=".55" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".12"/></linearGradient></defs><g transform="translate(122 0) scale(${k} ${.96+(a.height-150)/700}) translate(-122 0)">${hair}<path d="M111 78V103L98 110 106 138H139L148 110 134 103V78" fill="${a.skin}"/><ellipse cx="123" cy="59" rx="26" ry="34" fill="${a.skin}"/><path d="M95 51Q95 17 124 23Q153 22 153 52Q140 46 132 32Q117 52 95 51Z" fill="${a.hair}"/><path d="M112 63h3m18 0h3" stroke="#5e493f" stroke-width="1.5" stroke-linecap="round"/><path d="M121 77Q126 80 131 76" stroke="#ab7867" fill="none" stroke-width="1.4"/><path d="M80 129 65 233 71 254Q82 264 86 250L83 233 103 150M160 129 180 233 174 255Q164 265 160 250L163 234 142 150" fill="${a.skin}"/><path d="M96 219 100 373H117L123 267 131 373H148L150 220" fill="${a.skin}"/>
${skirt?`<path d="M95 203H151L173 322Q127 337 77 322Z" fill="${bottom.color}"/><path d="M111 218 104 323M135 218 147 323" stroke="#0001" fill="none"/>`:`<path d="M94 207H151L${wide?158:149} 372H${wide?128:132}L122 266 117 372H${wide?88:99}Z" fill="${bottom.color}"/><path d="M122 214V264M96 223Q110 234 114 216M132 217Q136 232 151 223" fill="none" stroke="#ffffff30" stroke-width="1.3"/>`}
<path d="M104 104 83 111 ${70-shoulder} 130 57 213 80 220 96 151 91 226Q122 233 153 226L148 151 164 220 187 213 ${175+shoulder} 130 160 111 139 104Q124 119 104 104Z" fill="${top.color}"/><path d="M104 104Q123 129 139 104M94 218Q123 224 152 218M60 205 81 211M163 211 184 205" fill="none" stroke="#00000016" stroke-width="3"/>
${top.kind==='shirt'?'<path d="M105 105 113 127 123 118 133 127 139 105M123 118V226" fill="none" stroke="#fff5" stroke-width="1.5"/>':''}
<path d="M104 104 83 111 70 130 57 213 80 220 96 151 91 226Q122 233 153 226L148 151 164 220 187 213 175 130 160 111 139 104Q124 119 104 104Z" fill="url(#clothShade)"/>
${shoes.kind==='boot'?`<path d="M98 350H117L118 393Q104 404 82 401L81 393 98 382ZM131 350H150L150 382 167 393 166 401Q144 405 130 393Z" fill="${shoes.color}"/>`:`<path d="M99 372H117L118 393Q100 403 80 399L79 392 97 382ZM131 372H149L151 382 169 392 167 399Q146 403 130 393Z" fill="${shoes.color}"/><path d="M80 398Q103 403 117 395M132 395Q147 403 168 398" fill="none" stroke="#f3f0e6" stroke-width="4"/>`}</g></svg>`}
function renderClothes(){const grid=$('#clothesGrid');grid.replaceChildren();state.items.filter(i=>filter==='all'||i.cat===filter).forEach(i=>{let b=document.createElement('button');b.className='clothing-card'+(state.selected[i.cat]===i.id?' selected':'');b.setAttribute('aria-label','试穿'+i.name);b.setAttribute('aria-pressed',state.selected[i.cat]===i.id);const art=document.createElement('div');art.className='art';art.style.background=i.cat==='top'?'#f0eee7':i.cat==='bottom'?'#ecede8':'#f0f1eb';if(i.image){let img=document.createElement('img');img.src=i.image;img.alt=i.name;art.append(img)}else art.innerHTML=garment(i);b.append(art);if(state.selected[i.cat]===i.id){let c=document.createElement('span');c.className='check';c.textContent='✓';b.append(c)}const info=document.createElement('div');info.className='item-info';const name=document.createElement('strong');name.textContent=i.name;const tag=document.createElement('small'),dot=document.createElement('span');dot.className='color-dot';dot.style.background=i.color;tag.append(dot,document.createTextNode(i.tag||'我的单品 · 自己的风格'));info.append(name,tag);b.append(info);b.onclick=()=>{state.selected[i.cat]=i.id;persist();renderClothes();renderModel()};grid.append(b)});$('#itemCount').textContent=state.items.length;$('#closetCount').textContent=state.items.length+' 件单品'}
function renderModel(){$('#model').innerHTML=modelSVG();$('#selectedPieces').replaceChildren();Object.values(current()).forEach(i=>{const chip=document.createElement('div');chip.className='selected-chip';chip.innerHTML=garment(i);const t=document.createElement('span');t.textContent=i.name;chip.append(t);$('#selectedPieces').append(chip)})}
$$('[data-cat]').forEach(b=>b.onclick=()=>{filter=b.dataset.cat;$$('[data-cat]').forEach(x=>x.classList.toggle('active',x===b));renderClothes()});
function shuffle(){for(const cat of ['top','bottom','shoes']){const pool=state.items.filter(i=>i.cat===cat&&i.id!==state.selected[cat]);if(pool.length)state.selected[cat]=pool[Math.floor(Math.random()*pool.length)].id}persist();renderClothes();renderModel()}
$('#shuffle').onclick=()=>{shuffle();toast('新的搭配灵感，试试看！')};
const now=new Date(),monday=new Date(now);monday.setDate(now.getDate()+((8-(now.getDay()||7))%7||7));monday.setHours(12,0,0,0);const days=Array.from({length:7},(_,i)=>{let d=new Date(monday);d.setDate(d.getDate()+i);return d});const dayNames=['周一','周二','周三','周四','周五','周六','周日'];function dayKey(i){let d=days[i];return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`}function dateLabel(d){return `${d.getMonth()+1}.${String(d.getDate()).padStart(2,'0')}`}$('#weekRange').textContent=`${dateLabel(days[0])} — ${dateLabel(days[6])}`;
function renderWeek(){$('#weekGrid').replaceChildren();days.forEach((d,i)=>{let p=state.plans[dayKey(i)],card=document.createElement('div');card.className='day-card';let head=document.createElement('div');head.className='day-head';const name=document.createElement('b');name.textContent=dayNames[i];let date=document.createElement('span');date.textContent=dateLabel(d);head.append(name,date);let art=document.createElement('button');art.className='day-art'+(p?'':' empty');art.setAttribute('aria-label',`${dayNames[i]}${p?'查看已安排穿搭':'安排穿搭'}`);if(p)art.innerHTML=modelSVG(p.selected,true);else art.textContent='＋';art.onclick=()=>{if(p){state.selected={...p.selected};persist();renderModel();renderClothes();switchView('studio');toast('已在试衣镜中打开'+dayNames[i]+'的穿搭')}else showPlan(i)};const note=document.createElement('small');note.textContent=p?p.occasion:'留一点空间给灵感';card.append(head,art,note);if(p){let acts=document.createElement('div');acts.className='day-actions';const edit=document.createElement('button');edit.textContent='改';edit.setAttribute('aria-label','修改'+dayNames[i]+'穿搭');edit.onclick=()=>showPlan(i);const del=document.createElement('button');del.textContent='×';del.setAttribute('aria-label','移除'+dayNames[i]+'穿搭');del.onclick=()=>{delete state.plans[dayKey(i)];persist();renderWeek();toast('已移除这天的穿搭')};acts.append(edit,del);card.append(acts)}$('#weekGrid').append(card)})}
function showPlan(i=0){planDay=i;$('#planDays').replaceChildren();days.forEach((d,j)=>{let b=document.createElement('button');b.textContent=dayNames[j]+' '+dateLabel(d);b.className=j===i?'active':'';b.onclick=()=>{planDay=j;$$('#planDays button').forEach((v,k)=>v.classList.toggle('active',j===k))};$('#planDays').append(b)});$('#occasion').value=state.plans[dayKey(i)]?.occasion||'日常通勤';open('#planDialog')}
$('#saveLook').onclick=()=>showPlan(days.findIndex((_,i)=>!state.plans[dayKey(i)])<0?0:days.findIndex((_,i)=>!state.plans[dayKey(i)]));$('#confirmPlan').onclick=()=>{state.plans[dayKey(planDay)]={selected:{...state.selected},occasion:$('#occasion').value};if(persist()){$('#planDialog').close();renderWeek();toast('已安排到下'+dayNames[planDay]+'，出门更从容')}};
$('#autoWeek').onclick=()=>{let count=0;days.forEach((_,i)=>{if(state.plans[dayKey(i)])return;let selected={};['top','bottom','shoes'].forEach((cat,j)=>{let pool=state.items.filter(x=>x.cat===cat);selected[cat]=pool[(i+j)%pool.length].id});state.plans[dayKey(i)]={selected,occasion:i>4?'休闲出游':'日常通勤'};count++});persist();renderWeek();toast(count?'已补齐 '+count+' 天穿搭，点击模特可查看与微调':'一周已安排完成，可逐天修改')};
function switchView(view){document.body.dataset.view=view;$$('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));$('#studioView').hidden=view==='planner';$('#weekSection').hidden=view==='wardrobe';$('#viewTitle').textContent={studio:'穿搭工作室',wardrobe:'我的衣橱',planner:'一周穿搭'}[view];$('#headline').textContent={studio:'今天，也穿得很像自己。',wardrobe:'喜欢的衣服，都在这里。',planner:'把下周的美好，提前穿好。'}[view];$('#subhead').textContent={studio:'少一点「穿什么」的纠结，多一点出门的期待。',wardrobe:'让每一件喜欢的单品，都有出场的机会。',planner:'用一点点准备，换七天不慌不忙的早晨。'}[view];if(window.YIYI_PUBLIC){$('#headline').textContent={studio:'今天穿什么？',wardrobe:'我的衣橱',planner:'一周穿搭'}[view];$('#subhead').textContent={studio:'搭好今天的一套，出门前少一个决定。',wardrobe:'拍照添加衣物，点选单品搭配。',planner:'提前搭好未来七天。'}[view];}window.scrollTo({top:0,behavior:'smooth'})}$$('[data-view]').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
function fillAvatar(){const a=state.avatar;$('#bodyStyle').value=a.style;$('#hairStyle').value=a.hairstyle;$('#hairColor').value=a.hair;$('#bodySize').value=a.size;$('#bodyHeight').value=a.height;$('#bodyValue').textContent=a.size+'%';$('#heightValue').textContent=a.height+' cm';$('#skinOptions').replaceChildren();['#f0d3ba','#e2b999','#d4a78a','#b98262','#8f5e43','#5c3b2d'].forEach(c=>{let b=document.createElement('button');b.style.background=c;b.className=c===a.skin?'active':'';b.setAttribute('aria-label','选择肤色 '+c);b.onclick=()=>{a.skin=c;fillAvatar();renderModel();renderWeek()};$('#skinOptions').append(b)})}
if (!window.YIYI_PUBLIC) {let avatarBefore;function showAvatar(){avatarBefore={...state.avatar};fillAvatar();open('#avatarDialog')}$('#editAvatar').onclick=showAvatar;$('#avatarNav').onclick=showAvatar;$('#profile').onclick=showAvatar;[['#bodyStyle','style'],['#hairStyle','hairstyle'],['#hairColor','hair'],['#bodySize','size'],['#bodyHeight','height']].forEach(([s,k])=>$(s).oninput=e=>{state.avatar[k]=['size','height'].includes(k)?Number(e.target.value):e.target.value;$('#bodyValue').textContent=state.avatar.size+'%';$('#heightValue').textContent=state.avatar.height+' cm';renderModel();renderWeek()});$('#saveAvatar').onclick=()=>{if(persist()){avatarBefore=null;$('#avatarDialog').close();toast('你的专属模特已保存')}};$('#avatarDialog').addEventListener('close',()=>{if(avatarBefore){state.avatar=avatarBefore;avatarBefore=null;renderModel();renderWeek()}});let bg=0;$('#rotate').onclick=()=>{bg++;$('.mirror').style.background=['#eeeee5','#e4e8e1','#eee5de'][bg%3]};}
if (!window.YIYI_PUBLIC) {$$('.upload-trigger').forEach(b=>b.onclick=()=>open('#uploadDialog'));$('#uploadFile').onchange=async e=>{const file=e.target.files[0];uploadData='';$('#uploadPreview').hidden=true;if(!file)return;if(file.size>8*1024*1024||!['image/jpeg','image/png','image/webp'].includes(file.type)){e.target.value='';toast('请选择 8MB 以内的 JPG、PNG 或 WebP 图片');return}try{const data=await new Promise((res,rej)=>{let reader=new FileReader;reader.onload=()=>res(reader.result);reader.onerror=rej;reader.readAsDataURL(file)});const img=new Image;img.src=data;await img.decode();const cv=document.createElement('canvas'),scale=Math.min(1,700/Math.max(img.width,img.height));cv.width=Math.round(img.width*scale);cv.height=Math.round(img.height*scale);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);uploadData=cv.toDataURL('image/webp',.82);$('#uploadPreview').src=uploadData;$('#uploadPreview').hidden=false;if(!$('#uploadName').value)$('#uploadName').value=file.name.replace(/\.[^.]+$/,'').slice(0,30)}catch{e.target.value='';toast('图片读取失败，请更换一张图片')}};}
if (!window.YIYI_PUBLIC) {$('#uploadForm').onsubmit=e=>{e.preventDefault();if(!uploadData){toast('请先选择并等待图片读取完成');return}let cat=$('#uploadCategory').value,newItem={id:'u'+Date.now(),name:$('#uploadName').value.trim(),cat,color:$('#uploadColor').value,kind:cat==='top'?'tee':cat==='bottom'?'wide':'sneaker',image:uploadData,tag:'我的实拍 · 原图保留',warmth:$('#uploadWarmth').value,occasion:$('#uploadOccasion').value};if(!newItem.name)return;state.items.unshift(newItem);if(!persist()){state.items.shift();return}state.selected[cat]=newItem.id;persist();filter='all';$$('[data-cat]').forEach(b=>b.classList.toggle('active',b.dataset.cat==='all'));renderClothes();renderModel();$('#uploadDialog').close();$('#uploadForm').reset();$('#uploadPreview').hidden=true;uploadData='';toast('新衣服已加入衣橱，原图已用于搭配台')};}
if (!window.YIYI_PUBLIC) {['#proNav','#proBanner'].forEach(s=>$(s).onclick=()=>{updateJoined();open('#proDialog')});function updateJoined(){$('#joinWaitlist').textContent=state.joined?'✓ 已记录内测意向':'加入内测意向名单';$('#joinWaitlist').disabled=state.joined}$$('[data-billing]').forEach(b=>b.onclick=()=>{$$('[data-billing]').forEach(x=>x.classList.toggle('active',x===b));const year=b.dataset.billing==='year';$('#price').textContent=year?'¥198':'¥24';$('#priceUnit').textContent=year?'/ 年':'/ 月';$('#priceSub').textContent=year?'相当于每月 ¥16.50':'每月订阅，灵活选择'});$('#joinWaitlist').onclick=()=>{state.joined=true;if(persist()){updateJoined();toast('已在此设备记录你的内测意向（尚未提交至服务器）')}};}
$('#help').onclick=()=>toast('拍照加入衣橱，选衣服搭配，再保存进一周计划。');
function weatherText(code){if(code===0)return '晴';if(code<=3)return '多云';if(code<=48)return '有雾';if(code<=67)return '有雨';if(code<=77)return '有雪';if(code<=82)return '阵雨';return '雷雨'}
let weatherRequest;
async function loadWeather() {
  weatherRequest?.abort();
  const controller = new AbortController();
  weatherRequest = controller;
  const city = {...state.city};
  forecast = null;
  $('#weatherTitle').textContent = city.name;
  $('#weatherDetail').textContent = '天气稍后更新';
  const timer = setTimeout(() => controller.abort(), window.YIYI_PUBLIC ? 3500 : 12000);
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=14&timezone=auto`;
    const response = await fetch(url, {signal:controller.signal});
    if (!response.ok) throw Error('天气不可用');
    const result = await response.json();
    if (weatherRequest !== controller) return;
    forecast = result;
    const temp = Math.round(result.current.temperature_2m);
    const desc = weatherText(result.current.weather_code);
    $('#weatherTitle').textContent = `${city.name} · ${temp}°C ${desc}`;
    $('#weatherDetail').textContent = `今日 ${Math.round(result.daily.temperature_2m_min[0])}° – ${Math.round(result.daily.temperature_2m_max[0])}° · 降水概率 ${result.daily.precipitation_probability_max[0]}%`;
    $('.weather-icon').textContent = desc.includes('雨') ? '☂' : desc === '晴' ? '☀' : '☁';
    $('#weatherTip').textContent = temp < 12 ? '今天偏凉，建议添加保暖外套' : temp < 22 ? '温柔叠穿，轻松应对早晚温差' : '轻盈透气，给今天一点清爽';
  } catch {
    if (weatherRequest !== controller) return;
    $('#weatherDetail').textContent = '暂未获取实时天气';
    $('#weatherTip').textContent = '出门前记得查看当地天气';
  } finally {
    clearTimeout(timer);
    if (weatherRequest === controller && typeof renderDaily === 'function') renderDaily();
  }
}
$('#cityBtn').onclick=()=>open('#cityDialog');$('#searchCity').onclick=async()=>{const q=$('#citySearch').value.trim();if(!q)return;$('#cityResults').textContent='正在查找…';$('#searchCity').disabled=true;try{const r=await fetch('https://geocoding-api.open-meteo.com/v1/search?name='+encodeURIComponent(q)+'&count=6&language=zh&format=json',{signal:AbortSignal.timeout(12000)});if(!r.ok)throw Error();let data=await r.json();$('#cityResults').replaceChildren();if(!data.results?.length)$('#cityResults').textContent='未找到城市，试试拼音或英文名称。';for(const c of data.results||[]){let b=document.createElement('button');b.textContent=[c.name,c.admin1,c.country].filter(Boolean).join(' · ');b.onclick=()=>{state.city={name:c.name,lat:c.latitude,lon:c.longitude};persist();$('#cityDialog').close();loadWeather()};$('#cityResults').append(b)}}catch{$('#cityResults').textContent='暂时无法搜索，请检查网络后重试。'}finally{$('#searchCity').disabled=false}};$('#citySearch').onkeydown=e=>{if(e.key==='Enter')$('#searchCity').click()};
if (!window.YIYI_PUBLIC) { renderClothes(); renderModel(); renderWeek(); }
setTimeout(loadWeather, 0);

;
// Photography uses the original uploaded photo or a bounded cell in a generated demo contact sheet.
const PHOTO_IDS=['t1','t2','t3','b1','b2','b3','s1','s2','s3','t4','t5','b4'];
const photoMeta={t1:['warm','all'],t2:['light','casual'],t3:['mid','all'],b1:['mid','casual'],b2:['mid','formal'],b3:['mid','all'],s1:['light','casual'],s2:['mid','formal'],s3:['warm','all'],t4:['warm','casual'],t5:['warm','formal'],b4:['mid','formal']};
state.history=state.history||[];state.dirty=state.dirty||{};state.dailyOccasion=state.dailyOccasion||'日常通勤';
state.items.forEach(i=>{if(photoMeta[i.id]){i.warmth=i.warmth||photoMeta[i.id][0];i.occasion=i.occasion||photoMeta[i.id][1]}});
let previewMode='photo',suggestionOffset=0;
function localDate(d=new Date()){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function photoNode(i){const frame=document.createElement('div');frame.className='photo-item';if(!i)return frame;frame.setAttribute('role','img');frame.setAttribute('aria-label',i.name+(i.image?'，我的实拍':'，写实示例图'));if(i.image){const img=document.createElement('img');img.src=i.image;img.alt=i.name;frame.append(img)}else{const idx=PHOTO_IDS.indexOf(i.id);frame.classList.add('catalog-photo');frame.style.backgroundPosition=`${(idx%3)*50}% ${Math.floor(idx/3)*100/3}%`;frame.style.backgroundImage='url("assets/wardrobe-preview.jpg")'}return frame}
function photoBoard(sel=state.selected){const board=document.createElement('div');board.className='photo-board';for(const cat of ['top','bottom','shoes']){const i=item(sel[cat]);if(!i)continue;const p=photoNode(i);p.classList.add('board-'+cat);board.append(p)}return board}
const originalClothes=renderClothes;
renderClothes=function(){originalClothes();const items=state.items.filter(i=>filter==='all'||i.cat===filter);$$('#clothesGrid .clothing-card').forEach((card,n)=>{const i=items[n],art=card.querySelector('.art');card.setAttribute('aria-label','搭配'+i.name);art.replaceChildren(photoNode(i));const badge=document.createElement('span');badge.className='photo-source';badge.textContent=i.image?'我的实拍':'写实示例';art.append(badge);if(state.dirty[i.id]){const dirty=document.createElement('span');dirty.className='dirty-badge';dirty.textContent='待洗';card.append(dirty)}card.querySelector('.item-info small').title=i.image?'照片来自你的上传':'AI 生成的写实示例，非用户衣物';});$('#closetCount').textContent=state.items.length+' 件 · 原图衣橱'};
const originalModel=renderModel;
renderModel=function(){originalModel();$('.mirror').classList.toggle('photo-mode',previewMode==='photo');if(previewMode==='photo'){$('#model').replaceChildren(photoBoard());$('#previewBadge').textContent='原图搭配';$('#previewNote').textContent='按原图拼搭，保留衣服细节 · 非 AI 上身';$('#lookName').textContent='看见真实的面料与细节'}else{$('#previewBadge').textContent='轮廓示意';$('#previewNote').textContent='轮廓与配色参考 · 非真实上身效果';$('#lookName').textContent='轮廓参考 · 可自定义模特'}$$('#selectedPieces .selected-chip').forEach((chip,n)=>{chip.querySelector('svg')?.remove();chip.prepend(photoNode(Object.values(current())[n]))});renderDaily()};
const originalWeek=renderWeek;
renderWeek=function(){originalWeek();$$('#weekGrid .day-card').forEach((card,n)=>{const plan=state.plans[dayKey(n)];if(plan){const art=card.querySelector('.day-art');art.replaceChildren(photoBoard(plan.selected));art.setAttribute('aria-label',dayNames[n]+'查看已安排穿搭');}})};
if ($('#photoMode')) $('#photoMode').onclick=()=>{previewMode='photo';$('#photoMode').classList.add('active');$('#shapeMode').classList.remove('active');renderModel()};
if ($('#shapeMode')) $('#shapeMode').onclick=()=>{previewMode='shape';$('#shapeMode').classList.add('active');$('#photoMode').classList.remove('active');renderModel()};
function renderDaily(){if(!$('#dailyPhotoStack'))return;$('#dailyPhotoStack').replaceChildren(photoBoard());$('#laundryCount').textContent=Object.keys(state.dirty).length;const today=localDate(),worn=state.history.find(h=>h.date===today),same=worn&&['top','bottom','shoes'].every(c=>worn.selected[c]===state.selected[c]);$('#wearToday').textContent=same?'✓ 今天已记录':'✓ 今天穿这套';$('#wearToday').disabled=!!same;const dirty=Object.values(state.selected).some(id=>state.dirty[id]);$('#laundryCurrent').disabled=dirty;$('#laundryCurrent').textContent=dirty?'已在待洗清单':'穿后放入待洗';const t=forecast?Math.round(forecast.current.temperature_2m):null;const reason=[];if(t!==null)reason.push(`${state.city.name} ${t}° · ${t<18?'适合针织与叠穿':t>25?'轻薄透气更舒服':'轻便搭配，留意温差'}`);else reason.push('天气暂未就绪，先按场合与穿搭记录推荐');if(state.history.some(h=>h.date!==today))reason.push('换套建议会优先选择最近少穿的单品');else reason.push('从今天开始记录，建议会逐渐参考你的穿衣习惯');if(dirty)reason.push('这套有待洗单品，建议先换一套');if(t!==null&&t<12)reason.push('气温较低，出门请额外加保暖外套');$('#dailyReason').replaceChildren(...reason.map(t=>{const p=document.createElement('p');p.textContent=t;return p}));const history=$('#dailyHistory');history.replaceChildren();if(worn){const t=document.createElement('span');t.textContent='今日已穿：'+Object.values(worn.selected).map(id=>item(id)?.name||'已移除单品').join(' + ');const undo=document.createElement('button');undo.textContent='撤销记录';undo.onclick=()=>{const before=state.history;state.history=state.history.filter(h=>h.date!==today);if(!persist()){state.history=before;return}renderDaily();toast('已撤销今天的穿搭记录')};history.append(t,undo)}else history.textContent='今天还没记录 · 一键确认，让衣橱记住你的日常';}
$('#dailyOccasion').value=state.dailyOccasion;
function recommendToday(){const result=DailyEngine.recommend({items:state.items,dirty:state.dirty,history:state.history,today:localDate(),occasion:state.dailyOccasion,temperature:forecast?forecast.current.temperature_2m:null,offset:suggestionOffset});if(!result.selected){const names={top:'上衣',bottom:'下装',shoes:'鞋履'};toast('可穿'+result.missing.map(c=>names[c]).join('、')+'不足，请上传或将洗好的衣服标记为可穿');return}state.selected=result.selected;suggestionOffset++;persist();renderClothes();renderModel();toast('已按场合、温度与近期记录挑选，并排除待洗单品')}
$('#recommendToday').onclick=recommendToday;$('#dailyOccasion').onchange=e=>{state.dailyOccasion=e.target.value;suggestionOffset=0;persist();recommendToday()};
$('#wearToday').onclick=()=>{if(Object.values(state.selected).some(id=>state.dirty[id])){toast('这套有待洗单品，请换一套或先确认衣服已洗好');return}const before=[...state.history];state.history=state.history.filter(h=>h.date!==localDate());state.history.unshift({date:localDate(),selected:{...state.selected},occasion:state.dailyOccasion});state.history=state.history.slice(0,90);if(!persist()){state.history=before;return}renderDaily();toast('今天的穿搭已记录，之后会减少连续重复推荐')};
$('#laundryCurrent').onclick=()=>{const before={...state.dirty};for(const cat of ['top','bottom'])state.dirty[state.selected[cat]]=true;if(!persist()){state.dirty=before;return}renderClothes();renderDaily();toast('上衣与下装已放入待洗，之后的每日推荐会跳过它们')};
function renderLaundry(){const list=$('#laundryList');list.replaceChildren();const items=state.items.filter(i=>state.dirty[i.id]);if(!items.length){const p=document.createElement('p');p.className='laundry-empty';p.textContent='衣服都准备好了，今天也可以轻松出门。';list.append(p)}for(const i of items){const row=document.createElement('div');row.className='laundry-row';const name=document.createElement('strong');name.textContent=i.name;const b=document.createElement('button');b.textContent='✓ 已洗好';b.className='outline';b.onclick=()=>{delete state.dirty[i.id];if(!persist()){state.dirty[i.id]=true;return}renderLaundry();renderClothes();renderDaily();toast('已恢复为可穿单品')};row.append(photoNode(i),name,b);list.append(row)}}
$('#openLaundry').onclick=()=>{renderLaundry();open('#laundryDialog')};$('#laundryDialog .close').onclick=()=>$('#laundryDialog').close();
// Keep recommendation changes explicit: asynchronous weather updates never replace a user's selection.
$('#shuffle').onclick=recommendToday;
const baseSwitchView=switchView;switchView=function(view){baseSwitchView(view);$('#dailyPick').hidden=view!=='studio'};
$('#help').onclick=()=>toast('上传实拍 → 查看原图搭配 → 今天穿这套 → 穿后放入待洗。写实示例为 AI 生成，真实试衣尚未接入。');
renderClothes();renderModel();renderWeek();

;
const PUBLIC_MODE=window.YIYI_PUBLIC===true;
const trialUI=document.createElement('section');trialUI.className='trial-strip';trialUI.id='trialStrip';trialUI.innerHTML=`<div><div class="eyebrow">14 DAYS TO FIND YOUR EVERYDAY STYLE</div><h2 id="trialStripTitle">让自己的衣服，真正参与每一天。</h2><p id="trialStripDetail">拍照加衣、查看搭配、记录穿着</p></div><div class="trial-strip-actions"><span id="cloudStatus">本设备记录</span><button class="dark" id="openTrial">开始两周体验 ↗</button></div>`;$(PUBLIC_MODE?'#weekSection':'#weather').after(trialUI);
const trialNav=document.createElement('button');trialNav.innerHTML='<span>◷</span> 两周体验';trialNav.id='trialNav';$('nav').append(trialNav);
$('#wearToday').after(Object.assign(document.createElement('button'),{id:'openActualFeedback',className:'outline',textContent:PUBLIC_MODE?'记录实穿':'晚上：记录实际穿着'}));
const tryBtn=document.createElement('button');tryBtn.id='openTryon';tryBtn.className='dark full tryon-main-button';tryBtn.textContent='✧ 用自己的照片试穿';if(!PUBLIC_MODE)$('#saveLook').before(tryBtn);
const dialogs=document.createElement('div');dialogs.innerHTML=`
<dialog id="trialDialog" class="wide-dialog"><div class="dialog-head"><div><div class="eyebrow">YOUR TWO-WEEK STYLE DIARY</div><h2>从自己的衣橱，找到每天的答案。</h2></div><button class="close">×</button></div><div class="service-notice" id="trialServiceNotice"></div><div class="trial-steps" id="trialSteps"></div><div class="trial-start" id="trialStart"><label class="check-label"><input type="checkbox" id="trialCloudConsent">我同意将衣物照片、穿搭记录与填写的反馈保存到一衣云端，供测试负责人汇总本次体验。我可随时导出或删除。</label><button class="dark full" id="startTrial">开始我的 14 天体验</button><p class="muted">无需付费；测试不会自动订阅。本人照片默认只保存在此浏览器，生成试衣前会另行征求同意。</p></div><div id="trialProgress"></div><div class="trial-tool-row"><button class="outline" id="syncNow">同步云端</button><button class="outline" id="restoreCloud">恢复云端记录</button><button class="outline" id="exportMyData">导出我的记录</button><button class="outline" id="openAdmin" hidden>查看测试汇总</button><button class="text-danger" id="deleteMyData">删除我的测试数据</button></div><p class="muted" id="trialSyncDetail">云同步开始后，你可以在相同 ChatGPT 账号下恢复衣橱。多人测试需要负责人分别邀请。</p></dialog>
<dialog id="tryonDialog" class="wide-dialog"><div class="dialog-head"><div><div class="eyebrow">YOUR CLOTHES. YOUR PHOTO.</div><h2>看看这套衣服穿在自己身上。</h2></div><button class="close">×</button></div><div class="service-notice" id="tryonAvailability"></div><div class="tryon-layout"><div><label class="person-upload"><input type="file" id="personPhotoFile" accept="image/jpeg,image/png,image/webp"><span id="personPhotoPrompt">＋ 添加本人正面全身照</span><img id="personPhotoPreview" alt="本人原始照片" hidden></label><p class="muted">自然站立、光线充足、完整露出双脚。支持 JPG / PNG / WebP，最大 8MB；上传后会压缩。</p><button class="text-danger" id="removePersonPhoto">删除本设备的本人照片</button></div><div><h3>本次试穿的衣服</h3><div id="tryonGarments"></div><label class="check-label"><input id="includeShoes" type="checkbox" checked>同时试穿鞋履（增加 1 个生成步骤）</label><label class="check-label"><input type="checkbox" id="tryonConsent">照片属于本人或已取得授权；同意本次将本人照和选中衣物照片发送给 FASHN 生成试衣，并由一衣私密保存结果。</label><p class="muted">AI 可能改变面部、图案或版型，请对照原图检查；不用于判断尺码是否合身。上衣和下装分步生成，鞋履可选。</p><button class="dark full" id="generateTryon">生成上身预览</button><button class="outline full" id="resumeTryon" hidden>继续查看上次任务</button><div class="tryon-status" id="tryonStatus" role="status"></div></div></div><div id="tryonResultSection" hidden><div class="result-heading"><h3>原图与 AI 生成效果</h3><span id="tryonResultLabel"></span></div><div class="tryon-comparison"><figure><img id="resultOriginal" alt="生成时的本人原始照片"><figcaption>生成前 · 本人原图</figcaption></figure><figure><img id="resultGenerated" alt="AI 试衣生成结果"><figcaption>生成后 · AI 模拟，非实际试穿</figcaption></figure></div><div class="quality-feedback"><h3>这个结果能帮助你决定穿什么吗？</h3><div class="choice-row" id="qualityChoice"><button data-trusted="yes">能，细节可信</button><button data-trusted="no">不能，有明显问题</button></div><div class="reason-chips" id="qualityIssues"><label><input type="checkbox" value="脸不像本人">脸不像本人</label><label><input type="checkbox" value="衣服细节变了">衣服细节变了</label><label><input type="checkbox" value="身材或姿势变了">身材或姿势变了</label><label><input type="checkbox" value="版型不自然">版型不自然</label><label><input type="checkbox" value="鞋履有问题">鞋履有问题</label></div><button id="saveQuality" class="dark">提交效果反馈</button><a id="downloadTryon" class="outline" download="yiyi-tryon.jpg">保存效果图</a></div></div></dialog>
<dialog id="actualFeedbackDialog" class="wide-dialog"><form id="actualFeedbackForm"><div class="dialog-head"><div><div class="eyebrow">WHAT DID YOU REALLY WEAR?</div><h2>今天，你实际穿了什么？</h2></div><button class="close" type="button">×</button></div><label>反馈日期<input type="date" id="feedbackDate" required></label><label>实际情况<select id="feedbackMode"><option value="adopted">按当天推荐穿了</option><option value="changed">调整了部分搭配</option><option value="rejected">穿了另一套</option><option value="no-outing">今天未出门</option></select></label><div id="actualItemSelectors" class="actual-selectors"></div><div class="feedback-reasons" id="feedbackReasons"><h3>没有照穿的主要原因（可多选）</h3><div class="reason-chips">${['不符合我的风格','场合不合适','天气不合适','衣服待洗或找不到','搭配重复了','其他'].map(v=>`<label><input type="checkbox" name="reason" value="${v}">${v}</label>`).join('')}</div></div><div class="form-row"><label>穿着舒适度<select id="feedbackComfort"><option value="5">5 · 很舒服</option><option value="4">4 · 舒服</option><option value="3">3 · 一般</option><option value="2">2 · 不太舒服</option><option value="1">1 · 很不舒服</option></select></label><label>搭配满意度<select id="feedbackSatisfaction"><option value="5">5 · 很满意</option><option value="4">4 · 满意</option><option value="3">3 · 一般</option><option value="2">2 · 不太满意</option><option value="1">1 · 很不满意</option></select></label></div><label>如果持续帮到你，你愿意付费吗？<select id="feedbackWillingness"><option value="unsure">暂不确定</option><option value="yes">愿意</option><option value="no">不愿意</option></select></label><label>还想告诉我们什么？（选填）<textarea id="feedbackComment" maxlength="1000" rows="3" placeholder="例如：裤子太正式，最后换成了牛仔裤"></textarea></label><button class="dark full" type="submit">保存实际穿着与反馈</button><p class="muted">反馈用于验证真实采用情况，不会因为点过「打算穿」就计为实际采用。</p></form></dialog>
<dialog id="adminDialog" class="wide-dialog"><div class="dialog-head"><div><div class="eyebrow">EVIDENCE BEFORE EXPANSION</div><h2>两周用户测试汇总</h2></div><button class="close">×</button></div><p class="muted">汇总仅限测试负责人访问。采用率只计算有推荐、有实际穿着反馈的日期；未出门不计入分母。小样本仅用于发现问题。</p><div id="adminReport"></div><button id="refreshAdmin" class="outline">刷新汇总</button><button id="downloadAdmin" class="dark">导出汇总 CSV</button></dialog>
<dialog id="deleteDataDialog"><div class="dialog-head"><h2>删除本人测试数据？</h2><button class="close">×</button></div><p class="muted">将删除你在一衣云端的衣物照片、生成结果和测试记录，同时清除当前设备的衣橱与本人照片。其他设备上的本地副本不会自动清除。此操作无法撤销，建议先导出。</p><label class="check-label"><input type="checkbox" id="deleteConfirm">我已理解，并确认删除本人数据</label><button class="danger full" id="confirmDelete">确认删除本人数据</button></dialog>`;document.body.append(dialogs);
$$('#trialDialog .close,#tryonDialog .close,#actualFeedbackDialog .close,#adminDialog .close,#deleteDataDialog .close').forEach(b=>b.onclick=()=>b.closest('dialog').close());
state.trial=state.trial||{feedback:{},recommendations:[],tryonFeedback:{}};state.trial.feedback=state.trial.feedback||{};state.trial.recommendations=state.trial.recommendations||[];state.trial.tryonFeedback=state.trial.tryonFeedback||{};state.intentions=state.intentions||[];
if(!state.trial.actualHistoryMigrated){state.intentions.push(...(state.history||[]));state.history=[];state.trial.actualHistoryMigrated=true;}
let sessionInfo=null,cloudVersion=0,cloudEnabled=false,cloudTimer,cloudBusy=false,cloudAgain=false,cloudPaused=false,personPhoto=null,lastResult=null,tryonBusy=false,chosenQuality=null,adminRows=[],pendingResume=null;
const localPersist=persist;
persist=function(){const ok=localPersist();if(ok&&cloudEnabled&&!cloudPaused){cloudLabel('本地已保存 · 待同步');clearTimeout(cloudTimer);cloudTimer=setTimeout(()=>syncCloud(),1000)}return ok};
function dbOpen(){return new Promise((resolve,reject)=>{const r=indexedDB.open('yiyi-private-photos',1);r.onupgradeneeded=()=>r.result.createObjectStore('photos');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
async function photoStore(key,value){const db=await dbOpen();return new Promise((resolve,reject)=>{const tx=db.transaction('photos',value===undefined?'readonly':'readwrite'),s=tx.objectStore('photos');const r=value===undefined?s.get(key):value===null?s.delete(key):s.put(value,key);let result;r.onsuccess=()=>result=r.result;tx.oncomplete=()=>{db.close();resolve(result)};tx.onerror=()=>{db.close();reject(tx.error)}})}
async function api(path,options={}){const r=await fetch(path,{...options,headers:{...(options.body?{'Content-Type':'application/json'}:{}),...options.headers},signal:options.signal||AbortSignal.timeout(35000)});let b;try{b=await r.json()}catch{b={message:'服务连接异常，请稍后重试'}}if(!r.ok){const e=new Error(b.message||'请求失败');e.status=r.status;throw e}return b}
const eventQueue=()=>state.trial.pendingEvents=state.trial.pendingEvents||[];
function track(type,payload,date=localDate()){if(!state.trial.startDate||!TrialCore.inTrial(date,state.trial.startDate))return;eventQueue().push({id:crypto.randomUUID(),type,date,payload});state.trial.pendingEvents=eventQueue().slice(-300);}
function cloudLabel(text,error=false){$('#cloudStatus').textContent=text;$('#cloudStatus').classList.toggle('sync-error',error)}
async function imageData(source){if(source.startsWith('data:image/'))return source;const r=await fetch(source);if(!r.ok)throw Error('衣物照片读取失败');return new Promise((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(f.result);f.onerror=reject;r.blob().then(b=>f.readAsDataURL(b))})}
async function digestBytes(bytes){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('')}
async function syncCloud(){
  if(!cloudEnabled||cloudPaused)return;if(cloudBusy){cloudAgain=true;return}cloudBusy=true;cloudLabel('同步中…');
  try{
    const snapshot=JSON.parse(JSON.stringify(state));for(const i of snapshot.items){if(i.image?.startsWith('data:')){const blob=await(await fetch(i.image)).blob(),bytes=await blob.arrayBuffer(),hash=await digestBytes(bytes);await api('/api/images/'+hash,{method:'PUT',headers:{'Content-Type':blob.type},body:blob});i.image='/api/images/'+hash;}}
    // Photos stay separate from metadata; pending feedback events are sent idempotently after the snapshot.
    snapshot.trial.pendingEvents=[];const saved=await api('/api/state',{method:'PUT',body:JSON.stringify({state:snapshot,expectedVersion:cloudVersion,consent:true})});cloudVersion=saved.version;localStorage.setItem('yiyi-cloud-version',String(cloudVersion));localStorage.setItem('yiyi-cloud-owner',sessionInfo.accountTag);
    const pending=[...eventQueue()];for(const event of pending){await api('/api/events',{method:'POST',body:JSON.stringify(event)});state.trial.pendingEvents=eventQueue().filter(x=>x.id!==event.id)}localPersist();cloudLabel('云端已同步');$('#trialSyncDetail').textContent='云端版本 '+cloudVersion+' · '+new Date().toLocaleTimeString('zh-CN')+' 同步成功。可在其他设备登录同一账号后恢复。';
  }catch(e){if(e.status===409){cloudPaused=true;cloudLabel('同步冲突，需恢复云端',true)}else cloudLabel('本地已保存 · 同步待重试',true);$('#trialSyncDetail').textContent=e.message||'网络不可用，本地记录仍保留。'}finally{cloudBusy=false;if(cloudAgain&&!cloudPaused){cloudAgain=false;clearTimeout(cloudTimer);cloudTimer=setTimeout(syncCloud,500)}}
}
async function restoreCloud(){if(cloudBusy){toast('正在同步，请稍后再恢复');return}try{const data=await api('/api/state');if(!data.state){toast('云端还没有记录，请先开始体验并同步');return}const backup=JSON.stringify(state);const stamp=new Date().toISOString().replace(/[:.]/g,'-');download('yiyi-local-before-restore-'+stamp+'.json',backup,'application/json');state=data.state;state.trial.pendingEvents=[];cloudVersion=data.version;localStorage.setItem('yiyi-cloud-version',String(cloudVersion));localStorage.setItem('yiyi-cloud-owner',sessionInfo.accountTag);cloudEnabled=true;cloudPaused=false;localPersist();renderClothes();renderModel();renderWeek();renderTrial();cloudLabel('已恢复云端记录');toast('已恢复云端版本；原本的本地记录已导出备份')}catch(e){toast(e.message)}}
function download(name,content,type='text/csv;charset=utf-8'){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function csv(rows){return '\uFEFF'+rows.map(row=>row.map(v=>{let text=String(v??'');if(/^[=+@-]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"'}).join(',')).join('\r\n')}
function renderTrial(){
  const t=state.trial,s=TrialCore.summary(t,localDate()),counts=Object.fromEntries(['top','bottom','shoes'].map(cat=>[cat,state.items.filter(i=>i.cat===cat&&i.image).length]));const ready=Object.values(counts).every(n=>n>0);
  $('#trialStripTitle').textContent=t.startDate?`两周体验 · 第 ${s.day} / 14 天`:'让自己的衣服，真正参与每一天。';$('#trialStripDetail').textContent=t.startDate?`已提交 ${s.feedbackDays} 天实际反馈 · ${s.recommendationDays} 天查看推荐 · ${s.adoptionRate===null?'采用率等待反馈':'实际采用率 '+s.adoptionRate+'%'}`:'拍照加衣、查看搭配、记录穿着';$('#openTrial').textContent=t.startDate?'查看体验进度 ↗':'开始两周体验 ↗';
  $('#trialServiceNotice').textContent=PUBLIC_MODE?'照片保存在此浏览器的本地数据库。穿搭计划和反馈也保存在本机，可导出备份。':sessionInfo?.tryonConfigured?'真实试衣服务已接入，请上传本人照片后体验。':'可在搭配台用自拍模特或全身照试穿。';
  const steps=$('#trialSteps');steps.replaceChildren();const entries=[{n:'01',title:'自己的衣服',detail:`上衣 ${counts.top} · 下装 ${counts.bottom} · 鞋 ${counts.shoes}`,done:ready,action:'上传衣服',fn:()=>{$('#trialDialog').close();open('#uploadDialog')}},{n:'02',title:'本人照片与试衣',detail:'用自拍模特或正面全身照试穿',done:!!personPhoto,action:'去试穿',fn:()=>{$('#trialDialog').close();switchView('studio');$('#openTryon').click()}},{n:'03',title:'每日穿搭建议',detail:s.recommendationDays?`${s.recommendationDays} 天已查看建议`:'按天气、场合和可穿衣物挑选',done:s.recommendationDays>0,action:'看今天推荐',fn:()=>{$('#trialDialog').close();switchView('studio');recommendToday()}},{n:'04',title:'实际穿着反馈',detail:s.feedbackDays?`${s.feedbackDays} 天真实反馈`:'晚上记录实际穿着与没有照穿的原因',done:s.feedbackDays>0,action:'填写反馈',fn:()=>{$('#trialDialog').close();showActualFeedback()}}];
  for(const e of entries){if(PUBLIC_MODE&&e.n==='02')continue;const card=document.createElement('div');card.className='trial-step'+(e.done?' done':'');const n=document.createElement('span');n.className='step-number';n.textContent=e.done?'✓':e.n;const title=document.createElement('strong');title.textContent=e.title;const detail=document.createElement('p');detail.textContent=e.detail;const b=document.createElement('button');b.className='outline';b.textContent=e.action;b.onclick=e.fn;card.append(n,title,detail,b);steps.append(card)}
  $('#trialStart').hidden=!!t.startDate;$('#startTrial').disabled=!ready;$('#trialProgress').replaceChildren();if(t.startDate){const stats=document.createElement('div');stats.className='trial-stats';for(const [label,value] of [['实际反馈',s.feedbackDays+' 天'],['穿着采用率',s.adoptionRate===null?'待反馈':s.adoptionRate+'%'],...(PUBLIC_MODE?[]:[['实际上身评价',s.tryonRated?s.tryonTrusted+'/'+s.tryonRated:'尚无数据']])]){const d=document.createElement('div'),b=document.createElement('b'),small=document.createElement('small');b.textContent=value;small.textContent=label;d.append(b,small);stats.append(d)}const calendar=document.createElement('div');calendar.className='trial-calendar';for(let i=0;i<14;i++){const d=new Date(t.startDate+'T12:00:00');d.setDate(d.getDate()+i);const key=localDate(d),button=document.createElement('button');button.className=t.feedback[key]?'complete':'';button.textContent=`${d.getMonth()+1}/${d.getDate()} ${t.feedback[key]?'✓':'·'}`;button.disabled=key>localDate();button.title=t.feedback[key]?'已反馈，点击修改':'点击补填当天实际穿着';button.onclick=()=>{$('#trialDialog').close();showActualFeedback(key)};calendar.append(button)}$('#trialProgress').append(stats,calendar)}
}
function showTrial(){renderTrial();open('#trialDialog')};$('#openTrial').onclick=showTrial;$('#trialNav').onclick=showTrial;
$('#startTrial').onclick=async()=>{if(!$('#trialCloudConsent').checked){toast('请先确认数据保存说明');return}if(!PUBLIC_MODE&&(!sessionInfo?.signedIn||!sessionInfo?.cloudReady)){toast('请先登录，或等待云端服务就绪后重试');return}state.trial.startDate=localDate();state.trial.consentAt=new Date().toISOString();state.trial.storageMode=PUBLIC_MODE?'local':'cloud';cloudEnabled=!PUBLIC_MODE;cloudPaused=false;track('enrolled',{});persist();await syncCloud();renderTrial();toast('14 天体验已开始，今晚记得反馈实际穿着')};
$('#syncNow').onclick=async()=>{if(!cloudEnabled){toast('请先开始两周体验，或恢复已有云端记录');return}await syncCloud()};$('#restoreCloud').onclick=restoreCloud;$('#exportMyData').onclick=async()=>{await window.yiyiWardrobeStorage?.ready;download('yiyi-my-trial.json',JSON.stringify({exportedAt:new Date().toISOString(),state},null,2),'application/json')};
const realismRenderDaily=renderDaily;renderDaily=function(){realismRenderDaily();const today=localDate(),intended=state.intentions.find(h=>h.date===today),same=intended&&TrialCore.same(intended.selected,state.selected);$('#wearToday').textContent=same?'✓ 已记下':PUBLIC_MODE?'✓ 记下这套':'✓ 打算穿这套';$('#wearToday').disabled=!!same;$('#dailyHistory').replaceChildren();const msg=document.createElement('span');msg.textContent=state.trial.feedback[today]?'今天的实际穿着已反馈，可修改记录。':intended?'已记录今天的穿搭打算；晚上反馈后才计入实际采用。':'先选一套，晚上再告诉我们实际穿了什么。';$('#dailyHistory').append(msg);renderTrial()};
$('#wearToday').onclick=()=>{if(Object.values(state.selected).some(id=>state.dirty[id])){toast('当前搭配含待洗单品，请先换一套');return}state.intentions=state.intentions.filter(x=>x.date!==localDate());state.intentions.unshift({date:localDate(),selected:{...state.selected},occasion:state.dailyOccasion});track('intention',{selected:{...state.selected}});persist();renderDaily();toast('已记下打算穿的搭配，晚上请反馈实际穿着')};
recommendToday=function(){const own=state.items.filter(i=>i.image),pool=['top','bottom','shoes'].every(c=>own.some(i=>i.cat===c))?own:state.items;const result=DailyEngine.recommend({items:pool,dirty:state.dirty,history:state.history,today:localDate(),occasion:state.dailyOccasion,temperature:forecast?forecast.current.temperature_2m:null,offset:suggestionOffset});if(!result.selected){toast('可穿衣物不足，请先上传或将洗好的衣服标记为可穿');return}state.selected=result.selected;suggestionOffset++;const rec={id:crypto.randomUUID(),date:localDate(),selected:{...state.selected},occasion:state.dailyOccasion,temperature:forecast?.current.temperature_2m??null,createdAt:new Date().toISOString()};state.trial.recommendations.push(rec);state.trial.recommendations=state.trial.recommendations.slice(-300);track('recommendation',rec);persist();renderClothes();renderModel();toast(pool===own?'已从你自己的实拍衣橱挑好今天的搭配':'当前包含示例衣服，上传自己的三类衣物后推荐会只用你的衣橱')};$('#recommendToday').onclick=recommendToday;$('#shuffle').onclick=recommendToday;
function recommendationFor(date){return [...state.trial.recommendations].reverse().find(r=>r.date===date)?.selected||null}
function actualSelects(value){const wrap=$('#actualItemSelectors');wrap.replaceChildren();for(const [cat,label] of [['top','实际穿的上衣'],['bottom','实际穿的下装'],['shoes','实际穿的鞋履']]){const l=document.createElement('label');l.textContent=label;const s=document.createElement('select');s.dataset.actualCat=cat;for(const i of state.items.filter(i=>i.cat===cat&&i.image)){const o=document.createElement('option');o.value=i.id;o.textContent=i.name+(i.image?'':'（示例）');s.append(o)}const outside=document.createElement('option');outside.value='outside:'+cat;outside.textContent='其他未录入的'+(cat==='shoes'?'鞋履':'衣服');s.append(outside);s.value=value?.[cat]||state.selected[cat];if(!s.value)s.value='outside:'+cat;l.append(s);wrap.append(l)}}
function updateFeedbackMode(){const mode=$('#feedbackMode').value;$('#actualItemSelectors').hidden=mode==='no-outing';$('#feedbackReasons').hidden=!['changed','rejected'].includes(mode);if(mode==='adopted'){const rec=recommendationFor($('#feedbackDate').value);if(rec)actualSelects(rec);else{$('#feedbackMode').value='changed';$('#feedbackReasons').hidden=false;toast('当天尚无推荐记录，请填写实际穿着')}}}
function showActualFeedback(date=localDate()){if(!state.trial.startDate){showTrial();toast('请先上传自己的衣服并开始两周体验');return}$('#feedbackDate').value=date;$('#feedbackDate').min=state.trial.startDate;$('#feedbackDate').max=localDate();const saved=state.trial.feedback[date];$('#feedbackMode').value=saved?.mode||(recommendationFor(date)?'adopted':'changed');actualSelects(saved?.actual||recommendationFor(date)||state.selected);$('#feedbackComfort').value=saved?.comfort||4;$('#feedbackSatisfaction').value=saved?.satisfaction||4;$('#feedbackWillingness').value=saved?.willingness||'unsure';$('#feedbackComment').value=saved?.comment||'';$$('[name="reason"]').forEach(c=>c.checked=saved?.reasons?.includes(c.value)||false);updateFeedbackMode();open('#actualFeedbackDialog')}
$('#feedbackMode').onchange=updateFeedbackMode;$('#feedbackDate').onchange=()=>{const d=$('#feedbackDate').value;if(d){$('#actualFeedbackDialog').close();showActualFeedback(d)}};$('#openActualFeedback').onclick=()=>showActualFeedback();
$('#actualFeedbackForm').onsubmit=e=>{e.preventDefault();const date=$('#feedbackDate').value,mode=$('#feedbackMode').value;if(date>localDate()||!TrialCore.inTrial(date,state.trial.startDate)){toast('请选择两周测试内且不晚于今天的日期');return}const f={date,mode,recommended:recommendationFor(date),actual:mode==='no-outing'?null:Object.fromEntries($$('[data-actual-cat]').map(s=>[s.dataset.actualCat,s.value])),comfort:mode==='no-outing'?null:Number($('#feedbackComfort').value),satisfaction:mode==='no-outing'?null:Number($('#feedbackSatisfaction').value),willingness:$('#feedbackWillingness').value,reasons:$$('[name="reason"]:checked').map(c=>c.value),comment:$('#feedbackComment').value.trim(),updatedAt:new Date().toISOString()};const error=TrialCore.validateFeedback(f,state.items);if(error){toast(error);return}state.trial.feedback[date]=f;state.history=state.history.filter(h=>h.date!==date);if(f.actual)state.history.push({date,selected:f.actual,occasion:state.dailyOccasion,source:'actual_feedback'});track('actual_feedback',f,date);if(!persist())return;$('#actualFeedbackDialog').close();renderDaily();toast('实际穿着已保存，感谢告诉我们真实的选择')};
async function compressPhoto(file){if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)throw Error('请选择 8MB 以内的 JPG、PNG 或 WebP');const url=URL.createObjectURL(file);try{const img=new Image;img.src=url;await img.decode();if(img.width<300||img.height<300)throw Error('照片太小，请选择更清晰的原图');const cv=document.createElement('canvas'),scale=Math.min(1,1296/Math.max(img.width,img.height));cv.width=Math.round(img.width*scale);cv.height=Math.round(img.height*scale);cv.getContext('2d').drawImage(img,0,0,cv.width,cv.height);return cv.toDataURL('image/jpeg',.88)}finally{URL.revokeObjectURL(url)}}
$('#personPhotoFile').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{personPhoto=await compressPhoto(file);await photoStore('person',personPhoto);renderPerson();renderTrial();toast('本人照片已保存至此设备，尚未发送给试衣服务')}catch(err){toast(err.message)}};
function renderPerson(){$('#personPhotoPreview').hidden=!personPhoto;$('#personPhotoPrompt').hidden=!!personPhoto;if(personPhoto)$('#personPhotoPreview').src=personPhoto;else $('#personPhotoPreview').removeAttribute('src')}
$('#removePersonPhoto').onclick=async()=>{if(tryonBusy){toast('请等待当前试衣任务结束');return}personPhoto=null;await photoStore('person',null);renderPerson();renderTrial();toast('已删除本设备的本人照片；生成结果可在删除测试数据时一并清除')};
function showTryon(){renderPerson();$('#tryonGarments').replaceChildren();for(const i of Object.values(current())){const row=document.createElement('div');row.className='tryon-garment';const text=document.createElement('span');text.textContent=i.name+(i.image?'':' · 示例，不参与真实试衣');row.append(photoNode(i),text);$('#tryonGarments').append(row)}$('#tryonAvailability').textContent=sessionInfo?.tryonConfigured?'FASHN 已就绪 · 每账号每天最多 6 个生成步骤；上衣、下装各一步，鞋履可选。':'真实 AI 试衣尚未开通。你可以先准备本人照与实拍衣物；负责人配置服务密钥后才能生成。';$('#generateTryon').disabled=!sessionInfo?.tryonConfigured||tryonBusy;$('#generateTryon').textContent=sessionInfo?.tryonConfigured?'生成上身预览':'生成上身预览';$('#resumeTryon').hidden=!pendingResume;open('#tryonDialog')};if(!PUBLIC_MODE)$('#openTryon').onclick=showTryon;
async function displayResult(result){lastResult=result;$('#tryonResultSection').hidden=false;$('#resultOriginal').src=result.original;$('#resultGenerated').src=result.image;$('#downloadTryon').href=result.image;$('#tryonResultLabel').textContent=result.names.join(' + ');chosenQuality=null;$$('[data-trusted]').forEach(b=>b.classList.remove('active'));$$('#qualityIssues input').forEach(i=>i.checked=false)}
async function pollJob(id){for(let i=0;i<90;i++){const result=await api('/api/tryon/'+id);if(result.status==='completed')return result;if(result.status==='failed'){const e=Error(result.message);e.terminal=true;throw e;}await new Promise(r=>setTimeout(r,2500))}throw Error('生成时间较长。任务已保留，请稍后点「继续查看上次任务」，不要重复提交')}
async function continueTryon(){if(!pendingResume||tryonBusy)return;tryonBusy=true;$('#generateTryon').disabled=true;$('#resumeTryon').disabled=true;const pending=pendingResume;try{for(let index=pending.next;index<pending.steps.length;index++){const step=pending.steps[index];$('#tryonStatus').textContent=`第 ${index+1}/${pending.steps.length} 步 · 正在试穿${{top:'上衣',bottom:'下装',shoes:'鞋履'}[step.cat]}，请稍候…`;if(!pending.jobId){const job=await api('/api/tryon',{method:'POST',body:JSON.stringify({modelImage:pending.currentImage,garmentImage:step.image,category:step.cat,attemptId:step.attemptId,consent:true})});pending.jobId=job.id;await photoStore('pending',pending)}const done=await pollJob(pending.jobId);pending.currentImage=done.image;pending.lastJob=done.id;pending.jobId=null;pending.next=index+1;await photoStore('pending',pending)}const result={id:pending.lastJob,original:pending.original,image:pending.currentImage,selected:pending.selected,names:pending.names,createdAt:new Date().toISOString(),durationMs:Date.now()-pending.startedAt};await photoStore('result',result);await photoStore('pending',null);pendingResume=null;await displayResult(result);$('#tryonStatus').textContent='生成完成。请对照原图检查本人特征和衣服细节，并提交可信度反馈。';}catch(e){if(e.terminal){pendingResume=null;await photoStore('pending',null)}$('#tryonStatus').textContent=e.message;toast(e.message)}finally{tryonBusy=false;$('#generateTryon').disabled=!sessionInfo?.tryonConfigured;$('#resumeTryon').disabled=false;$('#resumeTryon').hidden=!pendingResume}}
$('#generateTryon').onclick=async()=>{if(pendingResume){toast('有尚未完成的任务，请先继续查看，避免重复计费');return}if(!personPhoto){toast('请先添加本人正面全身照');return}if(!$('#tryonConsent').checked){toast('请先确认本次照片处理授权');return}const cats=$('#includeShoes').checked?['top','bottom','shoes']:['top','bottom'];if(cats.some(c=>!item(state.selected[c])?.image)){toast('真实试衣只使用你上传的衣服，请先上传并选中'+(cats.length===3?'上衣、下装和鞋履':'上衣与下装'));return}try{const steps=[];for(const cat of cats)steps.push({cat,attemptId:crypto.randomUUID(),image:await imageData(item(state.selected[cat]).image)});pendingResume={steps,next:0,jobId:null,original:personPhoto,currentImage:personPhoto,selected:{...state.selected},names:cats.map(c=>item(state.selected[c]).name),startedAt:Date.now()};await photoStore('pending',pendingResume);await continueTryon()}catch(e){toast(e.message)}};$('#resumeTryon').onclick=continueTryon;
$$('[data-trusted]').forEach(b=>b.onclick=()=>{chosenQuality=b.dataset.trusted==='yes';$$('[data-trusted]').forEach(x=>x.classList.toggle('active',x===b))});$('#saveQuality').onclick=()=>{if(!lastResult||chosenQuality===null){toast('请选择这个结果是否能帮助你决定穿什么');return}const issues=$$('#qualityIssues input:checked').map(i=>i.value);if(!chosenQuality&&!issues.length){toast('请选出主要问题，帮助我们改进');return}const f={jobId:lastResult.id,trusted:chosenQuality,issues,durationMs:lastResult.durationMs,date:localDate()};state.trial.tryonFeedback[lastResult.id]=f;track('tryon_feedback',f);if(persist()){renderTrial();toast('试衣可信度反馈已保存')}};
$('#deleteMyData').onclick=()=>{$('#deleteConfirm').checked=false;open('#deleteDataDialog')};$('#confirmDelete').onclick=async()=>{if(!$('#deleteConfirm').checked){toast('请先勾选删除确认');return}if(cloudBusy||tryonBusy||window.yiyiWardrobeStorage?.saving){toast('请等待保存结束后再删除');return}cloudPaused=true;try{if(cloudEnabled)await api('/api/account',{method:'DELETE',body:JSON.stringify({confirm:'DELETE_MY_DATA'})});if(PUBLIC_MODE)await window.yiyiWardrobeStorage.clear();for(const k of ['person','result','pending','avatar-selfie','avatar-selfie-partner','fitting-body-photo'])await photoStore(k,null);localStorage.removeItem('yiyi-v1');location.reload()}catch(e){cloudPaused=false;toast('删除未完成：'+e.message)}};
async function showAdmin(){if(!$('#adminDialog').open)open('#adminDialog');$('#adminReport').textContent='正在读取云端测试记录…';try{const data=await api('/api/admin/report');adminRows=data.participants.map(p=>({...p,summary:TrialCore.summary(p.trial,localDate())}));const container=$('#adminReport');container.replaceChildren();const notice=document.createElement('p');notice.className='service-notice';notice.textContent=data.tryonConfigured?'试衣服务已配置；请结合实际生成和可信度反馈评估效果。':'真实试衣尚未开通：当前数据仅验证衣橱与每日搭配流程，不能证明上身效果可信。';container.append(notice);if(!adminRows.length){const p=document.createElement('p');p.textContent='还没有参与者。收到测试者邮箱并完成邀请后，请他们用各自账号开始体验。';container.append(p)}for(const p of adminRows){const row=document.createElement('div');row.className='admin-participant';const title=document.createElement('strong');title.textContent='参与者 '+p.participant;const detail=document.createElement('p');detail.textContent=`实拍 ${p.uploadedItems} 件 · 反馈 ${p.summary.feedbackDays} 天 · 采用 ${p.summary.adoptedDays}/${p.summary.eligibleDays} · 可信评价 ${p.summary.tryonTrusted}/${p.summary.tryonRated}`;const reasons=document.createElement('small');reasons.textContent=Object.entries(p.summary.reasons).map(([r,n])=>r+' '+n+'次').join(' · ')||'尚无未采用原因';row.append(title,detail,reasons);container.append(row)}}catch(e){$('#adminReport').textContent=e.message}}$('#openAdmin').onclick=showAdmin;$('#refreshAdmin').onclick=showAdmin;$('#downloadAdmin').onclick=()=>{const rows=[['参与者','实拍衣物','测试开始','推荐天数','实际反馈天数','采用天数','有效分母天数','采用率%','实际穿着天数','舒适度均分','可信试衣评价数','全部试衣评价数','未采用原因']];for(const p of adminRows){const s=p.summary;rows.push([p.participant,p.uploadedItems,p.trial.startDate||'',s.recommendationDays,s.feedbackDays,s.adoptedDays,s.eligibleDays,s.adoptionRate??'',s.repeatUseDays,s.comfort??'',s.tryonTrusted,s.tryonRated,JSON.stringify(s.reasons)])}download('yiyi-14-day-report.csv',csv(rows))};
const beforeTrialClothes=renderClothes;renderClothes=function(){beforeTrialClothes();renderTrial()};
async function initTrial(){if(PUBLIC_MODE){sessionInfo={signedIn:false,isAdmin:false,tryonConfigured:false,cloudReady:false};cloudEnabled=false;cloudLabel('仅存本机 · 可导出');renderTrial();renderDaily();localPersist();return}try{personPhoto=await photoStore('person');pendingResume=await photoStore('pending');const r=await photoStore('result');if(r)await displayResult(r)}catch{toast('此浏览器无法保存本人照片，请检查隐私设置')}try{sessionInfo=await api('/api/session');$('#openAdmin').hidden=!sessionInfo.isAdmin;const data=await api('/api/state');cloudVersion=data.version;if(data.state){if(!state.trial.startDate){cloudLabel('发现云端衣橱，点恢复继续');$('#trialSyncDetail').textContent='该账号已有云端记录。请点「恢复云端记录」，或先导出本设备的数据。'}else if(Number(localStorage.getItem('yiyi-cloud-version'))===data.version&&localStorage.getItem('yiyi-cloud-owner')===sessionInfo.accountTag){cloudEnabled=true;cloudLabel('云同步已连接')}else{cloudPaused=true;cloudLabel('云端有更新 · 请先恢复',true)}}else{cloudEnabled=!!state.trial.consentAt;cloudLabel(cloudEnabled?'本地测试待同步':'登录成功 · 体验开始后同步')}}catch(e){cloudLabel('本地体验 · 云端未连接',true)}renderTrial();renderDaily();localPersist()}

if(PUBLIC_MODE){
  document.body.classList.add('public-mode');
  const consent=$('#trialCloudConsent');consent.parentElement.lastChild.textContent='我了解衣物照片、穿搭与反馈仅保存在当前设备；清理浏览器数据或更换手机前，需要先导出备份。';
  $('#syncNow').hidden=true;$('#restoreCloud').hidden=true;$('#openAdmin').hidden=true;
  $('#trialSyncDetail').textContent='公开版无需登录。你的照片与反馈不会上传到 GitHub；如需汇总测试结果，可导出记录后自行分享给负责人。';
  $('#deleteMyData').textContent='删除本设备数据';
  $('#deleteDataDialog .muted').textContent='这会删除当前浏览器中的衣物、本人照片和测试记录，无法撤销。建议先导出备份；其他设备的数据不受影响。';
  $('#confirmDelete').textContent='确认删除本设备数据';
  $('footer small').textContent='v0.9.1 · 本机保存';
}

initTrial();

;
(() => {
  function openDatabase() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('yiyi-wardrobe', 1);
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        reject(Error('本机衣橱打开超时'));
      }, 2500);
      request.onupgradeneeded = () => request.result.createObjectStore('garmentPhotos');
      request.onsuccess = () => {
        clearTimeout(timer);
        if (timedOut) request.result.close();
        else resolve(request.result);
      };
      request.onerror = () => {
        clearTimeout(timer);
        reject(request.error);
      };
    });
  }

  async function transaction(mode, operation) {
    const db = await openDatabase();
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction('garmentPhotos', mode);
        const requests = operation(tx.objectStore('garmentPhotos'));
        tx.oncomplete = () => resolve(Array.isArray(requests) ? requests.map(request => request.result) : requests.result);
        tx.onabort = () => reject(tx.error || Error('无法保存衣物照片'));
      });
    } finally {
      db.close();
    }
  }

  const save = (id, image) => transaction('readwrite', store => store.put(image, id));
  const remove = id => transaction('readwrite', store => store.delete(id));

  async function load() {
    const saved = state.items.filter(garment => garment.imageStored);
    const legacy = state.items.filter(garment => !garment.imageStored && garment.image);
    let unavailable = false;
    if (saved.length) {
      try {
        const photos = await transaction('readonly', store => saved.map(garment => store.get(garment.id)));
        saved.forEach((garment, index) => { garment.image = photos[index]; });
        unavailable = photos.some(photo => !photo);
      } catch {
        unavailable = true;
      }
    }
    if (legacy.length) {
      try {
        // Keep the legacy copies until the database has committed every photo.
        await transaction('readwrite', store => legacy.map(garment => store.put(garment.image, garment.id)));
        for (const garment of legacy) garment.imageStored = true;
        if (!persist()) for (const garment of legacy) delete garment.imageStored;
      } catch {
        unavailable = true;
      }
    }
    if (saved.length) {
      renderClothes();
      renderModel();
      renderWeek();
    }
    if (unavailable) toast('部分照片暂时无法读取，请在常用浏览器中重开页面。');
    return !unavailable;
  }

  const ready = load();
  window.yiyiWardrobeStorage = {
    ready, save, remove,
    async clear() {
      await ready;
      await transaction('readwrite', store => store.clear());
    }
  };

  const form = $('#uploadForm');
  const dialog = $('#uploadDialog');
  const album = $('#uploadFile');
  const camera = $('#uploadCamera');
  const preview = $('#uploadPreview');
  const submit = form.querySelector('button[type="submit"]');
  const status = $('#uploadStatus');
  const close = dialog.querySelector('.close');
  const take = $('#takeGarmentPhoto');
  const storage = window.yiyiWardrobeStorage;
  const saved = document.createElement('div');
  saved.className = 'mvp-saved';
  saved.hidden = true;
  const savedText = document.createElement('span');
  savedText.setAttribute('role','status');
  const addAnother = document.createElement('button');
  addAnother.type = 'button';
  addAnother.className = 'outline upload-trigger';
  addAnother.textContent = '再加一件';
  saved.append(savedText, addAnother);
  $('#filters').before(saved);
  const planToday = document.createElement('button');
  planToday.className = 'outline';
  planToday.type = 'button';
  planToday.textContent = '加入计划';
  planToday.onclick = () => $('#saveLook').click();
  $('.daily-buttons').append(planToday);
  let photo;
  let request = 0;

  function reset() {
    request++;
    photo = null;
    form.reset();
    preview.removeAttribute('src');
    preview.hidden = true;
    submit.disabled = true;
    status.textContent = '';
  }

  async function preparePhoto(event) {
    const file = event.target.files[0];
    if (!file || storage.saving) return;
    const version = ++request;
    photo = null;
    submit.disabled = preview.hidden = true;
    if (file.size > 20 * 1024 * 1024) {
      status.textContent = '照片超过 20 MB，请选一张较小的照片。';
      event.target.value = '';
      return;
    }
    status.textContent = '正在读取照片…';
    const url = URL.createObjectURL(file);
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      if (version !== request) return;
      const scale = Math.min(1, 900 / Math.max(image.naturalWidth, image.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      photo = canvas.toDataURL('image/webp', .84);
      preview.src = photo;
      preview.hidden = submit.disabled = false;
      status.textContent = '';
    } catch {
      if (version !== request) return;
      status.textContent = '这张照片无法读取。请直接拍照，或从相册选择 JPG / PNG。';
      event.target.value = '';
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  album.onchange = camera.onchange = preparePhoto;
  take.onclick = () => camera.click();
  for (const trigger of $$('.upload-trigger')) trigger.onclick = () => {
    if (!storage.saving) open('#uploadDialog');
  };
  dialog.addEventListener('close', () => {
    if (!storage.saving) reset();
  });
  dialog.addEventListener('cancel', event => {
    if (storage.saving) event.preventDefault();
  });
  form.onsubmit = async event => {
    event.preventDefault();
    if (!photo || storage.saving) return;
    const cat = $('#uploadCategory').value;
    const name = $('#uploadName').value.trim();
    if (!name) {
      status.textContent = '请给这件单品写个名称。';
      return;
    }
    const garment = {id:'u' + crypto.randomUUID(), name, cat, image:photo, imageStored:true,
      color:$('#uploadColor').value, kind:{top:'tee',bottom:'wide',shoes:'sneaker'}[cat],
      tag:'我的实拍', warmth:$('#uploadWarmth').value, occasion:$('#uploadOccasion').value};

    storage.saving = true;
    submit.disabled = close.disabled = album.disabled = camera.disabled = take.disabled = true;
    status.textContent = '正在保存到本机衣橱…';
    try {
      await ready;
      await save(garment.id, garment.image);
      const previous = state.selected[cat];
      state.items.unshift(garment);
      state.selected[cat] = garment.id;
      if (!persist()) {
        state.items.shift();
        state.selected[cat] = previous;
        await remove(garment.id);
        throw Error('无法保存单品信息');
      }
    } catch {
      status.textContent = '保存失败。请检查浏览器存储空间，再点保存重试。';
      return;
    } finally {
      storage.saving = false;
      submit.disabled = close.disabled = album.disabled = camera.disabled = take.disabled = false;
    }
    filter = 'all';
    for (const button of $$('[data-cat]')) button.classList.toggle('active', button.dataset.cat === 'all');
    dialog.close();
    reset();
    switchView('wardrobe');
    renderClothes();
    renderModel();
    const label = {top:'上衣',bottom:'下装',shoes:'鞋子'}[cat];
    savedText.textContent = `已保存 · ${label} / ${garment.name}`;
    saved.hidden = false;
  };
  reset();
})();

;
(()=>{
  const APP_VERSION='0.9.1';let installPrompt=null;
  const installed=()=>window.matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
  const bar=document.createElement('div');bar.className='app-install-bar';bar.innerHTML='<div><strong>一衣 App</strong><span>v'+APP_VERSION+' · 手机测试版</span></div><button type="button" id="installApp">添加到桌面</button>';window.YIYI_PUBLIC?document.querySelector('footer').before(bar):document.querySelector('header').after(bar);
  const dialog=document.createElement('dialog');dialog.className='install-dialog';dialog.innerHTML='<div class="dialog-head"><h2>把一衣放到手机桌面</h2><button type="button" aria-label="关闭安装说明">×</button></div><p>iPhone：用 Safari 打开此链接，点「分享」，再选「添加到主屏幕」。</p><p>Android：用 Chrome 打开，点「安装应用」；也可以在浏览器菜单中选「添加到主屏幕」。</p><p class="muted">这是 PWA 网页 App，无需下载 APK。首次联网打开后，衣橱、计划与反馈可在离线时继续使用；天气需要网络。照片保存在当前设备，建议定期导出。</p>';document.body.append(dialog);dialog.querySelector('button').onclick=()=>dialog.close();
  const button=document.querySelector('#installApp');
  function render(){button.textContent=installed()?'已添加到桌面':'添加到桌面';button.disabled=installed()}
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;render()});window.addEventListener('appinstalled',()=>{installPrompt=null;render()});
  button.onclick=async()=>{if(installPrompt){await installPrompt.prompt();await installPrompt.userChoice;installPrompt=null;render()}else dialog.showModal()};render();
  if('serviceWorker' in navigator&&window.YIYI_PUBLIC)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js',{scope:'./'}).catch(()=>{bar.querySelector('span').textContent='v'+APP_VERSION+' · 在线模式'}));
})();
