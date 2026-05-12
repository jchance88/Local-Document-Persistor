import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import PDFDocument from 'pdfkit';
import {
  Document,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun
} from 'docx';

const OUTPUT_ROOT = process.env.EXPORT_OUTPUT_ROOT || './generated';

const exportProfiles = {
  pdf: {
    extension: 'pdf',
    contentType: 'application/pdf'
  },
  docx: {
    extension: 'docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  },
  word: {
    extension: 'docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
};

function normalizeFormat(format = 'pdf') {
  const normalized = format.trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (!exportProfiles[normalized]) {
    throw new Error(`Unsupported export format "${format}". Supported formats: pdf, docx.`);
  }
  return normalized === 'word' ? 'docx' : normalized;
}

function slugify(value = 'generated-document') {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

  return slug || 'generated-document';
}

function buildOutputPath({ title, fileName, format }) {
  const profile = exportProfiles[format];
  const baseName = slugify(fileName || title);
  const safeName = baseName.endsWith(`.${profile.extension}`)
    ? baseName
    : `${baseName}.${profile.extension}`;

  return path.resolve(OUTPUT_ROOT, safeName);
}

function parseGeneratedText(text) {
  return text
    .replace(/\r/g, '\n')
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .flatMap((block) => {
      const lines = block.split('\n').map((line) => line.trim()).filter(Boolean);

      if (lines.length > 1 && lines.every((line) => /^[-*]\s+/.test(line))) {
        return lines.map((line) => ({
          type: 'bullet',
          text: line.replace(/^[-*]\s+/, '').trim()
        }));
      }

      const firstLine = lines[0] || '';
      if (lines.length === 1 && firstLine.length <= 90 && !/[.!?]$/.test(firstLine)) {
        return [{
          type: 'heading',
          text: firstLine.replace(/^#+\s*/, '').trim()
        }];
      }

      return [{
        type: 'paragraph',
        text: lines.join(' ')
      }];
    });
}

function writePdf({ title, blocks, outputPath }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'LETTER',
      margins: { top: 54, bottom: 54, left: 60, right: 60 },
      info: { Title: title || 'Generated Document' }
    });
    const stream = fs.createWriteStream(outputPath);

    stream.on('finish', resolve);
    stream.on('error', reject);
    doc.on('error', reject);
    doc.pipe(stream);

    doc.font('Times-Bold').fontSize(16).text(title || 'Generated Document', {
      align: 'center'
    });
    doc.moveDown();

    for (const block of blocks) {
      if (block.type === 'heading') {
        doc.font('Times-Bold').fontSize(12).text(block.text);
        doc.moveDown(0.25);
      } else if (block.type === 'bullet') {
        doc.font('Times-Roman').fontSize(11).text(`• ${block.text}`, {
          indent: 18,
          lineGap: 1.2
        });
        doc.moveDown(0.2);
      } else {
        doc.font('Times-Roman').fontSize(11).text(block.text, {
          align: 'justify',
          lineGap: 1.2
        });
        doc.moveDown(0.55);
      }
    }

    doc.end();
  });
}

async function writeDocx({ title, blocks, outputPath }) {
  const children = [
    new Paragraph({
      text: title || 'Generated Document',
      heading: HeadingLevel.TITLE
    })
  ];

  for (const block of blocks) {
    if (block.type === 'heading') {
      children.push(new Paragraph({
        text: block.text,
        heading: HeadingLevel.HEADING_2
      }));
    } else if (block.type === 'bullet') {
      children.push(new Paragraph({
        children: [new TextRun(block.text)],
        bullet: { level: 0 }
      }));
    } else {
      children.push(new Paragraph({
        children: [new TextRun(block.text)],
        spacing: { after: 180 }
      }));
    }
  }

  const doc = new Document({
    sections: [{ children }]
  });
  const buffer = await Packer.toBuffer(doc);
  await fsp.writeFile(outputPath, buffer);
}

export async function exportGeneratedDocument({ title, text, format, fileName }) {
  const normalizedFormat = normalizeFormat(format);
  const outputPath = buildOutputPath({ title, fileName, format: normalizedFormat });
  const blocks = parseGeneratedText(text || '');

  if (!blocks.length) {
    throw new Error('Text is required to export a generated document.');
  }

  await fsp.mkdir(path.dirname(outputPath), { recursive: true });

  if (normalizedFormat === 'pdf') {
    await writePdf({ title, blocks, outputPath });
  } else {
    await writeDocx({ title, blocks, outputPath });
  }

  const stats = await fsp.stat(outputPath);
  const profile = exportProfiles[normalizedFormat];

  return {
    format: normalizedFormat,
    fileName: path.basename(outputPath),
    filePath: outputPath,
    contentType: profile.contentType,
    sizeBytes: stats.size
  };
}
