import React, { useState, useEffect } from 'react';
import {
  ArrowRight,
  Trash2,
  ShieldCheck,
  Package,
  Check,
  Copy,
  Store,
  Heart,
  Star,
  LifeBuoy,
  Bell,
  UserRound,
  LogOut,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
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
  AddressFields,
  readAddress,
  Quantity,
  EmptyState,
  ErrorBox,
  Loading,
  Modal,
  UploadField,
  Grid,
} from './shared';
import { StoreCard, ReviewList } from './catalog';
export function AuthPage() {
  const app = useApp(),
    [mode, setMode] = useState('login');
  if (app.data.user)
    return (
      <EmptyState
        title={'Olá, ' + app.data.user.name.split(' ')[0]}
        text="Sua conta está conectada."
        href="/conta"
        action="Ir para minha conta"
      />
    );
  return (
    <div className="authlayout">
      <div className="authintro">
        <div className="eyebrow">Que bom ter você por aqui</div>
        <h1>
          Boas escolhas
          <br />
          começam com
          <br />
          boas conexões.
        </h1>
        <p>Compre, descubra e conheça quem faz acontecer.</p>
        <img src="/assets/brand.png" alt="Marca Mercaz" />
      </div>
      <div className="panel authform">
        <Heading
          title={mode === 'login' ? 'Entre na Mercaz' : 'Crie sua conta'}
          sub="Uma conta para comprar e vender."
        />
        <Tabs value={mode} onValueChange={(v) => setMode(String(v))}>
          <TabsList>
            <TabsTrigger value="login">Entrar</TabsTrigger>
            <TabsTrigger value="register">Criar conta</TabsTrigger>
          </TabsList>
        </Tabs>
        <ActionForm
          key={mode}
          button={mode === 'login' ? 'Entrar' : 'Criar minha conta'}
          onSubmit={async (f: FormData) => {
            await api('/auth/' + mode, 'POST', Object.fromEntries(f));
            await app.refresh();
            const next = new URLSearchParams(location.search).get('next');
            go(
              next && next.startsWith('/') && !next.startsWith('//')
                ? next
                : '/conta',
            );
          }}
        >
          {mode === 'register' && (
            <Field
              label="Seu nome"
              name="name"
              required
              minLength={2}
              maxLength={80}
              autoComplete="name"
            />
          )}
          <Field
            label="E-mail"
            name="email"
            type="email"
            required
            autoComplete="email"
          />
          <Field
            label="Senha"
            name="password"
            type="password"
            required
            minLength={mode === 'register' ? 12 : 1}
            maxLength={128}
            autoComplete={
              mode === 'register' ? 'new-password' : 'current-password'
            }
          />
          {mode === 'register' && (
            <p className="small muted">
              Use pelo menos 12 caracteres. Ao criar sua conta, você aceita os{' '}
              <a href="/politicas/termos">termos de uso</a> e conhece nossa{' '}
              <a href="/politicas/privacidade">política de privacidade</a>.
            </p>
          )}
        </ActionForm>
        {app.data.config.seedDemo && (
          <div className="notice">
            Ambiente de demonstração. As contas de teste e a senha de acesso
            estão no arquivo de instalação entregue com o projeto.
          </div>
        )}
      </div>
    </div>
  );
}
export function NeedAuth() {
  return (
    <EmptyState
      title="Sua conta deixa tudo mais fácil"
      text="Entre para acompanhar compras, salvar produtos e conversar com as lojas."
      href={'/entrar?next=' + encodeURIComponent(location.pathname)}
      action="Entrar ou criar conta"
    />
  );
}
export function Favorites() {
  const app = useApp();
  if (!app.data.user) return <NeedAuth />;
  const favorites = app.data.favorites;
  return (
    <>
      <Heading
        title="Para voltar depois"
        sub="Seus produtos e lojas favoritos, em um só lugar."
      />
      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Produtos</TabsTrigger>
          <TabsTrigger value="stores">Lojas</TabsTrigger>
        </TabsList>
        <TabsContent value="products">
          <Grid
            items={app.data.products.filter((p: any) =>
              favorites.some(
                (f: any) => f.kind === 'product' && f.item_id === p.id,
              ),
            )}
          />
        </TabsContent>
        <TabsContent value="stores">
          <div className="storegrid">
            {app.data.stores
              .filter((s: any) =>
                favorites.some(
                  (f: any) => f.kind === 'store' && f.item_id === s.id,
                ),
              )
              .map((s: any) => (
                <StoreCard key={s.id} s={s} />
              ))}
          </div>
          {!favorites.some((f: any) => f.kind === 'store') && (
            <EmptyState title="Suas lojas favoritas aparecerão aqui" />
          )}
        </TabsContent>
      </Tabs>
    </>
  );
}
export function Cart({ checkout = false }: any) {
  const app = useApp(),
    [accepted, setAccepted] = useState(false),
    [key] = useState(() => {
      let k = sessionStorage.getItem('mercaz-checkout-key');
      if (!k) {
        k = crypto.randomUUID();
        sessionStorage.setItem('mercaz-checkout-key', k);
      }
      return k;
    });
  const items = app.cart.map((c: any) => ({
    ...c,
    p: app.data.products.find((p: any) => p.id === c.id),
  }));
  const valid = items.every((i: any) => i.p && i.p.stock >= i.qty);
  const groups: any[] = [];
  for (const i of items) {
    if (!i.p) continue;
    let group = groups.find((g) => g.id === i.p.store_id);
    if (!group) {
      group = {
        id: i.p.store_id,
        name: i.p.store_name,
        shipping: i.p.shipping,
        prep: i.p.prep_days,
        days: i.p.shipping_days,
        items: [],
      };
      groups.push(group);
    }
    group.items.push(i);
  }
  const subtotal = items.reduce(
      (t: number, i: any) => t + (i.p?.price || 0) * i.qty,
      0,
    ),
    shipping = groups.reduce((t, g) => t + g.shipping, 0);
  if (!items.length)
    return <EmptyState title="Seu carrinho está esperando um achado" />;
  if (checkout && !app.data.user) return <NeedAuth />;
  const summary = (
    <div className="panel summary">
      <h2>Resumo da compra</h2>
      <div className="sumrow">
        <span>
          Produtos ({items.reduce((s: number, i: any) => s + i.qty, 0)})
        </span>
        <strong>{money(subtotal)}</strong>
      </div>
      <div className="sumrow">
        <span>Entrega · {groups.length} loja(s)</span>
        <strong>{money(shipping)}</strong>
      </div>
      <div className="sumrow total">
        <span>Total</span>
        <strong>{money(subtotal + shipping)}</strong>
      </div>
      <p className="small muted">
        {groups.length > 1
          ? 'Cada loja gera um pedido e um Pix. Acompanhe todos em Meus pedidos.'
          : 'Pagamento com Pix, direto no pedido.'}
      </p>
      {!checkout && (
        <a className="btn full" href={valid ? '/checkout' : '#itens'}>
          Continuar para entrega <ArrowRight size={16} />
        </a>
      )}
      <p className="small">
        <ShieldCheck size={16} /> Você vê todos os custos antes de pagar.
      </p>
    </div>
  );
  return (
    <>
      <Heading
        title={checkout ? 'Vamos finalizar sua compra?' : 'Seu carrinho'}
        sub={
          checkout
            ? 'Confira endereço, entrega e pagamento.'
            : 'Cada produto, seu vendedor. Todos os custos, à vista.'
        }
      />
      {!valid && (
        <ErrorBox message="Um item ficou indisponível ou a quantidade excede o estoque. Ajuste o carrinho." />
      )}
      <div className="checkoutlayout">
        <div className="stack">
          {!checkout ? (
            groups.map((g) => (
              <div className="panel" key={g.id}>
                <div className="sectionhead">
                  <h3 className="inline">
                    <Store size={18} />
                    {g.name}
                  </h3>
                  <span className="small muted">Preparo até {g.prep} dias</span>
                </div>
                {g.items.map((i: any) => (
                  <div className="cartitem" key={i.id + i.variant}>
                    <a href={'/produto/' + i.id}>
                      <img src={i.p.images[0]} alt={i.p.title} />
                    </a>
                    <div>
                      <a href={'/produto/' + i.id}>
                        <h3>{i.p.title}</h3>
                      </a>
                      <p className="small muted">{i.variant}</p>
                      <Quantity
                        value={i.qty}
                        max={Math.min(i.p.stock, 99)}
                        onChange={(qty: number) =>
                          app.updateCart(i.id, i.variant, qty)
                        }
                      />
                    </div>
                    <div className="stack alignend">
                      <strong>{money(i.p.price * i.qty)}</strong>
                      <button
                        className="iconbtn"
                        aria-label={'Remover ' + i.p.title}
                        onClick={() => app.updateCart(i.id, i.variant, 0)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="sumrow small">
                  <span>Transporte: estimativa de {g.days} dias corridos</span>
                  <strong>Frete {money(g.shipping)}</strong>
                </div>
              </div>
            ))
          ) : (
            <ActionForm
              button={
                app.data.config.demo
                  ? 'Criar pedidos de demonstração'
                  : 'Gerar Pix e confirmar pedidos'
              }
              onSubmit={async (f: FormData) => {
                if (!accepted) throw Error('Aceite as condições de compra.');
                const result = await api('/checkout', 'POST', {
                  key,
                  items: app.cart,
                  address: readAddress(f),
                  cpf: f.get('cpf'),
                  accepted,
                });
                app.clearCart();
                sessionStorage.removeItem('mercaz-checkout-key');
                await app.refresh();
                go('/pedidos/' + result.orders[0].id);
                if (result.warnings?.length)
                  app.flash(
                    'Pedido criado. O Pix poderá ser gerado novamente no detalhe do pedido.',
                  );
              }}
            >
              <div className="panel stack">
                <h2>01. Onde você quer receber?</h2>
                <AddressFields value={app.data.user.address} />
              </div>
              <div className="panel stack">
                <h2>02. Entrega sem surpresas</h2>
                {groups.map((g) => (
                  <div className="sumrow" key={g.id}>
                    <div>
                      <strong>{g.name}</strong>
                      <p className="small muted">
                        Preparo + transporte: até {g.prep + g.days} dias
                        corridos após pagamento. Frete fixo nacional.
                      </p>
                    </div>
                    <strong>{money(g.shipping)}</strong>
                  </div>
                ))}
              </div>
              <div className="panel stack">
                <h2>03. Pagamento com Pix</h2>
                <p>
                  O QR Code e o código para copiar serão exibidos no pedido. O
                  pedido só segue para preparo após a confirmação do pagamento.
                </p>
                {app.data.config.demo ? (
                  <div className="notice">
                    Demonstração: nenhuma cobrança será feita. Você poderá
                    simular o pagamento no pedido.
                  </div>
                ) : (
                  <Field
                    label="CPF do pagador"
                    name="cpf"
                    required
                    pattern="[0-9.\-]{11,14}"
                    placeholder="000.000.000-00"
                  />
                )}
                <label className="checkrow">
                  <Checkbox checked={accepted} onCheckedChange={setAccepted} />
                  <span>
                    Li e aceito os{' '}
                    <a className="more inline-link" href="/politicas/termos">
                      termos de compra
                    </a>
                    , incluindo os prazos e custos informados.
                  </span>
                </label>
              </div>
            </ActionForm>
          )}
          {items
            .filter((i: any) => !i.p)
            .map((i: any) => (
              <div className="panel" key={i.id + i.variant}>
                Produto indisponível.{' '}
                <button
                  className="btn secondary"
                  onClick={() => app.updateCart(i.id, i.variant, 0)}
                >
                  Remover do carrinho
                </button>
              </div>
            ))}
        </div>
        {summary}
      </div>
    </>
  );
}
export function Orders() {
  const app = useApp();
  if (!app.data.user) return <NeedAuth />;
  return <OrderList />;
}
function OrderList() {
  const { data, error, reload } = useData('/orders');
  const [filter, setFilter] = useState('Todos');
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!data) return <Loading />;
  const list = data.filter(
    (o: any) =>
      filter === 'Todos' ||
      (filter === 'Em andamento' &&
        !['delivered', 'cancelled', 'refunded'].includes(o.status)) ||
      (filter === 'Concluídos' &&
        ['delivered', 'cancelled', 'refunded'].includes(o.status)),
  );
  return (
    <>
      <Heading
        title="Meus pedidos"
        sub="Da confirmação até a sua porta, acompanhe cada etapa."
      />
      <Pick
        label="Exibir"
        value={filter}
        onChange={setFilter}
        options={['Todos', 'Em andamento', 'Concluídos']}
      />
      <div className="stack section">
        {list.map((o: any) => (
          <a className="panel ordercard" key={o.id} href={'/pedidos/' + o.id}>
            <div className="sectionhead">
              <div>
                <span className={'status ' + o.status}>
                  {statuses[o.status]}
                </span>
                <p className="small muted">
                  {o.id.slice(-8).toUpperCase()} · {date(o.created)} ·{' '}
                  {o.store_name}
                </p>
              </div>
              <ArrowRight size={20} />
            </div>
            <div className="inline">
              {o.items.slice(0, 3).map((i: any) => (
                <img key={i.id} src={i.image} alt={i.title} />
              ))}
              <div>
                <h3>
                  {o.items[0]?.title}
                  {o.items.length > 1
                    ? ' e mais ' + (o.items.length - 1) + ' item(s)'
                    : ''}
                </h3>
                <p>{money(o.total)}</p>
              </div>
            </div>
          </a>
        ))}
        {!list.length && <EmptyState title="Nenhum pedido por aqui" />}
      </div>
    </>
  );
}
export function OrderDetail({ id }: any) {
  const app = useApp();
  if (!app.data.user) return <NeedAuth />;
  return <OrderContent id={id} />;
}
function OrderContent({ id }: any) {
  const { data: o, error, reload } = useData('/orders/' + id),
    app = useApp(),
    [review, setReview] = useState<any>(null),
    [support, setSupport] = useState(false),
    [rating, setRating] = useState('5'),
    [media, setMedia] = useState<string[]>([]);
  if (error) return <ErrorBox message={error} retry={reload} />;
  if (!o) return <Loading />;
  const own = o.user_id === app.data.user.id;
  const act = (url: string, body?: any) =>
    app.act(async () => {
      await api(url, 'POST', body);
      reload();
      await app.refresh();
    }, 'Pedido atualizado.');
  return (
    <>
      <div className="breadcrumb">
        <a href="/pedidos">Meus pedidos</a> / {o.id.slice(-8).toUpperCase()}
      </div>
      <Heading
        title={statuses[o.status]}
        sub={`Pedido ${o.id.slice(-8).toUpperCase()} · ${o.store_name} · ${date(o.created)}`}
      >
        <button className="btn secondary" onClick={reload}>
          Atualizar
        </button>
      </Heading>
      {o.demo === 1 && (
        <div className="notice">
          Pedido de demonstração. Não representa uma cobrança ou entrega real.
        </div>
      )}
      <div className="checkoutlayout">
        <div className="stack">
          <div className="panel">
            <h2>Acompanhe sua compra</h2>
            <ol className="timeline">
              {o.events.map((e: any) => (
                <li key={e.id}>
                  <span>
                    <Check size={14} />
                  </span>
                  <div>
                    <strong>{statuses[e.status]}</strong>
                    <p className="small muted">{date(e.created)}</p>
                  </div>
                </li>
              ))}
            </ol>
            {o.tracking && (
              <div className="notice">
                Código de rastreio: <strong>{o.tracking}</strong>. Consulte no
                site da transportadora informada pela loja.
              </div>
            )}
            {own && ['shipped', 'transit'].includes(o.status) && (
              <button
                className="btn"
                onClick={() => act('/orders/' + id + '/delivered')}
              >
                Confirmar que recebi
              </button>
            )}
          </div>
          {own && o.status === 'pending' && (
            <div className="panel stack">
              <h2>{o.demo ? 'Simule seu pagamento' : 'Pague com Pix'}</h2>
              {o.demo ? (
                <>
                  <p>Use a simulação para testar o fluxo completo de compra.</p>
                  <button
                    className="btn"
                    onClick={() => act('/orders/' + id + '/simulate')}
                  >
                    Simular pagamento aprovado
                  </button>
                </>
              ) : o.payment_data.qr_code ? (
                <>
                  <img
                    className="qrcode"
                    src={
                      'data:image/png;base64,' + o.payment_data.qr_code_base64
                    }
                    alt="QR Code Pix"
                  />
                  <Field label="Pix copia e cola">
                    <textarea readOnly value={o.payment_data.qr_code} />
                  </Field>
                  <button
                    className="btn"
                    onClick={() =>
                      app.act(
                        () =>
                          navigator.clipboard.writeText(o.payment_data.qr_code),
                        'Código Pix copiado.',
                      )
                    }
                  >
                    <Copy size={17} />
                    Copiar código Pix
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() => act('/orders/' + id + '/payment')}
                  >
                    Já paguei · verificar pagamento
                  </button>
                  <p className="small muted">
                    O Pix vence em 30 minutos. A confirmação é consultada no
                    Mercado Pago.
                  </p>
                </>
              ) : (
                <ActionForm
                  button="Gerar / recuperar Pix"
                  onSubmit={async (f: FormData) => {
                    await api('/orders/' + id + '/payment', 'POST', {
                      cpf: f.get('cpf'),
                    });
                    reload();
                  }}
                >
                  <Field
                    label="CPF do pagador"
                    name="cpf"
                    required
                    minLength={11}
                    maxLength={14}
                  />
                </ActionForm>
              )}
              <button
                className="btn ghost"
                onClick={() => act('/orders/' + id + '/cancel')}
              >
                Cancelar pedido pendente
              </button>
            </div>
          )}
          <div className="panel">
            <h2>Os seus produtos</h2>
            {o.items.map((i: any) => (
              <div className="cartitem" key={i.id}>
                <img src={i.image} alt={i.title} />
                <div>
                  <a href={'/produto/' + i.product_id}>
                    <h3>{i.title}</h3>
                  </a>
                  <p className="small muted">
                    {i.variant} · {i.qty} unidade(s)
                  </p>
                  {own &&
                    o.status === 'delivered' &&
                    !o.reviews.some(
                      (r: any) => r.product_id === i.product_id,
                    ) && (
                      <button
                        className="btn ghost"
                        onClick={() => {
                          setReview(i);
                          setMedia([]);
                        }}
                      >
                        Avaliar compra <Star size={15} />
                      </button>
                    )}
                </div>
                <strong>{money(i.price * i.qty)}</strong>
              </div>
            ))}
          </div>
          <div className="panel">
            <h2>Precisa de uma mão?</h2>
            <p>
              Converse com a loja sobre entrega, produto, cancelamento ou
              devolução. Todas as respostas ficam registradas.
            </p>
            {own && (
              <button
                className="btn secondary"
                onClick={() => setSupport(true)}
              >
                <LifeBuoy size={16} />
                Abrir atendimento
              </button>
            )}
          </div>
        </div>
        <div className="panel summary stack">
          <h2>Detalhes da compra</h2>
          <div className="sumrow">
            <span>Produtos</span>
            <strong>{money(o.subtotal)}</strong>
          </div>
          <div className="sumrow">
            <span>Entrega</span>
            <strong>{money(o.shipping)}</strong>
          </div>
          <div className="sumrow total">
            <span>Total</span>
            <strong>{money(o.total)}</strong>
          </div>
          <h3>Endereço de entrega</h3>
          <p>
            {o.address.name}
            <br />
            {o.address.street}, {o.address.number} {o.address.extra}
            <br />
            {o.address.city} / {o.address.state}
            <br />
            CEP {o.address.zip}
          </p>
          <p className="small muted">
            Preparo de até {o.prep_days} dias + transporte estimado em{' '}
            {o.shipping_days} dias corridos após pagamento.
          </p>
          <a className="more" href="/pedidos">
            Ver todos os meus pedidos <ArrowRight size={15} />
          </a>
        </div>
      </div>
      <Modal
        open={!!review}
        onClose={() => setReview(null)}
        title="Como foi sua experiência?"
        description="Mostre o produto como ele é. Uma opinião útil pode incluir qualidades e limitações."
      >
        <ActionForm
          button="Publicar avaliação"
          onSubmit={async (f: FormData) => {
            await api('/reviews', 'POST', {
              order_id: id,
              product_id: review.product_id,
              rating: Number(rating),
              text: f.get('text'),
              context: f.get('context'),
              media,
            });
            setReview(null);
            reload();
          }}
        >
          <Pick
            label="Sua nota"
            value={rating}
            onChange={setRating}
            options={[5, 4, 3, 2, 1].map((n) => ({
              value: String(n),
              label: n + ' estrela(s)',
            }))}
          />
          <Field label="Conte sua experiência">
            <textarea name="text" required minLength={5} maxLength={3000} />
          </Field>
          <Field
            label="Contexto (opcional)"
            name="context"
            placeholder="Ex.: tamanho real, uso há 30 dias"
            maxLength={150}
          />
          <UploadField value={media} onChange={setMedia} video />
        </ActionForm>
      </Modal>
      <Modal
        open={support}
        onClose={() => setSupport(false)}
        title="Vamos resolver juntos"
        description="A loja receberá sua solicitação e responderá por este atendimento."
      >
        <ActionForm
          button="Abrir atendimento"
          onSubmit={async (f: FormData) => {
            const t = await api('/tickets', 'POST', {
              order_id: id,
              type: f.get('type'),
              text: f.get('text'),
            });
            go('/suporte/' + t.id);
          }}
        >
          <Field
            label="Assunto"
            name="type"
            placeholder="Entrega, devolução, cancelamento…"
            required
            minLength={3}
            maxLength={50}
          />
          <Field label="O que aconteceu?">
            <textarea name="text" required minLength={5} maxLength={3000} />
          </Field>
        </ActionForm>
      </Modal>
    </>
  );
}
export function Account() {
  const app = useApp();
  if (!app.data.user) return <NeedAuth />;
  return <AccountContent />;
}
function AccountContent() {
  const app = useApp(),
    u = app.data.user,
    [tab, setTab] = useState('data');
  return (
    <>
      <Heading
        title={'Seu espaço, ' + u.name.split(' ')[0]}
        sub="Organize seus dados e acompanhe o que importa."
      />
      <div className="accountcards">
        {[
          ['Meus pedidos', '/pedidos', Package],
          ['Favoritos', '/favoritos', Heart],
          ['Notificações', '/notificacoes', Bell],
          ['Minha loja', u.seller ? '/vendedor' : '/vender/cadastro', Store],
        ].map(([t, url, I]: any) => (
          <a className="panel inline" key={t} href={url}>
            <I />
            <h3>{t}</h3>
            <ArrowRight size={15} />
          </a>
        ))}
      </div>
      <div className="panel section">
        <Tabs value={tab} onValueChange={(v) => setTab(String(v))}>
          <TabsList>
            <TabsTrigger value="data">Seus dados</TabsTrigger>
            <TabsTrigger value="address">Endereço</TabsTrigger>
            <TabsTrigger value="password">Senha</TabsTrigger>
            <TabsTrigger value="reviews">Avaliações</TabsTrigger>
          </TabsList>
          <TabsContent value="data">
            <ActionForm
              button="Salvar dados"
              onSubmit={async (f: FormData) => {
                await api('/account', 'PATCH', { name: f.get('name') });
                await app.refresh();
              }}
            >
              <Field
                label="Nome"
                name="name"
                defaultValue={u.name}
                required
                minLength={2}
              />
              <Field label="E-mail" type="email" value={u.email} readOnly />
              <p className="small muted">
                O e-mail identifica sua conta e seus pagamentos.
              </p>
            </ActionForm>
          </TabsContent>
          <TabsContent value="address">
            <ActionForm
              button="Salvar endereço"
              onSubmit={async (f: FormData) => {
                await api('/account', 'PATCH', {
                  name: u.name,
                  address: readAddress(f),
                });
                await app.refresh();
              }}
            >
              <AddressFields value={u.address} />
            </ActionForm>
          </TabsContent>
          <TabsContent value="password">
            <ActionForm
              button="Alterar senha"
              onSubmit={async (f: FormData) => {
                await api('/account/password', 'POST', Object.fromEntries(f));
              }}
            >
              <Field
                label="Senha atual"
                name="current"
                type="password"
                required
                autoComplete="current-password"
              />
              <Field
                label="Nova senha"
                name="password"
                type="password"
                required
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
              />
            </ActionForm>
          </TabsContent>
          <TabsContent value="reviews">
            <MyReviews />
          </TabsContent>
        </Tabs>
      </div>
      <button
        className="btn ghost section"
        onClick={() =>
          app.act(async () => {
            await api('/auth/logout', 'POST');
            await app.refresh();
            go('/');
          }, 'Você saiu da sua conta.')
        }
      >
        <LogOut size={17} />
        Sair da conta
      </button>
    </>
  );
}
function MyReviews() {
  const { data, error, reload } = useData('/reviews'),
    app = useApp();
  return error ? (
    <ErrorBox message={error} />
  ) : !data ? (
    <Loading />
  ) : (
    <ReviewList
      items={data.filter((r: any) => r.user_id === app.data.user.id)}
      reload={reload}
    />
  );
}
export function Notifications() {
  const app = useApp();
  if (!app.data.user) return <NeedAuth />;
  return <NotificationsContent />;
}
function NotificationsContent() {
  const { data, error, reload } = useData('/notifications'),
    app = useApp();
  if (error) return <ErrorBox message={error} />;
  if (!data) return <Loading />;
  return (
    <>
      <Heading title="Notificações" sub="Atualizações que merecem sua atenção.">
        <button
          className="btn secondary"
          onClick={() =>
            app.act(async () => {
              await api('/notifications/read', 'POST');
              reload();
              await app.refresh();
            }, 'Notificações marcadas como lidas.')
          }
        >
          Marcar como lidas
        </button>
      </Heading>
      <div className="stack">
        {data.map((n: any) => (
          <a
            className={'panel notification ' + (!n.seen ? 'unread' : '')}
            href={n.href}
            key={n.id}
          >
            <Bell size={18} />
            <div>
              <p>{n.text}</p>
              <small>{date(n.created)}</small>
            </div>
            <ArrowRight size={18} />
          </a>
        ))}
        {!data.length && (
          <EmptyState
            title="Tudo em dia por aqui"
            text="As novidades dos seus pedidos e da sua loja aparecerão aqui."
            href=""
          />
        )}
      </div>
    </>
  );
}
export function Support({ id }: any) {
  const app = useApp();
  if (!app.data.user) return <NeedAuth />;
  return id ? <Ticket id={id} /> : <Tickets />;
}
function Tickets() {
  const { data, error } = useData('/tickets');
  return (
    <>
      <Heading
        title="Seus atendimentos"
        sub="Um lugar para acompanhar cada conversa."
      />
      {error ? (
        <ErrorBox message={error} />
      ) : !data ? (
        <Loading />
      ) : data.length ? (
        <div className="stack">
          {data.map((t: any) => (
            <a className="panel sumrow" href={'/suporte/' + t.id} key={t.id}>
              <div>
                <h3>
                  #{t.id} · {t.type}
                </h3>
                <p>
                  {t.status === 'closed' ? 'Resolvido' : 'Em atendimento'} ·{' '}
                  {date(t.created)}
                </p>
              </div>
              <ArrowRight />
            </a>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nenhum atendimento aberto"
          text="Para pedir ajuda com uma compra, abra o pedido e selecione Abrir atendimento."
          href="/pedidos"
          action="Ver meus pedidos"
        />
      )}
    </>
  );
}
function Ticket({ id }: any) {
  const { data: t, error, reload } = useData('/tickets/' + id),
    app = useApp();
  if (error) return <ErrorBox message={error} />;
  if (!t) return <Loading />;
  return (
    <div className="narrow">
      <Heading
        title={'Atendimento #' + t.id}
        sub={
          t.type +
          ' · ' +
          (t.status === 'closed' ? 'Resolvido' : 'Em atendimento')
        }
      />
      <a className="more" href={'/pedidos/' + t.order_id}>
        Ver pedido <ArrowRight size={15} />
      </a>
      <div className="panel stack section">
        {t.messages.map((m: any) => (
          <div
            key={m.id}
            className={
              'message ' + (m.user_id === app.data.user.id ? 'mine' : '')
            }
          >
            <strong>{m.name}</strong>
            <p className="preline">{m.text}</p>
            <small>{date(m.created)}</small>
          </div>
        ))}
        <ActionForm
          button="Enviar resposta"
          onSubmit={async (f: FormData) => {
            await api('/tickets/' + id + '/messages', 'POST', {
              text: f.get('text'),
            });
            reload();
          }}
        >
          <Field label="Sua resposta">
            <textarea name="text" required minLength={2} maxLength={3000} />
          </Field>
        </ActionForm>
        <button
          className="btn secondary"
          onClick={() =>
            app.act(async () => {
              await api('/tickets/' + id + '/close', 'POST');
              reload();
            }, 'Atendimento marcado como resolvido.')
          }
        >
          Marcar como resolvido
        </button>
      </div>
    </div>
  );
}
