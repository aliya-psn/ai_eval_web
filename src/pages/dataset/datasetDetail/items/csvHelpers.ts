/** 轻量 CSV 解析（对齐 Langfuse 客户端解析行为：trim / BOM / 引号） */

export type CsvJsonValue = string | number | boolean | null | CsvJsonObject | CsvJsonValue[];
export type CsvJsonObject = { [key: string]: CsvJsonValue };

export interface CsvPreviewResult {
  fileName: string;
  columns: string[];
  /** 预览行（不含表头），最多 10 行 */
  previewRows: string[][];
  /** 全部数据行（不含表头） */
  rows: string[][];
}

const MAX_PREVIEW_ROWS = 10;
const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

export { MAX_FILE_SIZE_BYTES };

/** 解析整份 CSV 文本为二维数组（含表头） */
export function parseCsvText(text: string): string[][] {
  const source = text.replace(/^\uFEFF/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ',') {
      row.push(field.trim());
      field = '';
      continue;
    }
    if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(field.trim());
      field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
      continue;
    }
    field += ch;
  }

  row.push(field.trim());
  if (row.some((cell) => cell !== '')) rows.push(row);

  return rows;
}

export async function parseCsvFile(file: File): Promise<CsvPreviewResult> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('FILE_TOO_LARGE');
  }

  const text = await file.text();
  const matrix = parseCsvText(text);
  if (matrix.length === 0) {
    throw new Error('CSV_EMPTY');
  }

  const columns = matrix[0].map((c) => c.trim());
  if (columns.length === 0 || columns.every((c) => !c)) {
    throw new Error('CSV_NO_COLUMNS');
  }

  const dataRows = matrix.slice(1).map((row) => {
    const padded = [...row];
    while (padded.length < columns.length) padded.push('');
    return padded.slice(0, columns.length).map((c) => c.trim());
  });

  return {
    fileName: file.name,
    columns,
    previewRows: dataRows.slice(0, MAX_PREVIEW_ROWS),
    rows: dataRows,
  };
}

/** 推断单元格值类型（null / bool / number / JSON / string） */
export function parseCsvValue(value: string): CsvJsonValue {
  if (value === '' || value.toLowerCase() === 'null') return null;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  if (
    (value.startsWith('{') && value.endsWith('}')) ||
    (value.startsWith('[') && value.endsWith(']')) ||
    (value.startsWith('"') && value.endsWith('"'))
  ) {
    try {
      return JSON.parse(value) as CsvJsonValue;
    } catch {
      // fall through
    }
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric) && Math.abs(numeric) <= Number.MAX_SAFE_INTEGER) {
    return numeric;
  }

  return value;
}

/** 多列合并为对象；单列可选是否包装为 { col: value } */
export function buildFieldFromColumns(
  columnNames: string[],
  row: string[],
  headerMap: Map<string, number>,
  wrapSingleColumn: boolean,
): CsvJsonValue | undefined {
  if (columnNames.length === 0) return undefined;

  if (columnNames.length === 1) {
    const col = columnNames[0];
    const idx = headerMap.get(col);
    const parsed = parseCsvValue(idx == null ? '' : row[idx] ?? '');
    if (wrapSingleColumn) return { [col]: parsed };
    return parsed;
  }

  const obj: CsvJsonObject = {};
  columnNames.forEach((col) => {
    const idx = headerMap.get(col);
    const raw = idx == null ? '' : row[idx] ?? '';
    // 空单元格不写入字段，避免可选 string 被写成 null 导致 schema 校验失败
    if (raw === '') return;
    obj[col] = parseCsvValue(raw);
  });
  return obj;
}

const COLUMN_ALIASES: Record<'input' | 'expectedOutput' | 'metadata', string[]> = {
  input: ['input', 'prompt', 'question', 'query', 'instruction'],
  expectedOutput: [
    'expected',
    'expectedoutput',
    'expected_output',
    'output',
    'answer',
    'response',
    'completion',
    'target',
    'result',
  ],
  metadata: ['metadata', 'meta', 'tags', 'info', 'additional'],
};

/** 按列名猜测默认映射（对齐 Langfuse findDefaultColumn） */
export function guessDefaultColumns(
  columns: string[],
): { input: string[]; expectedOutput: string[]; metadata: string[] } {
  const used = new Set<string>();

  const pick = (aliases: string[]): string[] => {
    const exact = columns.find(
      (c) => !used.has(c) && aliases.some((a) => a === c.toLowerCase()),
    );
    if (exact) {
      used.add(exact);
      return [exact];
    }
    return [];
  };

  return {
    input: pick(COLUMN_ALIASES.input),
    expectedOutput: pick(COLUMN_ALIASES.expectedOutput),
    metadata: pick(COLUMN_ALIASES.metadata),
  };
}
