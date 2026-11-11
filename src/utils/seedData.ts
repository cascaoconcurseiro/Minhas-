import {
  BankAccount,
  Category,
  CreditCard,
  FamilyMember,
  InvestmentAsset,
  SavingsGoal,
  Transaction,
  Trip,
} from '../types/finance';

const localNow = new Date();
export const DEFAULT_MONTH = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}`;

export const INITIAL_FAMILY_MEMBERS: FamilyMember[] = [];

export const INITIAL_ACCOUNTS: BankAccount[] = [];

export const INITIAL_CREDIT_CARDS: CreditCard[] = [];

export const INITIAL_CATEGORIES: Category[] = [
  // Receitas
  {
    id: 'cat-salario',
    name: 'Salário / Pró-Labore',
    type: 'income',
    bucket: 'financial',
    monthlyBudget: 0,
    color: '#059669',
    icon: 'briefcase',
    subcategories: [
      { id: 'sub-sal-clt', name: 'Salário Mensal CLT' },
      { id: 'sub-sal-13', name: '13º Salário & Férias' },
      { id: 'sub-sal-plr', name: 'Bônus & PLR' },
    ],
  },
  {
    id: 'cat-freela',
    name: 'Projetos Extras & PIX',
    type: 'income',
    bucket: 'financial',
    monthlyBudget: 0,
    color: '#0d9488',
    icon: 'wallet',
    subcategories: [
      { id: 'sub-free-cons', name: 'Consultoria & Projetos' },
      { id: 'sub-free-vendas', name: 'Vendas & Reembolsos' },
    ],
  },
  {
    id: 'cat-rendimentos',
    name: 'Rendimentos & Dividendos',
    type: 'income',
    bucket: 'financial',
    monthlyBudget: 0,
    color: '#0284c7',
    icon: 'trending-up',
    subcategories: [
      { id: 'sub-rend-fii', name: 'Dividendos & FIIs' },
      { id: 'sub-rend-cash', name: 'Cashback & Juros' },
    ],
  },

  // Despesas Essenciais (50%)
  {
    id: 'cat-moradia',
    name: 'Moradia & Condomínio',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 0,
    color: '#1e293b',
    icon: 'home',
    subcategories: [
      { id: 'sub-mor-aluguel', name: 'Aluguel Mensal' },
      { id: 'sub-mor-cond', name: 'Taxa de Condomínio' },
      { id: 'sub-mor-manut', name: 'Manutenção & Reparos' },
    ],
  },
  {
    id: 'cat-mercado',
    name: 'Supermercado & Feira',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 0,
    color: '#059669',
    icon: 'shopping-cart',
    subcategories: [
      { id: 'sub-merc-atacado', name: 'Atacadão / Compra do Mês' },
      { id: 'sub-merc-feira', name: 'Feira Livre & Hortifruti' },
      { id: 'sub-merc-padaria', name: 'Padaria & Mercearia' },
    ],
  },
  {
    id: 'cat-contas',
    name: 'Luz, Água, Gás & Internet',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 0,
    color: '#0284c7',
    icon: 'zap',
    subcategories: [
      { id: 'sub-con-luz', name: 'Energia Elétrica' },
      { id: 'sub-con-agua', name: 'Água & Esgoto' },
      { id: 'sub-con-net', name: 'Internet Fibra & Celular' },
    ],
  },
  {
    id: 'cat-transporte',
    name: 'Transporte & Combustível',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 0,
    color: '#4f46e5',
    icon: 'car',
    subcategories: [
      { id: 'sub-trans-comb', name: 'Combustível & Lavagem' },
      { id: 'sub-trans-seguro', name: 'Seguro Auto' },
      { id: 'sub-trans-app', name: 'Uber / 99 / Metrô' },
    ],
  },
  {
    id: 'cat-saude',
    name: 'Saúde & Farmácia',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 0,
    color: '#e11d48',
    icon: 'heart-pulse',
    subcategories: [
      { id: 'sub-sau-plano', name: 'Plano de Saúde' },
      { id: 'sub-sau-farm', name: 'Farmácia & Medicamentos' },
      { id: 'sub-sau-cons', name: 'Consultas & Exames' },
    ],
  },
  {
    id: 'cat-educacao',
    name: 'Educação & Cursos',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 0,
    color: '#7c3aed',
    icon: 'graduation-cap',
    subcategories: [
      { id: 'sub-edu-cursos', name: 'Pós / Idiomas / Cursos' },
      { id: 'sub-edu-livros', name: 'Livros & Materiais' },
    ],
  },

  // Estilo de Vida (30%)
  {
    id: 'cat-restaurantes',
    name: 'Restaurantes & Delivery',
    type: 'expense',
    bucket: 'lifestyle',
    monthlyBudget: 0,
    color: '#ea580c',
    icon: 'utensils',
    subcategories: [
      { id: 'sub-rest-ifood', name: 'iFood & Delivery' },
      { id: 'sub-rest-jantar', name: 'Restaurantes & Cafés' },
    ],
  },
  {
    id: 'cat-lazer',
    name: 'Viagens & Lazer',
    type: 'expense',
    bucket: 'lifestyle',
    monthlyBudget: 0,
    color: '#0891b2',
    icon: 'plane',
    subcategories: [
      { id: 'sub-laz-viagem', name: 'Passagens & Hospedagem' },
      { id: 'sub-laz-passeios', name: 'Passeios & Eventos' },
    ],
  },
  {
    id: 'cat-compras',
    name: 'Compras Pessoais & Casa',
    type: 'expense',
    bucket: 'lifestyle',
    monthlyBudget: 0,
    color: '#db2777',
    icon: 'shopping-bag',
    subcategories: [
      { id: 'sub-comp-roupas', name: 'Vestuário & Calçados' },
      { id: 'sub-comp-eletr', name: 'Eletrônicos & Utensílios' },
      { id: 'sub-comp-online', name: 'Lojas online' },
    ],
  },
  {
    id: 'cat-assinaturas',
    name: 'Assinaturas & Streaming',
    type: 'expense',
    bucket: 'lifestyle',
    monthlyBudget: 0,
    color: '#6366f1',
    icon: 'tv',
    subcategories: [
      { id: 'sub-ass-stream', name: 'Streaming & Música' },
      { id: 'sub-ass-soft', name: 'Apps & Nuvem' },
    ],
  },

  // Metas & Reserva (20%)
  {
    id: 'cat-aportes',
    name: 'Aportes & Investimentos',
    type: 'expense',
    bucket: 'financial',
    monthlyBudget: 0,
    color: '#059669',
    icon: 'piggy-bank',
    subcategories: [
      { id: 'sub-apo-selic', name: 'Tesouro Selic / Reserva' },
      { id: 'sub-apo-metas', name: 'Caixinhas de Objetivos' },
    ],
  },
  {
    id: 'cat-fatura',
    name: 'Pagamento de Fatura de Cartão',
    type: 'expense',
    bucket: 'financial',
    monthlyBudget: 0,
    color: '#7c3aed',
    icon: 'file-text',
    subcategories: [],
  },
  {
    id: 'cat-impostos',
    name: 'Impostos (IPTU / IPVA)',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 0,
    color: '#1e293b',
    icon: 'file-text',
    subcategories: [
      { id: 'sub-imp-ipva', name: 'IPVA & Licenciamento' },
      { id: 'sub-imp-iptu', name: 'IPTU Municipal' },
    ],
  },
  {
    id: 'cat-outros',
    name: 'Outras Despesas & Acertos',
    type: 'expense',
    bucket: 'essential',
    monthlyBudget: 0,
    color: '#64748b',
    icon: 'file-text',
    subcategories: [
      { id: 'sub-out-geral', name: 'Despesas Gerais' },
      { id: 'sub-out-rateio', name: 'Acertos & Rateios Familiares' },
    ],
  },
];

export const INITIAL_TRANSACTIONS: Transaction[] = [];

export const INITIAL_SAVINGS_GOALS: SavingsGoal[] = [];

export const INITIAL_INVESTMENTS: InvestmentAsset[] = [];

export const INITIAL_TRIPS: Trip[] = [];
