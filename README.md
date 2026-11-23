# 绵绵云
A cozy little chinchilla game

## 云野原型

从林间小径走到右端，点「进入云野」。在支持 WebGL 2 的浏览器中，可使用左手摇杆或 WASD 移动，拖动画面旋转镜头，靠近地标后点「互动」。本地开发可用 `python3 -m http.server` 启动页面。

云野沿用现有存档。资源数量仍以 `world.collection.inventory` 的物品 ID 为准，`world.meadow.placements` 保存未来的建筑记录。每条记录包含稳定的 `id`、配方类型 `type`、`position: { x, y, z }` 和绕 Y 轴旋转的弧度值 `rotation`。后续可在单份存档中同时调整材料和增删记录。云野原型只提供建造区参观。

Three.js 0.179.1 的 WebGL 模块及 MIT 许可位于 `meadow/vendor`，只在进入云野时加载。
