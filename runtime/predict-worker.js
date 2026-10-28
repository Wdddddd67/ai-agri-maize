'use strict';
importScripts('./predict-core.js');
let data = null;
const cache = new Map();
async function loadModel(key) {
  if (cache.has(key)) {
    const value=cache.get(key);cache.delete(key);cache.set(key,value);return value;
  }
  const entry=data.manifest.schemes[key];
  if (!entry) throw Error('所选模型文件未配置。');
  const response=await fetch(new URL('../'+entry.path,self.location.href));
  if (!response.ok) throw Error('模型文件加载失败，请检查网页文件是否完整上传后重试。');
  const buffer=await response.arrayBuffer();
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
  if (digest!==entry.sha256) throw Error('模型文件校验失败，请刷新网页后重试。');
  if (typeof DecompressionStream==='undefined') throw Error('请使用支持模型解压的新版 Chrome、Edge、Firefox 或 Safari 浏览器。');
  const stream=new Blob([buffer]).stream().pipeThrough(new DecompressionStream('gzip'));
  const model=JSON.parse(await new Response(stream).text());
  cache.set(key,model);
  while(cache.size>3)cache.delete(cache.keys().next().value);
  return model;
}
self.onmessage=async event=>{
  const message=event.data;
  if(message.type==='init'){data=message.data;return;}
  const id=message.id;
  try{
    if(!data)throw Error('模型数据尚未初始化，请刷新后重试。');
    const payload=MaizePredictorCore.validate(message.payload,data.catalog,data.observations);
    const job={status:'running',results:[],observation:payload.observation};
    for(const name of payload.models){
      self.postMessage({id,type:'progress',stage:'loading',current_model:name,...job});
      try{
        const model=await loadModel(`${name}_L${payload.lead}_${payload.route}`);
        if(model.name!==name||model.lead!==payload.lead||model.route!==payload.route)throw Error('模型方案与所选节点不一致。');
        const result=MaizePredictorCore.predict(model,payload.values,payload.province);
        const actual=payload.observation.actual_t_ha;
        result.actual_t_ha=actual;
        result.absolute_error_t_ha=actual===null?null:Math.abs(result.prediction_t_ha-actual);
        job.results.push(result);
      }catch(error){job.results.push({model:name,error:error.message||'模型计算失败，请重试。'});}
      self.postMessage({id,type:'progress',stage:'computed',current_model:name,...job});
    }
    job.status='complete';self.postMessage({id,type:'complete',job});
  }catch(error){self.postMessage({id,type:'error',error:error.message||'预测失败，请重试。'});}
};
