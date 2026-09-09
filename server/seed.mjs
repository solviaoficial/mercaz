const series = async (items, fn) => { for (const [i,item] of items.entries()) await fn(item,i); };
import { one, run, passwordHash, transaction } from './db.mjs';
import { postgres } from './db.mjs';
export async function seed() {
    if (process.env.SEED_DEMO !== 'true' || await one('SELECT id FROM users LIMIT 1'))
        return;
    const pass = process.env.DEMO_PASSWORD;
    if (!pass || pass.length < 12)
        throw Error('Defina DEMO_PASSWORD com pelo menos 12 caracteres para criar o catálogo de demonstração.');
    await transaction(async () => {
        await run('INSERT INTO users(id,name,email,password) VALUES(1,?,?,?)', 'Visitante Demo', 'comprador@mercaz.local', passwordHash(pass));
        const shops = [
            [
                'Casa Aurora',
                'Objetos que deixam a casa com a sua personalidade. Design, cuidado e boas ideias para morar.',
            ],
            ['Tech & Co.', 'Tecnologia para deixar a rotina mais simples.'],
            [
                'Cozinha Viva',
                'Utensílios para cozinhar, organizar e aproveitar o dia.',
            ],
            [
                'Novos Caminhos',
                'Acessórios para se movimentar e descobrir novas possibilidades.',
            ],
        ];
        await series(shops, async ([name, description], i) => {
            await run('INSERT INTO users(id,name,email,password) VALUES(?,?,?,?)', i + 2, name, `vendedor${i + 1}@mercaz.local`, passwordHash(pass));
            await run('INSERT INTO stores(id,user_id,name,description,prep_days,shipping,shipping_days) VALUES(?,?,?,?,?,?,?)', i + 1, i + 2, name, description, i === 0 ? 2 : 1, i === 1 ? 0 : 1990, 5);
        });
        const products = [
            [101, 2, 'Apple AirPods Max Silver', 'Tecnologia', 329900, 12, 'Prata'],
            [
                47,
                1,
                'Luminária de mesa',
                'Casa e decoração',
                14990,
                18,
                'Modelo único',
            ],
            [
                14,
                1,
                'Cadeira Saarinen executiva',
                'Casa e decoração',
                89990,
                8,
                'Modelo único',
            ],
            [65, 3, 'Marmita com divisórias', 'Cozinha', 7990, 24, 'Modelo único'],
            [46, 1, 'Vaso decorativo', 'Casa e decoração', 8990, 15, 'Modelo único'],
            [
                53,
                3,
                'Tábua de madeira para cozinha',
                'Cozinha',
                6990,
                20,
                'Modelo único',
            ],
            [100, 2, 'Apple AirPods', 'Tecnologia', 109990, 7, 'Branco'],
            [
                175,
                4,
                'Mochila branca em material sintético',
                'Moda e acessórios',
                18990,
                10,
                'Branco',
            ],
            [152, 4, 'Raquete de tênis', 'Esporte', 24990, 4, 'Modelo único'],
            [
                6,
                4,
                'Calvin Klein CK One — fragrância',
                'Beleza',
                28990,
                9,
                'Modelo único',
            ],
            [
                12,
                1,
                'Sofá Annibale Colombo',
                'Casa e decoração',
                389990,
                3,
                'Modelo único',
            ],
            [73, 3, 'Organizador de temperos', 'Cozinha', 12990, 16, 'Modelo único'],
        ];
        await series(products, async ([id, store, title, category, price, stock, v]) => await run('INSERT INTO products(id,store_id,title,description,category,price,stock,images,variants) VALUES(?,?,?,?,?,?,?,?,?)', id, store, title, `${title}. Item do catálogo de demonstração da Mercaz. Imagens ilustrativas. Para uma venda real, o vendedor deve preencher material, medidas, conteúdo da embalagem, garantia e condições específicas do produto.`, category, price, stock, JSON.stringify([`/assets/product-${id}.webp`]), JSON.stringify([v])));
        if(postgres) for(const table of ['users','stores','products']) await one(`SELECT setval(pg_get_serial_sequence('${table}','id'),(SELECT max(id) FROM ${table}))`);
    });
}
