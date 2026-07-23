import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 四川美术学院（sfai）数据 - 排污口: sfai-1, sfai-2
const sfaiData = [
  // sfai-1 排污口 - 7月23日数据
  { '排污口': 'sfai-1', '时间': '2026-07-23 04:00', 'COD': 185.3, 'NH3-N': 4.2, 'TP': 0.38, 'TN': 0.72 },
  { '排污口': 'sfai-1', '时间': '2026-07-23 10:00', 'COD': 220.5, 'NH3-N': 5.8, 'TP': 0.45, 'TN': 0.85 },
  { '排污口': 'sfai-1', '时间': '2026-07-23 16:00', 'COD': 195.2, 'NH3-N': 4.5, 'TP': 0.42, 'TN': 0.78 },
  // sfai-2 排污口 - 7月23日数据
  { '排污口': 'sfai-2', '时间': '2026-07-23 04:00', 'COD': 165.8, 'NH3-N': 3.8, 'TP': 0.35, 'TN': 0.68 },
  { '排污口': 'sfai-2', '时间': '2026-07-23 10:00', 'COD': 210.4, 'NH3-N': 5.2, 'TP': 0.48, 'TN': 0.82 },
  { '排污口': 'sfai-2', '时间': '2026-07-23 16:00', 'COD': 178.6, 'NH3-N': 4.1, 'TP': 0.39, 'TN': 0.71 },
];

// 重庆医科大学（cqmu）数据 - 排污口: cqmu1
const cqmuData = [
  { '排污口': 'cqmu1', '时间': '2026-07-23 04:00', 'COD': 125.5, 'NH3-N': 8.2, 'TP': 0.42, 'TN': 0.65 },
  { '排污口': 'cqmu1', '时间': '2026-07-23 10:00', 'COD': 158.3, 'NH3-N': 12.5, 'TP': 0.55, 'TN': 0.78 },
  { '排污口': 'cqmu1', '时间': '2026-07-23 16:00', 'COD': 142.8, 'NH3-N': 10.3, 'TP': 0.48, 'TN': 0.72 },
];

// 生成四川美术学院Excel
const sfaiWs = XLSX.utils.json_to_sheet(sfaiData);
const sfaiWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(sfaiWb, sfaiWs, '监测数据');
const sfaiPath = path.join(__dirname, '..', 'public', 'sfai-monitoring-data.xlsx');
XLSX.writeFile(sfaiWb, sfaiPath);
console.log('四川美术学院Excel已生成:', sfaiPath);

// 生成重庆医科大学Excel
const cqmuWs = XLSX.utils.json_to_sheet(cqmuData);
const cqmuWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(cqmuWb, cqmuWs, '监测数据');
const cqmuPath = path.join(__dirname, '..', 'public', 'cqmu-monitoring-data.xlsx');
XLSX.writeFile(cqmuWb, cqmuPath);
console.log('重庆医科大学Excel已生成:', cqmuPath);
