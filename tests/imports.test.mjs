import { test, after } from "node:test";
import assert from "node:assert/strict";
import ExcelJS from "exceljs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFiles, buildPreview, amount, guessMapping } from "../server/import-parser.mjs";

const dir = mkdtempSync(path.join(tmpdir(), "mercaz-import-test-"));
process.env.DATA_DIR = dir;
process.env.NO_LISTEN = "true";
process.env.SEED_DEMO = "true";
process.env.PAYMENT_MODE = "demo";
process.env.DEMO_PASSWORD = "TesteMercaz2026!";
process.env.AUTH_PROVIDER = "local";
const { app } = await import("../server/index.mjs");
const { db, one, all, run } = await import("../server/db.mjs");
const { processImports } = await import("../server/imports.mjs");
const { publicIP, resolveImageUrl, imageType } = await import("../server/import-media.mjs");
const server = await new Promise((resolve) => {
  const s = app.listen(0, "127.0.0.1", () => resolve(s));
});
const base = "http://127.0.0.1:" + server.address().port + "/api";
after(async () => {
  await new Promise((r) => server.close(r));
  await db.close();
  rmSync(dir, { recursive: true, force: true });
});
async function call(url, body, cookie = "", method) {
  const r = await fetch(base + url, {
    method: method || (body ? "POST" : "GET"),
    headers: {
      "X-Mercaz-Client": "web",
      Cookie: cookie,
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
    },
    body: body ? (body instanceof FormData ? body : JSON.stringify(body)) : undefined,
  });
  return {
    code: r.status,
    data: await r.json(),
    cookie: r.headers.get("set-cookie")?.split(";")[0],
  };
}
const csv = (name, text) => ({ name, buffer: Buffer.from(text) });
async function xlsx(name, rows) {
  const b = new ExcelJS.Workbook();
  const ws = b.addWorksheet("Produtos");
  rows.forEach((r) => ws.addRow(r));
  return { name, buffer: Buffer.from(await b.xlsx.writeBuffer()) };
}
const options = { defaultCategory: "Moda e acessórios" };
const desc = "Camiseta de algodão com acabamento reforçado.";
test("Planilhas: combinação, variantes e validação sem perda de dados", async (t) => {
  await t.test("preço brasileiro, internacional, zero estoque, rejeição de arredondamento", () => {
    assert.equal(amount("R$ 1.234,56"), 123456);
    assert.equal(amount("19,90"), 1990);
    assert.equal(amount("19.90"), 1990);
    assert.equal(amount("19.999"), null);
    assert.equal(amount("-10"), null);
    assert.equal(amount("GRÁTIS"), null);
  });
  await t.test("Shopee junta informações básicas, vendas e mídia e mantém variações", async () => {
    const files = [
      await xlsx("basic.xlsx", [
        ["Instruções de uso"],
        ["Product ID", "Parent SKU", "Product Name", "Product Description"],
        ["00123", "CAMISETA", "Camiseta básica", desc],
      ]),
      csv(
        "sales.csv",
        "Product ID;Variation ID;Variation Name;SKU;Price;Stock\n00123;v1;Azul / M;CAM-A;49,90;0\n00123;v2;Preto / G;CAM-B;59,90;3",
      ),
      csv(
        "media.csv",
        "Product ID;Cover Image;Image 1\n00123;https://example.com/cover.jpg;https://example.com/side.jpg",
      ),
    ];
    const sheets = await readFiles(files),
      rows = buildPreview(sheets, options, "shopee");
    assert.equal(sheets[0].header, 1);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].price, 4990);
    assert.equal(rows[0].stock, 0);
    assert.equal(rows[1].stock, 3);
    assert.equal(rows[1].description, desc);
    assert.equal(rows[0].images.length, 2);
    assert.equal(rows[0].externalId, "00123");
    assert.deepEqual(rows[0].errors, []);
  });
  await t.test("conflitos entre arquivos nunca são resolvidos silenciosamente", async () => {
    const rows = await readFiles([
      csv("a.csv", `ID;Título;Descrição;Preço;Estoque\n10;Camiseta de algodão;${desc};10;3`),
      csv("b.csv", "ID;Preço;Estoque\n10;20;3"),
    ]);
    assert.match(buildPreview(rows, options, "mercadolivre")[0].errors.join(" "), /divergentes/);
  });
  await t.test("Shopify herda título/descrição e combina linhas extras de imagens", async () => {
    const rows = await readFiles([
      csv(
        "shopify.csv",
        `Handle,Title,Body (HTML),Variant SKU,Option1 Value,Variant Price,Variant Inventory Qty,Image Src\nshirt,Camiseta básica,<p>${desc}</p>,CAM-A,Azul,49.90,3,https://example.com/a.jpg\nshirt,,,CAM-B,Preto,59.90,4,\nshirt,,,,,,,https://example.com/b.jpg`,
      ),
    ]);
    const items = buildPreview(rows, options, "shopify");
    assert.equal(items.length, 2);
    assert.equal(items[1].description, desc);
    assert.match(items[1].title, /Camiseta básica/);
    assert.equal(items[1].images.length, 1);
    assert.deepEqual(items[1].errors, []);
  });
  await t.test("WooCommerce vincula a variação ao pai pelo SKU", async () => {
    const sheets = await readFiles([
      csv(
        "woo.csv",
        `ID,Type,SKU,Name,Description,Regular price,Stock,Parent,Attribute 1 value(s),Images\n10,variable,SHIRT,Camiseta básica,${desc},,,,,https://example.com/p.jpg\n11,variation,SHIRT-A,Camiseta azul,,39.90,2,SHIRT,Azul,`,
      ),
    ]);
    const items = buildPreview(sheets, options, "woocommerce");
    assert.equal(items.length, 1);
    assert.equal(items[0].description, desc);
    assert.equal(items[0].stock, 2);
    assert.equal(items[0].images.length, 1);
  });
  await t.test("arquivo inválido, fórmulas e limite de linhas são recusados", async () => {
    const oversized = await xlsx("oversized.xlsx", [
      ["ID", "Título"],
      ["1", "Produto teste"],
    ]);
    const central = oversized.buffer.indexOf(Buffer.from("504b0102", "hex"));
    oversized.buffer.writeUInt32LE(40 * 1024 * 1024, central + 24);
    await assert.rejects(() => readFiles([oversized]), /descompactado/);
    await assert.rejects(() => readFiles([csv("old.xls", "abc")]), /XLSX/);
    const sheets = await readFiles([
      await xlsx("formula.xlsx", [
        ["ID", "Título", "Descrição", "Preço", "Estoque"],
        ["1", "Camiseta teste", desc, { formula: "1+1", result: 2 }, 4],
      ]),
    ]);
    assert.match(buildPreview(sheets, options, "other")[0].errors.join(" "), /fórmulas/);
    await assert.rejects(
      () => readFiles([csv("huge.csv", "ID;Título\n" + Array(2031).fill("1;Teste").join("\n"))]),
      /2.000/,
    );
  });
  await t.test(
    "ID estável de produto simples independe de preenchimento posterior do SKU",
    async () => {
      const make = async (sku) =>
        buildPreview(
          await readFiles([
            csv("simple.csv", `ID;SKU;Título;Preço;Estoque\nA1;${sku};Camiseta teste;20;2`),
          ]),
          options,
          "mercadolivre",
        )[0];
      assert.equal((await make("")).key, (await make("NOVO-SKU")).key);
    },
  );
  await t.test(
    "mapeamento manual e categoria por origem corrigem arquivo customizado",
    async () => {
      const sheets = await readFiles([
        csv("erp.csv", "COD;NOME ESPECIAL;VALOR;QTD;GRUPO\n1;Camiseta de algodão;10,00;0;Roupas"),
      ]);
      const items = buildPreview(
        sheets,
        {
          sheets: [
            {
              key: "0",
              enabled: true,
              header: 0,
              mapping: { id: 0, title: 1, price: 2, stock: 3, category: 4 },
            },
          ],
          categories: { Roupas: "Moda e acessórios" },
        },
        "other",
      );
      assert.deepEqual(items[0].errors, []);
      assert.equal(items[0].stock, 0);
    },
  );
  await t.test("URLs inseguras e fórmulas não se tornam mídia executável", async () => {
    for (const ip of [
      "127.0.0.1",
      "10.0.0.1",
      "169.254.169.254",
      "0.0.0.0",
      "::1",
      "::ffff:127.0.0.1",
      "fc00::1",
      "100.64.0.1",
      "224.0.0.1",
    ])
      assert.equal(publicIP(ip), false, ip);
    assert.equal(publicIP("8.8.8.8"), true);
    await assert.rejects(() => resolveImageUrl("https://127.0.0.1/image.png"), /não permitido/);
    await assert.rejects(() => resolveImageUrl("file:///etc/passwd"));
    await assert.rejects(() => resolveImageUrl("https://user:pass@example.com/image.png"), /HTTPS/);
    assert.equal(imageType(Buffer.from('<svg onload="alert(1)"></svg>')), null);
  });
});

test("API de importação: autorização, fila persistente e idempotência", async (t) => {
  const seller = (
    await call("/auth/login", {
      email: "vendedor1@mercaz.local",
      password: process.env.DEMO_PASSWORD,
    })
  ).cookie;
  const other = (
    await call("/auth/login", {
      email: "vendedor2@mercaz.local",
      password: process.env.DEMO_PASSWORD,
    })
  ).cookie;
  const buyer = (
    await call("/auth/login", {
      email: "comprador@mercaz.local",
      password: process.env.DEMO_PASSWORD,
    })
  ).cookie;
  let batch;
  const data = `ID;SKU;Título;Descrição;Preço;Estoque;Imagens\nIMPORT-001;SKU-1;Camiseta importada;${desc};49,90;3;https://example.com/p.jpg\nIMPORT-002;SKU-2;Camiseta inválida;${desc};grátis;3;`;
  async function upload(cookie = seller) {
    const form = new FormData();
    form.append("source", "mercadolivre");
    form.append("account", "principal");
    form.append("files", new Blob([data]), "produtos.csv");
    return call("/imports", form, cookie);
  }
  await t.test("somente vendedores podem enviar planilhas", async () => {
    assert.equal((await upload("")).code, 401);
    assert.equal((await upload(buyer)).code, 403);
    const r = await upload();
    assert.equal(r.code, 201, JSON.stringify(r));
    batch = r.data;
    assert.equal(batch.state, "mapping");
  });
  await t.test("outro vendedor não acessa, altera, executa ou cancela o lote", async () => {
    assert.equal((await call("/imports/" + batch.id, null, other)).code, 404);
    for (const path of ["preview", "start", "cancel"])
      assert.equal((await call("/imports/" + batch.id + "/" + path, {}, other)).code, 404);
  });
  await t.test("prévia não grava produtos e seleciona categoria por padrão", async () => {
    const before = (await one("SELECT COUNT(*) n FROM products")).n;
    const r = await call(
      "/imports/" + batch.id + "/preview",
      { defaultCategory: "Moda e acessórios", publish: false },
      seller,
    );
    assert.equal(r.code, 200);
    batch = r.data;
    assert.equal(batch.ready, 1);
    assert.equal(batch.total, 2);
    assert.equal((await one("SELECT COUNT(*) n FROM products")).n, before);
  });
  await t.test("duplo clique e repetição do lote não duplicam produtos", async () => {
    const a = await call("/imports/" + batch.id + "/start", { accept: true }, seller);
    assert.equal(a.code, 202);
    assert.equal(
      (await call("/imports/" + batch.id + "/start", { accept: true }, seller)).code,
      202,
    );
    await processImports({
      saveImage: async () => {
        throw Error("Imagem indisponível");
      },
    });
    batch = (await call("/imports/" + batch.id, null, seller)).data;
    assert.equal(batch.state, "done");
    assert.equal(batch.createdCount, 1);
    assert.equal(batch.errorCount, 1);
    const p = await one("SELECT * FROM products WHERE id=?", batch.results[0].productId);
    assert.equal(p.stock, 3);
    assert.equal(p.price, 4990);
    assert.equal(p.status, "draft");
    assert.deepEqual(JSON.parse(p.images), []);
    const again = await upload();
    await call(
      "/imports/" + again.data.id + "/preview",
      { defaultCategory: "Moda e acessórios" },
      seller,
    );
    await call("/imports/" + again.data.id + "/start", { accept: true }, seller);
    await processImports();
    const second = (await call("/imports/" + again.data.id, null, seller)).data;
    assert.equal(second.skippedCount, 1);
    assert.equal(second.createdCount, 0);
  });
  await t.test(
    "outro vendedor importa seus próprios IDs sem acessar os anúncios alheios",
    async () => {
      const b = (await upload(other)).data;
      await call("/imports/" + b.id + "/preview", { defaultCategory: "Moda e acessórios" }, other);
      await call("/imports/" + b.id + "/start", { accept: true }, other);
      await processImports({
        saveImage: async () => {
          throw Error("Não disponível");
        },
      });
      const finished = (await call("/imports/" + b.id, null, other)).data;
      assert.equal(finished.createdCount, 1);
      assert.notEqual(finished.results[0].productId, batch.results[0].productId);
    },
  );
  await t.test("cancelamento preserva catálogo e não executa itens pendentes", async () => {
    const b = (await upload()).data;
    await call("/imports/" + b.id + "/preview", { defaultCategory: "Moda e acessórios" }, seller);
    await call("/imports/" + b.id + "/start", { accept: true }, seller);
    await call("/imports/" + b.id + "/cancel", {}, seller);
    await processImports();
    assert.equal((await call("/imports/" + b.id, null, seller)).data.cursor, 0);
  });
  await t.test("retomada de lote com reserva expirada usa registros persistidos", async () => {
    const b = (await upload()).data;
    await call("/imports/" + b.id + "/preview", { defaultCategory: "Moda e acessórios" }, seller);
    await call("/imports/" + b.id + "/start", { accept: true }, seller);
    await run(
      "UPDATE import_batches SET state='running',lease='crashed',locked_until=0 WHERE id=?",
      b.id,
    );
    await processImports();
    assert.equal((await call("/imports/" + b.id, null, seller)).data.state, "done");
  });
  await t.test("relatório é privado e neutraliza fórmulas de CSV", async () => {
    await run(
      "UPDATE import_batches SET results=? WHERE id=?",
      JSON.stringify([
        {
          title: '=HYPERLINK("bad")',
          where: ["planilha.csv / linha 2"],
          state: "error",
          message: "Erro",
        },
      ]),
      batch.id,
    );
    const report = await fetch(base + "/imports/" + batch.id + "/report", {
      headers: { Cookie: seller },
    });
    assert.equal(report.status, 200);
    assert.match(await report.text(), /"'=HYPERLINK/);
    assert.equal(
      (await fetch(base + "/imports/" + batch.id + "/report", { headers: { Cookie: other } }))
        .status,
      404,
    );
  });
});
