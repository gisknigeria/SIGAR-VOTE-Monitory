import { inflateRawSync } from 'node:zlib';

/**
 * Minimal, dependency-free .xlsx reader: enough to read cell values from worksheets. An .xlsx is
 * a zip of XML files; this reads the zip's central directory, inflates only the entries asked
 * for, and resolves shared strings. It deliberately does not evaluate formulas -- it returns the
 * value Excel cached for them, which is what the workbook showed when it was saved.
 *
 * Written in-house because the popular npm spreadsheet package carries unpatched advisories and
 * we only ever need to read values, never styles or charts.
 */

const MAX_ENTRY_BYTES = 256 * 1024 * 1024;

function readZipEntries(buffer) {
  // The end-of-central-directory record sits in the last 64KB + 22 bytes of the file.
  const floor = Math.max(0, buffer.length - 65_557);
  let eocd = -1;
  for (let i = buffer.length - 22; i >= floor; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('This file is not a valid .xlsx workbook (no zip directory found).');

  const count = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);
  const entries = new Map();
  for (let n = 0; n < count; n += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) throw new Error('The workbook zip directory is damaged.');
    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const size = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localOffset = buffer.readUInt32LE(offset + 42);
    const name = buffer.toString('utf8', offset + 46, offset + 46 + nameLength);
    entries.set(name, { method, compressedSize, size, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }

  return (name) => {
    const entry = entries.get(name);
    if (!entry) return null;
    if (entry.size > MAX_ENTRY_BYTES) throw new Error(`Workbook part ${name} is too large to read.`);
    const local = entry.localOffset;
    if (buffer.readUInt32LE(local) !== 0x04034b50) throw new Error('The workbook zip entry is damaged.');
    const start = local + 30 + buffer.readUInt16LE(local + 26) + buffer.readUInt16LE(local + 28);
    const raw = buffer.subarray(start, start + entry.compressedSize);
    if (entry.method === 0) return raw.toString('utf8');
    if (entry.method === 8) return inflateRawSync(raw).toString('utf8');
    throw new Error(`Workbook part ${name} uses an unsupported compression method.`);
  };
}

const unescapeXml = (value) =>
  value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&amp;/g, '&');

const textOf = (xml) => unescapeXml([...xml.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)].map((match) => match[1]).join(''));

const columnIndex = (reference) => {
  let index = 0;
  for (const char of reference.replace(/\d+/g, '')) index = index * 26 + (char.charCodeAt(0) - 64);
  return index - 1;
};

/** Opens a workbook buffer. Returns the sheet names and a reader that yields rows as string arrays. */
export function openWorkbook(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('No workbook file was received.');
  if (buffer.length < 22) throw new Error('This file is not a valid .xlsx workbook.');
  const part = readZipEntries(buffer);
  const workbookXml = part('xl/workbook.xml');
  if (!workbookXml) throw new Error('This file is not an Excel workbook (xl/workbook.xml is missing).');

  const relsXml = part('xl/_rels/workbook.xml.rels') || '';
  const targets = new Map();
  for (const match of relsXml.matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = match[1].match(/\bId="([^"]+)"/)?.[1];
    const target = match[1].match(/\bTarget="([^"]+)"/)?.[1];
    if (id && target) targets.set(id, target.replace(/^\/?xl\//, '').replace(/^\//, ''));
  }
  const sheets = [...workbookXml.matchAll(/<sheet\b([^>]*)\/?>/g)].map((match) => ({
    name: unescapeXml(match[1].match(/\bname="([^"]*)"/)?.[1] || ''),
    path: `xl/${targets.get(match[1].match(/\br:id="([^"]+)"/)?.[1]) || ''}`,
  }));

  let sharedStrings = null;
  const shared = () => {
    if (!sharedStrings) {
      const xml = part('xl/sharedStrings.xml') || '';
      sharedStrings = [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((match) => textOf(match[1]));
    }
    return sharedStrings;
  };

  return {
    sheetNames: sheets.map((sheet) => sheet.name),
    /** Every row of the named sheet as an array of strings ('' for empty cells). */
    rows(name) {
      const sheet = sheets.find((item) => item.name === name);
      if (!sheet) return null;
      const xml = part(sheet.path);
      if (xml === null) return null;
      const strings = shared();
      const rows = [];
      for (const rowMatch of xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)) {
        const row = [];
        for (const cell of rowMatch[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
          const attributes = cell[1];
          const reference = attributes.match(/\br="([A-Z]+\d+)"/)?.[1];
          const inner = cell[2] || '';
          const type = attributes.match(/\bt="([^"]+)"/)?.[1];
          const rawValue = inner.match(/<v>([\s\S]*?)<\/v>/)?.[1];
          let value = '';
          if (type === 's') value = strings[Number(rawValue)] ?? '';
          else if (type === 'inlineStr') value = textOf(inner);
          else if (rawValue !== undefined) value = unescapeXml(rawValue);
          row[reference ? columnIndex(reference) : row.length] = value;
        }
        rows.push(Array.from(row, (value) => (value === undefined ? '' : String(value))));
      }
      return rows;
    },
  };
}
