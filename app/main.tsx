import React, { useEffect, useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Search,
  Heart,
  ShoppingBag,
  UserRound,
  ArrowRight,
  LayoutGrid,
  Compass,
  Package,
  Store,
  Bell,
  MapPin,
  X,
  Home as HomeIcon,
} from 'lucide-react';
import { Ctx, api, go, useData, Loading, ErrorBox, EmptyState } from './shared';
import {
  Home,
  SearchPage,
  Categories,
  Discover,
  Product,
  Shop,
  Stores,
} from './catalog';
import {
  AuthPage,
  Account,
  Cart,
  Favorites,
  Orders,
  OrderDetail,
  Support,
  Notifications,
} from './buyer';
import { SellLanding, SellerSignup, Seller } from './seller';
import { Help, About, Policy, Moderation } from './info';
import './globals.css';
import './pages.css';
function readCart() {
  try {
    const d = JSON.parse(localStorage.getItem('mercaz-cart') || '[]');
    return Array.isArray(d)
      ? d
          .filter(
            (i: any) =>
              Number.isInteger(i.id) &&
              i.id > 0 &&
              Number.isInteger(i.qty) &&
              i.qty > 0 &&
              i.qty <= 99 &&
              typeof i.variant === 'string',
          )
          .slice(0, 50)
      : [];
  } catch {
    return [];
  }
}
function App() {
  const { data, error, reload, setData } = useData('/bootstrap'),
    [path, setPath] = useState(location.pathname + location.search),
    [cart, setCart] = useState<any[]>(readCart),
    [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [q, setQ] = useState(new URLSearchParams(location.search).get('q') || '');
  const refresh = useCallback(async () => {
    const d = await api('/bootstrap');
    setData(d);
  }, [setData]);
  useEffect(() => {
    const pop = () => {
      setPath(location.pathname + location.search);
      setQ(new URLSearchParams(location.search).get('q') || '');
    };
    const click = (e: MouseEvent) => {
      const a = (e.target as Element).closest?.('a');
      if (
        !a ||
        e.defaultPrevented ||
        e.ctrlKey ||
        e.metaKey ||
        e.shiftKey ||
        e.altKey ||
        e.button ||
        a.target ||
        a.hasAttribute('download')
      )
        return;
      const u = new URL(a.href);
      if (
        u.origin !== location.origin ||
        u.pathname.startsWith('/assets/') ||
        u.pathname.startsWith('/uploads/') ||
        u.pathname.startsWith('/api/')
      )
        return;
      if (u.pathname === location.pathname && u.hash) return;
      e.preventDefault();
      go(u.pathname + u.search + u.hash);
    };
    window.addEventListener('popstate', pop);
    document.addEventListener('click', click);
    return () => {
      window.removeEventListener('popstate', pop);
      document.removeEventListener('click', click);
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem('mercaz-cart', JSON.stringify(cart));
    } catch {}
  }, [cart]);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(''), 8000);
    return () => clearTimeout(t);
  }, [message]);
  useEffect(() => {
    const seg = location.pathname.split('/').filter(Boolean);
    const p =
      seg[0] === 'produto'
        ? data?.products.find((p: any) => p.id === Number(seg[1]))
        : null;
    const titles: any = {
      busca: 'Encontre seu próximo achado',
      descobrir: 'Descobrir',
      pedidos: 'Meus pedidos',
      conta: 'Minha conta',
      carrinho: 'Seu carrinho',
      checkout: 'Finalizar compra',
      vendedor: 'Área do vendedor',
    };
    document.title =
      (p?.title || titles[seg[0]] || 'Comprar e vender, em equilíbrio') +
      ' | Mercaz';
  }, [path, data]);
  function updateCart(id: number, variant: string, qty: number) {
    sessionStorage.removeItem('mercaz-checkout-key');
    setCart((c) =>
      qty
        ? c.map((i) =>
            i.id === id && i.variant === variant ? { ...i, qty } : i,
          )
        : c.filter((i) => !(i.id === id && i.variant === variant)),
    );
  }
  function addCart(p: any, qty: number, variant: string) {
    const existing = cart.find((i) => i.id === p.id && i.variant === variant);
    const total = (existing?.qty || 0) + qty;
    const allQty =
      cart.filter((i) => i.id === p.id).reduce((s, i) => s + i.qty, 0) + qty;
    if (allQty > p.stock || total > 99) {
      setMessage('A quantidade ultrapassa o estoque disponível.');
      return false;
    }
    if (!p.variants.includes(variant)) return false;
    sessionStorage.removeItem('mercaz-checkout-key');
    setCart((c) =>
      existing
        ? c.map((i) =>
            i.id === p.id && i.variant === variant ? { ...i, qty: total } : i,
          )
        : [...c, { id: p.id, qty, variant }],
    );
    setMessage('Produto adicionado ao carrinho.');
    return true;
  }
  async function act(fn: () => any, success: string) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
      setMessage(success);
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function favorite(kind: string, item_id: number) {
    if (!data.user) {
      go('/entrar?next=' + encodeURIComponent(location.pathname));
      return;
    }
    await act(async () => {
      await api('/favorites', 'POST', { kind, item_id });
      await refresh();
    }, 'Favoritos atualizados.');
  }
  useEffect(() => {
    const context = (document as any).modelContext;
    if (!context?.registerTool || !data) return;
    const lifecycle = new AbortController();
    Promise.resolve(
      context.registerTool(
        {
          name: 'search_mercaz_products',
          description:
            'Procura produtos disponíveis na Mercaz. Não realiza compras.',
          inputSchema: {
            type: 'object',
            properties: { query: { type: 'string' } },
            required: ['query'],
            additionalProperties: false,
          },
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: async (input: any) => {
            if (typeof input.query !== 'string' || input.query.length > 180)
              throw Error('Busca inválida');
            const rows = await api(
              '/catalog?q=' + encodeURIComponent(input.query),
            );
            return rows
              .slice(0, 20)
              .map((p: any) => ({
                id: p.id,
                title: p.title,
                price_centavos: p.price,
                stock: p.stock,
                variants: p.variants,
              }));
          },
        },
        { signal: lifecycle.signal },
      ),
    ).catch(() => {});
    return () => lifecycle.abort();
  }, [data]);
  if (error)
    return (
      <main className="wrap page">
        <ErrorBox message={error} retry={reload} />
      </main>
    );
  if (!data)
    return (
      <main className="wrap page">
        <Loading />
      </main>
    );
  const segments = location.pathname.split('/').filter(Boolean),
    [route, id, sub] = segments;
  const app = {
    data,
    cart,
    refresh,
    addCart,
    updateCart,
    clearCart: () => setCart([]),
    favorite,
    act,
    flash: setMessage,
    busy,
  };
  let content;
  switch (route) {
    case undefined:
      content = <Home />;
      break;
    case 'busca':
      content = <SearchPage />;
      break;
    case 'categorias':
      content = (
        <>
          <h1 className="mb-8">Um universo de possibilidades</h1>
          <Categories />
          <div className="section">
            <SearchPage />
          </div>
        </>
      );
      break;
    case 'descobrir':
      content = <Discover />;
      break;
    case 'produto':
      content = <Product id={id} />;
      break;
    case 'loja':
      content = <Shop id={id} />;
      break;
    case 'lojas':
      content = <Stores />;
      break;
    case 'entrar':
      content = <AuthPage />;
      break;
    case 'conta':
      content = <Account />;
      break;
    case 'carrinho':
      content = <Cart />;
      break;
    case 'checkout':
      content = <Cart checkout />;
      break;
    case 'favoritos':
      content = <Favorites />;
      break;
    case 'pedidos':
      content = id ? <OrderDetail id={id} /> : <Orders />;
      break;
    case 'suporte':
      content = <Support id={id} />;
      break;
    case 'notificacoes':
      content = <Notifications />;
      break;
    case 'vender':
      content = id === 'cadastro' ? <SellerSignup /> : <SellLanding />;
      break;
    case 'vendedor':
      content = <Seller section={id || ''} id={sub} />;
      break;
    case 'ajuda':
      content = <Help />;
      break;
    case 'sobre':
      content = <About />;
      break;
    case 'politicas':
      content = <Policy slug={id} />;
      break;
    case 'moderacao':
      content = <Moderation />;
      break;
    default:
      content = (
        <EmptyState
          title="Este caminho não levou a um achado"
          text="A página não foi encontrada. Continue explorando a Mercaz."
        />
      );
  }
  return (
    <Ctx.Provider value={app}>
      <a className="skiplink" href="#conteudo">
        Pular para o conteúdo
      </a>
      <div className="topline">
        Mais justo para vender. Melhor para comprar.
        {data.config.demo && (
          <span className="demo-tag">Demonstração · sem cobranças</span>
        )}
      </div>
      <header className="header">
        <div className="wrap headrow">
          <a className="logo" href="/" aria-label="Mercaz, início">
            <img src="/assets/brand.png" alt="" />
            merca<em>z</em>
          </a>
          <form
            className="search"
            onSubmit={(e) => {
              e.preventDefault();
              go('/busca?q=' + encodeURIComponent(q));
            }}
          >
            <input
              aria-label="Buscar produtos, marcas ou lojas"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              maxLength={180}
              placeholder="O que você quer encontrar hoje?"
            />
            <button aria-label="Buscar">
              <Search size={21} />
            </button>
          </form>
          <div className="headlinks">
            <a href={data.user ? '/conta' : '/entrar'} aria-label="Minha conta">
              <UserRound />
              <span>
                <small>
                  {data.user
                    ? 'Olá, ' + data.user.name.split(' ')[0]
                    : 'Boas-vindas!'}
                </small>
                <strong>
                  {data.user ? 'Minha conta' : 'Entre ou cadastre-se'}
                </strong>
              </span>
            </a>
            <a href="/notificacoes" aria-label="Notificações">
              <Bell size={21} />
              {data.unread > 0 && (
                <span className="count">{Math.min(data.unread, 99)}</span>
              )}
            </a>
            <a href="/favoritos" aria-label="Favoritos">
              <Heart size={22} />
            </a>
            <a href="/carrinho" aria-label="Carrinho">
              <ShoppingBag size={23} />
              {cart.length > 0 && (
                <span className="count">
                  {cart.reduce((s, i) => s + i.qty, 0)}
                </span>
              )}
            </a>
          </div>
        </div>
        <nav className="wrap nav">
          <a href="/categorias">
            <LayoutGrid size={17} />
            Categorias
          </a>
          <a
            className={route === 'descobrir' ? 'active' : ''}
            href="/descobrir"
          >
            <Compass size={17} />
            Descobrir
          </a>
          <a href="/busca">Achados da Mercaz</a>
          <a href="/pedidos">Meus pedidos</a>
          <a className="deliverynav" href="/conta">
            <MapPin size={15} />
            {data.user?.address?.zip || 'Informe seu endereço'}
          </a>
          <a
            className="push"
            href={data.user?.seller ? '/vendedor' : '/vender'}
          >
            <Store size={17} />
            {data.user?.seller ? 'Área do vendedor' : 'Vender na Mercaz'}
            <ArrowRight size={15} />
          </a>
        </nav>
      </header>
      <main
        id="conteudo"
        className={'wrap page ' + (route === 'vendedor' ? 'sellerpage' : '')}
        key={path}
      >
        {content}
      </main>
      <footer className="footer">
        <div className="wrap">
          <div className="footergrid">
            <div>
              <a className="logo" href="/">
                merca<em>z</em>
              </a>
              <p>
                Equilíbrio para comprar.
                <br />
                Espaço para crescer.
              </p>
            </div>
            <div>
              <h3>Encontre seu caminho</h3>
              <a href="/descobrir">Descobrir</a>
              <a href="/categorias">Categorias</a>
              <a href="/lojas">Conheça as lojas</a>
            </div>
            <div>
              <h3>Estamos por aqui</h3>
              <a href="/ajuda">Central de ajuda</a>
              <a href="/suporte">Meus atendimentos</a>
              <a href="/politicas/devolucoes">Devoluções e reembolsos</a>
            </div>
            <div>
              <h3>Sobre a Mercaz</h3>
              <a href="/sobre">Nossa ideia de equilíbrio</a>
              <a href="/vender">Venda na Mercaz</a>
              <a href="/politicas/ranking">Como funciona a busca</a>
            </div>
          </div>
          <div className="footnote">
            <span>© {new Date().getFullYear()} Mercaz</span>
            <span>
              <a className="inline-link" href="/politicas/termos">
                Termos de uso
              </a>{' '}
              ·{' '}
              <a className="inline-link" href="/politicas/privacidade">
                Privacidade
              </a>
            </span>
          </div>
        </div>
      </footer>
      <nav className="mobilebar">
        {[
          ['Início', '/', HomeIcon],
          ['Descobrir', '/descobrir', Compass],
          ['Favoritos', '/favoritos', Heart],
          ['Pedidos', '/pedidos', Package],
          ['Conta', '/conta', UserRound],
        ].map(([name, url, I]: any) => (
          <a key={name} href={url}>
            <I />
            {name}
          </a>
        ))}
      </nav>
      {message && (
        <div className="flash" role="status" aria-live="polite">
          <span>{message}</span>
          <button aria-label="Fechar mensagem" onClick={() => setMessage('')}>
            <X size={17} />
          </button>
        </div>
      )}
    </Ctx.Provider>
  );
}
class Boundary extends React.Component<
  React.PropsWithChildren,
  { error: boolean }
> {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    return this.state.error ? (
      <main className="wrap page">
        <h1>Vamos tentar novamente?</h1>
        <p>Ocorreu um problema ao abrir esta tela.</p>
        <a className="btn" href="/">
          Voltar ao início
        </a>
      </main>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById('root')!).render(
  <Boundary>
    <App />
  </Boundary>,
);
