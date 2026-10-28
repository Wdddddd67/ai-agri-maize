(()=>{
  'use strict';
  const base=new URL('./',document.baseURI),pending=new Map();
  let worker=null,sequence=0;
  async function getJson(name){
    const response=await fetch(new URL(`static/${name}.json`,base));
    if(!response.ok)throw Error('网页数据加载失败，请检查文件是否完整上传后刷新。');
    return response.json();
  }
  // Initialize lazily when the new-input page first asks for data.
  let dataPromise=null;
  function ready(){
    if(!dataPromise)dataPromise=Promise.all(['catalog','observations','examples','model-manifest'].map(getJson)).then(([catalog,observations,examples,manifest])=>({catalog,observations,examples,manifest}));
    return dataPromise;
  }
  async function ensureWorker(){
    const data=await ready();
    if(worker)return worker;
    if(typeof Worker==='undefined')throw Error('当前浏览器不支持后台计算，请使用新版 Chrome 或 Edge。');
    worker=new Worker(new URL('runtime/predict-worker.js',base));
    worker.onmessage=event=>{
      const message=event.data,item=pending.get(message.id);
      if(!item)return;
      if(message.type==='progress'){item.progress(message);return;}
      pending.delete(message.id);
      if(message.type==='error')item.reject(Error(message.error));else item.resolve(message.job);
    };
    worker.onerror=()=>{
      for(const item of pending.values())item.reject(Error('浏览器计算线程加载失败，请检查网页文件后刷新重试。'));
      pending.clear();worker.terminate();worker=null;
    };
    worker.postMessage({type:'init',data});
    return worker;
  }
  window.MaizeBrowser=Object.freeze({
    async catalog(){return(await ready()).catalog;},
    async observation(province,year){
      const data=await ready();
      if(!data.catalog.provinces.some(p=>p.id===province))throw Error('省份不在研究范围内。');
      return MaizePredictorCore.observation(data.observations,province,year);
    },
    async example(province,lead,year){
      const value=(await ready()).examples[`${province}|${year}|${lead}`];
      if(!value)throw Error('该年份暂无输入示例，请手动填写指标。');
      return value;
    },
    async predict(payload,progress=()=>{}){
      const data=await ready();MaizePredictorCore.validate(payload,data.catalog,data.observations);
      const active=await ensureWorker(),id=++sequence;
      return new Promise((resolve,reject)=>{pending.set(id,{resolve,reject,progress});active.postMessage({id,type:'predict',payload});});
    }
  });
})();
