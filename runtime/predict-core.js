(function (scope) {
  'use strict';
  const names = ['Ridge', 'RF', 'XGBoost'];
  function observation(observations, province, year, manual = null) {
    if (!Number.isInteger(year) || year < 1900 || year > 2100) throw Error('预测年份应为1900至2100之间的整数。');
    if (manual !== null && (typeof manual !== 'number' || !Number.isFinite(manual) || manual < 0)) throw Error('当年实测单产必须是非负有限数值。');
    const record = observations[`${province}|${year}`];
    if (record && manual !== null && Math.abs(manual - record.actual_t_ha) > 1e-8) throw Error('当年实测与数据集记录不一致，请重新匹配省份和年份。');
    const actual = record ? record.actual_t_ha : manual;
    return {province, harvest_year: year, available: actual !== null, actual_t_ha: actual, source: record ? record.source : actual !== null ? 'user' : null};
  }
  function validate(payload, catalog, observations) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw Error('输入格式不正确。');
    if (!catalog.provinces.some(p => p.id === payload.province)) throw Error('请选择研究范围内的省份。');
    if (!Number.isInteger(payload.lead) || ![0,30,60,90].includes(payload.lead)) throw Error('预报节点只能为90、60、30或0。');
    if (!['direct','residual'].includes(payload.route)) throw Error('预测方式不正确。');
    if (!Array.isArray(payload.models) || payload.models.length < 1 || payload.models.length > 3 || new Set(payload.models).size !== payload.models.length || payload.models.some(n => !names.includes(n))) throw Error('请选择1至3种不同模型。');
    if (!Array.isArray(payload.values) || payload.values.length !== 13) throw Error('请完整填写13项指标。');
    const values = payload.values.map((v,i) => {
      const f = catalog.features[i];
      if (typeof v !== 'number' || !Number.isFinite(v)) throw Error(`${f.label}必须是有限数值。`);
      if ((f.min !== null && v < f.min) || (f.max !== null && v > f.max)) throw Error(`${f.label}超出允许范围。`);
      if (f.key === 'e_heat35_days' && !Number.isInteger(v)) throw Error('高温日数必须是整数。');
      return v;
    });
    for (const [peak,mean,recent,label] of [[7,6,8,'NDVI'],[10,9,11,'fPAR']]) {
      if (values[peak] + 1e-8 < Math.max(values[mean],values[recent])) throw Error(`${label}峰值应不小于两项均值。`);
    }
    return {...payload, values, observation: observation(observations,payload.province,payload.harvest_year,payload.actual_t_ha ?? null)};
  }
  function transform(values, province, prep, float32) {
    if (values.length !== 13 || !prep.categories.includes(province)) throw Error('模型输入或省份编码不匹配。');
    const numeric = values.map((v,i) => prep.mean ? (v - prep.mean[i]) / prep.scale[i] : v);
    const vector = numeric.concat(prep.categories.map(c => c === province ? 1 : 0));
    const result = float32 ? vector.map(Math.fround) : vector;
    if (result.some(v => !Number.isFinite(v))) throw Error('输入数值超出模型可计算范围，请检查指标单位和数值。');
    return result;
  }
  function treeValue(tree, vector, xgboost) {
    let node = tree;
    while (Array.isArray(node)) {
      const threshold = xgboost ? Math.fround(node[1]) : node[1];
      node = (xgboost ? vector[node[0]] < threshold : vector[node[0]] <= threshold) ? node[2] : node[3];
    }
    return xgboost ? Math.fround(node) : node;
  }
  function predict(model, values, province) {
    const start = typeof performance !== 'undefined' ? performance.now() : Date.now();
    const vector = transform(values,province,model.prep,model.name !== 'Ridge');
    let raw;
    if (model.name === 'Ridge') {
      raw = model.intercept;
      for (let i=0;i<vector.length;i++) raw += vector[i]*model.coefficients[i];
    } else if (model.name === 'RF') {
      raw = 0;
      for (const tree of model.trees) raw += treeValue(tree,vector,false);
      raw /= model.trees.length;
    } else if (model.name === 'XGBoost') {
      raw = Math.fround(model.base_score);
      for (const tree of model.trees) raw = Math.fround(raw + treeValue(tree,vector,true));
    } else throw Error('此网页仅支持Ridge、RF和XGBoost的新数据预测。');
    const h = values[12], restored = raw + (model.route === 'residual' ? h : 0), prediction = Math.max(0,restored);
    if (!Number.isFinite(prediction)) throw Error('模型未返回有限预测值。');
    const outside = model.feature_labels.filter((_,i) => values[i] < model.train_min[i] || values[i] > model.train_max[i]);
    return {model:model.name,prediction_t_ha:prediction,raw_model_output_t_ha:raw,
      change_from_previous_t_ha:prediction-h,historical_metrics:model.metrics,
      outside_training_range:outside,clipped_at_zero:restored<0,source:'browser_model_inference',
      seconds:((typeof performance !== 'undefined' ? performance.now() : Date.now())-start)/1000};
  }
  scope.MaizePredictorCore = Object.freeze({names,observation,validate,transform,predict});
  if (typeof module !== 'undefined' && module.exports) module.exports = scope.MaizePredictorCore;
})(typeof globalThis === 'undefined' ? self : globalThis);
