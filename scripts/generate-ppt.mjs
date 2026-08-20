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
  cardBg: '#FFFFFF',
};

const pptx = new PptxGenJS();
pptx.defineLayout({ name: 'WIDE', width: 13.33, height: 7.5 });
pptx.layout = 'WIDE';

// ===== 第1页：封面 =====
const s1 = pptx.addSlide();
s1.background = { fill: C.primary };

// 深色渐变背景装饰
s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 7.5, fill: { color: C.overlay } });
// 右上角装饰圆
s1.addShape(pptx.ShapeType.ellipse, { x: 9.5, y: -2, w: 6, h: 6, fill: { color: C.secondary, transparency: 60 } });
s1.addShape(pptx.ShapeType.ellipse, { x: 10.5, y: 4, w: 5, h: 5, fill: { color: C.accent, transparency: 80 } });
// 左下角装饰
s1.addShape(pptx.ShapeType.ellipse, { x: -2, y: 5.5, w: 4, h: 4, fill: { color: C.secondary, transparency: 70 } });

// 左侧装饰线
s1.addShape(pptx.ShapeType.rect, { x: 0.8, y: 0, w: 0.06, h: 7.5, fill: { color: C.accent } });

// 主标题
s1.addText('基于虚拟质点系与高维矩张量耦合的水污染动态评估系统', {
  x: 1.5, y: 2.2, w: 10, h: 1.2,
  fontSize: 42, fontFace: 'Microsoft YaHei', color: C.white, bold: true
});

// 副标题
s1.addText('Groundwater Monitoring & Pollution Early Warning System', {
  x: 1.5, y: 3.4, w: 10, h: 0.6,
  fontSize: 16, fontFace: 'Arial', color: C.accent, italic: true
});

// 分隔线
s1.addShape(pptx.ShapeType.rect, { x: 1.5, y: 4.2, w: 4, h: 0.04, fill: { color: C.accent } });

// 标语
s1.addText('科技赋能环保 · 数据驱动决策 · 守护绿水青山', {
  x: 1.5, y: 4.6, w: 10, h: 0.6,
  fontSize: 18, fontFace: 'Microsoft YaHei', color: C.light
});

// 底部信息栏
s1.addShape(pptx.ShapeType.rect, { x: 0, y: 6.8, w: 13.33, h: 0.7, fill: { color: 'rgba(0,0,0,0.3)' } });
s1.addText('2026  |  智慧环保综合解决方案', {
  x: 1.5, y: 6.8, w: 10, h: 0.7,
  fontSize: 13, fontFace: 'Microsoft YaHei', color: C.gray, valign: 'middle'
});

// ===== 第2页：背景与市场前景 =====
const s2 = pptx.addSlide();
s2.background = { fill: C.white };

// 顶部蓝色条
s2.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: C.accent } });

// 标题
s2.addShape(pptx.ShapeType.rect, { x: 0.6, y: 0.8, w: 0.06, h: 1.0, fill: { color: C.primary } });
s2.addText('项目背景与市场前景', {
  x: 1.0, y: 0.8, w: 10, h: 0.8,
  fontSize: 28, fontFace: 'Microsoft YaHei', color: C.primary, bold: true
});

// 左侧：项目背景 - 卡片式
s2.addShape(pptx.ShapeType.roundRect, {
  x: 0.6, y: 1.8, w: 5.8, h: 4.8,
  fill: { color: C.primary }, rectRadius: 0.3
});

// 背景装饰
s2.addShape(pptx.ShapeType.ellipse, { x: 4.5, y: 4.5, w: 3, h: 3, fill: { color: C.secondary, transparency: 60 } });

s2.addText('项目背景', {
  x: 1.0, y: 2.0, w: 5, h: 0.5,
  fontSize: 18, fontFace: 'Microsoft YaHei', color: C.white, bold: true
});

// 图标装饰
const bgItems = [
  { icon: '⚠', text: '我国地下水污染问题日益突出，工业排污对水资源构成严重威胁' },
  { icon: '📋', text: '传统监测依赖人工采样，周期长、覆盖窄、响应慢' },
  { icon: '📜', text: '国家"十四五"规划明确加强地下水环境监测体系建设' },
  { icon: '🏭', text: '环保监管趋严，企业亟需数字化工具实现排污合规管理' },
];

bgItems.forEach((item, i) => {
  const y = 2.7 + i * 0.85;
  s2.addShape(pptx.ShapeType.roundRect, {
    x: 1.0, y: y, w: 5.2, h: 0.7,
    fill: { color: C.secondary, transparency: 40 }, rectRadius: 0.1
  });
  s2.addText(item.icon, {
    x: 1.2, y: y, w: 0.5, h: 0.7,
    fontSize: 16, align: 'center', valign: 'middle'
  });
  s2.addText(item.text, {
    x: 1.7, y: y, w: 4.3, h: 0.7,
    fontSize: 11, fontFace: 'Microsoft YaHei', color: C.light, valign: 'middle'
  });
});

// 右侧：市场前景
s2.addShape(pptx.ShapeType.roundRect, {
  x: 6.7, y: 1.8, w: 5.8, h: 4.8,
  fill: { color: C.bg }, rectRadius: 0.3,
  shadow: { type: 'outer', blur: 8, offset: 2, color: 'B0B0B0' }
});

s2.addText('市场前景', {
  x: 7.1, y: 2.0, w: 5, h: 0.5,
  fontSize: 18, fontFace: 'Microsoft YaHei', color: C.primary, bold: true
});

// 市场数据卡片
const marketData = [
  { value: '3,000亿+', label: '环保产业市场规模', sub: '年复合增长率 15%', color: C.primary, bar: 0.9 },
  { value: '60%↑', label: '数字化监测覆盖率', sub: '十四五规划目标增速', color: C.accent, bar: 0.6 },
  { value: '85%', label: '企业环保合规需求', sub: '中小企业占比持续提升', color: C.green, bar: 0.85 },
];

marketData.forEach((d, i) => {
  const y = 2.7 + i * 1.3;
  s2.addShape(pptx.ShapeType.roundRect, {
    x: 7.1, y: y, w: 5.0, h: 1.1,
    fill: { color: C.white }, rectRadius: 0.15,
    line: { color: C.line, width: 1 }
  });
  // 数值
  s2.addText(d.value, {
    x: 7.3, y: y + 0.05, w: 2.0, h: 0.55,
    fontSize: 22, fontFace: 'Arial', color: d.color, bold: true, align: 'left', valign: 'middle'
  });
  // 标签
  s2.addText(d.label, {
    x: 9.3, y: y + 0.05, w: 2.5, h: 0.55,
    fontSize: 13, fontFace: 'Microsoft YaHei', color: C.dark, bold: true, align: 'left', valign: 'middle'
  });
  // 副标签
  s2.addText(d.sub, {
    x: 9.3, y: y + 0.55, w: 2.5, h: 0.45,
    fontSize: 10, fontFace: 'Microsoft YaHei', color: C.gray, align: 'left', valign: 'middle'
  });
  // 进度条
  s2.addShape(pptx.ShapeType.roundRect, {
    x: 7.3, y: y + 0.75, w: 4.5 * d.bar, h: 0.06,
    fill: { color: d.color }, rectRadius: 0.03
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

// 4个功能卡片 - 2x2网格
const features = [
  { icon: '📊', title: '实时监测', desc: '24小时不间断监测排污口水质数据\nCOD、NH₃-N、TP、TN等多维指标', color: C.accent, bg: '#E0F2FE' },
  { icon: '🚨', title: '超标预警', desc: '超标数据自动触发告警通知\n三级预警体系，快速响应突发事件', color: C.amber, bg: '#FEF3C7' },
  { icon: '📈', title: 'CDC风险分析', desc: '污染风险指数综合评估模型\n科学量化污染等级，追踪趋势变化', color: C.green, bg: '#D1FAE5' },
  { icon: '🗺️', title: '园区地图', desc: '可视化园区地图展示企业分布\n排污口位置一目了然，便捷管理', color: C.primary, bg: '#DBEAFE' },
];

features.forEach((f, i) => {
  const col = i % 2;
  const row = Math.floor(i / 2);
  const x = 0.6 + col * 6.2;
  const y = 1.8 + row * 2.6;

  // 卡片背景
  s3.addShape(pptx.ShapeType.roundRect, {
    x: x, y: y, w: 5.9, h: 2.3,
    fill: { color: C.white }, rectRadius: 0.3,
    line: { color: C.line, width: 1 },
    shadow: { type: 'outer', blur: 6, offset: 2, color: 'D0D0D0' }
  });

  // 左侧色块
  s3.addShape(pptx.ShapeType.roundRect, {
    x: x + 0.15, y: y + 0.3, w: 0.06, h: 1.0,
    fill: { color: f.color }, rectRadius: 0.03
  });

  // 图标圈
  s3.addShape(pptx.ShapeType.ellipse, {
    x: x + 0.5, y: y + 0.3, w: 0.8, h: 0.8,
    fill: { color: f.bg }
  });
  s3.addText(f.icon, {
    x: x + 0.5, y: y + 0.3, w: 0.8, h: 0.8,
    fontSize: 24, align: 'center', valign: 'middle'
  });

  s3.addText(f.title, {
    x: x + 1.5, y: y + 0.3, w: 4, h: 0.5,
    fontSize: 18, fontFace: 'Microsoft YaHei', color: C.primary, bold: true
  });
  s3.addText(f.desc, {
    x: x + 1.5, y: y + 0.8, w: 4.0, h: 1.0,
    fontSize: 12, fontFace: 'Microsoft YaHei', color: C.gray, lineSpacing: 20
  });
});

// 底部提示
s3.addShape(pptx.ShapeType.roundRect, {
  x: 0.6, y: 6.8, w: 12.0, h: 0.5,
  fill: { color: C.softBg }, rectRadius: 0.1
});
s3.addText('支持多企业多排污口管理，数据实时更新，随时随地掌握排污动态', {
  x: 0.8, y: 6.8, w: 11.5, h: 0.5,
  fontSize: 11, fontFace: 'Microsoft YaHei', color: C.secondary, align: 'center', valign: 'middle'
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

// 4个流程步骤 - 横向流程
const steps = [
  { num: '01', title: '数据采集', desc: '企业通过Excel批量上传\n或接入在线监测设备\n自动采集排污口数据', color: C.primary },
  { num: '02', title: '智能分析', desc: '系统自动计算CDC指数\n多维度评估污染风险\n生成可视化分析报告', color: C.secondary },
  { num: '03', title: '预警通知', desc: '超标数据实时告警\n分级推送预警信息\n快速响应污染事件', color: C.amber },
  { num: '04', title: '监管决策', desc: '管理者查看园区全景\n数据驱动制定措施\n科学化环保监管', color: C.accent },
];

// 横向连接线
s4.addShape(pptx.ShapeType.rect, { x: 1.5, y: 3.0, w: 10.5, h: 0.04, fill: { color: C.line } });

steps.forEach((s, i) => {
  const x = 0.8 + i * 3.1;
  // 圆圈
  s4.addShape(pptx.ShapeType.ellipse, {
    x: x + 0.8, y: 2.3, w: 0.8, h: 0.8,
    fill: { color: s.color }
  });
  s4.addText(s.num, {
    x: x + 0.8, y: 2.3, w: 0.8, h: 0.8,
    fontSize: 16, fontFace: 'Arial', color: C.white, bold: true,
    align: 'center', valign: 'middle'
  });
  // 标题
  s4.addText(s.title, {
    x: x, y: 3.3, w: 2.5, h: 0.5,
    fontSize: 16, fontFace: 'Microsoft YaHei', color: C.primary, bold: true, align: 'center'
  });
  // 描述
  s4.addText(s.desc, {
    x: x, y: 3.8, w: 2.5, h: 1.2,
    fontSize: 11, fontFace: 'Microsoft YaHei', color: C.gray, align: 'center', lineSpacing: 18
  });
  // 箭头（除最后一个）
  if (i < 3) {
    s4.addText('›', {
      x: x + 2.6, y: 2.3, w: 0.5, h: 0.8,
      fontSize: 30, color: C.accent, bold: true, align: 'center', valign: 'middle'
    });
  }
});

// 底部技术架构区域
s4.addShape(pptx.ShapeType.roundRect, {
  x: 0.6, y: 5.2, w: 12.0, h: 2.0,
  fill: { color: C.primary }, rectRadius: 0.3
});

s4.addText('技术架构', {
  x: 1.0, y: 5.3, w: 5, h: 0.5,
  fontSize: 16, fontFace: 'Microsoft YaHei', color: C.white, bold: true
});

const techTags = [
  'Next.js 16', 'React 19', 'TypeScript', 'Tailwind CSS 4',
  'shadcn/ui', 'Supabase Auth', 'PostgreSQL', 'Vercel'
];

techTags.forEach((t, i) => {
  const col = i % 4;
  const row = Math.floor(i / 4);
  const x = 1.0 + col * 2.8;
  const y = 5.9 + row * 0.55;
  s4.addShape(pptx.ShapeType.roundRect, {
    x: x, y: y, w: 2.4, h: 0.4,
    fill: { color: C.secondary }, rectRadius: 0.08
  });
  s4.addText(t, {
    x: x, y: y, w: 2.4, h: 0.4,
    fontSize: 11, fontFace: 'Microsoft YaHei', color: C.light, align: 'center', valign: 'middle'
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