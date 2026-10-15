// Référentiel des sociétés cotées à la BRVM.
// - shortName : nom court affiché dans l'application
// - aliases   : mots-clés utilisés pour rattacher automatiquement une actualité à une valeur
// - sector    : secteur par défaut (remplacé par le secteur officiel lu sur brvm.org à chaque collecte)
// Une société nouvellement cotée et absente de cette liste est quand même collectée :
// elle apparaît avec le nom officiel lu sur brvm.org.

export const COUNTRIES = {
  CI: "Côte d'Ivoire",
  SN: 'Sénégal',
  BJ: 'Bénin',
  BF: 'Burkina Faso',
  ML: 'Mali',
  NE: 'Niger',
  TG: 'Togo',
  GW: 'Guinée-Bissau',
};

export const SECTORS = {
  194: 'Consommation de base',
  195: 'Consommation discrétionnaire',
  196: 'Énergie',
  197: 'Industriels',
  198: 'Services financiers',
  199: 'Services publics',
  200: 'Télécommunications',
};

const S = SECTORS;

export const COMPANIES = {
  ABJC: { shortName: 'Servair Abidjan', sector: S[195], aliases: ['servair'] },
  BBGC: { shortName: 'Bridge Bank Group CI', sector: S[198], aliases: ['bridge bank'] },
  BICB: { shortName: 'BIIC Bénin', sector: S[198], aliases: ['biic', 'bicb'] },
  BICC: { shortName: 'BICI Côte d’Ivoire', sector: S[198], aliases: ['bici', 'bicici', 'bicc'] },
  BNBC: { shortName: 'Bernabé CI', sector: S[195], aliases: ['bernabe', 'bernabé'] },
  BOAB: { shortName: 'BOA Bénin', sector: S[198], aliases: ['boa bénin', 'bank of africa bénin', 'bank of africa benin', 'boab'] },
  BOABF: { shortName: 'BOA Burkina Faso', sector: S[198], aliases: ['boa burkina', 'bank of africa burkina', 'boabf'] },
  BOAC: { shortName: 'BOA Côte d’Ivoire', sector: S[198], aliases: ['boa ci', 'boa côte', 'bank of africa côte', 'bank of africa ci', 'boac'] },
  BOAM: { shortName: 'BOA Mali', sector: S[198], aliases: ['boa mali', 'bank of africa mali', 'boam'] },
  BOAN: { shortName: 'BOA Niger', sector: S[198], aliases: ['boa niger', 'bank of africa niger', 'boan'] },
  BOAS: { shortName: 'BOA Sénégal', sector: S[198], aliases: ['boa sénégal', 'boa senegal', 'bank of africa sénégal', 'boas'] },
  CABC: { shortName: 'Sicable CI', sector: S[197], aliases: ['sicable'] },
  CBIBF: { shortName: 'Coris Bank International', sector: S[198], aliases: ['coris bank', 'cbibf'] },
  CFAC: { shortName: 'CFAO Motors CI', sector: S[195], aliases: ['cfao'] },
  CIEC: { shortName: 'CIE Côte d’Ivoire', sector: S[199], aliases: ['cie ci', 'compagnie ivoirienne d’électricité', "compagnie ivoirienne d'électricité", 'ciec'] },
  ECOC: { shortName: 'Ecobank Côte d’Ivoire', sector: S[198], aliases: ['ecobank ci', 'ecobank côte', 'ecoc'] },
  ETIT: { shortName: 'Ecobank Transnational (ETI)', sector: S[198], aliases: ['ecobank transnational', 'eti ', 'etit'] },
  FTSC: { shortName: 'Filtisac CI', sector: S[197], aliases: ['filtisac'] },
  LNBB: { shortName: 'Loterie Nationale du Bénin', sector: S[195], aliases: ['loterie nationale du bénin', 'lnb', 'lnbb'] },
  NEIC: { shortName: 'NEI-CEDA CI', sector: S[195], aliases: ['nei-ceda', 'nei ceda'] },
  NSBC: { shortName: 'NSIA Banque CI', sector: S[198], aliases: ['nsia banque', 'nsia'] },
  NTLC: { shortName: 'Nestlé CI', sector: S[194], aliases: ['nestlé', 'nestle'] },
  ONTBF: { shortName: 'Onatel Burkina Faso', sector: S[200], aliases: ['onatel', 'moov africa burkina'] },
  ORAC: { shortName: 'Orange Côte d’Ivoire', sector: S[200], aliases: ['orange ci', 'orange côte', 'orange cote', 'orac'] },
  ORGT: { shortName: 'Oragroup Togo', sector: S[198], aliases: ['oragroup', 'orabank'] },
  PALC: { shortName: 'Palm CI', sector: S[194], aliases: ['palmci', 'palm ci'] },
  PRSC: { shortName: 'Tractafric Motors CI', sector: S[195], aliases: ['tractafric'] },
  SAFC: { shortName: 'SAFCA CI', sector: S[198], aliases: ['safca'] },
  SCRC: { shortName: 'Sucrivoire CI', sector: S[194], aliases: ['sucrivoire'] },
  SDCC: { shortName: 'SODECI', sector: S[199], aliases: ['sodeci', 'sode ci', 'sdcc'] },
  SDSC: { shortName: 'Africa Global Logistics CI', sector: S[197], aliases: ['africa global logistics', 'agl ci', 'sdsc'] },
  SEMC: { shortName: 'Eviosys Packaging SIEM CI', sector: S[197], aliases: ['eviosys', 'crown siem', 'siem'] },
  SGBC: { shortName: 'Société Générale CI', sector: S[198], aliases: ['société générale ci', 'société générale côte', 'societe generale cote', 'sgbci', 'sgci', 'sgbc'] },
  SHEC: { shortName: 'Vivo Energy CI', sector: S[196], aliases: ['vivo energy'] },
  SIBC: { shortName: 'Société Ivoirienne de Banque', sector: S[198], aliases: ['société ivoirienne de banque', 'sib ci', 'sibc'] },
  SICC: { shortName: 'SICOR CI', sector: S[194], aliases: ['sicor'] },
  SIVC: { shortName: 'Erium CI', sector: S[197], aliases: ['erium'] },
  SLBC: { shortName: 'Solibra CI', sector: S[194], aliases: ['solibra'] },
  SMBC: { shortName: 'SMB CI', sector: S[197], aliases: ['smb ci', 'société multinationale de bitumes', 'smbc'] },
  SNTS: { shortName: 'Sonatel', sector: S[200], aliases: ['sonatel', 'snts'] },
  SOGC: { shortName: 'SOGB CI', sector: S[194], aliases: ['sogb'] },
  SPHC: { shortName: 'SAPH CI', sector: S[194], aliases: ['saph'] },
  STAC: { shortName: 'SETAO CI', sector: S[197], aliases: ['setao'] },
  STBC: { shortName: 'SITAB CI', sector: S[194], aliases: ['sitab'] },
  TTLC: { shortName: 'TotalEnergies Marketing CI', sector: S[196], aliases: ['totalenergies marketing côte', 'totalenergies ci', 'total ci', 'ttlc'] },
  TTLS: { shortName: 'TotalEnergies Marketing Sénégal', sector: S[196], aliases: ['totalenergies marketing sénégal', 'totalenergies sénégal', 'total sénégal', 'ttls'] },
  UNLC: { shortName: 'Unilever CI', sector: S[194], aliases: ['unilever'] },
  UNXC: { shortName: 'Uniwax CI', sector: S[195], aliases: ['uniwax'] },
};

/** Pays déduit du suffixe du symbole BRVM (C = CI, S = Sénégal, BF = Burkina…). */
export function countryFromSymbol(symbol) {
  const s = symbol.toUpperCase();
  if (s.endsWith('BF')) return 'BF';
  const last = s.slice(-1);
  return { C: 'CI', S: 'SN', B: 'BJ', M: 'ML', N: 'NE', T: 'TG', G: 'GW' }[last] ?? 'CI';
}

/** Ticker utilisé par sikafinance pour l'historique (ex. SNTS.sn). */
export function sikaTicker(symbol) {
  const suffix = { CI: 'ci', SN: 'sn', BJ: 'bj', BF: 'bf', ML: 'ml', NE: 'ne', TG: 'tg', GW: 'gw' }[countryFromSymbol(symbol)];
  return `${symbol}.${suffix}`;
}
