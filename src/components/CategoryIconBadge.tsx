import React from 'react';
import {
  Briefcase,
  Car,
  Coffee,
  FileText,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  PiggyBank,
  Plane,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tag,
  TrendingUp,
  Tv,
  Utensils,
  Wallet,
  Wrench,
  Zap,
} from 'lucide-react';
import { CategoryIconName } from '../types/finance';

export const CATEGORY_ICON_OPTIONS: { id: CategoryIconName; label: string }[] = [
  { id: 'home', label: 'Casa / Moradia' },
  { id: 'shopping-cart', label: 'Supermercado' },
  { id: 'zap', label: 'Contas / Energia' },
  { id: 'car', label: 'Transporte / Auto' },
  { id: 'heart-pulse', label: 'Saúde / Farmácia' },
  { id: 'graduation-cap', label: 'Educação' },
  { id: 'utensils', label: 'Restaurante / Alimentação' },
  { id: 'plane', label: 'Viagem / Lazer' },
  { id: 'shopping-bag', label: 'Compras / Vestuário' },
  { id: 'tv', label: 'Assinaturas / Streaming' },
  { id: 'piggy-bank', label: 'Poupança / Metas' },
  { id: 'file-text', label: 'Impostos / Boletos' },
  { id: 'briefcase', label: 'Salário / Trabalho' },
  { id: 'trending-up', label: 'Investimentos / Dividendos' },
  { id: 'wallet', label: 'Carteira / Renda Extra' },
  { id: 'gift', label: 'Presentes / Doações' },
  { id: 'wrench', label: 'Manutenção / Serviços' },
  { id: 'coffee', label: 'Café / Padaria' },
  { id: 'smartphone', label: 'Celular / Tecnologia' },
  { id: 'tag', label: 'Geral / Outros' },
];

export const CATEGORY_COLOR_PALETTE: { hex: string; name: string }[] = [
  { hex: '#059669', name: 'Esmeralda' },
  { hex: '#0284c7', name: 'Azul Oceano' },
  { hex: '#4f46e5', name: 'Índigo' },
  { hex: '#7c3aed', name: 'Violeta' },
  { hex: '#db2777', name: 'Magenta' },
  { hex: '#dc2626', name: 'Vermelho' },
  { hex: '#ea580c', name: 'Laranja' },
  { hex: '#d97706', name: 'Âmbar' },
  { hex: '#0d9488', name: 'Turquesa' },
  { hex: '#1e293b', name: 'Ardósia Escuro' },
];

export const renderCategoryIcon = (
  iconName: CategoryIconName | undefined,
  className = 'h-4 w-4'
) => {
  switch (iconName) {
    case 'home':
      return <Home className={className} />;
    case 'shopping-cart':
      return <ShoppingCart className={className} />;
    case 'zap':
      return <Zap className={className} />;
    case 'car':
      return <Car className={className} />;
    case 'heart-pulse':
      return <HeartPulse className={className} />;
    case 'graduation-cap':
      return <GraduationCap className={className} />;
    case 'utensils':
      return <Utensils className={className} />;
    case 'plane':
      return <Plane className={className} />;
    case 'shopping-bag':
      return <ShoppingBag className={className} />;
    case 'tv':
      return <Tv className={className} />;
    case 'piggy-bank':
      return <PiggyBank className={className} />;
    case 'file-text':
      return <FileText className={className} />;
    case 'briefcase':
      return <Briefcase className={className} />;
    case 'trending-up':
      return <TrendingUp className={className} />;
    case 'wallet':
      return <Wallet className={className} />;
    case 'gift':
      return <Gift className={className} />;
    case 'wrench':
      return <Wrench className={className} />;
    case 'coffee':
      return <Coffee className={className} />;
    case 'smartphone':
      return <Smartphone className={className} />;
    default:
      return <Tag className={className} />;
  }
};

interface CategoryIconBadgeProps {
  icon?: CategoryIconName;
  color?: string;
  size?: 'sm' | 'md';
}

export const CategoryIconBadge: React.FC<CategoryIconBadgeProps> = ({
  icon = 'tag',
  color = '#1e293b',
  size = 'md',
}) => {
  const boxClass = size === 'sm' ? 'h-7 w-7 rounded-md' : 'h-8 w-8 rounded-lg';
  const iconClass = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4';
  const effectiveColor =
    color.toLowerCase() === '#1e293b' ? '#3b82f6' : color;

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 ${boxClass}`}
      style={{
        backgroundColor: `${effectiveColor}18`,
        color: effectiveColor,
      }}
      aria-hidden="true"
    >
      {renderCategoryIcon(icon, iconClass)}
    </span>
  );
};
