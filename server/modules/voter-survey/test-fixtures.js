import { deflateRawSync } from 'node:zlib';

// Builds a real .xlsx (zip of XML) in memory so the reader is tested against the actual format
// rather than a mock of it. Strings go through sharedStrings, as Excel writes them.

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buffer) => {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

function zip(files) {
  const locals = [];
  const centrals = [];
  let offset = 0;
  for (const [name, text] of Object.entries(files)) {
    const data = Buffer.from(text, 'utf8');
    const compressed = deflateRawSync(data);
    const nameBytes = Buffer.from(name, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(data), 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(nameBytes.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(data), 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(nameBytes.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, nameBytes, compressed);
    centrals.push(central, nameBytes);
    offset += local.length + nameBytes.length + compressed.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(Object.keys(files).length, 8); end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

const escape = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const column = (index) => { let name = ''; let n = index + 1; while (n) { const r = (n - 1) % 26; name = String.fromCharCode(65 + r) + name; n = Math.floor((n - 1) / 26); } return name; };

/** sheets: { "Sheet name": [[cell, cell], ...] } -> .xlsx Buffer. Numbers stay numeric cells. */
export function buildXlsx(sheets) {
  const strings = [];
  const stringIndex = new Map();
  const ref = (value) => {
    if (!stringIndex.has(value)) { stringIndex.set(value, strings.length); strings.push(value); }
    return stringIndex.get(value);
  };
  const names = Object.keys(sheets);
  const files = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${names.map((name, i) => `<sheet name="${escape(name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships>${names.map((_, i) => `<Relationship Id="rId${i + 1}" Type="worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  };
  names.forEach((name, i) => {
    const rows = sheets[name].map((row, r) => `<row r="${r + 1}">${row.map((cell, c) => {
      if (cell === '' || cell === null || cell === undefined) return '';
      const at = `${column(c)}${r + 1}`;
      return typeof cell === 'number' ? `<c r="${at}"><v>${cell}</v></c>` : `<c r="${at}" t="s"><v>${ref(String(cell))}</v></c>`;
    }).join('')}</row>`).join('');
    files[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0"?><worksheet><sheetData>${rows}</sheetData></worksheet>`;
  });
  files['xl/sharedStrings.xml'] = `<?xml version="1.0"?><sst>${strings.map((value) => `<si><t xml:space="preserve">${escape(value)}</t></si>`).join('')}</sst>`;
  return zip(files);
}

export const SURVEY_HEADER = [
  'Submission ID', 'Respondent', 'Top Priority Issue', 'Most Influential Platform', 'Likely Vote Candidate', 'Overall Impression Of Candidate',
  'Will Candidate Make A Good Governor', 'If No Why', 'Preferred Alternative Candidate', 'Voting LGA', 'Vote Response Quality', 'Agent Name',
];

/** One survey row in SURVEY_HEADER order. */
export const surveyRow = ({ id = 1, respondent = 'Youth member', issue = 'Job creation', platform = 'Radio', vote = '', impression = '', governor = '', whyNo = '', second = '', lga = 'Atiba', agent = 'Adeola Bankole' } = {}) =>
  [id, respondent, issue, platform, vote, impression, governor, whyNo, second, lga, vote ? 'Named candidate' : 'Blank', agent];

export const ALLI = 'Sen Sharafadeen Abiodun Alli';
export const HAMZAT = 'Oriyomi Hamzat';
