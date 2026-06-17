import { inflateRawSync } from "node:zlib";

export type CsvRow = Record<string, string>;

export function parseCsv(input: string): CsvRow[] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  const text = input.replace(/^\uFEFF/, "");

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field.trim());
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field.trim());
      field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  row.push(field.trim());
  if (row.some((value) => value !== "")) rows.push(row);

  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) =>
    headers.reduce<CsvRow>((acc, header, index) => {
      acc[header] = values[index]?.trim() ?? "";
      return acc;
    }, {})
  );
}

function decodeXml(value: string) {
  return value
    .replaceAll("&apos;", "'")
    .replaceAll("&quot;", '"')
    .replaceAll("&gt;", ">")
    .replaceAll("&lt;", "<")
    .replaceAll("&amp;", "&");
}

function rowsToObjects(rows: string[][]) {
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((values) =>
    headers.reduce<CsvRow>((acc, header, index) => {
      acc[header] = values[index]?.trim() ?? "";
      return acc;
    }, {})
  );
}

function columnIndex(cellRef: string) {
  const letters = cellRef.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "";
  return letters.split("").reduce((acc, char) => acc * 26 + char.charCodeAt(0) - 64, 0) - 1;
}

function unzipXlsx(buffer: Buffer) {
  const files = new Map<string, string>();
  let eocd = -1;

  for (let i = buffer.length - 22; i >= 0; i -= 1) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }

  if (eocd < 0) return files;

  const entries = buffer.readUInt16LE(eocd + 10);
  let offset = buffer.readUInt32LE(eocd + 16);

  for (let i = 0; i < entries; i += 1) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) break;

    const method = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const fileName = buffer
      .subarray(offset + 46, offset + 46 + fileNameLength)
      .toString("utf8");

    const localNameLength = buffer.readUInt16LE(localHeaderOffset + 26);
    const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
    const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
    const compressed = buffer.subarray(dataStart, dataStart + compressedSize);

    let content: Buffer | null = null;
    if (method === 0) content = compressed;
    if (method === 8) content = inflateRawSync(compressed);
    if (content) files.set(fileName, content.toString("utf8"));

    offset += 46 + fileNameLength + extraLength + commentLength;
  }

  return files;
}

function parseSharedStrings(xml: string | undefined) {
  if (!xml) return [];
  const strings: string[] = [];
  const pattern = /<si\b[^>]*>([\s\S]*?)<\/si>/gi;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    const parts = Array.from(match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi));
    strings.push(decodeXml(parts.map((part) => part[1]).join("")));
  }

  return strings;
}

function parseXlsxSheet(xml: string, sharedStrings: string[]) {
  const rows: string[][] = [];
  const rowPattern = /<row\b[^>]*>([\s\S]*?)<\/row>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(xml)) !== null) {
    const row: string[] = [];
    const cellPattern = /<c\b([^>]*)>([\s\S]*?)<\/c>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      const attrs = cellMatch[1];
      const body = cellMatch[2];
      const ref = attrs.match(/\br="([^"]+)"/i)?.[1] ?? "";
      const type = attrs.match(/\bt="([^"]+)"/i)?.[1] ?? "";
      const targetIndex = ref ? columnIndex(ref) : row.length;
      while (row.length < targetIndex) row.push("");

      const value = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1] ?? "";
      const inline = body.match(/<t\b[^>]*>([\s\S]*?)<\/t>/i)?.[1] ?? "";
      const text = type === "s"
        ? sharedStrings[Number(value)] ?? ""
        : inline || value;
      row.push(decodeXml(text).trim());
    }

    if (row.some((value) => value !== "")) rows.push(row);
  }

  return rowsToObjects(rows);
}

export function parseXlsx(buffer: Buffer, sheetName: string): CsvRow[] {
  const files = unzipXlsx(buffer);
  const workbook = files.get("xl/workbook.xml");
  if (!workbook) return [];

  const rels = files.get("xl/_rels/workbook.xml.rels") ?? "";
  const relationships = new Map<string, string>();
  for (const match of rels.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/gi)) {
    const target = match[2].startsWith("/") ? match[2].slice(1) : `xl/${match[2]}`;
    relationships.set(match[1], target.replaceAll("\\", "/"));
  }

  let sheetPath = "";
  for (const match of workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"/gi)) {
    if (decodeXml(match[1]) === sheetName) {
      sheetPath = relationships.get(match[2]) ?? "";
      break;
    }
  }

  if (!sheetPath) {
    const firstSheet = workbook.match(/<sheet\b[^>]*r:id="([^"]+)"/i)?.[1];
    sheetPath = firstSheet ? relationships.get(firstSheet) ?? "" : "";
  }

  const sheetXml = files.get(sheetPath);
  if (!sheetXml) return [];

  return parseXlsxSheet(sheetXml, parseSharedStrings(files.get("xl/sharedStrings.xml")));
}

export function parseExcelXml(input: string, sheetName: string): CsvRow[] {
  const text = input.replace(/^\uFEFF/, "");
  const worksheetPattern = new RegExp(
    `<Worksheet\\b[^>]*(?:ss:)?Name="${sheetName}"[^>]*>([\\s\\S]*?)</Worksheet>`,
    "i"
  );
  const worksheetMatch = text.match(worksheetPattern);
  if (!worksheetMatch) return [];

  const rows: string[][] = [];
  const rowPattern = /<Row\b[^>]*>([\s\S]*?)<\/Row>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowPattern.exec(worksheetMatch[1])) !== null) {
    const values: string[] = [];
    const cellPattern = /<Cell\b([^>]*)>([\s\S]*?)<\/Cell>/gi;
    let cellMatch: RegExpExecArray | null;

    while ((cellMatch = cellPattern.exec(rowMatch[1])) !== null) {
      const indexMatch = cellMatch[1].match(/ss:Index="(\d+)"/i);
      if (indexMatch) {
        const targetIndex = Number(indexMatch[1]) - 1;
        while (values.length < targetIndex) values.push("");
      }

      const dataMatch = cellMatch[2].match(/<Data\b[^>]*>([\s\S]*?)<\/Data>/i);
      values.push(decodeXml(dataMatch?.[1] ?? "").trim());
    }

    if (values.some((value) => value !== "")) rows.push(values);
  }

  return rowsToObjects(rows);
}

export function parseImportRows(input: string, sheetName: string): CsvRow[] {
  const text = input.replace(/^\uFEFF/, "").trimStart();
  if (text.startsWith("<?xml") || text.includes("<Workbook")) {
    return parseExcelXml(text, sheetName);
  }
  return parseCsv(text);
}

export function parseImportBuffer(buffer: Buffer, sheetName: string): CsvRow[] {
  if (buffer.subarray(0, 2).toString("utf8") === "PK") {
    return parseXlsx(buffer, sheetName);
  }
  return parseImportRows(buffer.toString("utf8"), sheetName);
}

export function csvResponse(filename: string, content: string) {
  return new Response(`\uFEFF${content}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

function escapeXml(value: string | number | null | undefined) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function worksheet(name: string, rows: Array<Array<string | number | null | undefined>>) {
  return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${rows
    .map(
      (row) =>
        `<Row>${row
          .map(
            (cell) =>
              `<Cell><Data ss:Type="String">${escapeXml(cell)}</Data></Cell>`
          )
          .join("")}</Row>`
    )
    .join("")}</Table></Worksheet>`;
}

export function excelResponse(
  filename: string,
  sheets: Array<{ name: string; rows: Array<Array<string | number | null | undefined>> }>
) {
  const content = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
${sheets.map((sheet) => worksheet(sheet.name, sheet.rows)).join("")}
</Workbook>`;

  return new Response(content, {
    headers: {
      "Content-Type": "application/vnd.ms-excel; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

export function parseYesNo(value: string) {
  const normalized = catalogKey(value);
  return ["si", "sí", "s", "yes", "y", "true", "1"].includes(normalized);
}

export function nullable(value: string) {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function catalogKey(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
