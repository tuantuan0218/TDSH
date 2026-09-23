'use strict';
// Server-authored quote only. Never infer billable prices from the browser clock.
globalThis.RoleAITariffs=Object.freeze({
 schedule:'北京时间周一至周五 09:00–12:00、14:00–18:00 为高峰，其余时段半价。每次模型请求开始时锁定价格。',
 scheduled:m=>m?.pricing?.mode==='deepseek_weekly_v1',
 rate:(micro,divisor=1)=>(Number(micro||0)/divisor/1e6).toFixed(7).replace(/0+$/,'').replace(/\.$/,'')+' 元',
 fresh:(m,received)=>!RoleAITariffs.scheduled(m)||(Number(m.pricing.next_change_unix)>Number(m.pricing.as_of_unix)&&performance.now()>=received&&performance.now()-received<(Number(m.pricing.next_change_unix)-Number(m.pricing.as_of_unix))*1000),
 label:(m,received)=>RoleAITariffs.scheduled(m)?(RoleAITariffs.fresh(m,received)?(m.pricing.period==='peak'?'当前高峰':'当前空闲 · 半价'):'时段已切换，请刷新价格'):'固定售价',
 next:m=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(Number(m.pricing.next_change_unix)*1000))
});
