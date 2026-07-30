import PptxGenJS from 'pptxgenjs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC = path.join(__dirname, '../public');

const C = {
  primary: '#0F2B46',
  secondary: '#1E4A6F',
  accent: '#0EA5E9',
  light: '#E8F0F8',
  white: '#FFFFFF',
  dark: '#0F172A',
  gray: '#64748B',
  bg: '#F8FAFC',
  green: '#10B981',
  amber: '#F59E0B',
  red: '#EF4444',
  line: '#E2E8F0',
  overlay: '#0A1A2E',
  softBg: '#EFF6FF',
};

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
pptx.layout = 'WIDE';

// ===== 第1页：封面（全图背景） =====
const s1 = pptx.addSlide();
s1.background = { fill: C.primary };

// 封面背景图
s1.addImage({ path: path.join(PUBLIC, 'cover-bg.jpg'), x: 0, y: 0, w: 13.33, h: 7.5, opacity: 0.35 });

// 左侧渐变装饰条
s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 0.5, h: 7.5, fill: { color: C.accent } });

// 主标题
s1.addText('地下水监测排污预警系统', {
  x: 1.5, y: 2.2, w: 10, h: 1.2,
  fontSize: 42, fontFace: 'Microsoft YaHei',
  color: C.white, bold: true
});

// 副标题
s1.addText('Groundwater Monitoring & Pollution Early Warning System', {
  x: 1.5, y: 3.4, w: 10, h: 0.6,
  fontSize: 16, fontFace: 'Arial', color: C.accent, italic: true
});

// 分隔线
s1.addShape(pptx.ShapeType.rect, { x: 1.5, y: 4.2, w: 4, h: 0.04, fill: { color: C.accent } });

// 标语
s1.addText('科技赋能环保  ·  数据驱动决策  ·  守护绿水青山', {
  x: 1.5, y: 4.6, w: 10, h: 0.6,
  fontSize: 18, fontFace: 'Microsoft YaHei', color: C.light
});

// 底部信息
s1.addShape(pptx.ShapeType.rect, { x: 0, y: 6.8, w: 13.33, h: 0.7, fill: { color: C.overlay } });
s1.addText('2026  |  智慧环保综合解决方案', {
  x: 1.5, y: 6.8, w: 10, h: 0.7,
  fontSize: 13, fontFace: 'Microsoft YaHei', color: C.gray, valign: 'middle'
});

// ===== 第2页：背景与市场前景 =====
const s2 = pptx.addSlide();
s2.background = { fill: C.white };

s2.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: C.accent } });

s2.addShape(pptx.ShapeType.rect, { x: 0.6, y: 0.8, w: 0.06, h: 1.0, fill: { color: C.primary } });
s2.addText('项目背景与市场前景', {
  x: 1.0, y: 0.8, w: 10, h: 0.8,
  fontSize: 28, fontFace: 'Microsoft YaHei', color: C.primary, bold: true
});

// 左侧：背景区域
s2.addImage({ path: path.join(PUBLIC, 'park-aerial.jpg'), x: 0.6, y: 1.8, w: 5.8, h: 4.8, opacity: 0.3 });

// 深色背景卡片
s2.addShape(pptx.ShapeType.roundRect, {
  x: 0.6, y: 1.8, w: 5.8, h: 4.8,
  fill: { color: C.primary },
  rectRadius: 0.2
});

s2.addText('项目背景', {
  x: 1.0, y: 2.0, w: 5, h: 0.5,
  fontSize: 18, fontFace: 'Microsoft YaHei', color: C.white, bold: true
});

s2.addText([
  { text: '▸', options: { color: C.accent, bold: true } },
  { text: ' 我国地下水污染问题日益突出，工业排污对水资源构成严重威胁\n\n', options: { color: C.light } },
  { text: '▸', options: { color: C.accent, bold: true } },
  { text: ' 传统监测依赖人工采样，周期长、覆盖窄、响应慢\n\n', options: { color: C.light } },
  { text: '▸', options: { color: C.accent, bold: true } },
  { text: ' 国家"十四五"规划明确加强地下水环境监测体系建设\n\n', options: { color: C.light } },
  { text: '▸', options: { color: C.accent, bold: true } },
  { text: ' 环保监管趋严，企业亟需数字化工具实现排污合规管理', options: { color: C.light } },
], {
  x: 1.0, y: 2.7, w: 5.2, h: 3.5,
  fontSize: 12, fontFace: 'Microsoft YaHei', lineSpacing: 24, valign: 'top'
});

// 右侧：市场前景卡片
s2.addShape(pptx.ShapeType.roundRect, {
  x: 6.7, y: 1.8, w: 5.8, h: 4.8,
  fill: { color: C.bg }, rectRadius: 0.3,
  shadow: { type: 'outer', blur: 8, offset: 2, color: 'B0B0B0' }
});

s2.addText('市场前景', {
  x: 7.1, y: 2.0, w: 5, h: 0.5,
  fontSize: 18, fontFace: 'Microsoft YaHei', color: C.primary, bold: true
});

const marketColor = {
  primary: { value: '3,000亿+', label: '中国环保产业市场规模', sub: '年复合增长率15%', color: C.primary },
  accent: { value: '60% ↑', label: '数字化监测覆盖率', sub: '十四五规划目标增速', color: C.accent },
  green: { value: '85%', label: '企业环保合规需求', sub: '中小企业占比持续提升', color: C.green },
};

const items = [marketColor.primary, marketColor.accent, marketColor.green];
items.forEach((d, i) => {
  const y = 2.7 + i * 1.3;
  s2.addShape(pptx.ShapeType.roundRect, {
    x: 7.1, y: y, w: 5.0, h: 1.1,
    fill: { color: C.white }, rectRadius: 0.15,
    line: { color: C.line, width: 1 }
  });
  s2.addText(d.value, {
    x: 7.3, y: y + 0.05, w: 2.0, h: 0.55,
    fontSize: 22, fontFace: 'Arial', color: d.color, bold: true, align: 'left', valign: 'middle'
  });
  s2.addText(d.label, {
    x: 9.3, y: y + 0.05, w: 2.5, h: 0.55,
    fontSize: 13, fontFace: 'Microsoft YaHei', color: C.dark, bold: true, align: 'left', valign: 'middle'
  });
  s2.addText(d.sub, {
    x: 9.3, y: y + 0.55, w: 2.5, h: 0.45,
    fontSize: 10, fontFace: 'Microsoft YaHei', color: C.gray, align: 'left', valign: 'middle'
  });
});

// 底部趋势说明
s2.addShape(pptx.ShapeType.roundRect, {
  x: 7.1, y: 5.2, w: 5.0, h: 0.5,
  fill: { color: C.softBg }, rectRadius: 0.1
});
s2.addText('环保监测数字化是未来5年高增长赛道', {
  x: 7.3, y: 5.2, w: 4.6, h: 0.5,
  fontSize: 11, fontFace: 'Microsoft YaHei', color: C.secondary, valign: 'middle'
});

// ===== 第3页：核心功能 =====
const s3 = pptx.addSlide();
s3.background = { fill: C.white };

s3.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: C.accent } });

s3.addShape(pptx.ShapeType.rect, { x: 0.6, y: 0.8, w: 0.06, h: 1.0, fill: { color: C.primary } });
s3.addText('核心功能', {
  x: 1.0, y: 0.8, w: 10, h: 0.8,
  fontSize: 28, fontFace: 'Microsoft YaHei', color: C.primary, bold: true
});

// 左侧功能列表
const features = [
  { icon: '📊', title: '实时监测', desc: '24小时不间断监测排污口水质数据\nCOD、NH₃-N、TP、TN等多维指标', color: C.accent },
  { icon: '🚨', title: '超标预警', desc: '超标数据自动触发告警通知\n三级预警体系，快速响应突发事件', color: C.amber },
  { icon: '📈', title: 'CDC风险分析', desc: '污染风险指数综合评估模型\n科学量化污染等级，追踪趋势变化', color: C.green },
  { icon: '🗺️', title: '园区地图', desc: '可视化园区地图展示企业分布\n排污口位置一目了然，便捷管理', color: C.primary },
];

features.forEach((f, i) => {
  const y = 1.8 + i * 1.35;
  // 左侧色条
  s3.addShape(pptx.ShapeType.rect, { x: 0.6, y: y, w: 0.06, h: 1.15, fill: { color: f.color } });
  // 卡片背景
  s3.addShape(pptx.ShapeType.roundRect, {
    x: 0.66, y: y, w: 6.3, h: 1.15,
    fill: { color: C.bg }, rectRadius: 0.2,
    shadow: { type: 'outer', blur: 4, offset: 1, color: 'B0B0B0' }
  });
  s3.addText(f.icon, {
    x: 0.9, y: y + 0.1, w: 0.7, h: 0.7,
    fontSize: 24, align: 'center', valign: 'middle'
  });
  s3.addText(f.title, {
    x: 1.7, y: y + 0.08, w: 2, h: 0.4,
    fontSize: 16, fontFace: 'Microsoft YaHei', color: C.primary, bold: true
  });
  s3.addText(f.desc, {
    x: 1.7, y: y + 0.5, w: 5.0, h: 0.55,
    fontSize: 11, fontFace: 'Microsoft YaHei', color: C.gray, lineSpacing: 16
  });
});

// 右侧数据仪表盘图片
s3.addImage({ path: path.join(PUBLIC, 'data-dashboard.jpg'), x: 7.4, y: 1.8, w: 5.3, h: 4.6 });
s3.addShape(pptx.ShapeType.roundRect, {
  x: 7.4, y: 1.8, w: 5.3, h: 4.6,
  rectRadius: 0.3, line: { color: C.line, width: 1 }, fill: { type: 'none' }
});

// 图片上的标签
s3.addShape(pptx.ShapeType.roundRect, {
  x: 7.6, y: 2.0, w: 2.0, h: 0.4,
  fill: { color: C.primary }, rectRadius: 0.1
});
s3.addText('系统界面示意', {
  x: 7.6, y: 2.0, w: 2.0, h: 0.4,
  fontSize: 10, fontFace: 'Microsoft YaHei', color: C.white, align: 'center', valign: 'middle'
});

// ===== 第4页：运行方式 =====
const s4 = pptx.addSlide();
s4.background = { fill: C.white };

s4.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: C.accent } });

s4.addShape(pptx.ShapeType.rect, { x: 0.6, y: 0.8, w: 0.06, h: 1.0, fill: { color: C.primary } });
s4.addText('系统运行方式', {
  x: 1.0, y: 0.8, w: 10, h: 0.8,
  fontSize: 28, fontFace: 'Microsoft YaHei', color: C.primary, bold: true
});

s4.addText('从数据采集到监管决策，全流程数字化闭环管理', {
  x: 1.0, y: 1.5, w: 10, h: 0.4,
  fontSize: 14, fontFace: 'Microsoft YaHei', color: C.gray
});

// 4个流程步骤 - 时间轴布局
const steps = [
  { num: '01', title: '数据采集', desc: '企业通过Excel批量上传\n或接入在线监测设备\n自动采集排污口数据', color: C.primary },
  { num: '02', title: '智能分析', desc: '系统自动计算CDC指数\n多维度评估污染风险\n生成可视化分析报告', color: C.secondary },
  { num: '03', title: '预警通知', desc: '超标数据实时告警\n分级推送预警信息\n快速响应污染事件', color: C.amber },
  { num: '04', title: '监管决策', desc: '管理者查看园区全景\n数据驱动制定措施\n科学化环保监管', color: C.accent },
];

// 竖线
s4.addShape(pptx.ShapeType.rect, { x: 1.2, y: 2.2, w: 0.04, h: 4.5, fill: { color: C.line } });

steps.forEach((s, i) => {
  const y = 2.2 + i * 1.15;
  // 时间轴圆点
  s4.addShape(pptx.ShapeType.ellipse, {
    x: 1.0, y: y + 0.15, w: 0.45, h: 0.45,
    fill: { color: s.color }
  });
  s4.addText(s.num, {
    x: 1.0, y: y + 0.15, w: 0.45, h: 0.45,
    fontSize: 12, fontFace: 'Arial', color: C.white, bold: true,
    align: 'center', valign: 'middle'
  });
  s4.addText(s.title, {
    x: 1.8, y: y, w: 2, h: 0.4,
    fontSize: 16, fontFace: 'Microsoft YaHei', color: C.primary, bold: true
  });
  s4.addText(s.desc, {
    x: 1.8, y: y + 0.4, w: 3.5, h: 0.75,
    fontSize: 11, fontFace: 'Microsoft YaHei', color: C.gray, lineSpacing: 16
  });
});

// 右侧技术架构卡片
s4.addImage({ path: path.join(PUBLIC, 'cover-bg.jpg'), x: 6.0, y: 2.0, w: 6.8, h: 4.5, opacity: 0.25 });
s4.addShape(pptx.ShapeType.roundRect, {
  x: 6.0, y: 2.0, w: 6.8, h: 4.5,
  fill: { color: C.primary }, rectRadius: 0.3
});

s4.addText('技术架构', {
  x: 6.5, y: 2.3, w: 5.5, h: 0.5,
  fontSize: 18, fontFace: 'Microsoft YaHei', color: C.white, bold: true
});

const techStack = [
  { label: '前端框架', value: 'Next.js 16 + React 19 + TypeScript' },
  { label: 'UI 样式', value: 'Tailwind CSS 4 + shadcn/ui 组件库' },
  { label: '后端服务', value: 'Next.js API Routes' },
  { label: '数据库', value: 'PostgreSQL (Supabase)' },
  { label: '认证系统', value: 'Supabase Auth (邮箱密码)' },
  { label: '部署运维', value: 'Vercel + Supabase 云端部署' },
  { label: '安全合规', value: '数据加密 + 权限分级 + 审计日志' },
];

techStack.forEach((t, i) => {
  const y = 2.9 + i * 0.45;
  s4.addShape(pptx.ShapeType.rect, {
    x: 6.5, y: y, w: 5.8, h: 0.35,
    fill: { color: i % 2 === 0 ? C.overlay : C.secondary }
  });
  s4.addText(t.label, {
    x: 6.7, y: y, w: 1.5, h: 0.35,
    fontSize: 10, fontFace: 'Microsoft YaHei', color: C.accent, valign: 'middle', bold: true
  });
  s4.addText(t.value, {
    x: 8.2, y: y, w: 3.8, h: 0.35,
    fontSize: 10, fontFace: 'Microsoft YaHei', color: C.light, valign: 'middle'
  });
});

// 底部版权
s4.addShape(pptx.ShapeType.rect, { x: 0, y: 7.0, w: 13.33, h: 0.5, fill: { color: C.primary } });
s4.addText('让每一滴水都有数据，让每一次排污都在监控', {
  x: 0, y: 7.0, w: 13.33, h: 0.5,
  fontSize: 11, fontFace: 'Microsoft YaHei', color: C.light, align: 'center', valign: 'middle'
});

// 保存
const outputPath = path.join(PUBLIC, 'groundwater-monitoring.pptx');
pptx.writeFile({ fileName: outputPath }).then(() => {
  console.log('✅ PPT已生成:', outputPath);
});