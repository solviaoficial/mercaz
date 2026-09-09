import React, { useState } from 'react';
import { Search, ArrowRight, Scale, ShieldCheck, Store } from 'lucide-react';
import {
  useApp,
  useData,
  api,
  Heading,
  EmptyState,
  ErrorBox,
  Loading,
} from './shared';
const faqs = [
  [
    'comprador',
    'Como acompanho minha compra?',
    'Entre em Meus pedidos e abra a compra. A linha do tempo mostra pagamento, preparo, envio, transporte e entrega.',
  ],
  [
    'comprador',
    'Como funciona o pagamento?',
    'O checkout gera um Pix por loja. O preparo começa após confirmação do Mercado Pago. Não é necessário enviar comprovantes para marcar um pagamento como aprovado.',
  ],
  [
    'comprador',
    'Como pedir uma devolução ou resolver um problema?',
    'Abra o pedido, escolha Abrir atendimento e descreva o problema. A loja recebe a solicitação. A conversa e a resolução ficam registradas.',
  ],
  [
    'comprador',
    'Como avaliar e enviar um vídeo?',
    'Confirme o recebimento no pedido e selecione Avaliar compra. Você pode dar uma nota, escrever sua opinião e anexar fotos ou um vídeo.',
  ],
  [
    'comprador',
    'O que define a ordem dos resultados?',
    'A busca considera o texto pesquisado, a disponibilidade e as avaliações visíveis. Você também pode ordenar por preço e nota. Não vendemos posições nos resultados.',
  ],
  [
    'vendedor',
    'Como começo a vender?',
    'Crie sua conta e cadastre a loja. Informe identidade, prazo de preparo, prazo de transporte e frete fixo nacional. Depois, crie seus anúncios e conecte o Mercado Pago.',
  ],
  [
    'vendedor',
    'Como recebo o dinheiro das vendas?',
    'Conecte sua própria conta Mercado Pago nas configurações da loja. O provedor processa o pagamento, desconta as tarifas e a comissão da Mercaz. Consulte a liberação do dinheiro no Mercado Pago.',
  ],
  [
    'vendedor',
    'Posso pausar minha loja?',
    'Sim. Acesse Configurações e ative Pausar novas vendas. Os pedidos já realizados continuam disponíveis e devem ser atendidos.',
  ],
  [
    'vendedor',
    'O assistente muda meus anúncios sozinho?',
    'Não. Você revisa as sugestões, escolhe se quer aplicá-las ao rascunho e salva o anúncio.',
  ],
  [
    'vendedor',
    'Como despacho um pedido?',
    'Em Pedidos, avance de confirmado para preparo e pronto para envio. Ao enviar, informe a transportadora e o rastreio. A postagem é realizada pela sua operação.',
  ],
];
export function Help() {
  const [q, setQ] = useState(''),
    [audience, setAudience] = useState('comprador');
  return (
    <div className="narrow">
      <Heading
        title="Vamos encontrar uma resposta."
        sub="Ajuda clara para comprar e vender."
      />
      <div className="filterbar">
        <button
          className={'btn ' + (audience === 'comprador' ? '' : 'secondary')}
          onClick={() => setAudience('comprador')}
        >
          Quero comprar
        </button>
        <button
          className={'btn ' + (audience === 'vendedor' ? '' : 'secondary')}
          onClick={() => setAudience('vendedor')}
        >
          Quero vender
        </button>
      </div>
      <div className="search mb-6">
        <input
          aria-label="Buscar na ajuda"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Qual é a sua dúvida?"
        />
        <span className="p-4">
          <Search size={19} />
        </span>
      </div>
      <div className="stack">
        {faqs
          .filter(
            ([a, t, b]) =>
              a === audience &&
              (t + ' ' + b).toLowerCase().includes(q.toLowerCase()),
          )
          .map(([, t, b]) => (
            <details className="panel faq" key={t}>
              <summary>{t}</summary>
              <p>{b}</p>
            </details>
          ))}
      </div>
      <div className="panel section stack">
        <h2>É sobre uma compra específica?</h2>
        <p>
          Abra um atendimento dentro do pedido para que a loja tenha todas as
          informações.
        </p>
        <a className="btn" href="/pedidos">
          Ver meus pedidos <ArrowRight size={16} />
        </a>
        <a className="more" href="/suporte">
          Acompanhar meus atendimentos
        </a>
      </div>
    </div>
  );
}
export function About() {
  return (
    <div className="narrow">
      <div className="abouthead">
        <img src="/assets/brand.png" alt="Mercaz" />
        <div className="eyebrow">
          O crescimento precisa fazer sentido para todos
        </div>
        <h1>
          Equilíbrio para comprar.
          <br />
          Espaço para crescer.
        </h1>
      </div>
      <div className="prose">
        <p>
          A Mercaz nasce de uma ideia simples: o comprador e o vendedor não
          precisam estar em lados opostos. Bons produtos, informação clara e
          compromissos cumpridos fazem os dois quererem voltar.
        </p>
        <h2>Mais do que uma taxa</h2>
        <p>
          Queremos que o vendedor preserve sua autonomia e que o comprador
          entenda o que está escolhendo. Por isso, mostramos preço, frete, prazo
          de preparo, loja e avaliações antes da compra.
        </p>
        <h2>Descobrir também é comprar melhor</h2>
        <p>
          Às vezes, a busca começa com um produto. Em outras, começa com uma
          vontade: cuidar da casa, melhorar a rotina ou começar algo novo. A
          Mercaz dá espaço às duas formas de encontrar.
        </p>
        <h2>Confiança que vem da experiência</h2>
        <p>
          Avaliações são vinculadas a compras entregues. Fotos e vídeos podem
          mostrar o uso real, incluindo as limitações. Não basta parecer bom na
          foto.
        </p>
        <h2>Crescer sem pagar para existir</h2>
        <p>
          Os resultados orgânicos não são um leilão de anúncios. A ordenação usa
          critérios que o comprador pode entender, e o vendedor encontra
          ferramentas para melhorar o próprio negócio.
        </p>
        <a className="btn" href="/descobrir">
          Descobrir a Mercaz <ArrowRight size={16} />
        </a>
      </div>
    </div>
  );
}
const policies: Record<
  string,
  { title: string; sections: [string, string][] }
> = {
  termos: {
    title: 'Termos de uso e compra',
    sections: [
      [
        'A Mercaz e as lojas',
        'A Mercaz conecta compradores e vendedores independentes. Cada anúncio identifica a loja responsável pelo produto, sua descrição, estoque, preço, preparo e entrega. As condições exibidas no checkout compõem o registro do pedido.',
      ],
      [
        'Conta e segurança',
        'Mantenha seus dados corretos e sua senha protegida. Você é responsável pelo uso autorizado de sua conta. Não use a plataforma para fraude, anúncios enganosos, violação de direitos ou conteúdo proibido.',
      ],
      [
        'Pagamento e pedidos',
        'Os pedidos são separados por loja. O pagamento é feito com Pix por meio do Mercado Pago. A confirmação é obtida junto ao provedor. Pedidos sem pagamento não seguem para preparo. Pagamentos pendentes podem ser cancelados quando expirarem.',
      ],
      [
        'Entrega e atendimento',
        'O prazo informado considera preparo e transporte em dias corridos após a confirmação do pagamento. O frete fixo da loja é informado antes da compra. Use o atendimento do pedido para registrar imprevistos.',
      ],
      [
        'Resolução de problemas',
        'Solicitações de cancelamento, devolução, produto divergente ou atraso ficam registradas no suporte do pedido. A loja e a operação da plataforma devem conduzir a resolução conforme as condições de compra e a legislação aplicável.',
      ],
    ],
  },
  privacidade: {
    title: 'Privacidade e seus dados',
    sections: [
      [
        'Dados usados no serviço',
        'Guardamos nome, e-mail, senha protegida por hash, endereço, pedidos, anúncios, avaliações, perguntas, mensagens e arquivos enviados. Esses dados permitem operar a conta, processar a compra e prestar atendimento.',
      ],
      [
        'Pagamento',
        'O CPF informado no pagamento é transmitido ao Mercado Pago para gerar o Pix. A solicitação é guardada temporariamente de forma criptografada para recuperação de falhas e removida quando o pagamento é vinculado ao pedido. Tokens de conexão das lojas são guardados criptografados no servidor. O Mercado Pago trata os dados sob suas próprias condições.',
      ],
      [
        'Compartilhamento necessário',
        'A loja responsável recebe dados de entrega e os registros necessários para atender a compra. O conteúdo publicado em avaliações, perguntas e anúncios fica visível aos visitantes. Evite publicar informações pessoais de terceiros.',
      ],
      [
        'Armazenamento no navegador',
        'Um cookie de sessão mantém sua conta conectada. O carrinho é salvo neste navegador para você continuar depois. Não usamos publicidade comportamental ou rastreadores externos nesta versão.',
      ],
      [
        'Seus pedidos sobre dados',
        'Use o canal de contato do operador informado nesta página para solicitar acesso, correção ou exclusão de dados. Alguns registros podem precisar ser preservados para cumprir obrigações ou resolver transações.',
      ],
      [
        'Assistência de anúncios',
        'Quando a IA está configurada, título e descrição enviados ao assistente são transmitidos ao provedor para gerar sugestões. Não inclua dados pessoais ou segredos nesse conteúdo.',
      ],
    ],
  },
  devolucoes: {
    title: 'Devoluções, cancelamentos e reembolsos',
    sections: [
      [
        'Antes do pagamento',
        'Um pedido aguardando Pix pode ser cancelado pela tela do pedido. O cancelamento é consultado no provedor quando há uma cobrança emitida.',
      ],
      [
        'Depois do pagamento',
        'Abra o pedido e selecione Abrir atendimento. Informe se deseja cancelar, devolver ou relatar um problema e descreva o ocorrido. Você pode acompanhar a conversa e as atualizações na área de suporte.',
      ],
      [
        'Devolução do produto',
        'Combine com a loja a logística de devolução pelo atendimento. Guarde as informações do envio. Não envie itens a endereços informados fora da conversa sem conferir a identidade do destinatário.',
      ],
      [
        'Reembolso',
        'A loja pode solicitar o reembolso integral do pedido pelo Mercado Pago. O estado do pedido muda após a confirmação do provedor. O processamento financeiro depende do provedor; acompanhe o resultado no pedido e em sua conta de pagamento.',
      ],
      [
        'Direitos e condições',
        'As condições operacionais da loja não afastam os direitos aplicáveis ao comprador. Prazos específicos, responsáveis e canais oficiais devem ser definidos pelo operador antes da abertura comercial da plataforma.',
      ],
    ],
  },
  vendedores: {
    title: 'Regras para vender na Mercaz',
    sections: [
      [
        'Catálogo responsável',
        'Publique apenas produtos que pode vender e entregar. Use imagens autorizadas, descrições corretas e estoque atualizado. Informe variações, características, garantia e conteúdo da embalagem de forma objetiva.',
      ],
      [
        'Preparo e envio',
        'Você define seu prazo de preparo, o transporte estimado e o frete fixo nacional. Inclua fins de semana na estimativa em dias corridos. Atualize o pedido quando estiver pronto e informe transportadora e rastreio ao enviar.',
      ],
      [
        'Custos e recebimento',
        'A comissão configurada da Mercaz incide sobre os produtos e é mostrada antes do cadastro da loja. As tarifas do Mercado Pago são separadas. A conta conectada da loja recebe os pagamentos por meio do provedor.',
      ],
      [
        'Visibilidade',
        'Não é necessário comprar posições na busca. Mantenha o anúncio claro, disponível e correto. A experiência real do comprador aparece nas avaliações vinculadas a compras entregues.',
      ],
      [
        'Suporte e opinião',
        'Responda perguntas e atendimentos com clareza. Uma avaliação negativa não é motivo para remoção por si só. Denuncie conteúdo impróprio para análise da moderação.',
      ],
    ],
  },
  ranking: {
    title: 'Como organizamos os resultados',
    sections: [
      [
        'Busca',
        'A pesquisa compara o termo com título, categoria, descrição e nome da loja, sem diferenciar acentos ou letras maiúsculas.',
      ],
      [
        'Relevância nesta versão',
        'Entre os produtos encontrados, anúncios com estoque aparecem primeiro. Em seguida, usamos a média das avaliações visíveis e o título como critério estável de desempate. Não há pagamento por posição.',
      ],
      [
        'Sua escolha',
        'Você pode ordenar por menor preço, maior preço ou melhor avaliação e limitar por categoria, preço máximo e disponibilidade.',
      ],
      [
        'Descoberta',
        'As coleções de Descobrir são editoriais por contexto. Não usamos perfis de publicidade nem afirmamos uma personalização que ainda não existe.',
      ],
    ],
  },
};
export function Policy({ slug = 'termos' }: any) {
  const app = useApp(),
    p = policies[slug];
  if (!p) return <EmptyState title="Página não encontrada" />;
  return (
    <div className="narrow">
      <Heading
        title={p.title}
        sub="Regras que você consegue encontrar e entender."
      />
      {!app.data.config.policiesConfigured && (
        <div className="notice">
          Ambiente em preparação: estas condições ainda precisam ser finalizadas
          pelo operador antes da abertura para vendas reais.
        </div>
      )}
      <div className="policytabs">
        {Object.entries(policies).map(([k, v]) => (
          <a
            key={k}
            className={slug === k ? 'active' : ''}
            href={'/politicas/' + k}
          >
            {v.title}
          </a>
        ))}
      </div>
      <div className="prose">
        {p.sections.map(([t, b]) => (
          <section key={t}>
            <h2>{t}</h2>
            <p>{b}</p>
          </section>
        ))}
        <section>
          <h2>Operador e contato</h2>
          <p>{app.data.config.operator}</p>
          {app.data.config.support ? (
            <a className="more" href={'mailto:' + app.data.config.support}>
              {app.data.config.support}
            </a>
          ) : (
            <p>
              Canal de contato em configuração. Para pedidos de demonstração,
              use o atendimento interno.
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
export function Moderation() {
  const { data, error, reload } = useData('/admin/reports'),
    app = useApp();
  return (
    <>
      <Heading
        title="Moderação"
        sub="Analise conteúdo com base nas regras, preservando o direito à opinião."
      />
      {error ? (
        <ErrorBox message={error} />
      ) : !data ? (
        <Loading />
      ) : (
        <div className="stack">
          {data.map((r: any) => (
            <div className="panel stack" key={r.id}>
              <span className="label">
                {r.status === 'open' ? 'Em análise' : 'Analisada'}
              </span>
              <h3>Denúncia #{r.id}</h3>
              <p>
                <strong>Motivo:</strong> {r.reason}
              </p>
              <p>
                <strong>Avaliação:</strong> {r.review_text}
              </p>
              {r.status === 'open' && (
                <div className="inline">
                  <button
                    className="btn"
                    onClick={() =>
                      app.act(async () => {
                        await api('/admin/reports/' + r.id, 'POST', {
                          hide: true,
                        });
                        reload();
                      }, 'Conteúdo ocultado.')
                    }
                  >
                    Ocultar conteúdo
                  </button>
                  <button
                    className="btn secondary"
                    onClick={() =>
                      app.act(async () => {
                        await api('/admin/reports/' + r.id, 'POST', {
                          hide: false,
                        });
                        reload();
                      }, 'Denúncia encerrada.')
                    }
                  >
                    Manter conteúdo
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
