import type { Category } from '../../types/finance';

/**
 * Smart categorization dictionary based on common Brazilian bank statement descriptions.
 */
const CATEGORY_KEYWORDS: Array<{
  categoryIdHint: string;
  fallbackCategoryIdHint?: string;
  keywords: string[];
}> = [
  {
    categoryIdHint: 'cat-restaurantes',
    keywords: [
      'ifood', 'rappi', 'uber eats', 'restaurante', 'lanchonete', 'bar', 'pizzaria',
      'churrascaria', 'sushi', 'acai', 'sorveteria', 'adega', 'mc donalds', 'mcdonalds',
      'burger king', 'burguer', 'subway', 'habib', 'outback', 'madero', 'coco bambu', 'giraffas',
      'spoleto', 'china in box', 'delivery', 'hamburgueria', 'espetinho', 'marmita', 'almoco',
      'jantar',
    ],
  },
  {
    categoryIdHint: 'cat-cafe',
    keywords: [
      'padaria', 'cafeteria', 'starbucks', 'kopenhagen', 'cacau show', 'confeitaria',
      'panificadora', 'doceria',
    ],
  },
  {
    // Antes de supermercado: "mercado livre" é loja online, não mercado de bairro.
    categoryIdHint: 'cat-compras',
    keywords: ['mercado livre', 'mercadolivre'],
  },
  {
    categoryIdHint: 'cat-mercado',
    keywords: [
      'supermercado', 'mercado', 'carrefour', 'pao de acucar', 'atacadao', 'assai', 'extra',
      'muffato', 'hortifruti', 'sacolao', 'dia brasil', 'mercearia', 'hipermercado', 'sonda',
      'st marche', 'acougue', 'apolo', 'big bompreco', 'bompreco', 'guanabara',
      'prezunic', 'supernosso', 'savegnago', 'condor', 'angeloni', 'zaffari', 'comper',
      'fort atacadista', 'makro', 'sams club',
    ],
  },
  {
    categoryIdHint: 'cat-farmacia',
    keywords: [
      'farmacia', 'drogaria', 'raia', 'drogasil', 'pague menos', 'panvel', 'droga raia', 'drogal',
      'ultrafarma', 'pacheco', 'nissei', 'onofre', 'farma',
    ],
  },
  {
    categoryIdHint: 'cat-plano-saude',
    keywords: [
      'unimed', 'amil', 'bradesco saude', 'sulamerica saude', 'hapvida', 'notredame',
      'intermedica', 'porto saude', 'plano de saude',
    ],
  },
  {
    categoryIdHint: 'cat-saude',
    keywords: [
      'hospital', 'clinica', 'laboratorio', 'medico', 'dentista', 'odontologia', 'fleury', 'dasa',
      'lavoisier', 'psicologo', 'psiquiatra', 'fisioterapia', 
      'oftalmologista', 'nutricionista',
    ],
  },
  {
    categoryIdHint: 'cat-pets',
    keywords: [
      'petz', 'cobasi', 'petlove', 'veterinario', 'veterinaria', 'pet shop', 'petshop', 'racao',
      'banho e tosa',
    ],
  },
  {
    categoryIdHint: 'cat-veiculo',
    keywords: [
      'oficina', 'mecanica', 'auto pecas', 'autopecas', 'lavagem', 'lava rapido', 'seguro auto',
      'porto seguro auto', 'borracharia', 'funilaria', 'troca de oleo', 'pneu', 'estacionamento',
      'estapar', 
    ],
  },
  {
    categoryIdHint: 'cat-transporte',
    keywords: [
      'uber', '99app', '99 tecnologia', '99 pop', 'posto', 'combustivel', 'gasolina', 'etanol',
      'shell', 'ipiranga', 'br distribuidora', 'ale combustiveis', 'pedagio', 'sem parar',
      'conectcar', 'veloe', 'metro', 'cptm', 'sptrans', 'bilhete unico', 'auto posto', 'onibus',
      'passagem rodoviaria', 'buser', 'cabify', 'indriver', 'taxi',
    ],
  },
  {
    categoryIdHint: 'cat-assinaturas',
    fallbackCategoryIdHint: 'cat-lazer',
    keywords: [
      'amazon prime', 'prime video', 'netflix', 'spotify', 'disney', 'hbo max', 'max.com',
      'youtube premium', 'globoplay', 'deezer', 'apple.com bill', 'icloud', 'google one',
      'paramount', 'crunchyroll', 'star plus', 'telecine', 'premiere', 'dropbox', 'chatgpt',
      'openai', 'canva', 'adobe', 'microsoft 365', 'xbox game pass', 'ps plus', 'playstation plus',
    ],
  },
  {
    categoryIdHint: 'cat-lazer',
    keywords: [
      'cinema', 'cinemark', 'uci cinema', 'steam', 'playstation', 'xbox', 'nintendo', 'ingresso',
      'sympla', 'eventim', 'teatro', 'show', 'boliche', 'karaoke', 'epic games',
      'balada', 'museu',
    ],
  },
  {
    categoryIdHint: 'cat-viagens',
    keywords: [
      'latam', 'gol linhas', 'azul linhas', 'booking', 'airbnb', 'decolar', 'hotel', 'pousada',
      'hostel', 'cvc', '123milhas', 'maxmilhas', 'smiles', 'hurb', 'expedia', 'passagem aerea',
      'aluguel de carro', 'localiza', 'movida', 'unidas',
    ],
  },
  {
    categoryIdHint: 'cat-academia',
    keywords: [
      'smartfit', 'smart fit', 'bluefit', 'bodytech', 'academia', 'crossfit', 'pilates', 'natacao',
      'gympass', 'wellhub', 'totalpass', 'personal trainer',
    ],
  },
  {
    categoryIdHint: 'cat-beleza',
    keywords: [
      'salao', 'barbearia', 'cabeleireiro', 'manicure', 'boticario', 'natura', 'sephora',
      'o boticario', 'avon', 'eudora', 'quem disse berenice', 'depilacao', 
      'perfumaria', 'mac cosmetics',
    ],
  },
  {
    categoryIdHint: 'cat-vestuario',
    keywords: [
      'zara', 'renner', 'riachuelo', 'c&a', 'marisa', 'hering', 'arezzo', 'havaianas',
      'nike', 'adidas', 'centauro', 'netshoes', 'dafiti', 'shein', 'calcados', 'vestuario', 
      'lojas americanas moda', 'pernambucanas', 'forever 21', 'john john', 'vivara',
    ],
  },
  {
    categoryIdHint: 'cat-casa-decoracao',
    keywords: [
      'leroy merlin', 'tok stok', 'tok&stok', 'telhanorte', 'etna', 'mobly', 'westwing',
      'camicado', 'casa e video', 'madeira madeira', 'c&c', 'dicico', 'ikea', 'colchoes', 'moveis',
    ],
  },
  {
    categoryIdHint: 'cat-compras',
    keywords: [
      'amazon', 'mercado livre', 'mercadolivre', 'shopee', 'aliexpress', 'magazine luiza',
      'magalu', 'casas bahia', 'americanas', 'kabum', 'fast shop', 'ponto frio', 'extra.com',
      'submarino', 'carrefour.com', 'samsung', 'apple store', 'decathlon', 'kalunga', 'papelaria',
      'livraria cultura',
    ],
  },
  {
    categoryIdHint: 'cat-internet',
    keywords: [
      'claro', 'vivo', 'tim', 'oi fibra', 'oi movel', 'internet', 'net claro', 'nextel',
      'brisanet', 'vero internet', 'telefone', 'celular', 'recarga', 'algar telecom',
    ],
  },
  {
    categoryIdHint: 'cat-contas',
    keywords: [
      'enel', 'cpfl', 'eletropaulo', 'cemig', 'sabesp', 'sanepar', 'copasa', 'comgas',
      'neoenergia', 'equatorial', 'celesc', 'copel', 'energisa', 'cedae', 'embasa',
      'caesb', 'agua e esgoto', 'gas encanado', 'luz', 'energia eletrica', 'ultragaz', 'liquigas',
      'supergasbras', 'gas de cozinha',
    ],
  },
  {
    categoryIdHint: 'cat-moradia',
    keywords: [
      'aluguel', 'condominio', 'financiamento imobiliario', 'caixa habitacao',
      'taxa de condominio', 'imobiliaria', 'quinto andar',
    ],
  },
  {
    categoryIdHint: 'cat-manutencao-casa',
    keywords: [
      'encanador', 'eletricista', 'pedreiro', 'reforma', 'pintor', 'marceneiro', 'chaveiro',
      'dedetizacao', 'ar condicionado', 'manutencao residencial', 'serralheria', 'vidraceiro',
      'diarista', 'faxina',
    ],
  },
  {
    categoryIdHint: 'cat-impostos',
    keywords: [
      'iptu', 'detran', 'licenciamento', 'ipva', 'imposto de renda', 'darf', 'simples nacional', 'taxa de lixo',
      'taxa municipal', 'receita federal', 'inss contribuicao',
    ],
  },
  {
    categoryIdHint: 'cat-seguros',
    keywords: [
      'seguro de vida', 'seguro residencial', 'seguro viagem', 'porto seguro', 'tokio marine',
      'mapfre', 'azul seguros', 'allianz', 'liberty seguros', 'hdi seguros', 'sulamerica seguros',
      
    ],
  },
  {
    categoryIdHint: 'cat-tarifas',
    keywords: [
      'tarifa', 'iof', 'anuidade', 'mensalidade conta', 'cesta de servicos', 'encargos',
      'multa e juros', 'taxa bancaria', 'tarifa bancaria', 'juros de mora', 'pacote de servicos',
    ],
  },
  {
    categoryIdHint: 'cat-dividas',
    keywords: [
      'emprestimo', 'financiamento', 'consignado', 'parcela financiamento', 
      'refinanciamento', 'crediario', 'renegociacao', 'acordo serasa', 'serasa', 'banco pan',
      'agibank', 'creditas',
    ],
  },
  {
    categoryIdHint: 'cat-filhos',
    keywords: [
      'fralda', 'brinquedo', 'ri happy', 'pbkids', 'creche', 'escolinha', 'uniforme escolar',
      'material escolar', 'berçario', 'bercario', 
    ],
  },
  {
    categoryIdHint: 'cat-educacao',
    keywords: [
      'escola', 'colegio', 'faculdade', 'universidade', 'curso', 'udemy', 'alura', 'coursera',
      'livraria', 'mensalidade escolar', 'hotmart', 'duolingo', 'wizard', 'fisk', 'ccaa',
      'cultura inglesa', 'kumon', 'pos graduacao', 'mba', 'enem',
    ],
  },
  {
    categoryIdHint: 'cat-doacoes',
    keywords: [
      'dizimo', 'igreja', 'doacao', 'vakinha', 'apoia se', 'campanha solidaria', 
      'caridade', 
    ],
  },
  {
    categoryIdHint: 'cat-presentes',
    keywords: [
      'presente', 'florista', 'floricultura', 'giuliana flores', 'buque', 'amigo secreto',
      'lembrancinha',
    ],
  },
  {
    categoryIdHint: 'cat-previdencia',
    keywords: [
      'previdencia', 'vgbl', 'pgbl', 'consorcio', 'porto consorcio', 'embracon', 'ademicon',
    ],
  },
  {
    categoryIdHint: 'cat-aportes',
    keywords: [
      'tesouro direto', 'cdb', 'lci', 'lca', 'fundo de investimento', 
      'xp investimentos', 'rico investimentos', 'clear corretora', 'nuinvest', 'inter invest',
      'btg pactual',
    ],
  },
  {
    categoryIdHint: 'cat-trabalho',
    keywords: [
      'coworking', 'material de escritorio', 'contador', 'contabilidade', 'anuidade crea', 'oab',
      'impressao', 'software', 'hospedagem de site', 'dominio', 'hostgator', 'godaddy',
      'registro.br',
    ],
  },
  {
    categoryIdHint: 'cat-13-ferias',
    keywords: [
      '13o salario', 'decimo terceiro', '13 salario', 'ferias', 'adiantamento 13',
    ],
  },
  {
    categoryIdHint: 'cat-bonus',
    keywords: [
      'bonus', 'plr', 'participacao nos lucros', 'comissao', 'premio produtividade',
    ],
  },
  {
    categoryIdHint: 'cat-salario',
    keywords: [
      'salario', 'folha de pagamento', 'vencimentos', 'pro-labore', 'pro labore', 'ted recebida',
      'ted receb', 'ted credito', 'credito em conta', 'remuneracao', 'adiantamento salarial',
    ],
  },
  {
    categoryIdHint: 'cat-rendimentos',
    keywords: [
      'dividendo', 'jcp', 'juros s/ capital', 'rendimento', 'rendimentos', 'proventos',
      'resgate cdi', 'remuneracao aplic', 'rendimento poupanca', 'rendimento cdb',
    ],
  },
  {
    categoryIdHint: 'cat-aluguel-recebido',
    keywords: [
      'aluguel recebido', 'locacao recebida', 'inquilino',
    ],
  },
  {
    categoryIdHint: 'cat-restituicao-ir',
    keywords: [
      'restituicao', 'restituicao ir', 'restituicao imposto', 'receita federal restituicao',
    ],
  },
  {
    categoryIdHint: 'cat-beneficios',
    keywords: [
      'inss', 'fgts', 'seguro desemprego', 'aposentadoria', 'pensao inss', 
      'bolsa familia', 'loas',
    ],
  },
  {
    categoryIdHint: 'cat-reembolsos',
    keywords: [
      'reembolso', 'ressarcimento', 'estorno', 'devolucao', 'cashback reembolso',
    ],
  },
  {
    categoryIdHint: 'cat-cashback',
    keywords: [
      'cashback', 'picpay cashback', 'ame cashback',
      'meliuz',
    ],
  },
  {
    categoryIdHint: 'cat-vendas',
    keywords: [
      'olx', 'enjoei', 'mercado livre venda', 
    ],
  },
];

let normalizedKeywordGroups: Array<{ group: (typeof CATEGORY_KEYWORDS)[number]; normalizedKeywords: string[] }> | null = null;

/** As palavras-chave são normalizadas uma vez só (antes eram refeitas a cada linha do extrato). */
function getNormalizedKeywordGroups() {
  if (!normalizedKeywordGroups) {
    normalizedKeywordGroups = CATEGORY_KEYWORDS.map((group) => ({
      group,
      normalizedKeywords: group.keywords.map((kw) =>
        kw.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim()
      ),
    }));
  }
  return normalizedKeywordGroups;
}

export interface DescriptionCategoryMatch {
  categoryId: string;
}

/** Returns only confident merchant/description rules; unknown text has no match. */
export function matchCategoryByDescription(
  description: string,
  categories: Category[],
  type: 'income' | 'expense' = 'expense'
): DescriptionCategoryMatch | null {
  const normDesc = ` ${description.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()} `;

  for (const { group, normalizedKeywords } of getNormalizedKeywordGroups()) {
    for (const normKw of normalizedKeywords) {
      if (normDesc.includes(` ${normKw} `)) {
        // Find existing category matching either the hint ID or the name
        const match = categories.find(
          (c) =>
            c.type === type &&
            (c.id === group.categoryIdHint ||
              ` ${c.name.toLowerCase()
                .normalize('NFD')
                .replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-z0-9]+/g, ' ')
                .trim()} `.includes(` ${normKw} `))
        );
        const fallbackMatch = group.fallbackCategoryIdHint
          ? categories.find((c) => c.type === type && c.id === group.fallbackCategoryIdHint)
          : undefined;
        if (match || fallbackMatch) {
          const resolvedMatch = match || fallbackMatch!;
          return { categoryId: resolvedMatch.id };
        }
      }
    }
  }

  return null;
}
