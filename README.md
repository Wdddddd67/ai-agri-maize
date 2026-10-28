# 中国省级玉米年单产量预测 · GitHub Pages 版

本目录是可直接上传的静态网站：打开网址后，访问者可查看归档结果，并在自己的浏览器中使用 Ridge、RF、XGBoost 预测新数据。

## 功能范围

- 首页与预测结果展示沿用原平台；归档结果仍包含五模型，以及TabPFN残差方案的预测与实测对比。
- 新数据预测仅提供Ridge、RF、XGBoost；四个预报节点、直接与残差两种方式，共24套已保存模型。
- 不是重新训练：迁移原系数、树结构、标准化和省份编码；残差输出按原规则加回H，并非负截断。
- 保留示例载入、已知实测匹配、手动或缺失实测、绝对误差、CSV/JSON导出。
- 年份和当年实测仅用于核对，不进入模型。无上一年数据集记录时，不展示历史基线与较上年变化；H仍须作为模型输入。

## GitHub Pages 发布

1. 在GitHub创建一个公开仓库，例如 `ai-agri-maize`。GitHub Free的Pages使用公开仓库。
2. 上传本目录中的所有内容，保持 `models`、`static`、`runtime`、`assets` 的目录层级。
3. 仓库根目录必须直接看到 `index.html`。不要只上传压缩包，也不要再嵌套一层 `site` 文件夹。
4. 打开仓库 Settings → Pages，在 Build and deployment 中选择 Deploy from a branch。
5. Branch选择main、目录选择/(root)，点击Save。若主分支名不同，选择实际上传文件所在的分支。
6. 等待Pages构建完成，打开页面显示的真实网址，通常是 https://用户名.github.io/仓库名/ 。
7. 测试“载入示例→全选→开始预测”，应看到三模型结果。访客无需安装Python，也不需要你的电脑保持开机。

无需云端Python服务器、Docker、API密钥或自购域名。本版只使用静态文件，所有路径均支持GitHub仓库子路径。
公开仓库和浏览器模型参数对访问者可见；本上传目录不含Python模型、TabPFN权重或原训练明细。

## 运行方式

使用支持Web Worker、Web Crypto与DecompressionStream的现代浏览器。模型按选择加载并校验SHA256，下载后在浏览器后台线程计算。
请通过GitHub Pages网址或本地HTTP预览访问；不要双击HTML以file://方式打开。
本机预览和开发核验程序另存于发布包的Code目录，不需要上传。

## 研究与验证边界

训练期2003—2019；2020—2022为探索性评价。未来年份的精度未独立验证。保留的模型精度不会因移至浏览器而自动提高。
17,328次浏览器JavaScript引擎与原Python模型对比通过，覆盖24套方案；详见发布包Output/15_browser_parity.json。
已在本地纯静态HTTP环境下测试/site/子路径、24套网页方案、实测匹配及JSON导出；尚未代替你在GitHub账号上实际发布。

模型：scikit-learn Ridge/RandomForest、XGBoost。原研究归档亦使用CatBoost与PriorLabs TabPFN V2。
中文字体许可见 assets/fonts/OFL.txt。没有为本项目代码擅自添加新的开源授权。
