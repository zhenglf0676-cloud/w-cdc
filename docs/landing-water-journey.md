# 登录前首页：一滴水的旅程

仅调整公共首页。测试分支 feat/landing-water-story；业务 API、认证、数据库和登录后的 UI 均未改动。

## 视觉与实现

雪山融水 → 峡谷 → 河流 → 土壤剖面 → 大海。五幅统一光线和色调的 AI 生成艺术景观代替旧首页照片。景观采用图像驱动的 WebGL 浅浮雕网格和受限视差；早期悬浮水滴因为与景观脱节而移除。此实现不是完整可自由漫游的三维地形，也不是污染扩散或地下水流模型。大幅移动镜头会暴露图像深度的限制，因此只使用缓慢推进和轻微指针视差。

滚动决定场景进度。时间步长用于稳定插值，停止滚动后不会自动摇晃。无 WebGL、贴图失败时，照片的前景与远景以不同速度缓慢移动；减少动态效果设置下保留静态景观和正常可用的链接。图片共约 1.3 MB，Three.js 动态加载。访问首页并加上 `?debug3d=1` 可查看本机的渲染状态，普通访问者不显示诊断标签。

## 素材生成记录

使用内置图像生成工具，每个场景独立生成。原图仅作无视觉修改的 WebP 编码压缩（quality 88）。最终素材：public/landing/journey/{snow,canyon,river,soil,ocean}.webp。

统一提示：premium cinematic website landscape background, 16:9 wide; natural detailed material, cool blue and muted jade palette, soft overcast morning lighting, deep atmospheric perspective, impressive scale, high-end environmental storytelling. Main landscape interest center-right, left third calmer for white type overlay. No people, buildings, typography, labels, borders or watermarks. Not low-poly, cartoon or game graphics.

- Snow: monumental pristine alpine snow mountain range at dawn, fine glacier striations, meltwater channel toward bottom right, snowy foreground ridge, middle peaks and distant atmospheric mountains.
- Canyon: turquoise meltwater river through an immense limestone canyon, camera above water, rocky right foreground, misty distant valley and layered mountains.
- River: winding jade river through lush green valley, high riverbank right foreground, distant mountain silhouettes, sunlight on water ripples.
- Soil: photorealistic artistic geological cutaway seen obliquely, forest on top, exposed roots, porous sediment and dark layered rock, turquoise water in lower fissure. Concept art, not technical diagram.
- Ocean: calm deep blue ocean and coastal river estuary at dawn, freshwater channel enters sea, textured coastal rock on right, soft silver horizon.

页面底部标注 AI 景观、非监测点/案例现场。土壤章节也注明画面不代表迁移预测。

## 验收

在支持 WebGL 的桌面浏览器中检查：雪山开场、连续向下/向上滚动、五幕转场、窗口改变尺寸和导航跳转。检查手机竖屏文案、减少动态效果、WebGL 不可用时的滚动视差。测试环境若禁用 WebGL，只能验证降级画面，不能用该截图证明三维渲染质量。要达到参考站的完整立体摄影效果，需另行制作有真实几何与贴图的场景资源，并在具备 GPU 的浏览器中逐帧验收。

## 2026-11-09：轻量连续场景试验

`/terrain-lab` 现使用动态导入的 `journey-scene.ts`，移除 ArcGIS 模块、在线地形和卫星影像请求。浏览器本地生成带顶点颜色的地形、渐降河床、动态水面、实例化岩石及树林；一条连续镜头路线依次经过雪山、融水近景、峡谷、林地河流、海面。场景为艺术化几何，不宣称真实地貌、水文模拟或摄影级效果。当前融水是流水近景，不包含积雪真实融化模拟。

手机使用较低网格密度与实例数量，像素比上限为 1.25；桌面为 1.5。页面隐藏时停止绘制，减少动态偏好下停止水面动画并直接响应章节位置。异步加载在卸载后不再初始化，清理监听、动画帧、几何体、材质和实例资源；WebGL 失败或丢失时显示明确提示。

本次只改试验页，未替换首页、未合并 main。TypeScript、改动文件 ESLint 与 Next.js 生产构建通过。本地预览因 tsx IPC 管道 EPERM 无法启动，Vercel 团队访问返回 403，需要重新授权。浏览器视觉、帧率、移动端和实际加载速度尚未验收，不据构建通过宣称视觉达标。下一步检查五个章节及中间镜头位置、正反滚动、减少动态设置和导航返回后的重新初始化。
