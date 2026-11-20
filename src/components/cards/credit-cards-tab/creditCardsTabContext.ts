/** Tudo o que CreditCardsTab calcula, junto. */
import type { CreditCard, CreditCardSummary } from '../../../types/finance';
import type { CreditCardsTabPropsApi } from './creditCardsTabConfig';
import type { CardsStateApi } from './useCardsState';
import type { CardsDerivedApi } from './useCardsDerived';

export type CreditCardsTabContext = CreditCardsTabPropsApi &
  CardsStateApi &
  CardsDerivedApi;

/**
 * O que as partes da tela recebem: cartão ativo e fatura nunca são nulos aqui, porque a tela principal só é
 * montada depois de CreditCardsTab conferir que existem.
 */
export type CardPageContext = Omit<CreditCardsTabContext, 'activeCard' | 'activeSummary'> & {
  activeCard: CreditCard;
  activeSummary: CreditCardSummary;
  isCardDetailOpen: boolean;
};
