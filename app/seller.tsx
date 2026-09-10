import React, { useState } from 'react';
import {
  ArrowRight,
  Store,
  Package,
  Plus,
  ChartNoAxesCombined,
  Wallet,
  Settings,
  Boxes,
  Star,
  Video,
  LayoutDashboard,
  Sparkles,
  TriangleAlert,
  Check,
  ExternalLink,
  Download,
  MessageCircle,
} from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
} from '@/components/ui/sidebar';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  useApp,
  useData,
  api,
  go,
  money,
  date,
  statuses,
  Heading,
  Field,
  Pick,
  ActionForm,
  EmptyState,
  ErrorBox,
  Loading,
  Modal,
  UploadField,
} from './shared';
import { NeedAuth } from './buyer';
import { ReviewList } from './catalog';
import { ImportProducts } from './import-products';
export function SellLanding() {
  const app = useApp();
  return (
    <>
      <div className="sellerhero">
        <div>
          <div className="eyebrow">
            Seu produto. Seu preço. Seu crescimento.
          </div>
          <h1>
            A sua próxima venda
            <br />
            pode ser mais justa.
          </h1>
          <p>
            Um espaço para construir sua loja, entender seus resultados e
            crescer com autonomia.
          </p>
          <a
            className="btn"
            href={app.data.user?.seller ? '/vendedor' : '/vender/cadastro'}
          >
            {app.data.user?.seller ? 'Ir para minha loja' : 'Criar minha loja'}
            <ArrowRight size={17} />
          </a>
        </div>
        <img src="/assets/brand.png" alt="Mercaz" />
      </div>
      <div className="benefitcards section">
        {[
          [
            Store,
            'Sua loja, sua identidade',
            'Organize catálogo, preços e promessa de preparo.',
          ],
          [
            Sparkles,
            'Ajuda para anunciar melhor',
            'Revise sugestões para títulos, descrições e informações úteis.',
          ],
          [
            Wallet,
            'Entenda o que você recebe',
            `Comissão Mercaz de ${(app.data.config.feeBps / 100).toFixed(2)}% sobre os produtos. A tarifa do Mercado Pago é cobrada separadamente pelo provedor.`,
          ],
          [
            ChartNoAxesCombined,
            'Resultados sem mistério',
            'Acompanhe pedidos, estoque e procura com dados da sua operação.',
          ],
        ].map(([I, t, p]: any) => (
          <div className="panel stack" key={t}>
            <I color="#74162d" />
            <h2>{t}</h2>
            <p className="muted">{p}</p>
          </div>
        ))}
      </div>
      <div className="panel section prose">
        <h2>Antes de começar</h2>
        <p>
          Você define preços, estoque, prazo de preparo e o frete fixo para o
          Brasil. O comprador vê essas condições antes de comprar. Após o
          pagamento, prepare o pedido e informe a transportadora e o rastreio.
        </p>
        <p>
          Para receber pagamentos reais, conecte a conta Mercado Pago da sua
          loja. Cada vendedor recebe por sua própria conta, com a comissão da
          Mercaz definida no pedido. Não há compra de posições na busca.
        </p>
        <a className="more" href="/politicas/vendedores">
          Conheça as regras para vender <ArrowRight size={16} />
        </a>
      </div>
    </>
  );
}
export function SellerSignup() {
  const app = useApp();
  if (!app.data.user) return <NeedAuth />;
  if (app.data.user.seller)
    return (
      <EmptyState
        title="Sua loja já está pronta para você"
        href="/vendedor"
        action="Abrir painel"
      />
    );
  return (
    <div className="narrow">
      <Heading
        title="Vamos dar espaço ao seu negócio"
        sub="Comece pela identidade da loja e uma promessa de entrega que você consegue cumprir."
      />
      <div className="panel">
        <ActionForm
          button="Criar minha loja"
          onSubmit={async (f: FormData) => {
            const d = Object.fromEntries(f);
            await api('/store', 'POST', {
              ...d,
              prep_days: Number(d.prep_days),
              shipping: Math.round(Number(d.shipping) * 100),
              shipping_days: Number(d.shipping_days),
            });
            await app.refresh();
            go('/vendedor');
          }}
        >
          <h2>01. Sua loja</h2>
          <Field
            label="Nome da loja"
            name="name"
            required
            minLength={2}
            maxLength={80}
          />
          <Field
            label="CPF ou CNPJ do responsável"
            name="document"
            required
            minLength={11}
            maxLength={18}
          />
          <Field label="Conte um pouco sobre o seu negócio">
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={1500}
            />
          </Field>
          <h2>02. Sua operação</h2>
          <div className="formgrid">
            <Field
              label="Preparo (dias corridos)"
              name="prep_days"
              type="number"
              min="0"
              max="30"
              required
              defaultValue="2"
            />
            <Field
              label="Transporte (dias corridos)"
              name="shipping_days"
              type="number"
              min="1"
              max="45"
              required
              defaultValue="5"
            />
            <Field
              label="Frete fixo nacional (R$)"
              name="shipping"
              type="number"
              min="0"
              max="1000"
              step="0.01"
              required
              defaultValue="19.90"
            />
          </div>
          <p className="small muted">
            Considere fins de semana no prazo informado. A taxa da Mercaz é de{' '}
            {app.data.config.feeBps / 100}% sobre os produtos. Leia as{' '}
            <a href="/politicas/vendedores">regras para vendedores</a>.
          </p>
        </ActionForm>
      </div>
    </div>
  );
}
const nav = [
  ['', 'Visão geral', LayoutDashboard],
  ['pedidos', 'Pedidos', Package],
  ['produtos', 'Produtos', Boxes],
  ['importar', 'Importar produtos', Download],
  ['anuncio', 'Criar anúncio', Plus],
  ['estoque', 'Estoque e demanda', ChartNoAxesCombined],
  ['desempenho', 'Desempenho', ChartNoAxesCombined],
  ['financeiro', 'Financeiro', Wallet],
  ['reputacao', 'Reputação e perguntas', Star],
  ['videos', 'Vídeos dos compradores', Video],
  ['suporte', 'Atendimentos', MessageCircle],
  ['configuracoes', 'Configurações', Settings],
] as const;
export function Seller({ section = '', id }: any) {
  const app = useApp();
  if (!app.data.user) return <NeedAuth />;
  if (!app.data.user.seller) return <SellerSignup />;
  return <SellerContent section={section} id={id} />;
}
function SellerContent({ section, id }: any) {
  const { data: d, error, reload } = useData('/seller');
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!d) return <Loading />;
  return (
    <SidebarProvider
      className="sellerlayout"
      style={{ '--sidebar-width': '230px' } as React.CSSProperties}
    >
      <Sidebar collapsible="none" className="selleraside">
        <SidebarContent>
          <div className="selleridentity">
            <div className="avatar">{d.store.name.slice(0, 2)}</div>
            <h3>{d.store.name}</h3>
            <span className="label">Área do vendedor</span>
          </div>
          <SidebarMenu>
            {nav.map(([slug, title, I]) => (
              <SidebarMenuItem key={slug}>
                <SidebarMenuButton
                  isActive={section === slug}
                  render={<a href={'/vendedor' + (slug ? '/' + slug : '')} />}
                  className="sellerlink"
                >
                  <I size={18} />
                  {title}
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
          <a className="more sellerback" href={'/loja/' + d.store.id}>
            Ver minha loja <ExternalLink size={15} />
          </a>
        </SidebarContent>
      </Sidebar>
      <div className="sellerbody">
        {section === '' ? (
          <Dashboard d={d} />
        ) : section === 'produtos' ? (
          <Products d={d} />
        ) : section === 'importar' ? (
          <ImportProducts />
        ) : section === 'anuncio' ? (
          <Listing d={d} id={id} reload={reload} />
        ) : section === 'pedidos' ? (
          <SellerOrders d={d} reload={reload} />
        ) : section === 'estoque' ? (
          <Inventory d={d} reload={reload} />
        ) : section === 'financeiro' ? (
          <Finance d={d} />
        ) : section === 'desempenho' ? (
          <Performance d={d} />
        ) : section === 'reputacao' ? (
          <Reputation d={d} reload={reload} />
        ) : section === 'videos' ? (
          <>
            <Heading
              title="Na vida real"
              sub="Vídeos vinculados aos produtos da sua loja."
            />
            <ReviewList
              items={d.reviews.filter((r: any) =>
                r.media.some((u: string) => /\.(mp4|webm)$/.test(u)),
              )}
              reload={reload}
            />
          </>
        ) : section === 'configuracoes' ? (
          <StoreSettings d={d} reload={reload} />
        ) : section === 'suporte' ? (
          <>
            <Heading
              title="Atendimentos"
              sub="Conversas para cuidar de cada compra."
            />
            <div className="stack">
              {d.tickets.map((t: any) => (
                <a
                  className="panel sumrow"
                  href={'/suporte/' + t.id}
                  key={t.id}
                >
                  <span>
                    #{t.id} · {t.type} ·{' '}
                    {t.status === 'open' ? 'Em atendimento' : 'Resolvido'}
                  </span>
                  <ArrowRight />
                </a>
              ))}
              {!d.tickets.length && (
                <EmptyState title="Nenhum atendimento pendente" href="" />
              )}
            </div>
          </>
        ) : (
          <EmptyState
            title="Página não encontrada"
            href="/vendedor"
            action="Visão geral"
          />
        )}
      </div>
    </SidebarProvider>
  );
}
const paid = (d: any) =>
  d.orders.filter(
    (o: any) => !['pending', 'cancelled', 'refunded'].includes(o.status),
  );
function Stats({ items }: any) {
  return (
    <div className="stats">
      {items.map(([label, value, sub]: any) => (
        <div className="panel stat" key={label}>
          <p>{label}</p>
          <strong>{value}</strong>
          {sub && <small>{sub}</small>}
        </div>
      ))}
    </div>
  );
}
function Dashboard({ d }: any) {
  const orders = paid(d),
    revenue = orders.reduce((s: number, o: any) => s + o.subtotal, 0),
    low = d.products.filter((p: any) => p.stock <= 5),
    pending = d.orders.filter((o: any) =>
      ['confirmed', 'preparing', 'ready'].includes(o.status),
    );
  return (
    <>
      <Heading
        title="Seu negócio, em movimento."
        sub="Comece pelo que merece sua atenção."
      >
        <a className="btn" href="/vendedor/anuncio">
          <Plus size={16} />
          Criar anúncio
        </a>
      </Heading>
      <Stats
        items={[
          ['Vendas em produtos', money(revenue), 'Desde a abertura'],
          ['Pedidos pagos', orders.length, 'Exclui cancelados e estornos'],
          ['Para preparar / enviar', pending.length, 'Acompanhe sua promessa'],
          ['Itens com estoque baixo', low.length, 'Até 5 unidades'],
        ]}
      />
      <div className="panel section stack">
        <h2>O que precisa de você</h2>
        {!d.store.mp_connected && (
          <a className="taskrow" href="/vendedor/configuracoes">
            <Wallet />
            <div>
              <h3>Conecte seu Mercado Pago</h3>
              <p>Prepare sua loja para receber pagamentos reais.</p>
            </div>
            <ArrowRight />
          </a>
        )}
        {pending.length > 0 && (
          <a className="taskrow" href="/vendedor/pedidos">
            <Package />
            <div>
              <h3>{pending.length} pedido(s) esperando o próximo passo</h3>
              <p>Confira o preparo e atualize seus compradores.</p>
            </div>
            <ArrowRight />
          </a>
        )}
        {low.length > 0 && (
          <a className="taskrow" href="/vendedor/estoque">
            <TriangleAlert />
            <div>
              <h3>{low.length} produto(s) com poucas unidades</h3>
              <p>Revise o estoque para manter seus anúncios disponíveis.</p>
            </div>
            <ArrowRight />
          </a>
        )}
        {!pending.length && !low.length && (
          <p className="muted">
            Sua operação está em dia. Aproveite para revisar seus anúncios.
          </p>
        )}
      </div>
      <div className="section panel stack">
        <div className="eyebrow">Orientação para crescer</div>
        <h2>Um anúncio mais claro vende com mais confiança.</h2>
        <p>
          Os compradores precisam entender medidas, material, uso e prazo.
          Revise seus produtos e use o assistente para organizar o que já sabe
          sobre eles.
        </p>
        <a className="more" href="/vendedor/produtos">
          Revisar meu catálogo <ArrowRight size={16} />
        </a>
      </div>
    </>
  );
}
function Products({ d }: any) {
  const [q, setQ] = useState('');
  const list = d.products.filter((p: any) =>
    p.title.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <Heading
        title="Seu catálogo"
        sub={`${d.products.length} produtos. Você controla preço, disponibilidade e apresentação.`}
      >
        <a className="btn secondary" href="/vendedor/importar"><Download size={16} />Importar produtos</a>
        <a className="btn" href="/vendedor/anuncio">
          <Plus size={16} />
          Novo anúncio
        </a>
      </Heading>
      <Field
        label="Buscar no catálogo"
        value={q}
        onChange={(e: any) => setQ(e.target.value)}
        placeholder="Nome do produto"
      />
      <div className="panel section">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Produto</TableHead>
              <TableHead>Preço</TableHead>
              <TableHead>Estoque</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Ação</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.map((p: any) => (
              <TableRow key={p.id}>
                <TableCell>
                  <div className="tableproduct">
                    <img src={p.images[0]} alt="" />
                    <span>{p.title}</span>
                  </div>
                </TableCell>
                <TableCell>{money(p.price)}</TableCell>
                <TableCell>{p.stock}</TableCell>
                <TableCell>
                  <span className="label">
                    {p.status === 'active'
                      ? 'Ativo'
                      : p.status === 'draft'
                        ? 'Rascunho'
                        : 'Pausado'}
                  </span>
                </TableCell>
                <TableCell>
                  <a className="more" href={'/vendedor/anuncio/' + p.id}>
                    Editar <ArrowRight size={14} />
                  </a>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {!list.length && (
          <EmptyState
            title="Seu próximo anúncio começa aqui"
            href="/vendedor/anuncio"
            action="Criar anúncio"
          />
        )}
      </div>
    </>
  );
}
function Listing({ d, id, reload }: any) {
  const app = useApp(),
    p = d.products.find((p: any) => p.id === Number(id));
  const [title, setTitle] = useState(p?.title || ''),
    [description, setDescription] = useState(p?.description || ''),
    [category, setCategory] = useState(p?.category || app.data.categories[0]),
    [images, setImages] = useState<string[]>(p?.images || []),
    [state, setState] = useState(p?.status || 'draft'),
    [suggestion, setSuggestion] = useState<any>(null),
    [price, setPrice] = useState(p ? p.price / 100 : 0),
    [cost, setCost] = useState(0),
    [busy, setBusy] = useState(false);
  if (id && !p)
    return (
      <EmptyState
        title="Anúncio não encontrado"
        href="/vendedor/produtos"
        action="Voltar ao catálogo"
      />
    );
  async function assist() {
    setBusy(true);
    await app.act(async () => {
      setSuggestion(
        await api('/seller/assistant', 'POST', { title, description }),
      );
    }, 'Sugestões prontas para sua revisão.');
    setBusy(false);
  }
  return (
    <>
      <Heading
        title={
          p
            ? 'Cuide dos detalhes do seu anúncio'
            : 'O próximo achado começa com você.'
        }
        sub="Informações claras ajudam o comprador a escolher com confiança."
      />
      <div className="listinglayout">
        <div className="panel">
          <ActionForm
            button={
              state === 'active'
                ? 'Salvar e publicar anúncio'
                : 'Salvar anúncio'
            }
            onSubmit={async (f: FormData) => {
              const b = {
                title,
                description,
                category,
                images,
                status: state,
                price: Math.round(price * 100),
                stock: Number(f.get('stock')),
                variants: String(f.get('variants'))
                  .split(',')
                  .map((s) => s.trim())
                  .filter(Boolean),
              };
              await api(
                '/products' + (p ? '/' + p.id : ''),
                p ? 'PUT' : 'POST',
                b,
              );
              await app.refresh();
              go('/vendedor/produtos');
            }}
          >
            <h2>01. Apresente seu produto</h2>
            <Field
              label="Título do anúncio"
              value={title}
              onChange={(e: any) => setTitle(e.target.value)}
              required
              minLength={5}
              maxLength={180}
            />
            <Pick
              label="Categoria"
              value={category}
              onChange={setCategory}
              options={app.data.categories}
            />
            <Field label="Descrição">
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
                minLength={20}
                maxLength={8000}
                rows={7}
                placeholder="Material, medidas, uso, itens inclusos, garantia…"
              />
            </Field>
            <h2>02. Mostre os detalhes</h2>
            <UploadField value={images} onChange={setImages} />
            <h2>03. Preço e disponibilidade</h2>
            <div className="formgrid">
              <Field
                label="Preço (R$)"
                type="number"
                value={price}
                onChange={(e: any) => setPrice(Number(e.target.value))}
                required
                min="0.01"
                max="1000000"
                step="0.01"
              />
              <Field
                label="Estoque total"
                name="stock"
                type="number"
                defaultValue={p?.stock || 0}
                required
                min="0"
                max="1000000"
              />
            </div>
            <Field
              label="Variações separadas por vírgula"
              name="variants"
              required
              defaultValue={p?.variants.join(', ') || 'Modelo único'}
            />
            <p className="small muted">
              O estoque é compartilhado entre as variações deste anúncio. Crie
              anúncios separados se precisar controlar estoque por cor ou
              tamanho.
            </p>
            <Pick
              label="Status do anúncio"
              value={state}
              onChange={setState}
              options={[
                { value: 'draft', label: 'Rascunho' },
                { value: 'active', label: 'Ativo' },
                { value: 'paused', label: 'Pausado' },
              ]}
            />
          </ActionForm>
        </div>
        <div className="stack">
          <div className="panel assistant">
            <div className="eyebrow">
              <Sparkles size={16} />
              Seu assistente
            </div>
            <h2>
              Você conhece o produto.
              <br />
              Vamos contar melhor?
            </h2>
            <p>
              Receba sugestões e revise antes de aplicar. Características que
              você não informou não serão presumidas.
            </p>
            <button
              className="btn secondary full"
              type="button"
              disabled={busy || title.length < 3}
              onClick={assist}
            >
              {busy ? 'Preparando sugestões…' : 'Revisar meu anúncio'}
              <Sparkles size={16} />
            </button>
            {suggestion && (
              <div className="stack section">
                <span className="label">
                  {suggestion.mode === 'ai'
                    ? 'Sugestão com IA'
                    : 'Checklist de qualidade · sem IA configurada'}
                </span>
                <h3>{suggestion.title}</h3>
                <p className="preline small">{suggestion.description}</p>
                <ul>
                  {suggestion.advice.map((t: string, i: number) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setTitle(suggestion.title);
                    setDescription(suggestion.description);
                  }}
                >
                  Aplicar ao rascunho
                </button>
              </div>
            )}
          </div>
          <div className="panel stack">
            <h2>Copiloto de preço</h2>
            <p className="small muted">
              Simulação de margem. Seu preço continua sendo sua escolha.
            </p>
            <Field
              label="Seu custo por unidade (R$)"
              type="number"
              value={cost}
              min="0"
              step="0.01"
              onChange={(e: any) => setCost(Number(e.target.value))}
            />
            <div className="sumrow">
              <span>Comissão Mercaz</span>
              <strong>
                {money(Math.round((price * app.data.config.feeBps) / 100))}
              </strong>
            </div>
            <div className="sumrow">
              <span>Após comissão e custo</span>
              <strong>
                {money(
                  Math.round(
                    (price * (1 - app.data.config.feeBps / 10000) - cost) * 100,
                  ),
                )}
              </strong>
            </div>
            <p className="small muted">
              Não inclui tarifa do Mercado Pago, tributos, embalagem ou frete.
              Não é uma previsão de vendas.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
function SellerOrders({ d, reload }: any) {
  const app = useApp(),
    [filter, setFilter] = useState('Todos'),
    [ship, setShip] = useState<any>(null),
    [refund, setRefund] = useState<any>(null),
    [busy, setBusy] = useState(false);
  const steps: any = {
    confirmed: ['preparing', 'Iniciar preparo'],
    preparing: ['ready', 'Marcar pronto'],
    ready: ['shipped', 'Informar envio'],
    shipped: ['transit', 'Marcar em transporte'],
  };
  return (
    <>
      <Heading
        title="Pedidos da loja"
        sub="Cumpra sua promessa de preparo e mantenha o comprador informado."
      />
      <Pick
        label="Etapa"
        value={filter}
        onChange={setFilter}
        options={['Todos', ...Object.values(statuses)]}
      />
      <div className="stack section">
        {d.orders
          .filter(
            (o: any) => filter === 'Todos' || statuses[o.status] === filter,
          )
          .map((o: any) => (
            <div className="panel stack" key={o.id}>
              <div className="sectionhead">
                <div>
                  <span className={'status ' + o.status}>
                    {statuses[o.status]}
                  </span>
                  <p className="small muted">
                    #{o.id.slice(-8).toUpperCase()} · {date(o.created)}
                  </p>
                </div>
                <strong>{money(o.total)}</strong>
              </div>
              {o.items.map((i: any) => (
                <div className="tableproduct" key={i.id}>
                  <img src={i.image} alt="" />
                  <span>
                    {i.qty}× {i.title} · {i.variant}
                  </span>
                </div>
              ))}
              <p className="small">
                {o.address.name} · {o.address.street}, {o.address.number} ·{' '}
                {o.address.city}/{o.address.state} · CEP {o.address.zip}
              </p>
              <div className="inline">
                {steps[o.status] && (
                  <button
                    className="btn"
                    onClick={() =>
                      o.status === 'ready'
                        ? setShip(o)
                        : app.act(async () => {
                            await api(
                              '/seller/orders/' + o.id + '/status',
                              'POST',
                              { status: steps[o.status][0] },
                            );
                            reload();
                          }, 'Pedido atualizado.')
                    }
                  >
                    {steps[o.status][1]}
                  </button>
                )}
                <a className="btn secondary" href={'/pedidos/' + o.id}>
                  Ver detalhes
                </a>
                {!['pending', 'cancelled', 'refunded'].includes(o.status) && (
                  <button className="btn ghost" onClick={() => setRefund(o)}>
                    Reembolsar
                  </button>
                )}
              </div>
            </div>
          ))}
        {!d.orders.length && (
          <EmptyState
            title="A próxima venda começa no seu catálogo"
            href="/vendedor/produtos"
            action="Ver produtos"
          />
        )}
      </div>
      <Modal
        open={!!ship}
        onClose={() => setShip(null)}
        title="Seu pedido está pronto para sair"
        description="Informe a transportadora e o código de rastreio para o comprador."
      >
        <ActionForm
          button="Confirmar envio"
          onSubmit={async (f: FormData) => {
            await api('/seller/orders/' + ship.id + '/status', 'POST', {
              status: 'shipped',
              tracking: f.get('tracking'),
            });
            setShip(null);
            reload();
          }}
        >
          <Field
            label="Transportadora e rastreio"
            name="tracking"
            required
            minLength={4}
            maxLength={100}
            placeholder="Ex.: Correios · AB123456789BR"
          />
        </ActionForm>
      </Modal>
      <AlertDialog open={!!refund} onOpenChange={(v) => !v && setRefund(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Reembolsar {money(refund?.total)}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O valor integral será devolvido pelo Mercado Pago. Confira o
              recebimento dos itens e combine os detalhes com o comprador antes
              de confirmar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                await app.act(async () => {
                  await api('/seller/orders/' + refund.id + '/refund', 'POST');
                  reload();
                  setRefund(null);
                }, 'Reembolso solicitado.');
                setBusy(false);
              }}
            >
              Confirmar reembolso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
function Inventory({ d, reload }: any) {
  const app = useApp();
  return (
    <>
      <Heading
        title="Estoque e demanda"
        sub="Disponibilidade e procura, sem adivinhação."
      />
      <div className="stack">
        {d.products.map((p: any) => {
          const sold = paid(d)
            .flatMap((o: any) => o.items)
            .filter((i: any) => i.product_id === p.id)
            .reduce((s: number, i: any) => s + i.qty, 0);
          return (
            <div className="panel inventoryrow" key={p.id}>
              <div className="tableproduct">
                <img src={p.images[0]} alt="" />
                <div>
                  <h3>{p.title}</h3>
                  <p className="small muted">
                    {p.views} visualizações · {sold} unidades vendidas
                  </p>
                  {p.stock <= 5 && (
                    <span className="label">
                      {p.stock ? 'Estoque baixo' : 'Sem estoque'}
                    </span>
                  )}
                </div>
              </div>
              <ActionForm
                button="Atualizar"
                className="inline"
                onSubmit={async (f: FormData) => {
                  await api('/products/' + p.id + '/stock', 'PATCH', {
                    stock: Number(f.get('stock')),
                  });
                  await app.refresh();
                  reload();
                }}
              >
                <Field
                  label="Unidades disponíveis"
                  name="stock"
                  type="number"
                  required
                  defaultValue={p.stock}
                  min="0"
                  max="1000000"
                />
              </ActionForm>
            </div>
          );
        })}
      </div>
    </>
  );
}
function Finance({ d }: any) {
  const rows = paid(d),
    gross = rows.reduce((s: number, o: any) => s + o.subtotal, 0),
    fees = rows.reduce((s: number, o: any) => s + o.fee, 0),
    freight = rows.reduce((s: number, o: any) => s + o.shipping, 0),
    refunded = d.orders
      .filter((o: any) => o.status === 'refunded')
      .reduce((s: number, o: any) => s + o.total, 0);
  function exportCSV() {
    const csv = [
      [
        'Pedido',
        'Data',
        'Status',
        'Produtos centavos',
        'Frete centavos',
        'Comissão centavos',
        'Total centavos',
      ],
      ...d.orders.map((o: any) => [
        o.id,
        o.created,
        statuses[o.status],
        o.subtotal,
        o.shipping,
        o.fee,
        o.total,
      ]),
    ]
      .map((r) =>
        r.map((v: any) => '"' + String(v).replace(/"/g, '""') + '"').join(';'),
      )
      .join('\r\n');
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
    );
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mercaz-financeiro.csv';
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <>
      <Heading
        title="Cada valor, explicado."
        sub="Todas as vendas desde a abertura da loja."
      >
        <button className="btn secondary" onClick={exportCSV}>
          <Download size={16} />
          Exportar CSV
        </button>
      </Heading>
      <Stats
        items={[
          ['Vendas de produtos', money(gross)],
          ['Comissões Mercaz', money(fees)],
          [
            'Vendas + frete − Mercaz',
            money(gross + freight - fees),
            'Antes da tarifa Mercado Pago',
          ],
          ['Reembolsado', money(refunded)],
        ]}
      />
      <div className="notice section">
        O repasse é feito pelo Mercado Pago para a conta conectada da loja. O
        valor e a data de liberação, assim como a tarifa do provedor, devem ser
        consultados no Mercado Pago. Este painel não representa saldo disponível
        para saque.
      </div>
      <div className="panel">
        <Table>
          <TableHeader>
            <TableRow>
              {[
                'Pedido',
                'Situação',
                'Produtos',
                'Frete',
                'Mercaz',
                'Após Mercaz',
              ].map((t) => (
                <TableHead key={t}>{t}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {d.orders.map((o: any) => (
              <TableRow key={o.id}>
                <TableCell>
                  <a href={'/pedidos/' + o.id}>#{o.id.slice(-8)}</a>
                </TableCell>
                <TableCell>{statuses[o.status]}</TableCell>
                <TableCell>{money(o.subtotal)}</TableCell>
                <TableCell>{money(o.shipping)}</TableCell>
                <TableCell>{money(o.fee)}</TableCell>
                <TableCell>{money(o.total - o.fee)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
function Performance({ d }: any) {
  const rows = paid(d),
    views = d.products.reduce((s: number, p: any) => s + p.views, 0),
    units = rows
      .flatMap((o: any) => o.items)
      .reduce((s: number, i: any) => s + i.qty, 0);
  return (
    <>
      <Heading
        title="Entenda seus resultados"
        sub="Dados acumulados da sua loja. Visualizações incluem visitas repetidas."
      />
      <Stats
        items={[
          ['Visitas aos produtos', views],
          ['Pedidos pagos', rows.length],
          ['Unidades vendidas', units],
          [
            'Pedidos / visualizações',
            views ? ((rows.length / views) * 100).toFixed(1) + '%' : '—',
            'Indicador aproximado, não visitantes únicos',
          ],
        ]}
      />
      <div className="panel section stack">
        <h2>Produtos que movimentam sua loja</h2>
        {d.products.map((p: any) => {
          const n = rows
            .flatMap((o: any) => o.items)
            .filter((i: any) => i.product_id === p.id)
            .reduce((s: number, i: any) => s + i.qty, 0);
          return (
            <div className="barrow" key={p.id}>
              <span>{p.title}</span>
              <div>
                <i style={{ width: (units ? (n / units) * 100 : 0) + '%' }} />
              </div>
              <strong>{n} un.</strong>
            </div>
          );
        })}
      </div>
      <div className="panel section prose">
        <h2>Como ler esses números</h2>
        <p>
          Muitas visualizações e poucas compras podem indicar dúvidas sobre o
          anúncio, preço, frete ou prazo. Revise essas informações antes de
          mudar o preço. Este painel não atribui vendas à IA nem estima aumentos
          de demanda sem dados suficientes.
        </p>
      </div>
    </>
  );
}
function Reputation({ d, reload }: any) {
  const avg = d.reviews.length
    ? d.reviews.reduce((s: number, r: any) => s + r.rating, 0) /
      d.reviews.length
    : 0;
  return (
    <>
      <Heading
        title="Confiança se constrói nos detalhes"
        sub="Avaliações de compras entregues e perguntas dos seus compradores."
      />
      <Stats
        items={[
          [
            'Avaliação da loja',
            avg ? avg.toFixed(1) + ' / 5' : 'Sem avaliações',
          ],
          ['Compras avaliadas', d.reviews.length],
          [
            'Perguntas sem resposta',
            d.questions.filter((q: any) => !q.answer).length,
          ],
        ]}
      />
      <div className="panel section prose">
        <p>
          A nota é a média simples das avaliações visíveis da loja. Não
          removemos uma opinião apenas por ser negativa. A promessa de preparo
          aparece antes da compra; mantenha o comprador informado quando houver
          imprevistos.
        </p>
      </div>
      <section className="section stack">
        <h2>Perguntas dos produtos</h2>
        {d.questions.map((q: any) => (
          <div className="panel stack" key={q.id}>
            <h3>{q.title}</h3>
            <p>{q.question}</p>
            {q.answer && <p className="muted">Resposta atual: {q.answer}</p>}
            <ActionForm
              button="Responder"
              onSubmit={async (f: FormData) => {
                await api('/questions/' + q.id + '/answer', 'POST', {
                  answer: f.get('answer'),
                });
                reload();
              }}
            >
              <Field label="Resposta da loja">
                <textarea
                  name="answer"
                  required
                  minLength={2}
                  maxLength={2000}
                  defaultValue={q.answer}
                />
              </Field>
            </ActionForm>
          </div>
        ))}
      </section>
      <section className="section">
        <ReviewList items={d.reviews} reload={reload} />
      </section>
    </>
  );
}
function StoreSettings({ d, reload }: any) {
  const app = useApp(),
    s = d.store,
    [paused, setPaused] = useState(!!s.paused);
  return (
    <>
      <Heading
        title="Sua operação, suas escolhas"
        sub="Defina uma promessa que sua loja consegue cumprir."
      />
      <div className="panel">
        <ActionForm
          button="Salvar configurações"
          onSubmit={async (f: FormData) => {
            const b = Object.fromEntries(f);
            await api('/store', 'PATCH', {
              ...b,
              prep_days: Number(b.prep_days),
              shipping: Math.round(Number(b.shipping) * 100),
              shipping_days: Number(b.shipping_days),
              paused,
            });
            await app.refresh();
            reload();
          }}
        >
          <Field
            label="Nome da loja"
            name="name"
            defaultValue={s.name}
            required
            minLength={2}
          />
          <Field label="Descrição">
            <textarea
              name="description"
              required
              minLength={10}
              maxLength={1500}
              defaultValue={s.description}
            />
          </Field>
          <div className="formgrid">
            <Field
              label="Preparo (dias corridos)"
              name="prep_days"
              type="number"
              min="0"
              max="30"
              defaultValue={s.prep_days}
              required
            />
            <Field
              label="Transporte (dias corridos)"
              name="shipping_days"
              type="number"
              min="1"
              max="45"
              defaultValue={s.shipping_days}
              required
            />
            <Field
              label="Frete fixo nacional (R$)"
              name="shipping"
              type="number"
              min="0"
              max="1000"
              step="0.01"
              defaultValue={s.shipping / 100}
              required
            />
            <Field
              label="Dias de funcionamento"
              name="days"
              defaultValue={s.days}
              required
            />
          </div>
          <label className="checkrow">
            <Switch checked={paused} onCheckedChange={setPaused} />
            <span>Pausar novas vendas da loja</span>
          </label>
        </ActionForm>
      </div>
      <div className="panel section stack">
        <h2>Receba com Mercado Pago</h2>
        <p>
          {s.mp_connected
            ? 'Conta conectada. Os pagamentos usam a conta da sua loja.'
            : 'Conecte sua conta para gerar Pix e receber os valores de suas vendas.'}
        </p>
        <div className="notice">
          Comissão Mercaz: {app.data.config.feeBps / 100}% sobre os produtos. As
          tarifas do Mercado Pago são cobradas pelo provedor.
        </div>
        <button
          className="btn"
          onClick={() =>
            app.act(async () => {
              const d = await api('/payments/connect');
              location.assign(d.url);
            }, 'Abrindo Mercado Pago…')
          }
        >
          {s.mp_connected ? 'Reconectar conta' : 'Conectar Mercado Pago'}
          <ExternalLink size={16} />
        </button>
        {app.data.config.demo && (
          <p className="small muted">
            A conexão fica disponível quando o responsável pela VPS ativa o modo
            Mercado Pago na configuração.
          </p>
        )}
      </div>
    </>
  );
}
