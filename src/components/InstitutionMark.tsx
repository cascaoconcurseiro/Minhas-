import React from 'react';
import avenueLogo from 'react-bancos/icons/avenue.svg?url';
import bancoDoBrasilLogo from 'react-bancos/icons/bancodobrasil.svg?url';
import bradescoLogo from 'react-bancos/icons/bradesco.svg?url';
import btgLogo from 'react-bancos/icons/btgpactual.svg?url';
import c6Logo from 'react-bancos/icons/c6bank.svg?url';
import caixaLogo from 'react-bancos/icons/caixa.svg?url';
import coraLogo from 'react-bancos/icons/cora.svg?url';
import interLogo from 'react-bancos/icons/inter.svg?url';
import itauLogo from 'react-bancos/icons/itau.svg?url';
import mercadoPagoLogo from 'react-bancos/icons/mercadopago.svg?url';
import nomadLogo from 'react-bancos/icons/nomad.svg?url';
import nubankLogo from 'react-bancos/icons/nubank.svg?url';
import pagBankLogo from 'react-bancos/icons/pagbank.svg?url';
import picPayLogo from 'react-bancos/icons/picpay.svg?url';
import santanderLogo from 'react-bancos/icons/santander.svg?url';
import wiseLogo from 'react-bancos/icons/wise.svg?url';
import xpLogo from 'react-bancos/icons/xp.svg?url';

interface InstitutionMarkProps {
  institution?: string;
  accountName?: string;
  color?: string;
  size?: 'xs' | 'sm' | 'md';
}

const getInstitutionMonogram = (institution = '', accountName = '') => {
  const source = institution.trim() || accountName.trim();
  const words = source
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9\s]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  const meaningfulWords = words.filter(
    (word) => !['banco', 'bank', 'do', 'da', 'de', 'dos', 'das', 'digital', 'global'].includes(word.toLowerCase())
  );
  const initials = (meaningfulWords.length ? meaningfulWords : words)
    .slice(0, 3)
    .map((word) => word.match(/^c\d+/i)?.[0] || word[0])
    .join('');

  return (initials || '?').toUpperCase();
};

const institutionLogos: Array<{ aliases: string[]; src: string }> = [
  { aliases: ['bancodobrasil', 'ourocard', 'bb'], src: bancoDoBrasilLogo },
  { aliases: ['bradesco'], src: bradescoLogo },
  { aliases: ['caixa', 'cef'], src: caixaLogo },
  { aliases: ['itau'], src: itauLogo },
  { aliases: ['santander'], src: santanderLogo },
  { aliases: ['nubank', 'nu pagamentos'], src: nubankLogo },
  { aliases: ['inter', 'intermedium'], src: interLogo },
  { aliases: ['c6bank', 'c6'], src: c6Logo },
  { aliases: ['cora'], src: coraLogo },
  { aliases: ['btgpactual', 'btg'], src: btgLogo },
  { aliases: ['mercadopago'], src: mercadoPagoLogo },
  { aliases: ['picpay'], src: picPayLogo },
  { aliases: ['pagbank', 'pagseguro'], src: pagBankLogo },
  { aliases: ['wise', 'transferwise'], src: wiseLogo },
  { aliases: ['nomad'], src: nomadLogo },
  { aliases: ['avenue'], src: avenueLogo },
  { aliases: ['xp'], src: xpLogo },
];

const getInstitutionLogo = (institution = '') => {
  const normalized = institution
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

  return institutionLogos.find(({ aliases }) =>
    aliases.some((alias) => normalized === alias || normalized.includes(alias))
  )?.src;
};

/** Local institution monogram used where a bank-specific logo asset is unavailable. */
export const InstitutionMark: React.FC<InstitutionMarkProps> = ({
  institution,
  accountName,
  color = '#334155',
  size = 'md',
}) => {
  const logoSrc = getInstitutionLogo(institution);
  const dimensions = size === 'xs' ? 'h-7 w-7 rounded-lg text-[9px]' :
    size === 'sm' ? 'h-9 w-9 rounded-xl text-[10px]' :
      'h-10 w-10 rounded-xl text-xs';

  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center bg-slate-700 font-display font-extrabold tracking-tight text-white shadow-sm ${dimensions}`}
      style={{
        backgroundColor: `color-mix(in srgb, ${color} 46%, #0f172a)`,
      }}
    >
      {logoSrc ? (
        <img
          alt=""
          className="h-full w-full rounded-[inherit] object-cover"
          src={logoSrc}
        />
      ) : (
        getInstitutionMonogram(institution, accountName)
      )}
    </span>
  );
};
