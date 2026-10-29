import mammoth from 'mammoth';

export type DocumentSection = { section: string; text: string };
export type KnowledgeChunk = { ordinal: number; section: string; content: string };

export async function extractKnowledgeFile(file: File): Promise<DocumentSection[]> {
  if (file.size < 1 || file.size > 4 * 1024 * 1024) throw new Error('资料文件需在 4MB 以内');
  const name = file.name.toLowerCase();
  const bytes = Buffer.from(await file.arrayBuffer());
  let sections: DocumentSection[];
  if (name.endsWith('.pdf')) {
    if (bytes.subarray(0, 4).toString('ascii') !== '%PDF') throw new Error('PDF 文件格式不正确');
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: bytes });
    try {
      const result = await parser.getText({ last: 60 });
      sections = result.pages.map(page => ({ section: `第 ${page.num} 页`, text: page.text }));
      if (result.total > 60) throw new Error('PDF 最多支持 60 页，请拆分后上传');
    } finally { await parser.destroy(); }
  } else if (name.endsWith('.docx')) {
    if (bytes.subarray(0, 2).toString('ascii') !== 'PK') throw new Error('Word 文件格式不正确');
    const result = await mammoth.extractRawText({ buffer: bytes });
    sections = result.value.split(/\n\s*\n/).map((text, i) => ({ section: `第 ${i + 1} 段`, text }));
  } else if (/\.(txt|md)$/.test(name)) {
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    sections = text.split(/\n\s*\n/).map((part, i) => ({ section: `第 ${i + 1} 段`, text: part }));
  } else throw new Error('请选择 PDF、DOCX、TXT 或 MD 文件');

  sections = sections.map(part => ({ ...part, text: part.text.replace(/\s+/g, ' ').trim() })).filter(part => part.text);
  const length = sections.reduce((sum, part) => sum + part.text.length, 0);
  if (length < 30) throw new Error('没有提取到足够的可检索文字；扫描件可在后续图片识别功能上线后处理');
  if (length > 50000) throw new Error('资料正文超过 5 万字，请拆分后上传');
  return sections;
}

export function chunkKnowledge(sections: DocumentSection[]): KnowledgeChunk[] {
  const chunks: KnowledgeChunk[] = [];
  let content = '';
  let section = '';
  const flush = () => {
    if (content.trim()) chunks.push({ ordinal: chunks.length, section, content: content.trim() });
    content = '';
  };
  for (const part of sections) {
    for (let i = 0; i < part.text.length; i += 850) {
      const segment = part.text.slice(i, i + 850);
      if (section !== part.section || content.length + segment.length > 1000) flush();
      section = part.section;
      content += `${content ? ' ' : ''}${segment}`;
    }
  }
  flush();
  if (!chunks.length || chunks.length > 65) throw new Error('资料片段过多，请拆分文件后上传');
  return chunks;
}
