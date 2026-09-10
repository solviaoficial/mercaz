import ExcelJS from "exceljs";
import unzipper from "unzipper";
import { parse } from "csv-parse/sync";

export const MAX_ROWS = 2000;
async function validateArchive(buffer) {
  const zip = await unzipper.Open.buffer(buffer);
  const max = 32 * 1024 * 1024;
  if (zip.files.length > 500 || zip.files.reduce((n, f) => n + f.uncompressedSize, 0) > max)
    throw Error("XLSX descompactado excede 32 MB ou 500 partes. Divida o arquivo.");
  let total = 0;
  for (const entry of zip.files) {
    if (/vbaProject|externalLinks/i.test(entry.path))
      throw Error("Remova macros e vínculos externos da planilha.");
    const stream = entry.stream();
    let size = 0;
    for await (const chunk of stream) {
      size += chunk.length;
      total += chunk.length;
      if (total > max || size > entry.uncompressedSize) {
        stream.destroy();
        throw Error("XLSX excede o limite de descompactação.");
      }
    }
  }
}
export const fields = {
  id: [
    "ID do produto",
    "ID do anúncio",
    "Product ID",
    "Item ID",
    "item_id",
    "ID",
    "Número do anúncio",
    "URL handle",
    "Handle",
  ],
  sku: ["SKU", "SKU da variação", "SKU de vendedor", "Seller SKU", "Variant SKU", "SKU #"],
  parentSku: ["SKU principal", "SKU pai", "Parent SKU", "Parent SKU #"],
  parent: ["Parent", "Ascendente", "Produto pai"],
  type: ["Type", "Tipo"],
  variantId: ["Variation ID", "Model ID", "ID da variação", "ID de variação", "variation_id"],
  variant: [
    "Variation Name",
    "Nome da variação",
    "Variação",
    "Variation",
    "Option1 Value",
    "Option1 value",
    "Attribute 1 value(s)",
    "Valores do atributo 1",
  ],
  option2: ["Option2 Value", "Option2 value", "Attribute 2 value(s)", "Valores do atributo 2"],
  option3: ["Option3 Value", "Option3 value", "Attribute 3 value(s)", "Valores do atributo 3"],
  title: [
    "Título",
    "Nome do produto",
    "Nome",
    "Product Name",
    "Item Name",
    "Title",
    "Name",
    "Nome do anúncio",
  ],
  description: [
    "Descrição",
    "Descrição do produto",
    "Product Description",
    "Description",
    "Body (HTML)",
  ],
  price: [
    "Preço",
    "Preço de venda",
    "Price",
    "Variation Price",
    "Preço da variação",
    "Variant Price",
    "Regular price",
    "Preço normal",
    "Preço (R$)",
  ],
  stock: [
    "Estoque",
    "Quantidade",
    "Stock",
    "Variation Stock",
    "Estoque da variação",
    "Available quantity",
    "Variant Inventory Qty",
    "Inventory quantity",
  ],
  category: [
    "Categoria",
    "Category",
    "Categories",
    "Categorias",
    "Product category",
    "Product Category",
  ],
  images: [
    "Imagens",
    "Fotos",
    "Images",
    "Image Src",
    "Product image URL",
    "Image URL",
    "Imagem",
    "Imagem de capa",
    "Cover Image",
    "Cover image URL",
    "Product Image",
    "Imagem principal",
  ],
  variantImage: ["Variant Image", "Variant image URL", "Variation Image", "Imagem da variação"],
};
export const normalize = (v) =>
  String(v ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
const aliases = Object.fromEntries(Object.entries(fields).map(([k, a]) => [k, a.map(normalize)]));
export function guessMapping(headers) {
  const map = {};
  for (const [key, names] of Object.entries(aliases)) {
    const index = headers.findIndex((h) => names.includes(normalize(h)));
    if (index >= 0) map[key] = index;
  }
  return map;
}
function cellValue(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return "";
  if (typeof v === "number" && !Number.isSafeInteger(v) && Number.isInteger(v))
    throw Error("Identificador numérico grande demais. Salve IDs como texto.");
  if (typeof v !== "object") return String(v);
  if (v.formula || v.sharedFormula) return "[FÓRMULA: substitua pelo valor]";
  if (v.hyperlink) return String(v.hyperlink);
  if (v.richText) return v.richText.map((p) => p.text).join("");
  return cell.text || "";
}
function sheet(name, rows, filename, index) {
  if (rows.length > MAX_ROWS + 30)
    throw Error("Máximo de 2.000 linhas por aba. Divida o arquivo em lotes.");
  if (rows.some((r) => r.length > 160 || r.some((c) => c.length > 12000)))
    throw Error("Planilha excede 160 colunas ou contém células muito grandes.");
  let header = 0,
    best = -1;
  for (let i = 0; i < Math.min(25, rows.length); i++) {
    const m = guessMapping(rows[i]);
    const score =
      Object.keys(m).length + (m.id !== undefined ? 2 : 0) + (m.title !== undefined ? 2 : 0);
    if (score > best) {
      best = score;
      header = i;
    }
  }
  return {
    key: String(index),
    name,
    filename,
    rows,
    header,
    mapping: guessMapping(rows[header] || []),
    enabled: best >= 3,
  };
}
export async function readFiles(files) {
  const result = [];
  let total = 0;
  for (const file of files) {
    const b = Buffer.from(file.buffer);
    if (/\.csv$/i.test(file.name)) {
      let s;
      try {
        s = new TextDecoder("utf-8", { fatal: true }).decode(b);
      } catch {
        s = new TextDecoder("windows-1252").decode(b);
      }
      if (s.includes("\0")) throw Error("CSV contém bytes inválidos. Use CSV UTF-8.");
      let rows;
      for (const delimiter of [";", ",", "\t"]) {
        try {
          const candidate = parse(s, {
            delimiter,
            bom: true,
            relax_column_count: true,
            skip_empty_lines: false,
            max_record_size: 500000,
          });
          if (
            candidate.some((r) => r.length > 1) &&
            (!rows ||
              Math.max(...candidate.slice(0, 25).map((r) => r.length)) >
                Math.max(...rows.slice(0, 25).map((r) => r.length)))
          )
            rows = candidate;
        } catch {}
      }
      if (!rows) throw Error("CSV inválido: confira separador e aspas.");
      result.push(sheet("CSV", rows, file.name, result.length));
    } else if (/\.xlsx$/i.test(file.name) && b.subarray(0, 2).toString() === "PK") {
      await validateArchive(b);
      const book = new ExcelJS.Workbook();
      await book.xlsx.load(b, {
        ignoreNodes: ["dataValidations", "conditionalFormatting", "drawing", "extLst"],
      });
      if (book.worksheets.length > 20) throw Error("Máximo de 20 abas por arquivo.");
      for (const ws of book.worksheets) {
        if (!ws.rowCount || ws.state === "veryHidden") continue;
        if (ws.rowCount > MAX_ROWS + 30 || ws.columnCount > 160)
          throw Error("Máximo de 2.000 linhas e 160 colunas por aba.");
        const rows = [];
        for (let i = 1; i <= ws.rowCount; i++)
          rows.push(
            Array.from({ length: ws.columnCount }, (_, j) =>
              cellValue(ws.getRow(i).getCell(j + 1)),
            ),
          );
        result.push(sheet(ws.name, rows, file.name, result.length));
      }
    } else
      throw Error("Use XLSX ou CSV. Para XLS antigo, abra no Excel/LibreOffice e salve como XLSX.");
    if (result.length > 30) throw Error("Máximo de 30 abas no lote.");
  }
  for (const s of result) total += s.rows.length;
  if (total > 8000) throw Error("Máximo de 8.000 linhas somando as planilhas do lote.");
  if (Buffer.byteLength(JSON.stringify(result)) > 16 * 1024 * 1024)
    throw Error("Dados descompactados excedem 16 MB. Divida em lotes menores.");
  return result;
}
export function publicSheets(sheets) {
  return sheets.map(({ rows, ...s }) => ({
    ...s,
    count: rows.length,
    headers: rows[s.header],
    sample: rows.slice(0, Math.min(30, rows.length)),
  }));
}
function plain(v) {
  return String(v || "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<(br|\/p|\/div|\/li)\b[^>]*>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .trim();
}
export function amount(raw) {
  let s = String(raw ?? "")
    .trim()
    .replace(/^R\$\s*/i, "")
    .replace(/\s/g, "");
  if (/^\d{1,3}(\.\d{3})*,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/^\d+,\d{1,2}$/.test(s)) s = s.replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const n = Math.round(Number(s) * 100);
  return Number.isSafeInteger(n) && n > 0 && n <= 100000000 ? n : null;
}
export const categories = [
  "Casa e decoração",
  "Tecnologia",
  "Moda e acessórios",
  "Beleza",
  "Cozinha",
  "Esporte",
];
function urls(v) {
  return String(v || "")
    .split(/[|\n]|,\s*(?=https?:)/)
    .map((x) => x.trim())
    .filter(Boolean);
}
function merge(a, b) {
  for (const [k, v] of Object.entries(b)) {
    if (!v || k === "where") continue;
    if (k === "images") {
      a.images = [...new Set([...(a.images || []), ...v])];
      continue;
    }
    if (
      a[k] &&
      a[k] !== v &&
      ["title", "description", "price", "stock", "sku", "variant"].includes(k)
    )
      a.conflicts.add(k);
    if (!a[k]) a[k] = v;
  }
  a.where.push(b.where);
}
export function buildPreview(sheets, settings, source) {
  const settingsByKey = new Map((settings.sheets || []).map((s) => [s.key, s]));
  const records = [];
  for (const s of sheets) {
    const conf = settingsByKey.get(s.key) || s;
    if (!conf.enabled) continue;
    const h = Number(conf.header);
    if (!Number.isInteger(h) || h < 0 || h >= s.rows.length || h > 24)
      throw Error("Linha de cabeçalho inválida.");
    const map = conf.mapping || {};
    for (const [key, i] of Object.entries(map))
      if (!Object.hasOwn(fields, key) || !Number.isInteger(i) || i < 0 || i >= s.rows[h].length)
        throw Error("Mapeamento inválido.");
    if (map.id === undefined && map.sku === undefined && map.parentSku === undefined)
      throw Error(`${s.filename}: mapeie o ID do produto ou SKU.`);
    for (let i = h + 1; i < s.rows.length; i++) {
      const cells = s.rows[i];
      if (!cells.some((v) => v.trim())) continue;
      const r = {};
      for (const [key, col] of Object.entries(map)) r[key] = String(cells[col] || "").trim();
      if (normalize(r.id) === "productid" || normalize(r.title) === "productname") continue;
      r.images = [...urls(r.images), ...urls(r.variantImage)];
      // Shopee media templates can have separate numbered image columns.
      for (let c = 0; c < s.rows[h].length; c++)
        if (/^(image|imagem|foto|productimage)[1-9](url)?$/.test(normalize(s.rows[h][c])))
          r.images.push(...urls(cells[c]));
      r.where = `${s.filename} / ${s.name} / linha ${i + 1}`;
      records.push(r);
    }
  }
  const groups = new Map();
  const wooParents = new Map();
  if (source === "woocommerce")
    for (const r of records)
      if (r.type === "variable") {
        if (r.id) wooParents.set("id:" + r.id, r);
        if (r.sku) wooParents.set(r.sku, r);
      }
  for (const r of records) {
    if (source === "woocommerce" && r.type === "variation") {
      const parent = wooParents.get(r.parent);
      if (parent) {
        for (const k of ["description", "category"]) r[k] ||= parent[k];
        r.images = [...r.images, ...parent.images];
      }
    }
    const groupId = r.id || r.parentSku || r.sku;
    const key = groupId || "missing:" + r.where;
    if (!groups.has(key))
      groups.set(key, {
        base: { images: [], where: [], conflicts: new Set() },
        common: {},
        variants: new Map(),
        key,
      });
    const g = groups.get(key);
    for (const field of ["title", "description", "category"])
      if (!g.common[field] && r[field]) g.common[field] = r[field];
    const variant = [r.variant, r.option2, r.option3]
      .filter((v) => v && v !== "Default Title")
      .join(" / ");
    const variantId =
      r.variantId && r.variantId !== "0"
        ? r.variantId
        : variant
          ? r.sku
            ? "sku:" + r.sku
            : variant
          : "";
    if (variantId) {
      if (!g.variants.has(variantId))
        g.variants.set(variantId, { images: [], where: [], conflicts: new Set() });
      merge(g.variants.get(variantId), { ...r, variant });
    } else merge(g.base, r);
  }
  const items = [];
  for (const g of groups.values()) {
    const variants = g.variants.size ? [...g.variants.entries()] : [["", g.base]];
    for (const [variantId, v] of variants) {
      const r = { ...g.base, ...v };
      for (const k of ["title", "description", "category", "price", "stock", "sku"])
        r[k] = v[k] || g.base[k] || g.common[k] || "";
      r.images = [...new Set([...(v.images || []), ...(g.base.images || [])])];
      if (source === "woocommerce" && r.type === "variable") continue;
      const errors = [],
        warnings = [];
      const label = v.variant || (v.variantId && v.variantId !== "0" ? v.sku || v.variantId : "");
      const title = plain(r.title) + (label ? " — " + plain(label) : "");
      const price = amount(r.price);
      const stock = /^\d+$/.test(r.stock) && Number(r.stock) <= 1000000 ? Number(r.stock) : null;
      if (g.key.startsWith("missing:")) errors.push("ID/SKU ausente.");
      if (title.length < 5 || title.length > 180)
        errors.push("Título deve ter entre 5 e 180 caracteres.");
      if (price === null) errors.push("Preço ausente ou inválido; use 19,90 ou 19.90.");
      if (stock === null)
        errors.push("Estoque ausente ou inválido; informe um inteiro de 0 a 1.000.000.");
      if (
        Object.values(r).some((value) => typeof value === "string" && value.includes("[FÓRMULA:"))
      )
        errors.push("Substitua fórmulas pelos valores.");
      const conflicts = [...new Set([...g.base.conflicts, ...v.conflicts])];
      if (conflicts.length)
        errors.push("Dados divergentes nas planilhas: " + conflicts.join(", ") + ".");
      if (r.type && source === "woocommerce" && !["simple", "variation"].includes(r.type))
        errors.push("Tipo WooCommerce não suportado: " + r.type);
      const description = plain(r.description);
      if (description.length < 20 || description.length > 8000)
        warnings.push("Revise a descrição (20 a 8.000 caracteres) antes de publicar.");
      const category = categories.includes(r.category)
        ? r.category
        : settings.categories?.[r.category] || settings.defaultCategory;
      if (!categories.includes(category)) errors.push("Escolha a categoria Mercaz correspondente.");
      const images = r.images.filter((u) => {
        try {
          const x = new URL(u);
          return (
            x.protocol === "https:" && !x.username && !x.password && (!x.port || x.port === "443")
          );
        } catch {
          return false;
        }
      });
      if (images.length !== r.images.length)
        warnings.push("Há fotos sem URL HTTPS direta; envie as imagens no editor.");
      if (images.length > 6) warnings.push("Somente as primeiras 6 fotos serão importadas.");
      if (!images.length) warnings.push("Sem fotos: adicione imagens antes de publicar.");
      if (label)
        warnings.push(
          "Variação importada como anúncio individual para manter seu preço e estoque.",
        );
      items.push({
        key: JSON.stringify([g.key, variantId]),
        externalId: g.key,
        variantId,
        sku: r.sku,
        title,
        description,
        price,
        stock,
        category,
        sourceCategory: r.category,
        images: images.slice(0, 6),
        variant: label || "Único",
        errors,
        warnings,
        where: [...new Set([...g.base.where, ...v.where])],
      });
    }
  }
  if (!items.length) throw Error("Nenhum produto encontrado. Confira as abas e o cabeçalho.");
  if (items.length > MAX_ROWS) throw Error("Máximo de 2.000 anúncios por lote.");
  return items;
}
