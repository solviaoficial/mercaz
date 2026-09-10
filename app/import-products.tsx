import React, { useEffect, useState } from "react";
import { Upload, Files, ArrowRight, Check, Download, AlertTriangle, Package } from "lucide-react";
import { api, Heading, Field, money, ErrorBox } from "./shared";
import "./import-products.css";

const sourceNames: Record<string, string> = {
  shopee: "Shopee",
  mercadolivre: "Mercado Livre",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  other: "Outra plataforma / modelo Mercaz",
};
const fieldNames: Record<string, string> = {
  id: "ID do produto / anúncio",
  sku: "SKU da unidade vendida",
  parentSku: "SKU principal",
  parent: "Referência do produto pai (WooCommerce)",
  type: "Tipo (WooCommerce)",
  variantId: "ID da variação",
  variant: "Variação / opção 1",
  option2: "Opção 2",
  option3: "Opção 3",
  title: "Título",
  description: "Descrição",
  price: "Preço em reais",
  stock: "Estoque disponível",
  category: "Categoria de origem",
  images: "Imagens / URLs",
  variantImage: "Imagem da variação",
};
const states: Record<string, string> = {
  mapping: "Mapeando colunas",
  preview: "Aguardando confirmação",
  queued: "Na fila",
  running: "Importando",
  done: "Concluída",
  cancelled: "Cancelada",
};
const categories = [
  "Casa e decoração",
  "Tecnologia",
  "Moda e acessórios",
  "Beleza",
  "Cozinha",
  "Esporte",
];
export function ImportProducts() {
  const [source, setSource] = useState("shopee"),
    [account, setAccount] = useState("principal");
  const [files, setFiles] = useState<File[]>([]),
    [batch, setBatch] = useState<any>(null),
    [sheets, setSheets] = useState<any[]>([]);
  const [defaultCategory, setDefaultCategory] = useState(""),
    [categoryMap, setCategoryMap] = useState<Record<string, string>>({}),
    [publish, setPublish] = useState(false);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [history, setHistory] = useState<any[]>([]),
    [page, setPage] = useState(0),
    [showMapping, setShowMapping] = useState(true);
  const historyLoad = () =>
    api("/imports")
      .then(setHistory)
      .catch((e: any) => setError(e.message));
  useEffect(() => {
    historyLoad();
  }, []);
  useEffect(() => {
    if (!batch || !["running", "queued"].includes(batch.state)) return;
    let active = true;
    const timer = setInterval(
      () =>
        api("/imports/" + batch.id)
          .then((b) => {
            if (active) {
              setBatch(b);
              if (b.state === "done") historyLoad();
            }
          })
          .catch((e) => {
            if (active) setError(e.message);
          }),
      2500,
    );
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [batch?.id, batch?.state]);
  async function action(fn: () => Promise<any>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function load(b: any) {
    setBatch(b);
    setSheets(
      b.sheets.map((s: any) => ({ ...s, ...b.settings.sheets?.find((v: any) => v.key === s.key) })),
    );
    setDefaultCategory(b.settings.defaultCategory || "");
    setCategoryMap(b.settings.categories || {});
    setPublish(b.settings.publish === true);
    setPage(0);
    setShowMapping(b.state === "mapping");
  }
  function changeSheet(key: string, fn: (s: any) => any) {
    setSheets((s) => s.map((v) => (v.key === key ? fn(v) : v)));
  }
  const mapping = batch && ["mapping", "preview"].includes(batch.state) && showMapping;
  const processing = batch && ["running", "queued"].includes(batch.state);
  const rows = batch?.results?.length ? batch.results : batch?.items || [];
  const sourceCategories = [
    ...new Set<string>((batch?.items || []).map((i: any) => i.sourceCategory).filter(Boolean)),
  ];
  return (
    <div className="import-page">
      <Heading title="Importar produtos" sub="Traga seu catálogo para a Mercaz em um único lote.">
        <a className="btn secondary" href="/api/import-template">
          <Download size={16} /> Modelo Mercaz
        </a>
      </Heading>
      <div className="import-steps" aria-label="Etapas da importação">
        {["Enviar planilhas", "Conferir colunas", "Revisar produtos", "Importar"].map((s, i) => (
          <span
            key={s}
            className={
              (!batch ? 0 : mapping ? 1 : batch.state === "preview" ? 2 : 3) === i ? "current" : ""
            }
          >
            <b>{i + 1}</b>
            {s}
          </span>
        ))}
      </div>
      {error && (
        <div role="alert">
          <ErrorBox message={error} />
        </div>
      )}
      {!batch && (
        <>
          <div className="panel import-card">
            <h2>De onde vêm seus produtos?</h2>
            <div className="import-sources">
              {Object.entries(sourceNames).map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={source === value}
                  onClick={() => setSource(value)}
                  className={source === value ? "selected" : ""}
                >
                  <Package size={19} />
                  {label}
                </button>
              ))}
            </div>
            <Field
              label="Nome da sua loja na plataforma de origem"
              value={account}
              maxLength={80}
              onChange={(e: any) => setAccount(e.target.value)}
            />
            <p className="small muted">
              Use sempre o mesmo nome para essa conta. Isso permite reconhecer produtos já
              importados. Importe cada conta e plataforma em um lote separado.
            </p>
            <div className="import-help">
              <Files size={23} />
              <div>
                <strong>
                  {source === "shopee"
                    ? "Envie as planilhas que se completam"
                    : source === "mercadolivre"
                      ? "Exporte seus anúncios em Excel"
                      : "Exporte seu catálogo de produtos"}
                </strong>
                <p>
                  {source === "shopee"
                    ? "Na Central do Vendedor, procure Meus produtos → Ferramentas em massa → Atualização em massa. Baixe informações básicas e de vendas; inclua mídia se essa opção estiver disponível. Selecione os arquivos juntos. Os nomes podem variar na sua conta."
                    : source === "mercadolivre"
                      ? "Na lista de anúncios, use Modificar com Excel → Baixar planilha. Inclua título, descrição, SKU, preço e estoque. Se os dados estiverem em arquivos separados, envie-os juntos com o mesmo ID do anúncio."
                      : source === "shopify"
                        ? "Em Produtos → Exportar, baixe o CSV. Se o estoque estiver em outro arquivo, inclua-o com os mesmos identificadores e quantidades disponíveis."
                        : source === "woocommerce"
                          ? "Em Produtos → Todos os produtos → Exportar, gere o CSV com produtos, variações, IDs, SKU, preço, estoque, descrição e imagens."
                          : "Envie um CSV/XLSX do seu sistema ou use o modelo Mercaz. Você pode escolher manualmente a coluna de cada informação."}
                </p>
              </div>
            </div>
            <label className="import-drop">
              <Upload size={32} />
              <strong>Selecione suas planilhas</strong>
              <span>XLSX ou CSV · até 6 arquivos · 5 MB por arquivo · 20 MB no total</span>
              <input
                type="file"
                multiple
                accept=".xlsx,.csv"
                aria-label="Selecionar planilhas de produtos"
                onChange={(e) => setFiles(Array.from(e.target.files || []))}
              />
            </label>
            {files.length > 0 && (
              <ul className="import-file-list">
                {files.map((f, i) => (
                  <li key={i}>
                    <Files size={16} />
                    {f.name}
                    <span>{(f.size / 1024).toFixed(0)} KB</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="small muted">
              Até 2.000 anúncios por lote. Arquivos XLS antigos devem ser salvos como XLSX. Exporte
              fórmulas como valores.
            </p>
            <button
              className="btn"
              disabled={busy || !files.length || !account.trim()}
              onClick={() =>
                action(async () => {
                  if (
                    files.length > 6 ||
                    files.some((f) => f.size > 5 * 1024 * 1024) ||
                    files.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024
                  )
                    throw Error("Selecione até 6 arquivos, com até 5 MB cada e 20 MB no total.");
                  const fd = new FormData();
                  fd.append("source", source);
                  fd.append("account", account);
                  files.forEach((f) => fd.append("files", f));
                  const b = await api("/imports", "POST", fd);
                  load(b);
                  setShowMapping(true);
                  historyLoad();
                })
              }
            >
              {busy ? "Lendo planilhas…" : "Analisar arquivos"}
              <ArrowRight size={17} />
            </button>
          </div>
          <p className="import-note">
            A importação acontece a partir dos arquivos enviados. Preços, pedidos, frete e estoque
            nas outras plataformas não são sincronizados continuamente. Variações serão anúncios
            individuais, com preço e estoque próprios.
          </p>
        </>
      )}
      {mapping && (
        <div className="panel import-card">
          <h2>Confira as colunas de cada aba</h2>
          <p className="muted">
            Abas de instruções podem ser desmarcadas. Para combinar arquivos, mapeie o mesmo ID do
            produto em todos eles e o ID/SKU de cada variação quando existir.
          </p>
          {sheets.map((s) => (
            <details className="import-sheet" key={s.key} open={sheets.length === 1}>
              <summary>
                {s.filename} · {s.name} <span>{s.count} linhas</span>
              </summary>
              <label className="import-check">
                <input
                  type="checkbox"
                  checked={s.enabled}
                  onChange={(e) => changeSheet(s.key, (v) => ({ ...v, enabled: e.target.checked }))}
                />
                Incluir esta aba
              </label>
              {s.enabled && (
                <>
                  <Field
                    label="Linha que contém os nomes das colunas"
                    type="number"
                    min={1}
                    max={Math.min(25, s.count)}
                    value={s.header + 1}
                    onChange={(e: any) =>
                      changeSheet(s.key, (v) => ({
                        ...v,
                        header: Number(e.target.value) - 1,
                        mapping: {},
                      }))
                    }
                  />
                  <div className="import-scroll">
                    <table>
                      <thead>
                        <tr>
                          {(s.sample[s.header] || []).map((h: string, i: number) => (
                            <th key={i}>{h || `Coluna ${i + 1}`}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {s.sample
                          .slice(s.header + 1, s.header + 3)
                          .map((r: string[], i: number) => (
                            <tr key={i}>
                              {r.map((v, j) => (
                                <td key={j}>{v.slice(0, 100)}</td>
                              ))}
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="import-map">
                    {Object.entries(fieldNames).map(([field, label]) => (
                      <Field label={label} key={field}>
                        <select
                          value={s.mapping[field] ?? ""}
                          onChange={(e) =>
                            changeSheet(s.key, (v) => {
                              const mapping = { ...v.mapping };
                              if (e.target.value === "") delete mapping[field];
                              else mapping[field] = Number(e.target.value);
                              return { ...v, mapping };
                            })
                          }
                        >
                          <option value="">Não importar / ausente</option>
                          {(s.sample[s.header] || []).map((h: string, i: number) => (
                            <option key={i} value={i}>
                              {i + 1}. {h || "Sem nome"}
                            </option>
                          ))}
                        </select>
                      </Field>
                    ))}
                  </div>
                </>
              )}
            </details>
          ))}
          <div className="import-map">
            <Field label="Categoria Mercaz para categorias ainda não mapeadas">
              <select value={defaultCategory} onChange={(e) => setDefaultCategory(e.target.value)}>
                <option value="">Escolher na revisão</option>
                {categories.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
            </Field>
            {sourceCategories.map((c) => (
              <Field label={"Categoria de origem: " + c} key={c}>
                <select
                  value={categoryMap[c] || ""}
                  onChange={(e) => setCategoryMap((m) => ({ ...m, [c]: e.target.value }))}
                >
                  <option value="">Usar categoria padrão</option>
                  {categories.map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
            ))}
          </div>
          <label className="import-check">
            <input
              type="checkbox"
              checked={publish}
              onChange={(e) => setPublish(e.target.checked)}
            />
            Publicar automaticamente os produtos completos e sem avisos
          </label>
          <p className="small muted">
            Com esta opção desmarcada, todos entram como rascunho. Produtos com avisos ou falhas no
            download das fotos sempre ficam em rascunho. Produtos com erros não são criados.
          </p>
          <button
            className="btn"
            disabled={busy}
            onClick={() =>
              action(async () => {
                const b = await api("/imports/" + batch.id + "/preview", "POST", {
                  sheets: sheets.map(({ key, header, mapping, enabled }) => ({
                    key,
                    header,
                    mapping,
                    enabled,
                  })),
                  defaultCategory,
                  categories: categoryMap,
                  publish,
                });
                setBatch(b);
                setShowMapping(false);
                setPage(0);
              })
            }
          >
            {busy ? "Preparando…" : "Gerar prévia"}
            <ArrowRight size={17} />
          </button>
        </div>
      )}
      {batch && !mapping && (
        <div className="panel import-card">
          <div className="import-top">
            <div>
              <h2>{states[batch.state]}</h2>
              <p>
                {sourceNames[batch.source]} · {batch.account}
              </p>
            </div>
            {batch.state === "preview" && (
              <button className="btn secondary" onClick={() => setShowMapping(true)}>
                Ajustar colunas e categorias
              </button>
            )}
          </div>
          <div className="import-metrics">
            <div>
              <strong>{batch.total}</strong>
              <span>Anúncios no lote</span>
            </div>
            <div>
              <strong>{batch.ready}</strong>
              <span>Sem erros de dados</span>
            </div>
            <div>
              <strong>{batch.createdCount}</strong>
              <span>Criados</span>
            </div>
            <div>
              <strong>{batch.skippedCount}</strong>
              <span>Já existentes</span>
            </div>
          </div>
          {processing && (
            <div role="status" aria-live="polite">
              <progress max={Math.max(1, batch.total)} value={batch.cursor} />
              <p>
                {batch.cursor} de {batch.total} processados. Você pode sair desta página e
                acompanhar pelo histórico.
              </p>
            </div>
          )}
          {batch.state === "preview" && (
            <div className="import-help">
              <AlertTriangle size={22} />
              <p>
                Confira os preços e as quantidades. Importações repetidas da mesma origem/conta
                preservam os anúncios existentes. Produtos com erros serão ignorados; revise os
                avisos antes de vender.
              </p>
            </div>
          )}
          <div className="import-scroll">
            <table>
              <thead>
                <tr>
                  <th>Produto / SKU</th>
                  <th>Preço</th>
                  <th>Estoque</th>
                  <th>Categoria / resultado</th>
                  <th>Observações</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(page * 25, (page + 1) * 25).map((r: any, i: number) => {
                  const original = batch.items.find((v: any) => v.key === r.key) || r;
                  return (
                    <tr key={i}>
                      <td>
                        <strong>{r.title || "Sem título"}</strong>
                        <small>{original.sku || original.externalId}</small>
                        {r.productId && (
                          <a href={"/vendedor/anuncio/" + r.productId}>
                            Abrir anúncio #{r.productId}
                          </a>
                        )}
                      </td>
                      <td>{original.price === null ? "—" : money(original.price)}</td>
                      <td>{original.stock ?? "—"}</td>
                      <td>
                        {r.state
                          ? (
                              {
                                created: "Criado",
                                skipped: "Já existente",
                                error: "Não importado",
                              } as any
                            )[r.state]
                          : original.category || "Escolher categoria"}
                      </td>
                      <td>
                        {[r.message, ...(r.errors || []), ...(r.warnings || [])]
                          .filter(Boolean)
                          .map((m: string, j: number) => (
                            <p key={j}>{m}</p>
                          ))}
                        <small>{r.where?.join(" · ")}</small>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="import-pagination">
            <button
              className="btn secondary"
              disabled={!page}
              onClick={() => setPage((p) => p - 1)}
            >
              Anterior
            </button>
            <span>
              Página {page + 1} de {Math.max(1, Math.ceil(rows.length / 25))}
            </span>
            <button
              className="btn secondary"
              disabled={(page + 1) * 25 >= rows.length}
              onClick={() => setPage((p) => p + 1)}
            >
              Próxima
            </button>
          </div>
          <div className="import-actions">
            {batch.state === "preview" && (
              <button
                className="btn"
                disabled={busy || !batch.ready}
                onClick={() =>
                  action(async () => {
                    setBatch(
                      await api("/imports/" + batch.id + "/start", "POST", { accept: true }),
                    );
                    setPage(0);
                    historyLoad();
                  })
                }
              >
                <Check size={17} />
                {busy ? "Iniciando…" : `Confirmar importação de ${batch.ready} anúncios`}
              </button>
            )}
            {!!batch.items.length && (
              <a className="btn secondary" href={"/api/imports/" + batch.id + "/report"}>
                <Download size={16} />
                Baixar relatório CSV
              </a>
            )}
            <button
              className="btn secondary"
              onClick={() => {
                setBatch(null);
                setFiles([]);
                historyLoad();
              }}
            >
              Voltar ao início
            </button>
          </div>
        </div>
      )}
      {batch && !["done", "cancelled"].includes(batch.state) && (
        <button
          className="import-cancel"
          disabled={busy}
          onClick={() =>
            action(async () => {
              await api("/imports/" + batch.id + "/cancel", "POST");
              load(await api("/imports/" + batch.id));
              historyLoad();
            })
          }
        >
          Cancelar restante do lote (produtos já criados serão mantidos)
        </button>
      )}
      <div className="panel import-card">
        <h2>Histórico de importações</h2>
        {!history.length ? (
          <p className="muted">Suas importações aparecerão aqui.</p>
        ) : (
          <div className="import-scroll">
            <table>
              <thead>
                <tr>
                  <th>Origem</th>
                  <th>Conta</th>
                  <th>Estado</th>
                  <th>Processados</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{sourceNames[h.source]}</td>
                    <td>{h.account}</td>
                    <td>{states[h.state]}</td>
                    <td>{h.cursor}</td>
                    <td>
                      <button
                        className="more"
                        disabled={busy}
                        onClick={() => action(async () => load(await api("/imports/" + h.id)))}
                      >
                        Abrir
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
