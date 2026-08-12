import fs from 'fs';
import { Document, Packer, Paragraph, TextRun, Header, PageNumber, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType } from 'docx';

const files = [
  'src/app/page.tsx',
  'src/app/layout.tsx',
  'src/app/login/page.tsx',
  'src/app/register/page.tsx',
  'src/app/admin/page.tsx',
  'src/app/admin/monitoring/page.tsx',
  'src/app/enterprise/page.tsx',
  'src/app/enterprise/monitoring/page.tsx',
  'src/app/enterprise/cdc/page.tsx',
  'src/middleware.ts',
  'src/lib/auth-context.tsx',
  'src/lib/supabase-browser.ts',
  'src/storage/database/supabase-client.ts',
  'src/app/api/supabase-config/route.ts',
  'src/app/api/admin/park-enterprises/route.ts',
  'src/app/api/admin/monitoring/enterprise-data/route.ts',
  'src/app/api/admin/monitoring/warnings/route.ts',
  'src/app/api/discharge-outlets/approved/route.ts',
  'src/app/api/enterprise/cdc/analysis/route.ts',
  'src/app/api/enterprise/monitoring/upload-excel/route.ts',
];

const sections = [];

for (const filePath of files) {
  const fullPath = `/workspace/projects/${filePath}`;
  if (!fs.existsSync(fullPath)) {
    console.log(`文件不存在: ${filePath}`);
    continue;
  }
  
  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  
  // 文件标题
  const fileTitle = new Paragraph({
    spacing: { before: 400, after: 200 },
    alignment: AlignmentType.CENTER,
    children: [
      new TextRun({
        text: `文件：${filePath}`,
        bold: true,
        size: 22,
        font: 'SimSun',
      }),
    ],
  });
  
  const titleParagraphs = [fileTitle];
  
  // 代码行
  const codeParagraphs = lines.map((line, index) => {
    const lineNum = (index + 1).toString().padStart(4, ' ');
    return new Paragraph({
      spacing: { before: 0, after: 0, line: 240 },
      indent: { left: 0 },
      children: [
        new TextRun({
          text: `${lineNum}  ${line}`,
          size: 16,
          font: 'Courier New',
        }),
      ],
    });
  });
  
  sections.push({
    properties: {},
    children: [...titleParagraphs, ...codeParagraphs],
  });
}

const doc = new Document({
  title: '基于CDC模型的工业园区地下水监测系统 源代码',
  description: '软件著作权申请用源代码',
  styles: {
    default: {
      document: {
        run: {
          font: 'Courier New',
          size: 16,
        },
      },
    },
  },
  sections: sections.map(s => ({
    ...s,
    properties: {
      ...s.properties,
      page: {
        margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
      },
    },
  })),
});

const buffer = await Packer.toBuffer(doc);
const outPath = '/workspace/projects/public/源代码-基于CDC模型的工业园区地下水监测系统.docx';
fs.writeFileSync(outPath, buffer);
console.log(`文档已生成: ${outPath}`);
console.log(`文件大小: ${(buffer.length / 1024).toFixed(1)} KB`);