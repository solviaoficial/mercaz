import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import {
  Heart,
  ArrowRight,
  Package,
  Star,
  Check,
  Minus,
  Plus,
  Upload,
} from 'lucide-react';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
export type RecordData = Record<string, any>;
export const Ctx = createContext<any>(null);
export const useApp = () => useContext(Ctx);
export const money = (n: number) =>
  ((n || 0) / 100).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
export const date = (s: string) =>
  new Date(s.includes('T') ? s : s + 'Z').toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
export const statuses: Record<string, string> = {
  pending: 'Aguardando pagamento',
  confirmed: 'Pagamento confirmado',
  preparing: 'Em preparo',
  ready: 'Pronto para envio',
  shipped: 'Enviado',
  transit: 'Em transporte',
  delivered: 'Entregue',
  cancelled: 'Cancelado',
  refunded: 'Reembolsado',
};
export function go(href: string) {
  if (!href.startsWith('/') || href.startsWith('//')) return;
  history.pushState({}, '', href);
  window.dispatchEvent(new Event('popstate'));
  window.scrollTo(0, 0);
}
export async function api(url: string, method = 'GET', body?: any) {
  const r = await fetch('/api' + url, {
    method,
    headers: {
      'X-Mercaz-Client': 'web',
      ...(body instanceof FormData
        ? {}
        : { 'Content-Type': 'application/json' }),
    },
    ...(body
      ? { body: body instanceof FormData ? body : JSON.stringify(body) }
      : {}),
  });
  let d;
  try {
    d = await r.json();
  } catch {
    throw Error('O servidor não respondeu. Tente novamente.');
  }
  if (!r.ok) throw Error(d.error || 'Não foi possível concluir.');
  return d;
}
export function useData(url: string) {
  const [data, setData] = useState<any>(null),
    [error, setError] = useState(''),
    [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  useEffect(() => {
    let active = true;
    setError('');
    setData(null);
    api(url)
      .then((d) => active && setData(d))
      .catch((e) => active && setError(e.message));
    return () => {
      active = false;
    };
  }, [url, version]);
  return { data, error, reload, setData };
}
export function Loading() {
  return (
    <div className="stack" aria-label="Carregando">
      <Skeleton className="h-12 w-1/2" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
export function ErrorBox({
  message,
  retry,
}: {
  message: string;
  retry?: () => void;
}) {
  return (
    <div className="error" role="alert">
      {message}
      {retry && (
        <button className="btn secondary" onClick={retry}>
          Tentar novamente
        </button>
      )}
    </div>
  );
}
export function EmptyState({
  title = 'Nada por aqui ainda',
  text = 'Explore a Mercaz e encontre seu próximo achado.',
  href = '/busca',
  action = 'Explorar produtos',
}: {
  title?: string;
  text?: string;
  href?: string;
  action?: string;
}) {
  return (
    <Empty className="empty">
      <EmptyHeader>
        <Package size={35} />
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{text}</EmptyDescription>
      </EmptyHeader>
      {href && (
        <a className="btn" href={href}>
          {action}
          <ArrowRight size={16} />
        </a>
      )}
    </Empty>
  );
}
export function Heading({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="sectionhead heading">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  );
}
export function Field({ label, children, ...props }: any) {
  return (
    <label className="field">
      <span>{label}</span>
      {children || <input {...props} />}
    </label>
  );
}
export function Pick({ label, value, onChange, options }: any) {
  return (
    <div className="field">
      {label && <span>{label}</span>}
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger aria-label={label || 'Selecionar'} className="picker">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o: any) => (
            <SelectItem
              key={typeof o === 'string' ? o : o.value}
              value={typeof o === 'string' ? o : o.value}
            >
              {typeof o === 'string' ? o : o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
export function Modal({ open, onClose, title, description, children }: any) {
  return (
    <Dialog open={open} onOpenChange={(v: boolean) => !v && onClose()}>
      <DialogContent className="modal">
        <DialogTitle className="modal-title">{title}</DialogTitle>
        <DialogDescription className="muted">
          {description || 'Preencha os dados abaixo para continuar.'}
        </DialogDescription>
        {children}
      </DialogContent>
    </Dialog>
  );
}
export function Stars({ value = 0, count }: any) {
  return (
    <span className="stars">
      <Star size={13} fill={value ? '#b58a37' : 'none'} />
      {value ? Number(value).toFixed(1) : 'Sem avaliações'}
      {count > 0 && <span className="muted"> ({count})</span>}
    </span>
  );
}
export function ProductCard({ p }: any) {
  const app = useApp(),
    saved = app.data.favorites.some(
      (f: any) => f.kind === 'product' && f.item_id === p.id,
    );
  return (
    <article className="card">
      <button
        className="heart"
        aria-label={saved ? 'Remover dos favoritos' : 'Salvar nos favoritos'}
        aria-pressed={saved}
        onClick={() => app.favorite('product', p.id)}
      >
        <Heart size={17} fill={saved ? '#74162d' : 'none'} color="#74162d" />
      </button>
      <a className="cardphoto" href={'/produto/' + p.id}>
        <img src={p.images[0]} alt={p.title} loading="lazy" />
      </a>
      <div className="cardbody">
        <a href={'/produto/' + p.id}>
          <h3>{p.title}</h3>
        </a>
        <div className="storeline">
          <a href={'/loja/' + p.store_id}>{p.store_name}</a>
          <Stars value={p.rating} count={p.review_count} />
        </div>
        <div className="price">{money(p.price)}</div>
        <div className="delivery">
          {p.shipping === 0 ? 'Frete grátis' : `Frete ${money(p.shipping)}`} ·
          preparo até {p.prep_days} dias
        </div>
        {!p.stock && <span className="label">Sem estoque</span>}
      </div>
    </article>
  );
}
export function Grid({ items }: any) {
  return items.length ? (
    <div className="grid">
      {items.map((p: any) => (
        <ProductCard key={p.id} p={p} />
      ))}
    </div>
  ) : (
    <EmptyState
      title="Nenhum produto encontrado"
      text="Experimente outra busca ou remova os filtros."
    />
  );
}
export function Quantity({ value, onChange, max = 99 }: any) {
  return (
    <div className="quantity">
      <button
        aria-label="Diminuir quantidade"
        disabled={value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={14} />
      </button>
      <span>{value}</span>
      <button
        aria-label="Aumentar quantidade"
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={14} />
      </button>
    </div>
  );
}
export function UploadField({ value, onChange, video = false }: any) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  async function upload(files: FileList | null) {
    if (!files) return;
    setBusy(true);
    setError('');
    try {
      const results = [];
      for (const f of Array.from(files)) {
        const data = new FormData();
        data.append('file', f);
        results.push((await api('/uploads', 'POST', data)).url);
      }
      onChange([...value, ...results].slice(0, 6));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="stack">
      <label className="upload">
        <Upload size={22} />
        <span>
          {busy
            ? 'Enviando…'
            : video
              ? 'Adicionar fotos ou vídeo'
              : 'Adicionar fotos'}
          <small>
            {video ? 'Vídeos até 30 MB. ' : ''}Fotos até 8 MB. Até 6 arquivos.
          </small>
        </span>
        <input
          type="file"
          accept={
            video
              ? 'image/jpeg,image/png,image/webp,video/mp4,video/webm'
              : 'image/jpeg,image/png,image/webp'
          }
          multiple
          disabled={busy || value.length >= 6}
          onChange={(e) => upload(e.target.files)}
        />
      </label>
      {error && <ErrorBox message={error} />}
      <div className="thumbs">
        {value.map((u: string) => (
          <div key={u}>
            {/\.(mp4|webm)$/.test(u) ? (
              <video src={u} controls />
            ) : (
              <img src={u} alt="Arquivo enviado" />
            )}
            <button
              className="more"
              type="button"
              onClick={() => onChange(value.filter((x: string) => x !== u))}
            >
              Remover
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
export function ActionForm({
  onSubmit,
  children,
  button = 'Salvar',
  className = 'stack',
  after,
}: any) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [done, setDone] = useState('');
  return (
    <form
      className={className}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setError('');
        setDone('');
        try {
          await onSubmit(new FormData(e.currentTarget));
          setDone('Salvo com sucesso.');
          after?.();
        } catch (e: any) {
          setError(e.message);
        } finally {
          setBusy(false);
        }
      }}
    >
      {children}
      {error && <ErrorBox message={error} />}
      <button className="btn" disabled={busy}>
        {busy ? 'Aguarde…' : button}
        <Check size={16} />
      </button>
      {done && (
        <p className="success" role="status">
          {done}
        </p>
      )}
    </form>
  );
}
export function AddressFields({ value = {} }: any) {
  return (
    <div className="formgrid">
      <Field
        label="Nome de quem recebe"
        name="name"
        required
        defaultValue={value.name}
        autoComplete="name"
      />
      <Field
        label="CEP"
        name="zip"
        required
        pattern="[0-9]{5}-?[0-9]{3}"
        defaultValue={value.zip}
        autoComplete="postal-code"
        placeholder="00000-000"
      />
      <Field
        label="Rua ou avenida"
        name="street"
        required
        defaultValue={value.street}
        autoComplete="address-line1"
      />
      <Field
        label="Número"
        name="number"
        required
        defaultValue={value.number}
      />
      <Field
        label="Complemento (opcional)"
        name="extra"
        defaultValue={value.extra}
      />
      <Field
        label="Cidade"
        name="city"
        required
        defaultValue={value.city}
        autoComplete="address-level2"
      />
      <Field
        label="Estado (UF)"
        name="state"
        required
        minLength={2}
        maxLength={2}
        defaultValue={value.state}
        autoComplete="address-level1"
      />
    </div>
  );
}
export function readAddress(f: FormData) {
  return Object.fromEntries(
    ['name', 'zip', 'street', 'number', 'extra', 'city', 'state'].map((k) => [
      k,
      f.get(k),
    ]),
  );
}
