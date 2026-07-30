import PptxGenJS from 'pptxgenjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 颜色方案 - 简约大气深海蓝
const COLORS = {
  primary: '#0F2B46',      // 深海蓝 - 主色
  secondary: '#1E4A6F',    // 中蓝
  accent: '#0EA5E9',       // 水质青 - 强调
  light: '#E8F0F8',        // 浅蓝灰
  white: '#FFFFFF',
  dark: '#0F172A',         // 墨黑
  gray: '#64748B',         // 次级灰
  bg: '#F8FAFC',           // 背景色
  green: '#10B981',        // 绿色
  amber: '#F59E0B',        // 琥珀色
};

const pptx = new PptxGenJS();

pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
pptx.layout = 'WIDE';

// ===== 第1页：封面 =====
const slide1 = pptx.addSlide();
slide1.background = { fill: COLORS.primary };

// 左侧装饰线
slide1.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 0.08, h: 7.5, fill: { color: COLORS.accent }
});

// 底部装饰条
slide1.addShape(pptx.ShapeType.rect, {
  x: 0, y: 6.8, w: 13.33, h: 0.7, fill: { color: COLORS.secondary }
});

// 主标题
slide1.addText('地下水监测排污预警系统', {
  x: 1.5, y: 1.8, w: 10, h: 1.2,
  fontSize: 36, fontFace: 'Microsoft YaHei',
  color: COLORS.white, bold: true,
  align: 'left'
});

// 副标题
slide1.addText('Groundwater Monitoring & Pollution Early Warning System', {
  x: 1.5, y: 3.0, w: 10, h: 0.6,
  fontSize: 16, fontFace: 'Arial',
  color: COLORS.accent, italic: true,
  align: 'left'
});

// 分隔线
slide1.addShape(pptx.ShapeType.rect, {
  x: 1.5, y: 3.8, w: 3, h: 0.04, fill: { color: COLORS.accent }
});

// 描述文字
slide1.addText('科技赋能环保 · 数据驱动决策 · 守护绿水青山', {
  x: 1.5, y: 4.2, w: 10, h: 0.5,
  fontSize: 18, fontFace: 'Microsoft YaHei',
  color: COLORS.light,
  align: 'left'
});

// 右下角小字
slide1.addText('2026', {
  x: 11, y: 6.1, w: 1.5, h: 0.5,
  fontSize: 14, fontFace: 'Arial',
  color: COLORS.gray, align: 'right'
});

// ===== 第2页：背景与市场前景 =====
const slide2 = pptx.addSlide();
slide2.background = { fill: COLORS.white };

// 顶部色块
slide2.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: COLORS.accent }
});

// 左侧装饰线
slide2.addShape(pptx.ShapeType.rect, {
  x: 0.6, y: 0.8, w: 0.06, h: 1.2, fill: { color: COLORS.primary }
});

// 标题
slide2.addText('项目背景与市场前景', {
  x: 1.0, y: 0.8, w: 10, h: 0.8,
  fontSize: 28, fontFace: 'Microsoft YaHei',
  color: COLORS.primary, bold: true
});

// 背景内容 - 左侧卡片
slide2.addShape(pptx.ShapeType.roundRect, {
  x: 0.6, y: 1.8, w: 5.8, h: 4.8,
  fill: { color: COLORS.bg },
  rectRadius: 0.3,
  shadow: { type: 'outer', blur: 6, offset: 2, color: 'rgba(0,0,0,0.08)' }
});

slide2.addText('项目背景', {
  x: 1.0, y: 2.0, w: 5, h: 0.5,
  fontSize: 18, fontFace: 'Microsoft YaHei',
  color: COLORS.primary, bold: true
});

slide2.addText([
  { text: '• 我国地下水污染问题日益突出，工业排污、农业面源污染等对地下水资源构成严重威胁\n\n', options: { fontSize: 13, color: COLORS.dark } },
  { text: '• 传统监测方式依赖人工采样，周期长、覆盖窄、响应慢，难以及时发现污染风险\n\n', options: { fontSize: 13, color: COLORS.dark } },
  { text: '• 国家"十四五"生态环境规划明确提出加强地下水环境监测体系建设\n\n', options: { fontSize: 13, color: COLORS.dark } },
  { text: '• 环保监管趋严，企业亟需数字化工具实现排污合规管理', options: { fontSize: 13, color: COLORS.dark } },
], {
  x: 1.0, y: 2.6, w: 5.2, h: 3.8,
  fontSize: 13, fontFace: 'Microsoft YaHei',
  lineSpacing: 22,
  valign: 'top'
});

// 市场前景 - 右侧卡片
slide2.addShape(pptx.ShapeType.roundRect, {
  x: 6.7, y: 1.8, w: 5.8, h: 4.8,
  fill: { color: COLORS.primary },
  rectRadius: 0.3,
  shadow: { type: 'outer', blur: 6, offset: 2, color: 'rgba(0,0,0,0.08)' }
});

slide2.addText('市场前景', {
  x: 7.1, y: 2.0, w: 5, h: 0.5,
  fontSize: 18, fontFace: 'Microsoft YaHei',
  color: COLORS.white, bold: true
});

// 三个数据卡片
const metrics = [
  { value: '3000亿+', label: '环保市场规模', y: 2.7 },
  { value: '60%↑', label: '数字化监测覆盖率', y: 3.6 },
  { value: '85%', label: '企业合规需求', y: 4.5 },
];

metrics.forEach(m => {
  slide2.addShape(pptx.ShapeType.roundRect, {
    x: 7.3, y: m.y, w: 4.8, h: 0.7,
    fill: { color: COLORS.secondary },
    rectRadius: 0.15
  });
  slide2.addText(m.value, {
    x: 7.5, y: m.y, w: 2, h: 0.7,
    fontSize: 20, fontFace: 'Arial',
    color: COLORS.accent, bold: true,
    align: 'left', valign: 'middle'
  });
  slide2.addText(m.label, {
    x: 9.5, y: m.y, w: 2.5, h: 0.7,
    fontSize: 14, fontFace: 'Microsoft YaHei',
    color: COLORS.light,
    align: 'left', valign: 'middle'
  });
});

// ===== 第3页：核心功能 =====
const slide3 = pptx.addSlide();
slide3.background = { fill: COLORS.white };

// 顶部色块
slide3.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: COLORS.accent }
});

// 左侧装饰线
slide3.addShape(pptx.ShapeType.rect, {
  x: 0.6, y: 0.8, w: 0.06, h: 1.2, fill: { color: COLORS.primary }
});

// 标题
slide3.addText('核心功能', {
  x: 1.0, y: 0.8, w: 10, h: 0.8,
  fontSize: 28, fontFace: 'Microsoft YaHei',
  color: COLORS.primary, bold: true
});

// 4个功能卡片 - 2x2布局
const features = [
  { icon: '📊', title: '实时监测', desc: '24小时不间断监测排污口\n水质数据，实时掌握\n污染物动态变化', x: 0.6, y: 1.8 },
  { icon: '🚨', title: '智能预警', desc: '基于多维指标的智能\n预警模型，超标自动\n告警，快速响应', x: 6.7, y: 1.8 },
  { icon: '📈', title: 'CDC风险分析', desc: '污染风险指数(CDC)\n综合评估，科学量化\n污染风险等级', x: 0.6, y: 4.4 },
  { icon: '🗺️', title: '园区地图', desc: '可视化园区地图展示\n企业分布与排污口\n位置一目了然', x: 6.7, y: 4.4 },
];

features.forEach(f => {
  // 卡片背景
  slide3.addShape(pptx.ShapeType.roundRect, {
    x: f.x, y: f.y, w: 5.8, h: 2.2,
    fill: { color: COLORS.bg },
    rectRadius: 0.3,
    shadow: { type: 'outer', blur: 6, offset: 2, color: 'rgba(0,0,0,0.06)' }
  });

  // 图标
  slide3.addText(f.icon, {
    x: f.x + 0.3, y: f.y + 0.2, w: 0.8, h: 0.8,
    fontSize: 28, align: 'center', valign: 'middle'
  });

  // 标题
  slide3.addText(f.title, {
    x: f.x + 1.2, y: f.y + 0.2, w: 4, h: 0.5,
    fontSize: 18, fontFace: 'Microsoft YaHei',
    color: COLORS.primary, bold: true
  });

  // 描述
  slide3.addText(f.desc, {
    x: f.x + 1.2, y: f.y + 0.7, w: 4.2, h: 1.3,
    fontSize: 13, fontFace: 'Microsoft YaHei',
    color: COLORS.gray, lineSpacing: 20
  });
});

// ===== 第4页：运行方式与系统架构 =====
const slide4 = pptx.addSlide();
slide4.background = { fill: COLORS.white };

// 顶部色块
slide4.addShape(pptx.ShapeType.rect, {
  x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: COLORS.accent }
});

// 左侧装饰线
slide4.addShape(pptx.ShapeType.rect, {
  x: 0.6, y: 0.8, w: 0.06, h: 1.2, fill: { color: COLORS.primary }
});

// 标题
slide4.addText('系统运行方式', {
  x: 1.0, y: 0.8, w: 10, h: 0.8,
  fontSize: 28, fontFace: 'Microsoft YaHei',
  color: COLORS.primary, bold: true
});

// 流程步骤 - 横向排列
const steps = [
  { num: '01', title: '数据采集', desc: '企业通过Excel上传\n监测数据，或接入\n在线监测设备', color: COLORS.primary },
  { num: '02', title: '数据分析', desc: '系统自动计算CDC\n污染风险指数，\n评估风险等级', color: COLORS.secondary },
  { num: '03', title: '风险预警', desc: '超标数据自动触发\n预警通知，及时\n推送告警信息', color: COLORS.amber },
  { num: '04', title: '监管决策', desc: '管理者查看园区\n全景数据，科学\n制定监管措施', color: COLORS.accent },
];

steps.forEach((s, i) => {
  const x = 0.6 + i * 3.15;

  // 圆形编号
  slide4.addShape(pptx.ShapeType.ellipse, {
    x: x + 1.0, y: 1.9, w: 0.8, h: 0.8,
    fill: { color: s.color }
  });
  slide4.addText(s.num, {
    x: x + 1.0, y: 1.9, w: 0.8, h: 0.8,
    fontSize: 18, fontFace: 'Arial',
    color: COLORS.white, bold: true,
    align: 'center', valign: 'middle'
  });

  // 箭头连接（除最后一个）
  if (i < steps.length - 1) {
    slide4.addText('→', {
      x: x + 2.2, y: 1.9, w: 0.6, h: 0.8,
      fontSize: 24, color: COLORS.gray,
      align: 'center', valign: 'middle'
    });
  }

  // 标题
  slide4.addText(s.title, {
    x: x, y: 2.9, w: 2.8, h: 0.5,
    fontSize: 16, fontFace: 'Microsoft YaHei',
    color: COLORS.primary, bold: true,
    align: 'center'
  });

  // 描述
  slide4.addText(s.desc, {
    x: x, y: 3.4, w: 2.8, h: 1.5,
    fontSize: 12, fontFace: 'Microsoft YaHei',
    color: COLORS.gray, align: 'center',
    lineSpacing: 18
  });
});

// 底部技术架构卡片
slide4.addShape(pptx.ShapeType.roundRect, {
  x: 0.6, y: 5.2, w: 12.1, h: 1.8,
  fill: { color: COLORS.primary },
  rectRadius: 0.3
});

slide4.addText('技术架构', {
  x: 1.0, y: 5.3, w: 3, h: 0.5,
  fontSize: 16, fontFace: 'Microsoft YaHei',
  color: COLORS.white, bold: true
});

slide4.addText([
  { text: '前端 ', options: { color: COLORS.accent, bold: true } },
  { text: 'Next.js 16 + React 19 + Tailwind CSS 4  |  ', options: { color: COLORS.light } },
  { text: '后端 ', options: { color: COLORS.accent, bold: true } },
  { text: 'Next.js API Routes + Supabase  |  ', options: { color: COLORS.light } },
  { text: '数据库 ', options: { color: COLORS.accent, bold: true } },
  { text: 'PostgreSQL (Supabase)  |  ', options: { color: COLORS.light } },
  { text: '部署 ', options: { color: COLORS.accent, bold: true } },
  { text: 'Vercel + Supabase 云端部署', options: { color: COLORS.light } },
], {
  x: 1.0, y: 5.9, w: 11.5, h: 0.5,
  fontSize: 13, fontFace: 'Microsoft YaHei'
});

slide4.addText('支持多端适配 · 数据实时同步 · 安全可靠', {
  x: 1.0, y: 6.4, w: 11.5, h: 0.4,
  fontSize: 11, fontFace: 'Microsoft YaHei',
  color: COLORS.gray
});

// 保存
const outputPath = path.join(__dirname, '../public/groundwater-monitoring.pptx');
pptx.writeFile({ fileName: outputPath }).then(() => {
  console.log('PPT已生成:', outputPath);
});