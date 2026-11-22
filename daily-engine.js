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
