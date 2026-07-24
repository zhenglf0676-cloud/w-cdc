import XLSX from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// sfai（四川美术学院）的排污口和污染物
const outlets = ['sfai-1', 'sfai-2'];
const pollutants = {
  'cod': { min: 80, max: 450, standard: 500 },
  'nh3n': { min: 1, max: 8, standard: 10 },
  'tp': { min: 0.1, max: 0.8, standard: 1 },
  'tn': { min: 0.2, max: 0.9, standard: 1 }
};

// 生成7月24日的数据
const data = [];
const date = '2026-07-24';
const times = ['04:00', '08:00', '12:00', '16:00', '20:00'];

for (const outlet of outlets) {
  for (const time of times) {
    const row = {
      '排污口': outlet,
      '时间': `${date} ${time}`,
      'COD': (Math.random() * (pollutants.cod.max - pollutants.cod.min) + pollutants.cod.min).toFixed(1),
      'NH3-N': (Math.random() * (pollutants.nh3n.max - pollutants.nh3n.min) + pollutants.nh3n.min).toFixed(2),
      'TP': (Math.random() * (pollutants.tp.max - pollutants.tp.min) + pollutants.tp.min).toFixed(3),
      'TN': (Math.random() * (pollutants.tn.max - pollutants.tn.min) + pollutants.tn.min).toFixed(3)
    };
    data.push(row);
  }
}

// 创建工作簿和工作表
const wb = XLSX.utils.book_new();
const ws = XLSX.utils.json_to_sheet(data);

// 设置列宽
ws['!cols'] = [
  { wch: 12 }, // 排污口
  { wch: 20 }, // 时间
  { wch: 10 }, // COD
  { wch: 10 }, // NH3-N
  { wch: 10 }, // TP
  { wch: 10 }  // TN
];

XLSX.utils.book_append_sheet(wb, ws, '监测数据');

// 保存文件
const outputPath = path.join(__dirname, '../public/sfai-0724-data.xlsx');
XLSX.writeFile(wb, outputPath);

console.log(`Excel文件已生成: ${outputPath}`);
console.log(`共 ${data.length} 条记录`);
console.log(`排污口: ${outlets.join(', ')}`);
console.log(`日期: ${date}`);
console.log(`时间: ${times.join(', ')}`);
