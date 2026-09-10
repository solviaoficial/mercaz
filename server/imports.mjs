import { Worker } from "node:worker_threads";
import { randomUUID } from "node:crypto";
import multer from "multer";
import rateLimit from "express-rate-limit";
import { one, all, run, transaction, postgres } from "./db.mjs";
import { fields, categories, publicSheets, buildPreview } from "./import-parser.mjs";
import { saveRemoteImage, discardImage } from "./import-media.mjs";

const fail = (m, status = 400) => {
  throw Object.assign(Error(m), { status });
};
const sources = ["shopee", "mercadolivre", "shopify", "woocommerce", "other"];
export async function initImports() {
  await transaction(async () => {
    if (postgres) await one("SELECT pg_advisory_xact_lock(?)", -910902);
    await run(
      "CREATE TABLE IF NOT EXISTS import_batches(id TEXT PRIMARY KEY,store_id INTEGER NOT NULL REFERENCES stores(id),source TEXT NOT NULL,account TEXT NOT NULL,state TEXT NOT NULL DEFAULT 'mapping',sheets TEXT NOT NULL DEFAULT '[]',items TEXT NOT NULL DEFAULT '[]',results TEXT NOT NULL DEFAULT '[]',settings TEXT NOT NULL DEFAULT '{}',cursor INTEGER NOT NULL DEFAULT 0,lease TEXT NOT NULL DEFAULT '',locked_until BIGINT NOT NULL DEFAULT 0,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)",
    );
    await run(
      "CREATE INDEX IF NOT EXISTS idx_import_batches_store ON import_batches(store_id,created)",
    );
    await run(
      "CREATE TABLE IF NOT EXISTS import_links(store_id INTEGER NOT NULL REFERENCES stores(id),source TEXT NOT NULL,account TEXT NOT NULL,external_key TEXT NOT NULL,product_id INTEGER NOT NULL REFERENCES products(id),batch_id TEXT NOT NULL REFERENCES import_batches(id),sku TEXT NOT NULL DEFAULT '',PRIMARY KEY(store_id,source,account,external_key))",
    );
    if (postgres)
      for (const table of ["import_batches", "import_links"]) {
        await run(`ALTER TABLE ${table} ENABLE ROW LEVEL SECURITY`);
        await run(`REVOKE ALL ON ${table} FROM anon, authenticated`);
      }
  });
}
let parsing = false;
async function parseFiles(files) {
  if (parsing) fail("Outro arquivo está sendo analisado. Tente novamente em instantes.", 429);
  parsing = true;
  try {
    return await new Promise((resolve, reject) => {
      const worker = new Worker(new URL("./import-worker.mjs", import.meta.url), {
        workerData: { files: files.map((f) => ({ name: f.originalname, buffer: f.buffer })) },
        resourceLimits: { maxOldGenerationSizeMb: 192, maxYoungGenerationSizeMb: 24 },
      });
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(Error("Arquivo muito complexo. Divida em lotes menores."));
      }, 20000);
      const finish = (fn, v) => {
        clearTimeout(timeout);
        worker.terminate();
        fn(v);
      };
      worker.once("message", (m) =>
        m.error ? finish(reject, Error(m.error)) : finish(resolve, m.sheets),
      );
      worker.once("error", () =>
        finish(reject, Error("Não foi possível ler o arquivo. Use XLSX/CSV menor e sem fórmulas.")),
      );
      worker.once("exit", (code) => {
        if (code !== 0) finish(reject, Error("Leitura interrompida. Divida o arquivo em lotes."));
      });
    });
  } finally {
    parsing = false;
  }
}
function batchPublic(b) {
  const items = JSON.parse(b.items),
    results = JSON.parse(b.results);
  return {
    id: b.id,
    source: b.source,
    account: b.account,
    state: b.state,
    created: b.created,
    cursor: b.cursor,
    total: items.length,
    sheets: publicSheets(JSON.parse(b.sheets)),
    settings: JSON.parse(b.settings),
    items,
    results,
    ready: items.filter((i) => !i.errors.length).length,
    createdCount: results.filter((r) => r.state === "created").length,
    skippedCount: results.filter((r) => r.state === "skipped").length,
    errorCount: results.filter((r) => r.state === "error").length,
  };
}
async function owned(id, store) {
  const b = await one("SELECT * FROM import_batches WHERE id=? AND store_id=?", id, store);
  if (!b) fail("Importação não encontrada.", 404);
  return b;
}
let busy = false,
  closing = false;
export async function processImports({ saveImage = saveRemoteImage } = {}) {
  if (busy || closing) return;
  busy = true;
  try {
    const b = await one(
      "SELECT * FROM import_batches WHERE state='queued' OR (state='running' AND locked_until<?) ORDER BY created,id LIMIT 1",
      Date.now(),
    );
    if (!b) return;
    const lease = randomUUID();
    const claim = await run(
      "UPDATE import_batches SET state='running',lease=?,locked_until=? WHERE id=? AND (state='queued' OR (state='running' AND locked_until<?))",
      lease,
      Date.now() + 180000,
      b.id,
      Date.now(),
    );
    if (!claim.changes) return;
    const items = JSON.parse(b.items),
      results = JSON.parse(b.results),
      settings = JSON.parse(b.settings);
    const store = await one("SELECT * FROM stores WHERE id=?", b.store_id);
    // Work a bounded chunk, persisting each result in the same transaction as its product.
    for (let i = b.cursor; i < Math.min(b.cursor + 10, items.length); i++) {
      if (closing) break;
      const current = await one("SELECT state,lease FROM import_batches WHERE id=?", b.id);
      if (current.state !== "running" || current.lease !== lease) return;
      const item = items[i],
        saved = [];
      let result = {
        key: item.key,
        title: item.title,
        where: item.where,
        state: "error",
        message: item.errors.join(" "),
      };
      try {
        if (!item.errors.length) {
          const old = await one(
            "SELECT product_id FROM import_links WHERE store_id=? AND source=? AND account=? AND external_key=?",
            b.store_id,
            b.source,
            b.account,
            item.key,
          );
          if (old)
            result = {
              ...result,
              state: "skipped",
              productId: old.product_id,
              message: "Já importado nesta origem e conta. O anúncio existente foi preservado.",
            };
          else {
            const warnings = [...item.warnings];
            for (const url of item.images)
              try {
                saved.push(await saveImage(url));
              } catch (e) {
                warnings.push("Foto não importada: " + e.message);
              }
            const publish = settings.publish === true && !warnings.length && saved.length > 0;
            result = {
              ...result,
              state: "created",
              message: publish ? "Publicado." : "Salvo como rascunho.",
              warnings,
              status: publish ? "active" : "draft",
            };
          }
        }
        await transaction(async () => {
          const live = await one(
            "SELECT state,lease,cursor FROM import_batches WHERE id=?" +
              (postgres ? " FOR UPDATE" : ""),
            b.id,
          );
          if (live.lease !== lease || live.state !== "running" || live.cursor !== i)
            throw Error("Importação interrompida; tente retomar.");
          if (result.state === "created") {
            if (postgres) await one("SELECT pg_advisory_xact_lock(?)", -1000000 - b.store_id);
            const old = await one(
              "SELECT product_id FROM import_links WHERE store_id=? AND source=? AND account=? AND external_key=?",
              b.store_id,
              b.source,
              b.account,
              item.key,
            );
            if (old)
              result = {
                ...result,
                state: "skipped",
                productId: old.product_id,
                message: "Já importado. Anúncio existente preservado.",
              };
            else {
              const id = Number(
                (
                  await run(
                    "INSERT INTO products(store_id,title,description,category,price,stock,images,variants,status) VALUES(?,?,?,?,?,?,?,?,?)",
                    b.store_id,
                    item.title,
                    item.description,
                    item.category,
                    item.price,
                    item.stock,
                    JSON.stringify(saved.map((s) => s.url)),
                    JSON.stringify([item.variant.slice(0, 80)]),
                    result.status,
                  )
                ).lastInsertRowid,
              );
              for (const image of saved)
                await run(
                  "INSERT INTO uploads(path,user_id,type) VALUES(?,?,?)",
                  image.url,
                  store.user_id,
                  image.type,
                );
              await run(
                "INSERT INTO import_links(store_id,source,account,external_key,product_id,batch_id,sku) VALUES(?,?,?,?,?,?,?)",
                b.store_id,
                b.source,
                b.account,
                item.key,
                id,
                b.id,
                item.sku,
              );
              result.productId = id;
            }
          }
          results.push(result);
          await run(
            "UPDATE import_batches SET cursor=?,results=?,locked_until=? WHERE id=? AND lease=?",
            i + 1,
            JSON.stringify(results),
            Date.now() + 180000,
            b.id,
            lease,
          );
        });
        if (result.state !== "created") for (const image of saved) await discardImage(image);
      } catch (e) {
        for (const image of saved) await discardImage(image);
        // Do not advance on a DB failure: the committed link makes restart idempotent.
        throw e;
      }
    }
    await run(
      "UPDATE import_batches SET state=CASE WHEN cursor>=? THEN 'done' ELSE 'queued' END,lease='',locked_until=0 WHERE id=? AND lease=?",
      items.length,
      b.id,
      lease,
    );
  } finally {
    busy = false;
  }
}
export async function installImports(app, { auth, seller }) {
  await initImports();
  const limit = rateLimit({ windowMs: 3600000, limit: 30 });
  const multipart = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024, files: 6, fields: 4, fieldSize: 256 },
  }).array("files", 6);
  const upload = (req, res, next) =>
    multipart(req, res, (e) =>
      e
        ? next(
            Object.assign(Error("Use até 6 arquivos XLSX/CSV, com no máximo 5 MB cada."), {
              status: 413,
            }),
          )
        : next(),
    );
  app.get("/api/imports/config", auth, seller, (_req, res) =>
    res.json({ fields: Object.keys(fields), categories, sources }),
  );
  app.get("/api/imports", auth, seller, async (req, res) =>
    res.json(
      await all(
        "SELECT id,source,account,state,cursor,created FROM import_batches WHERE store_id=? ORDER BY created DESC,id DESC LIMIT 30",
        req.store.id,
      ),
    ),
  );
  app.post("/api/imports", auth, seller, limit, upload, async (req, res) => {
    if (!sources.includes(req.body.source)) fail("Escolha a origem dos produtos.");
    const account = String(req.body.account || "principal")
      .trim()
      .toLowerCase();
    if (!account || account.length > 80)
      fail("Identifique a loja de origem com até 80 caracteres.");
    if (!req.files?.length) fail("Selecione até 6 planilhas XLSX/CSV.");
    if (req.files.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024)
      fail("Máximo de 20 MB por lote.");
    const active = await one(
      "SELECT COUNT(*) AS n FROM import_batches WHERE store_id=? AND state IN ('mapping','preview','queued','running')",
      req.store.id,
    );
    if (active.n >= 5) fail("Conclua ou cancele uma importação antes de iniciar outra.");
    let sheets;
    try {
      sheets = await parseFiles(req.files);
    } catch (e) {
      fail(e.message, e.status || 400);
    }
    const id = randomUUID();
    await run(
      "INSERT INTO import_batches(id,store_id,source,account,sheets) VALUES(?,?,?,?,?)",
      id,
      req.store.id,
      req.body.source,
      account,
      JSON.stringify(sheets),
    );
    res.status(201).json(batchPublic(await owned(id, req.store.id)));
  });
  app.get("/api/imports/:id", auth, seller, async (req, res) =>
    res.json(batchPublic(await owned(req.params.id, req.store.id))),
  );
  app.post("/api/imports/:id/preview", auth, seller, async (req, res) => {
    const b = await owned(req.params.id, req.store.id);
    if (!["mapping", "preview"].includes(b.state)) fail("Essa importação já foi iniciada.", 409);
    const settings = {
      sheets: req.body.sheets,
      categories: req.body.categories,
      defaultCategory: req.body.defaultCategory,
      publish: req.body.publish === true,
    };
    let items;
    try {
      items = buildPreview(JSON.parse(b.sheets), settings, b.source);
    } catch (e) {
      fail(e.message);
    }
    const result = await run(
      "UPDATE import_batches SET state='preview',items=?,settings=? WHERE id=? AND state IN ('mapping','preview')",
      JSON.stringify(items),
      JSON.stringify(settings),
      b.id,
    );
    if (!result.changes) fail("A importação foi alterada. Recarregue.", 409);
    res.json(batchPublic(await owned(b.id, req.store.id)));
  });
  app.post("/api/imports/:id/start", auth, seller, async (req, res) => {
    const b = await owned(req.params.id, req.store.id);
    if (b.state === "preview") {
      if (!JSON.parse(b.items).some((i) => !i.errors.length))
        fail("Corrija os erros antes de importar.");
      if (req.body.accept !== true) fail("Confirme a prévia antes de importar.");
      await run(
        "UPDATE import_batches SET state='queued',sheets='[]' WHERE id=? AND state='preview'",
        b.id,
      );
    } else if (!["queued", "running", "done"].includes(b.state))
      fail("Gere a prévia antes de importar.", 409);
    res.status(202).json(batchPublic(await owned(b.id, req.store.id)));
  });
  app.post("/api/imports/:id/cancel", auth, seller, async (req, res) => {
    await owned(req.params.id, req.store.id);
    await run(
      "UPDATE import_batches SET state='cancelled',sheets='[]',lease='',locked_until=0 WHERE id=? AND state IN ('mapping','preview','queued','running')",
      req.params.id,
    );
    res.json({ ok: true });
  });
  app.get("/api/imports/:id/report", auth, seller, async (req, res) => {
    const b = await owned(req.params.id, req.store.id),
      saved = JSON.parse(b.results);
    const results = saved.length
      ? saved
      : JSON.parse(b.items).map((i) => ({
          ...i,
          state: i.errors.length ? "error" : "preview",
          message: i.errors.join(" "),
        }));
    const safe = (v) =>
      '"' +
      String(v ?? "")
        .replace(/^(?:[\s\uFEFF]*[=+@\-]|[\t\r\n])/, "'$&")
        .replace(/"/g, '""') +
      '"';
    const lines = [
      ["Produto", "Origem/linha", "Resultado", "ID Mercaz", "Detalhes"],
      ...results.map((r) => [
        r.title,
        r.where.join(" | "),
        r.state,
        r.productId,
        [r.message, ...(r.warnings || [])].join(" "),
      ]),
    ];
    res.setHeader("Content-Disposition", 'attachment; filename="mercaz-importacao.csv"');
    res.type("text/csv").send("\uFEFF" + lines.map((r) => r.map(safe).join(";")).join("\r\n"));
  });
  app.get("/api/import-template", auth, seller, (_req, res) => {
    res.setHeader("Content-Disposition", 'attachment; filename="modelo-mercaz.csv"');
    res
      .type("text/csv")
      .send(
        "\uFEFFID do produto;SKU;Título;Descrição;Preço;Estoque;Categoria;Imagens;Variação\r\n",
      );
  });
  let running;
  const timer =
    process.env.NO_LISTEN === "true"
      ? null
      : setInterval(() => {
          if (!busy)
            running = processImports().catch(() =>
              console.error(
                "Importação interrompida; retomada automática após expirar a reserva do lote.",
              ),
            );
        }, 1500);
  timer?.unref();
  return async () => {
    closing = true;
    clearInterval(timer);
    await running;
  };
}
