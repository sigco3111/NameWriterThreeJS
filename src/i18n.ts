// ============================================================================
//  한국어 / English i18n — UI 문자열만 노출, 식별자는 절대 건드리지 않음
// ============================================================================

const KO = {
  // ---- 앱 / 부트 ----
  appTitle: '🎈 풍선 이름 (한글판)',
  appBrand: '🎈 balloon.type',
  tip: '드래그 · 던지기 · 훔치기 · 터뜨리기',

  // ---- 모드 ----
  modeBalloon: '풍선',
  modeParticles: '파티클',
  modeBubbles: '거품',

  // ---- 컨트롤 ----
  textColor: '글자 색상',
  multicolor: '다색',
  background: '배경',
  strings: '줄',
  font: '글꼴',
  spheresLabel: '구的数量',
  spheresCount: (n: number) => `구 개수 ${n}`,
  ballSize: (v: number) => `공 크기 ${v.toFixed(1)}×`,

  // ---- 패널 ----
  placeholder: '이름을 입력하세요…',
  generate: '생성',
  pop: '팝',
  popTitle: '터뜨리기',

  // ---- 호버 ----
  brandHover: 'balloon.type — 인터랙티브 풍선 이름',
};

const EN = {
  appTitle: '🎈 Balloon Type',
  appBrand: '🎈 balloon.type',
  tip: 'drag · fling · steal · pop',

  modeBalloon: 'Balloon',
  modeParticles: 'Particles',
  modeBubbles: 'Bubbles',

  textColor: 'Text color',
  multicolor: 'Multicolor',
  background: 'Background',
  strings: 'Strings',
  font: 'Font',
  spheresLabel: 'Spheres',
  spheresCount: (n: number) => `Spheres ${n}`,
  ballSize: (v: number) => `Ball size ${v.toFixed(1)}×`,

  placeholder: 'type a name…',
  generate: 'Generate',
  pop: 'Pop',
  popTitle: 'Burst it',

  brandHover: 'balloon.type — interactive balloon names',
};

let current: typeof KO = KO;

export function setLanguage(lang: 'ko' | 'en'): void {
  current = lang === 'en' ? EN : KO;
}

export function t<K extends keyof typeof KO>(key: K): typeof KO[K] {
  const v = current[key];
  if (v !== undefined) return v;
  const e = (EN as any)[key];
  if (e !== undefined) return e;
  return (KO as any)[key];
}

export const L = {
  KO,
  EN,
  current: () => current,
};
