# 🎈 NameWriterThreeJS — 풍선 이름

**Three.js + React 19 + cannon-es + gsap + balloon 라이브러리** 기반의 **인터랙티브 풍선 이름 시뮬레이터** 입니다. 입력한 텍스트가 각 글자마다 풍선/파티클/거품 으로 변환되어 화면에 떠다니고, 마우스로 드래그하거나 던지거나 터뜨릴 수 있습니다. 본 저장소는 `achrefelouafi/NameWriterThreeJS` 의 **sigco3111 한국어 fork** 입니다 — 모든 컨트롤과 안내문을 한글로 제공하며, `src/i18n.ts` 가 한국어/영문 양쪽 키를 모두 보관합니다.

---

## 🌐 라이브 데모

**👉 https://sigco3111.github.io/NameWriterThreeJS/**

별도 빌드 없이 풀 인터랙티브 데모를 바로 확인하실 수 있습니다.

---

## 📚 저장소

- 🇰🇷 **한국어 fork**: https://github.com/sigco3111/NameWriterThreeJS
- ⭐ **원본 저장소** (achrefelouafi): https://github.com/achrefelouafi/NameWriterThreeJS
- 🌐 **라이브 데모**: https://sigco3111.github.io/NameWriterThreeJS/

---

## ✨ 주요 기능

### 🎈 풍선 이름 시뮬레이션

- **이름 입력 → 풍선으로 변환** — 텍스트 상자에 최대 14 글자 입력 → "생성" 버튼으로 글자별 풍선 즉시 생성.
- **3 가지 시각 모드**:
  - 🎈 **풍선 모드 (Balloon)** — 각 글자가 실제 물리 풍선처럼 둥글게 부풀고 떠다님. 줄(string) 토글 가능.
  - ✨ **파티클 모드 (Particles)** — 글자가 작은 입자들로 분해되어 빛나는 효과.
  - 🫧 **거품 모드 (Bubbles)** — 글자가 거품으로 변환. 구的数量 + 공 크기 슬라이더로 조정.
- **물리 시뮬레이션** — cannon-es 기반으로 풍선들이 서로 부딪히고 떠다님.
- **인터랙션**:
  - 🖱️ **드래그** — 풍선을 마우스로 끌기
  - 💥 **던지기 (fling)** — 강하게 던져서 화면 밖으로 보내기
  - ✋ **훔치기 (steal)** — 다른 풍선 위치를 가져오기
  - 🎉 **팝 (pop)** — 풍선 터뜨리기 (메뉴 버튼 또는 자동 폭발)

### 🎨 스타일링

- **글자 색상** — 컬러 피커로 풍선 색 변경 (다색 모드 끄기).
- **다색 (Multicolor)** — 각 글자를 무지개 색으로 자동 칠함 (기본 ON).
- **배경** — 컬러 피커로 배경 색 변경.
- **줄 (Strings)** — 풍선 모드에서 끈 표시 ON/OFF.
- **글꼴 (Font)** — 5 종 내장 폰트 (Helvetiker, Optimer, Droid Sans, Droid Serif, Gentilis) 즉시 전환.

### 🫧 거품 모드 추가 컨트롤

- **구的数量 (Spheres)** — 100~1000개 슬라이더로 거품 수량 조정.
- **공 크기 (Ball size)** — 0.5×~2× 슬라이더로 거품 크기 조정.

### 🇰🇷 한국어 UI

- `src/i18n.ts` 가 **15+ 한국어/영문 키** 를 모두 보관 (동적 슬라이더 라벨 포함).
- 모든 라벨 / 버튼 / 플레이스홀더 / 타이틀 한국어 통일.
- `setLanguage('en')` 으로 영문 토글 가능 (현재 자동 = 한국어).

---

## 🛠️ 기술 스택

| 영역 | 사용 기술 |
|---|---|
| **UI** | React 19 + TypeScript 6 |
| **빌드** | Vite 8 + tsc |
| **3D 렌더러** | Three.js r184 + WebGL2 |
| **물리** | cannon-es 0.20 |
| **애니메이션** | gsap 3.15 |
| **풍선 라이브러리** | balloon (글자 → 풍선 변환) |
| **폰트** | 5 종 내장 typeface.json |

---

## 🚀 로컬 실행

```bash
# 1. 저장소 클론
git clone https://github.com/sigco3111/NameWriterThreeJS.git
cd NameWriterThreeJS

# 2. 의존성 설치 (pnpm 권장)
pnpm install

# 3. 개발 서버 (http://localhost:5174)
pnpm dev

# 4. 프로덕션 빌드
pnpm build
```

빌드 산출물은 `dist/` 폴더에 생성되며, GitHub Pages 와 1:1 로 동일하게 작동합니다.

---

## 📁 프로젝트 구조

```
NameWriterThreeJS/
├─ src/
│  ├─ main.tsx           # React 엔트리
│  ├─ App.tsx            # 메인 컴포넌트 (UI + 상태 관리 + t() 라벨)
│  ├─ i18n.ts            # 🇰🇷 KO + 🇺🇸 EN 키 (15+, 함수형 슬라이더 라벨 포함)
│  ├─ balloon/
│  │  ├─ core.ts         # TextFX 메인 엔진 (Three.js + cannon-es 통합)
│  │  ├─ BalloonMode.ts  # 풍선 모드 (물리 + GSAP)
│  │  ├─ BubbleMode.ts   # 거품 모드
│  │  ├─ ParticleMode.ts # 파티클 모드
│  │  └─ TextFX.ts       # 모드 디스패처 + 폰트 메타데이터
│  ├─ App.css            # 스타일
│  ├─ index.css          # 글로벌 스타일
│  └─ vite.config.ts     # base: '/NameWriterThreeJS/' (GitHub Pages 경로)
├─ public/               # 정적 자산
├─ index.html            # <html lang="ko"> + 한글 title
└─ README.md             # 본 파일
```

---

## 🎮 사용 방법

1. **이름 입력** — 상단 입력란에 최대 14 글자 이름 입력 (예: "안녕하세요", "happy")
2. **모드 선택** — 풍선/파티클/거품 3 개 버튼 중 하나 선택
3. **색상 조정** — 컬러 피커로 글자 색 + 배경 색 조정
4. **스타일 조정** — 다색 / 줄 / 글꼴 / 구的数量 / 공 크기 슬라이더
5. **팝** — 풍선들을 한 번에 터뜨리기 (Pop 버튼)
6. **인터랙션** — 마우스로 풍선 드래그 / 던지기 / 훔치기 / 터뜨리기

---

## 🌐 다국어 토글

기본은 한국어. 콘솔에서 영문으로 전환:

```javascript
import { setLanguage } from './src/i18n.ts';
setLanguage('en');
// 이후 모든 라벨이 영문으로 갱신됨
```

새 라벨을 추가할 때는 `src/i18n.ts` 의 `KO` / `EN` 양쪽에 키를 추가하면 양쪽 언어에 동시 반영됩니다.

---

## 🎯 추천 이름 / 모드 조합

| 분위기 | 이름 (예시) | 모드 | 추천 설정 |
|---|---|---|---|
| **생일 카드** | "생일축하" | 풍선 | 다색 ON, 핑크 배경, 줄 ON |
| **파티** | "PARTY" | 파티클 | 다색 ON, 어두운 배경 |
| **수족관** | "바다" | 거품 | 다색 ON, 청록 배경, Spheres 600, Ball size 1.5× |
| **발렌타인** | "사랑해" | 풍선 | 글자색 빨강, 핑크 배경, 줄 ON |
| **프로필 사진** | "Welcome" | 풍선 | 다색 OFF, 글자색 흰색, 어두운 배경 |

---

## 🎯 한국어 fork 컬렉션 (sigco3111)

같은 작성자 `achrefelouafi` 의 다른 한국어 fork 들:

| # | 라이브 데모 | GitHub |
|---|---|---|
| 1 | https://waterthreejs.vercel.app | sigco3111/WaterThreeJS |
| 2 | https://basicproceduralbuilding.vercel.app | sigco3111/BasicProceduralBuilding |
| 3 | https://polegeneratortwothreejs.vercel.app | sigco3111/PoleGeneratorThreeJS |
| 4 | https://bookcasethreejs.vercel.app | sigco3111/BookcaseThreeJS |
| 5 | https://vegetationgeneratortwothreejs.vercel.app | sigco3111/VegetationGeneratorThreeJS |
| 6 | https://buildinggeneratortwothreejs.vercel.app | sigco3111/BuildingGeneratorThreeJS |
| 7 | https://grasssystemthreejs.vercel.app | sigco3111/GrassSystemThreeJS |
| 8 | https://rainsystemthreejs.vercel.app | sigco3111/RainSystemThreeJS |
| 9 | https://sigco3111.github.io/SnowSystemThreeJS/ | sigco3111/SnowSystemThreeJS |
| 10 | https://sigco3111.github.io/OceanThreejs/ | sigco3111/OceanThreejs |
| 11 | **https://sigco3111.github.io/NameWriterThreeJS/** ← 본 저장소 |

모두 동일한 풀폴드 + 풀 한글화 + Vite + i18n.js 패턴을 공유합니다.

---

## 📜 라이선스

원본 저장소와 동일 — **MIT License** ([LICENSE](./LICENSE) 참조).

원본 저작권: © achrefelouafi
한국어 fork 및 i18n.ts 추가: © sigco3111
