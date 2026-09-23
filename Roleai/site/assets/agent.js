'use strict';
const API=window.ROLEAI_API_BASE||'https://api.roleai.studio',$=s=>document.querySelector(s);
let before=null,canBuy=false,priceModels=[],priceReceived=0,priceRefreshAt=0,priceLoading=false,priceGeneration=0;
const tariffs=RoleAITariffs;
const node=(tag,text,cls)=>{const n=document.createElement(tag);n.textContent=text;if(cls)n.className=cls;return n;};
const money=n=>(Number(n||0)/1e6).toFixed(6).replace(/0+$/,'').replace(/\.$/,'')+' 元';
const friendly=e=>['TimeoutError','AbortError','TypeError'].includes(e.name)?'连接暂时中断，请稍后刷新。':e.message||'操作未完成，请稍后重试。';
async function request(path,body){const r=await fetch(API+path,{method:body===undefined?'GET':'POST',credentials:'include',redirect:'error',signal:AbortSignal.timeout(25000),headers:{Accept:'application/json','Content-Type':'application/json','X-RoleAI-CSRF':'1'},...(body===undefined?{}:{body:JSON.stringify(body)})});let b;try{b=await r.json();}catch{throw Error('暂时无法读取服务信息，请稍后重试。');}if(r.status===401){$('#sign-in').hidden=false;throw Error('请先登录账户。');}if(!r.ok||b.ok===false)throw Error(b.error?.message||'操作未完成，请稍后重试。');return b.data;}
function usage(rows,append=false){if(!append)$('#usage').replaceChildren();for(const r of rows){const row=node('article','', 'order-row');row.append(node('strong',r.kind==='purchase'?'购买额度':r.kind==='refund'?'退款退回':r.kind==='usage'?'模型用量':'额度调整'),node('span',r.created_at,'muted'),node('strong',money(r.amount_micro)));$('#usage').append(row);before=r.id;}$('#more').hidden=rows.length<50;if(!$('#usage').children.length)$('#usage').append(node('p','暂无用量记录。','muted'));}
async function load(){
 $('#buy').disabled=true;$('#wallet').setAttribute('aria-busy','true');$('#message').textContent='';
 const started=performance.now(),generation=++priceGeneration;
 try{const [catalog,wallet]=await Promise.all([request('/v1/agent/catalog'),request('/v1/agent/usage')]);
 $('#wallet').replaceChildren(node('p','可用额度  '+money(wallet.available_micro)),node('p','处理中或待核对  '+money(wallet.held_micro)));
 const ways=$('#payment-way');ways.replaceChildren();for(const value of catalog.payment_ways||[]){if(!['ALI_QR','WX_LITE_H5'].includes(value))continue;const option=node('option',value==='ALI_QR'?'支付宝扫码':'微信支付');option.value=value;ways.append(option);}
 canBuy=catalog.enabled&&catalog.entitled&&ways.children.length>0&&(catalog.items||[]).length>0;$('#buy').disabled=!canBuy;
 if(!catalog.entitled)$('#message').textContent='你可以先了解 Agent；开通订阅或拥有终身授权后，即可购买并使用官方模型额度。';
 else if(!catalog.enabled)$('#message').textContent='官方模型额度暂未开放购买。你仍可在软件中配置自己的 API。';
 else if(!(catalog.items||[]).length)$('#message').textContent='暂时没有可用的官方模型，请稍后再购买额度。你也可以在软件中接入自己的 API。';
 if(generation===priceGeneration){priceModels=catalog.items||[];priceReceived=started;renderPrices();}
 usage(wallet.items||[]);
 const stats=$('#model-usage');stats.replaceChildren();for(const r of wallet.model_usage||[]){const row=node('article','', 'order-row');row.append(node('strong',r.display_name),node('span',`输入 ${r.input_tokens} · 缓存命中 ${r.cached_tokens} · 缓存创建 ${r.cache_creation_tokens??0} · 输出 ${r.output_tokens} Token · ${r.requests} 次请求${Number(r.pending_requests)>0?'（'+r.pending_requests+' 次待核对）':''}`,'muted'),node('strong',money(r.charged_micro)));stats.append(row);}if(!stats.children.length)stats.append(node('p','最近 30 天暂无模型用量。','muted'));
 }catch(e){canBuy=false;$('#wallet').replaceChildren();$('#message').textContent=friendly(e);}finally{$('#wallet').setAttribute('aria-busy','false');}
}
$('#refresh').onclick=()=>load();$('#more').onclick=async()=>{const b=$('#more');b.disabled=true;try{const r=await request('/v1/agent/usage?before='+encodeURIComponent(before));usage(r.items||[],true);}catch(e){$('#message').textContent=friendly(e);}finally{b.disabled=false;}};
$('#purchase-form').onsubmit=async e=>{e.preventDefault();if(!canBuy)return;const form=e.currentTarget,button=$('#buy');button.disabled=true;try{const f=new FormData(form);const r=await request('/v1/agent/purchase',{amount_fen:Number(f.get('amount_fen')),way_code:f.get('way_code')});if(!/^[A-Z0-9]{16,30}$/.test(r.order?.merchant_order_no||''))throw Error('订单已提交，请在我的订单中查看，避免重复购买。');location.assign('/payment.html?order='+encodeURIComponent(r.order.merchant_order_no));}catch(e){canBuy=false;$('#message').textContent=friendly(e)+' 请先查看「我的订单」，确认没有待付款订单后再刷新此页，避免重复购买。';}finally{button.disabled=!canBuy;}};
load();

function renderPrices(){
 const list=$('#model-prices');list.replaceChildren();
 for(const m of priceModels){const row=node('article','','order-row'),scheduled=tariffs.scheduled(m),fresh=tariffs.fresh(m,priceReceived);
  row.append(node('strong',m.display_name+' · '+tariffs.label(m,priceReceived)));
  const line=d=>'输入 '+tariffs.rate(m.sell_input,d)+' · 缓存输入 '+tariffs.rate(m.sell_cached,d)+' · 输出 '+tariffs.rate(m.sell_output,d)+(m.sell_cache_creation==null?'':' · 缓存创建 '+tariffs.rate(m.sell_cache_creation,d));
  if(!scheduled||fresh)row.append(node('span',line(scheduled?m.pricing.divisor:1),'muted'));
  if(scheduled){row.append(node('span','高峰：'+line(1),'muted'),node('span','空闲：'+line(2),'muted'),node('p',tariffs.schedule,'muted'));
   if(fresh)row.append(node('span','下次切换：北京时间 '+tariffs.next(m),'muted'));
  }list.append(row);
 }if(!priceModels.length)list.append(node('p','暂时没有可购买的官方模型，请稍后刷新。','muted'));
}
setInterval(async()=>{
 if(!priceModels.some(m=>!tariffs.fresh(m,priceReceived)))return;
 renderPrices();
 if(document.hidden||priceLoading||performance.now()<priceRefreshAt)return;
 priceLoading=true;const started=performance.now(),generation=++priceGeneration;priceRefreshAt=started+30000;
 try{const cat=await request('/v1/agent/catalog');if(generation===priceGeneration){priceModels=cat.items||[];priceReceived=started;renderPrices();if(!cat.enabled||!cat.entitled||!priceModels.length){canBuy=false;$('#buy').disabled=true;}}}
 catch{/* Expired quote remains visibly expired; never retry a purchase or model request. */}
 finally{priceLoading=false;}
},1000);
