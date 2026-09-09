import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Scale,
  ShieldCheck,
  Truck,
  Store,
  Armchair,
  Headphones,
  Shirt,
  Sparkles,
  Utensils,
  Dumbbell,
  LayoutGrid,
  Play,
  Heart,
  ThumbsUp,
  Flag,
  Search,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useApp,
  useData,
  api,
  go,
  money,
  date,
  Grid,
  Heading,
  Pick,
  Loading,
  ErrorBox,
  EmptyState,
  Stars,
  Quantity,
  Modal,
  ActionForm,
  Field,
  ProductCard,
} from './shared';
export const cats = [
  ['Casa e decoração', Armchair],
  ['Tecnologia', Headphones],
  ['Moda e acessórios', Shirt],
  ['Beleza', Sparkles],
  ['Cozinha', Utensils],
  ['Esporte', Dumbbell],
  ['Ver tudo', LayoutGrid],
] as const;
export const contexts = [
  ['Minha casa, do meu jeito', 'Casa e decoração', 47],
  ['Um upgrade na rotina', 'Tecnologia', 101],
  ['Mais sabor no dia a dia', 'Cozinha', 65],
  ['Quero começar algo novo', 'Esporte', 152],
  ['Quero surpreender alguém', 'Moda e acessórios', 175],
  ['Um tempo para cuidar de mim', 'Beleza', 6],
] as const;
export function Categories() {
  return (
    <div className="categories">
      {cats.map(([n, I]) => (
        <a
          className="category"
          href={
            '/busca' +
            (n === 'Ver tudo' ? '' : '?categoria=' + encodeURIComponent(n))
          }
          key={n}
        >
          <span>
            <I />
          </span>
          {n}
        </a>
      ))}
    </div>
  );
}
export function Contexts({ all = false }: any) {
  return (
    <div className="contextgrid">
      {contexts.slice(0, all ? 6 : 3).map(([n, c, id]) => (
        <a
          className="context"
          key={n}
          href={'/descobrir?contexto=' + encodeURIComponent(c)}
        >
          <div className="eyebrow">Descubra possibilidades</div>
          <h3>{n}</h3>
          <span className="more">
            Quero explorar <ArrowRight size={15} />
          </span>
          <img src={'/assets/product-' + id + '.webp'} alt="" loading="lazy" />
        </a>
      ))}
    </div>
  );
}
export function Home() {
  const { data } = useApp();
  const featured = [101, 47, 14, 65]
    .map((id) => data.products.find((p: any) => p.id === id))
    .filter(Boolean);
  return (
    <>
      <div className="hero">
        <div className="hero-main">
          <div className="hero-copy">
            <div className="eyebrow">
              Pequenas escolhas. Novas possibilidades.
            </div>
            <h1>
              Sua casa, mais
              <br />
              do seu jeito.
            </h1>
            <p>
              Encontre detalhes que fazem a diferença.
              <br />
              Conheça quem faz acontecer.
            </p>
            <a
              className="btn"
              href={
                '/busca?categoria=' + encodeURIComponent('Casa e decoração')
              }
            >
              Encontre seu próximo achado <ArrowRight size={16} />
            </a>
          </div>
          <img
            src="/assets/product-14.webp"
            alt="Cadeira de design do catálogo Mercaz"
          />
        </div>
        <div className="hero-side">
          <Scale className="watermark" />
          <div className="eyebrow">É bom para os dois lados</div>
          <h2>
            Quem vende cresce.
            <br />
            Quem compra ganha.
          </h2>
          <p>Um marketplace com escolhas melhores e regras mais claras.</p>
          <a className="btn" href="/sobre">
            Conheça a Mercaz <ArrowRight size={16} />
          </a>
        </div>
      </div>
      <div className="benefits">
        <span>
          <ShieldCheck />
          Informação para comprar com confiança
        </span>
        <span>
          <Store />
          Lojas com identidade própria
        </span>
        <span>
          <Scale />
          Visibilidade sem leilão de anúncios
        </span>
        <span>
          <Truck />
          Preparo e entrega às claras
        </span>
      </div>
      <section className="section">
        <div className="sectionhead">
          <h2>Por onde vamos começar?</h2>
        </div>
        <Categories />
      </section>
      <section className="section">
        <div className="sectionhead">
          <div>
            <h2>Achados para o seu dia</h2>
            <p>Boas escolhas, de lojas que você vai gostar de conhecer.</p>
          </div>
          <a className="more" href="/busca">
            Explorar produtos <ArrowRight size={16} />
          </a>
        </div>
        <Grid items={featured.length ? featured : data.products.slice(0, 4)} />
      </section>
      <section className="section">
        <div className="sectionhead">
          <div>
            <div className="eyebrow">Não precisa saber o que procura</div>
            <h2>O que você quer mudar hoje?</h2>
          </div>
          <a className="more" href="/descobrir">
            Ir para Descobrir <ArrowRight size={16} />
          </a>
        </div>
        <Contexts />
      </section>
      <section className="section">
        <div className="sectionhead">
          <div>
            <h2>Na vida real</h2>
            <p>
              Experiências de quem comprou. Espaço para os pontos positivos e as
              limitações.
            </p>
          </div>
          <a className="more" href="/descobrir#experiencias">
            Ver experiências <ArrowRight size={16} />
          </a>
        </div>
        <ReviewFeed limit={3} />
      </section>
      <section className="section">
        <div className="sectionhead">
          <h2>Lojas para conhecer</h2>
          <a className="more" href="/lojas">
            Todas as lojas <ArrowRight size={16} />
          </a>
        </div>
        <div className="storegrid">
          {data.stores
            .filter((s: any) => !s.paused)
            .slice(0, 4)
            .map((s: any) => (
              <StoreCard key={s.id} s={s} />
            ))}
        </div>
      </section>
      {data.config.seedDemo && (
        <p className="demo-note">
          Catálogo de demonstração · produtos, preços e lojas ilustrativos.
        </p>
      )}
    </>
  );
}
export function SearchPage() {
  const { data } = useApp();
  const params = new URLSearchParams(location.search);
  const [category, setCategory] = useState(params.get('categoria') || 'Todas'),
    [sort, setSort] = useState('Relevância'),
    [max, setMax] = useState(''),
    [stock, setStock] = useState(false);
  const q = params.get('q') || '';
  const norm = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
  const result = data.products.filter(
    (p: any) =>
      norm(
        p.title + ' ' + p.store_name + ' ' + p.category + ' ' + p.description,
      ).includes(norm(q)) &&
      (category === 'Todas' || p.category === category) &&
      (!max || p.price <= Number(max) * 100) &&
      (!stock || p.stock > 0),
  );
  result.sort((a: any, b: any) =>
    sort === 'Menor preço'
      ? a.price - b.price
      : sort === 'Maior preço'
        ? b.price - a.price
        : sort === 'Melhor avaliação'
          ? b.rating - a.rating
          : (b.stock > 0 ? 1 : 0) - (a.stock > 0 ? 1 : 0) ||
            b.rating - a.rating ||
            a.title.localeCompare(b.title),
  );
  return (
    <>
      <div className="breadcrumb">
        <a href="/">Início</a> / {category === 'Todas' ? 'Produtos' : category}
      </div>
      <Heading
        title={
          q
            ? `Resultados para “${q}”`
            : category === 'Todas'
              ? 'Encontre seu próximo achado'
              : category
        }
        sub={`${result.length} produtos · resultados orgânicos, sem posições compradas`}
      />
      <div className="filterbar">
        <Pick
          label="Categoria"
          value={category}
          onChange={setCategory}
          options={['Todas', ...data.categories]}
        />
        <Field
          label="Preço máximo (R$)"
          type="number"
          min="0"
          placeholder="Sem limite"
          value={max}
          onChange={(e: any) => setMax(e.target.value)}
        />
        <Pick
          label="Disponibilidade"
          value={stock ? 'Em estoque' : 'Todos'}
          onChange={(v: string) => setStock(v === 'Em estoque')}
          options={['Todos', 'Em estoque']}
        />
        <Pick
          label="Ordenar por"
          value={sort}
          onChange={setSort}
          options={[
            'Relevância',
            'Menor preço',
            'Maior preço',
            'Melhor avaliação',
          ]}
        />
        <button
          className="btn secondary"
          onClick={() => {
            setCategory('Todas');
            setMax('');
            setStock(false);
            setSort('Relevância');
          }}
        >
          Limpar
        </button>
      </div>
      <Grid items={result} />
    </>
  );
}
export function StoreCard({ s }: any) {
  return (
    <a className="storecard" href={'/loja/' + s.id}>
      <div className="avatar">
        {s.name
          .split(' ')
          .map((x: string) => x[0])
          .slice(0, 2)
          .join('')}
      </div>
      <h3>{s.name}</h3>
      <p>Preparo em até {s.prep_days} dias</p>
      <span className="more">
        Conhecer a loja <ArrowRight size={15} />
      </span>
    </a>
  );
}
export function Stores() {
  const { data } = useApp();
  return (
    <>
      <Heading
        title="Lojas com histórias próprias"
        sub="Conheça quem está por trás dos seus próximos achados."
      />
      <div className="storegrid">
        {data.stores.map((s: any) => (
          <StoreCard key={s.id} s={s} />
        ))}
      </div>
    </>
  );
}
export function Shop({ id }: any) {
  const app = useApp(),
    s = app.data.stores.find((s: any) => s.id === Number(id));
  const saved = app.data.favorites.some(
    (f: any) => f.kind === 'store' && f.item_id === Number(id),
  );
  if (!s) return <EmptyState title="Loja não encontrada" />;
  return (
    <>
      <div className="shophero">
        <div className="avatar big">{s.name.slice(0, 2)}</div>
        <div>
          <div className="eyebrow">Conheça quem faz acontecer</div>
          <h1>{s.name}</h1>
          <p>{s.description}</p>
          <div className="inline">
            <span className="label">Preparo: até {s.prep_days} dias</span>
            <span className="label">{s.days}</span>
            {s.paused && <span className="label">Loja em pausa</span>}
          </div>
        </div>
        <button
          className="btn secondary"
          onClick={() => app.favorite('store', s.id)}
        >
          <Heart size={17} fill={saved ? 'currentColor' : 'none'} />
          {saved ? 'Loja salva' : 'Salvar loja'}
        </button>
      </div>
      <section className="section">
        <Heading
          title="O catálogo da loja"
          sub={`Frete ${money(s.shipping)} por pedido · transporte estimado em ${s.shipping_days} dias corridos`}
        />
        <Grid
          items={app.data.products.filter((p: any) => p.store_id === s.id)}
        />
      </section>
      <section className="section">
        <h2>Experiências dos compradores</h2>
        <ReviewFeed storeId={s.id} />
      </section>
    </>
  );
}
export function Product({ id }: any) {
  const { data: p, error, reload } = useData('/products/' + id),
    app = useApp();
  const [image, setImage] = useState(0),
    [variant, setVariant] = useState(''),
    [qty, setQty] = useState(1),
    [zip, setZip] = useState(''),
    [estimate, setEstimate] = useState(false);
  useEffect(() => {
    api('/products/' + id + '/view', 'POST').catch(() => {});
  }, [id]);
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!p) return <Loading />;
  const selected = variant || p.variants[0],
    related = app.data.products
      .filter((x: any) => x.category === p.category && x.id !== p.id)
      .slice(0, 4);
  function add(buy = false) {
    app.addCart(p, qty, selected);
    if (buy) go('/carrinho');
  }
  return (
    <>
      <div className="breadcrumb">
        <a href="/">Início</a> /{' '}
        <a href={'/busca?categoria=' + encodeURIComponent(p.category)}>
          {p.category}
        </a>{' '}
        / {p.title}
      </div>
      <div className="productdetail">
        <div>
          <div className="gallery">
            <img src={p.images[image] || p.images[0]} alt={p.title} />
          </div>
          <div className="thumbs">
            {p.images.map((u: string, i: number) => (
              <button
                key={u}
                aria-label={'Ver foto ' + (i + 1)}
                className={i === image ? 'selected' : ''}
                onClick={() => setImage(i)}
              >
                <img src={u} alt="" />
              </button>
            ))}
          </div>
        </div>
        <div className="buybox">
          <div className="eyebrow">{p.category}</div>
          <h1>{p.title}</h1>
          <div className="inline">
            <Stars value={p.rating} count={p.review_count} />
            <a className="more" href={'/loja/' + p.store_id}>
              Vendido por {p.store_name}
            </a>
          </div>
          <div className="bigprice">{money(p.price)}</div>
          <p className="muted">
            Pagamento com Pix · custo total antes de pagar
          </p>
          <Pick
            label="Variação"
            value={selected}
            onChange={setVariant}
            options={p.variants}
          />
          <div className="inline">
            <Quantity
              value={qty}
              max={Math.min(p.stock, 99)}
              onChange={setQty}
            />
            <span className="muted">{p.stock} disponíveis</span>
            <button
              className="iconbtn"
              aria-label="Salvar produto"
              onClick={() => app.favorite('product', p.id)}
            >
              <Heart />
            </button>
          </div>
          <div className="deliverybox">
            <Truck size={21} />
            <div>
              <strong>
                {p.shipping === 0
                  ? 'Frete grátis'
                  : 'Frete ' + money(p.shipping)}
              </strong>
              <p>
                Preparo até {p.prep_days} dias + transporte estimado em{' '}
                {p.shipping_days} dias corridos.
              </p>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  setEstimate(true);
                }}
                className="inline"
              >
                <input
                  aria-label="CEP de entrega"
                  placeholder="Seu CEP"
                  value={zip}
                  pattern="[0-9]{5}-?[0-9]{3}"
                  required
                  onChange={(e) => {
                    setZip(e.target.value);
                    setEstimate(false);
                  }}
                />
                <button className="more">Consultar</button>
              </form>
              {estimate && (
                <p className="success">
                  Entrega estimada em até {p.prep_days + p.shipping_days} dias
                  corridos após pagamento. Frete fixo da loja para o Brasil.
                </p>
              )}
            </div>
          </div>
          <button
            className="btn full"
            disabled={!p.stock || p.paused}
            onClick={() => add(true)}
          >
            Comprar agora <ArrowRight size={17} />
          </button>
          <button
            className="btn secondary full"
            disabled={!p.stock || p.paused}
            onClick={() => add()}
          >
            Adicionar ao carrinho
          </button>
          <p className="small muted">
            <ShieldCheck size={15} /> Problemas com a compra? Acompanhe a
            solicitação pelo suporte do pedido.
          </p>
        </div>
      </div>
      <section className="section">
        <Tabs defaultValue="description">
          <TabsList className="producttabs">
            <TabsTrigger value="description">Sobre o produto</TabsTrigger>
            <TabsTrigger value="questions">
              Perguntas ({p.questions.length})
            </TabsTrigger>
            <TabsTrigger value="reviews">
              Avaliações ({p.reviews.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="description">
            <div className="panel prose">
              <h2>Os detalhes fazem a diferença</h2>
              <p className="preline">{p.description}</p>
              <div className="specgrid">
                <span>
                  Categoria<strong>{p.category}</strong>
                </span>
                <span>
                  Variações<strong>{p.variants.join(', ')}</strong>
                </span>
                <span>
                  Vendido por<strong>{p.store_name}</strong>
                </span>
                <span>
                  Prazo de preparo
                  <strong>Até {p.prep_days} dias corridos</strong>
                </span>
              </div>
              <a className="more" href="/politicas/devolucoes">
                Condições de devolução e atendimento <ArrowRight size={15} />
              </a>
            </div>
          </TabsContent>
          <TabsContent value="questions">
            <div className="panel stack">
              <h2>Tire suas dúvidas antes de comprar</h2>
              {p.questions.map((q: any) => (
                <div className="question" key={q.id}>
                  <p>
                    <strong>{q.name}:</strong> {q.question}
                  </p>
                  <p className="muted">
                    {q.answer || 'Aguardando resposta da loja.'}
                  </p>
                </div>
              ))}
              {app.data.user ? (
                <ActionForm
                  button="Enviar pergunta"
                  onSubmit={async (f: FormData) => {
                    await api('/questions', 'POST', {
                      product_id: p.id,
                      question: f.get('question'),
                    });
                    reload();
                  }}
                >
                  <Field label="Sua pergunta">
                    <textarea
                      name="question"
                      minLength={5}
                      maxLength={1000}
                      required
                      placeholder="Pergunte sobre material, medidas, uso…"
                    />
                  </Field>
                </ActionForm>
              ) : (
                <a className="btn secondary" href="/entrar">
                  Entre para perguntar
                </a>
              )}
            </div>
          </TabsContent>
          <TabsContent value="reviews">
            <div className="panel">
              <ReviewList items={p.reviews} reload={reload} />
            </div>
          </TabsContent>
        </Tabs>
      </section>
      {related.length > 0 && (
        <section className="section">
          <div className="sectionhead">
            <h2>Outras boas possibilidades</h2>
          </div>
          <Grid items={related} />
        </section>
      )}
    </>
  );
}
export function ReviewList({ items, reload }: any) {
  const [report, setReport] = useState<any>(null),
    app = useApp();
  return (
    <>
      {!items.length ? (
        <EmptyState
          title="As primeiras experiências começam aqui"
          text="Quem receber este produto poderá compartilhar uma avaliação, fotos ou um vídeo."
          href=""
        />
      ) : (
        <div className="reviewgrid">
          {items.map((r: any) => (
            <article className="review" key={r.id}>
              <div className="inline">
                <div className="avatar">{r.name[0]}</div>
                <div>
                  <strong>{r.name}</strong>
                  <p className="small success">
                    <ShieldCheck size={13} /> Compra verificada
                  </p>
                </div>
                <Stars value={r.rating} />
              </div>
              <p>{r.text}</p>
              {r.context && <span className="label">{r.context}</span>}
              <div className="reviewmedia">
                {r.media.map((u: string) =>
                  /\.(mp4|webm)$/.test(u) ? (
                    <video
                      key={u}
                      src={u}
                      controls
                      preload="metadata"
                      playsInline
                    />
                  ) : (
                    <a key={u} href={u} target="_blank" rel="noreferrer">
                      <img
                        src={u}
                        alt="Foto enviada pelo comprador"
                        loading="lazy"
                      />
                    </a>
                  ),
                )}
              </div>
              <a className="more" href={'/produto/' + r.product_id}>
                {r.product_title || 'Ver produto'}
                <ArrowRight size={14} />
              </a>
              <div className="inline">
                <button
                  className="btn ghost"
                  onClick={() =>
                    app.act(async () => {
                      await api('/reviews/' + r.id + '/helpful', 'POST');
                      reload?.();
                    }, 'Reação atualizada.')
                  }
                >
                  <ThumbsUp size={15} /> Ajudou minha decisão ({r.helpful || 0})
                </button>
                <button
                  className="iconbtn"
                  aria-label="Denunciar avaliação"
                  onClick={() => setReport(r)}
                >
                  <Flag size={15} />
                </button>
              </div>
              <span className="small muted">{date(r.created)}</span>
            </article>
          ))}
        </div>
      )}
      <Modal
        open={!!report}
        onClose={() => setReport(null)}
        title="Denunciar conteúdo"
        description="A moderação analisará o conteúdo. Opiniões negativas, por si só, não são motivo de remoção."
      >
        <ActionForm
          button="Enviar denúncia"
          onSubmit={async (f: FormData) => {
            await api('/reviews/' + report.id + '/report', 'POST', {
              reason: f.get('reason'),
            });
            setReport(null);
            app.flash('Denúncia enviada para análise.');
          }}
        >
          <Field label="O que precisa ser analisado?">
            <textarea name="reason" required minLength={5} maxLength={1000} />
          </Field>
        </ActionForm>
      </Modal>
    </>
  );
}
export function ReviewFeed({ limit, storeId }: any) {
  const { data, error, reload } = useData('/reviews');
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!data) return <Loading />;
  let list = storeId ? data.filter((r: any) => r.store_id === storeId) : data;
  if (limit) list = list.slice(0, limit);
  return <ReviewList items={list} reload={reload} />;
}
export function Discover() {
  const { data } = useApp();
  const [context, setContext] = useState(
    new URLSearchParams(location.search).get('contexto') || 'Todas',
  );
  const products = data.products.filter(
    (p: any) => context === 'Todas' || p.category === context,
  );
  return (
    <>
      <Heading
        title="Deixe a curiosidade escolher."
        sub="Produtos para o que você quer sentir, fazer ou transformar."
      />
      <Contexts all />
      <div className="section">
        <div className="sectionhead">
          <h2>Encontre novas possibilidades</h2>
          <Pick
            label="Seu momento"
            value={context}
            onChange={setContext}
            options={['Todas', ...data.categories]}
          />
        </div>
        <button
          className="btn secondary mb-5"
          onClick={() => {
            if (products.length)
              go(
                '/produto/' +
                  products[Math.floor(Math.random() * products.length)].id,
              );
          }}
        >
          Me surpreenda <Sparkles size={16} />
        </button>
        <Grid items={products} />
      </div>
      <section className="section" id="experiencias">
        <Heading
          title="Na vida real"
          sub="Conteúdo de compradores vinculados a pedidos entregues."
        />
        <ReviewFeed />
      </section>
    </>
  );
}
