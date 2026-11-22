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
