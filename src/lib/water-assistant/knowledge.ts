/** Curated, public excerpts only. Keep the user's complete manual outside the deployed bundle. */
export type KnowledgeSource = {
  id: string;
  title: string;
  section: string;
  version: string;
  excerpt: string;
  url?: string;
};

type Entry = KnowledgeSource & { keywords: string[] };

export const knowledge: Entry[] = [
  {
    id: 'manual-upload', title: '工业园区地下水污染风险监测平台操作说明书', section: '5.3 排污点监测 / Excel 上传', version: '用户稿 2026-08（按现有功能核对）',
    excerpt: '企业在排污点监测页选择已审批排污口，按模板上传包含排污口、监测时间和污染物列的 Excel。系统先核对排污口、污染物、单位和数值，再按管理员审批的阈值提示异常；小水滴的 Excel 录入先预检，用户确认后才保存。',
    keywords: ['上传', '导入', '录入', 'excel', '表格', '模板', '审批', '排污口'],
  },
  {
    id: 'manual-cdc', title: '工业园区地下水污染风险监测平台操作说明书', section: '5.4 / 6 CDC 分析', version: '用户稿 2026-08（结合现有代码修订）',
    excerpt: 'CDC 是平台自定义的风险分析指标，不是国家标准水质类别。AV 是均值，AD 是平均绝对离差，CV 是变异系数，SKEW 是偏度；系统以七个自然日为窗口，按指标及企业比较并形成 CDC 风险提示。当前系统分级：CDC 小于 0.5 为低风险，0.5 至小于 1.5 为中风险，1.5 及以上为高风险。要查看实际 CDC 数值，请进入 CDC 分析或管理员监测页；小水滴当前的数据工具只计算监测记录统计和日均值，不计算 CDC。',
    keywords: ['cdc', 'av', 'ad', 'cv', 'skew', '算法', '风险', '七天', '7天', '波动', '偏度'],
  },
  {
    id: 'thresholds', title: '平台监测数据分析口径', section: '超阈值与日均值', version: '当前系统实现 2026-10',
    excerpt: '小水滴按企业、排污口、污染物及单位分别统计记录数、最小值、最大值、算术平均值与北京时间逐日平均值。逐条记录的数值大于记录保存的审批上限时计为“超阈值”；缺上限的记录不能判定。日均值只是趋势展示，不能替代单条记录的阈值判定；无记录不代表正常。审批阈值不自动等于国家或地方排放限值。当前数据结构只有上限，不适合自动判断 pH 等需要上下限的指标。',
    keywords: ['阈值', '超标', '超阈值', '异常', '日均值', '平均', '趋势', 'ph', '缺失', '无记录'],
  },
  {
    id: 'groundwater-quality', title: 'GB/T 14848-2017 地下水质量标准', section: '标准题录与适用边界', version: '2017-10 发布 / 2018-05 实施（官方题录显示现行）',
    url: 'https://openstd.samr.gov.cn/bzgk/std/newGbInfo?hcno=F745E3023BD5B10B9FB5314E0FFB5523',
    excerpt: 'GB/T 14848-2017 是地下水质量评价的推荐性国家标准。应用其分类指标前，先确认样品确为地下水、监测指标名称与测定方法相符，再确定评价类别。不能直接用此标准去认定企业排污口废水浓度超标；平台当前没有完整的采样介质、标准类别和测定方法字段，因此不自动套用国标数值。',
    keywords: ['地下水', '国标', '国家标准', '水质标准', '14848', '分类', '水质类别'],
  },
  {
    id: 'groundwater-monitoring', title: 'HJ 164-2020 地下水环境监测技术规范', section: '适用内容', version: '2021-03 实施',
    url: 'https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/jcffbz/202012/t20201203_811333.shtml',
    excerpt: 'HJ 164-2020 规定地下水监测点布设、监测井建设与管理、样品采集与保存、监测项目与分析方法、数据处理、质量保证和质量控制及资料整编。异常值核查时应先检查点位、采样和质控信息；仅靠平台数值无法确认污染来源。',
    keywords: ['地下水', '监测', '采样', '质控', '监测井', '164', '异常数据', '核查'],
  },
  {
    id: 'wastewater-discharge', title: 'GB 8978-1996 污水综合排放标准', section: '适用范围', version: '1998-01 实施',
    url: 'https://www.mee.gov.cn/ywgz/fgbz/bz/bzwb/shjbh/swrwpfbz/199801/t19980101_66568.htm',
    excerpt: 'GB 8978-1996 按污水排放去向及建设年限设置排放控制要求，属于污水排放管理标准。是否适用于某企业须核查排口性质、行业专门标准、排放去向、排污许可证及地方要求；不能从平台上的“排污口”名称直接推定适用 GB 8978，也不能把地下水质量标准当作排放限值。',
    keywords: ['污水', '排放', '国标', '国家标准', '8978', '排污口', '许可证', '行业'],
  },
];

export const knowledgeArgs = (value: unknown): value is { query: string } =>
  !!value && typeof value === 'object' && 'query' in value && typeof value.query === 'string' && value.query.trim().length > 0 && value.query.length <= 120;

export function searchKnowledge(query: string, limit = 4): KnowledgeSource[] {
  const input = query.toLowerCase().replace(/\s+/g, '');
  const tokens = input.match(/[a-z0-9/-]+|[\u3400-\u9fff]{2,}/g) ?? [];
  const ranked = knowledge.map(entry => {
    const score = entry.keywords.reduce((sum, keyword) => {
      const term = keyword.toLowerCase();
      return sum + (input.includes(term) ? (/^\d{3,}$/.test(term) ? 12 : term.length > 2 ? 3 : 1) : 0);
    }, 0) + (input.includes(entry.id) ? 4 : 0) + tokens.reduce((sum, word) => sum + (word.length > 2 && entry.title.toLowerCase().includes(word) ? 2 : 0), 0);
    return { entry, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score);
  return ranked.filter(item => ranked[0].score < 10 || item.score >= 10)
    .slice(0, Math.max(1, Math.min(limit, 5))).map(({ entry }) => {
    const { keywords: _keywords, ...source } = entry;
    void _keywords;
    return source;
  });
}
