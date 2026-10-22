import PDFDocument from 'pdfkit';
import type { Block, Segment } from '../types/domain.js';

const INK = '#111111';
const MUT = '#6B6B6B';
const text = (segments: Segment[]) => segments.map((s) => s.text).join('');

/** Renders document blocks to an A4 PDF. Underlines are a review aid only, so they are not printed. */
export function renderPdf(blocks: Block[], title: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 64, bottom: 64, left: 64, right: 64 }, info: { Title: title } });
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const width = doc.page.width - 128;
    for (const b of blocks) {
      switch (b.type) {
        case 'heading':
          doc.font('Helvetica-Bold').fontSize(18).fillColor(INK).text(text(b.segments), { width });
          doc.moveDown(0.2);
          break;
        case 'meta':
          doc.font('Helvetica').fontSize(10).fillColor(MUT).text(text(b.segments), { width });
          doc.moveDown(0.6);
          break;
        case 'section':
          doc.moveDown(0.6);
          doc.font('Helvetica-Bold').fontSize(9).fillColor(MUT).text(text(b.segments).toUpperCase(), { width, characterSpacing: 0.5 });
          doc.moveDown(0.3);
          break;
        case 'entry':
          doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(text(b.segments), { width, continued: Boolean(b.aside) });
          if (b.aside) doc.font('Helvetica').fillColor(MUT).text(`   ${b.aside}`);
          doc.moveDown(0.2);
          break;
        case 'bullets':
          for (const item of b.items) {
            doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(`•  ${text(item)}`, { width, indent: 0, lineGap: 2 });
          }
          doc.moveDown(0.5);
          break;
        case 'paragraph':
          doc.font('Helvetica').fontSize(10.5).fillColor(INK).text(text(b.segments), { width, lineGap: 3 });
          doc.moveDown(0.7);
          break;
      }
    }
    doc.end();
  });
}
