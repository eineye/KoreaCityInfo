# Korea City Info

외국인에게 한국 지자체(광역 17 · 기초 226) 정보를 알리는 웹/앱 서비스입니다.
기본 언어는 영어이며 한국어·일본어·중국어 UI를 선택할 수 있습니다.

- **웹**: `www/` 폴더를 그대로 정적 호스팅 (Cloudflare Pages 등)
- **안드로이드 앱**: 같은 `www/`를 Capacitor로 감싸서 빌드 (추후 iOS도 `npx cap add ios`로 추가)
- **지도**: 구글/네이버 지도 없이, 행정구역 경계를 SVG로 직접 그려 클릭 이벤트로 상세 정보 표시
- **백엔드**: 테스트 버전은 브라우저 저장(localStorage), 이후 Supabase 무료 플랜으로 전환

## 화면 구성

지역 중심 구조입니다. 지도나 메뉴에서 지역을 고르면, 그 지역에 해당하는 정보만 보여줍니다.

1. **메인 화면**: 한반도 지도 + 지역(시·도) 선택 메뉴만 표시
2. **시·도 선택**: 지도 확대 + 지역 상세 메뉴 + 시·군·구 목록
3. **시·군·구 선택**: 해당 지역의 상세 메뉴
4. **지역 상세 메뉴**: 지역 소개(공식 홈페이지) · 단체장 인사말 · 축제 · 투자유치 · YouTube · Facebook · X. 시·도에서는 소속 시·군·구 내용까지 함께 보여줍니다.
5. **햄버거 메뉴**: 상단에 언어 선택 · 로그인 · 회원가입(로그인 후에는 관리자 · 로그아웃), 그 아래 시·도 선택 → 시·군·구 선택, 지역을 고르면 하단에 그 지역의 상세 메뉴

주소 예: `#/map/37` (경상북도), `#/map/37/37040?s=festivals` (안동시 축제)

## 관리자 모드

웹(또는 앱)에서 `admin / admin1234`로 로그인 → 메뉴의 **Admin** (`#/admin`).

- **Mayors / Festivals / Investment / Social posts**: 지역을 지정해 추가 · 수정 · 삭제, 이미지(URL 또는 업로드), 링크 URL, 노출 여부, 순서, 영어·한국어 문구
- **Regions**: 17개 시·도 + 229개 지역(226개 시·군·구 + 세종 + 제주시·서귀포시)의 공식 홈페이지 URL, 소개 문구, 배너 이미지 연결
- **Settings**: 유튜브/페이스북/X 계정 주소, 유튜브 채널 ID
- **Members**: 테스트 가입 회원 목록, 관리자 권한 부여/삭제
- **Data**: JSON 내보내기/가져오기, 기본 데이터로 초기화

테스트 계정은 `www/js/config.js`의 `testAccounts`에서 바꿀 수 있습니다 (`guest / guest1234`는 일반 회원).

> ⚠️ 테스트 모드(`backend: 'local'`)에서는 수정 내용이 **그 브라우저에만** 저장됩니다.
> 모든 방문자에게 반영하려면 Admin → Data → **Export JSON** 한 파일로 `www/data/seed.json`을 교체해 배포하거나, Supabase로 전환하세요.
> 테스트용 로그인은 브라우저에서만 확인하므로 보안 기능이 아닙니다. 정식 오픈 전 Supabase Auth로 전환해야 합니다.

## 실행

```bash
npm start
```

→ http://localhost:8080 (빌드 과정 없음. `www/`를 아무 정적 서버로 열어도 됩니다)

### 웹 배포

- **GitHub Pages**: 저장소 Settings → Pages → Source를 **GitHub Actions**로 지정하면, `main`에 push될 때마다 `.github/workflows/pages.yml`이 `www/`를 배포합니다.
- **Cloudflare Pages**: Build command는 비워두고, Build output directory를 `www`로 지정합니다.

### 안드로이드 앱 (Capacitor)

#### 스마트폰에 테스트 APK 설치

`main`에 변경이 반영되면 GitHub Actions(`.github/workflows/android.yml`)가 APK를 만들어 **Releases → test-latest**에 올립니다.

1. 스마트폰 브라우저로 `https://github.com/eineye/KoreaCityInfo/releases/tag/test-latest`를 엽니다.
2. `KoreaCityInfo-test.apk`를 내려받아 엽니다.
3. "출처를 알 수 없는 앱 설치"를 허용하고 설치합니다.

앱 안에 웹 파일이 들어 있어 웹 주소에 접속하지 않고 동작합니다. 유튜브 영상과 외부 링크는 인터넷이 필요합니다.
새 빌드는 기존 앱 위에 그대로 덮어 설치됩니다. 테스트 서명 키 `android/app/debug-test.keystore`를 함께 쓰기 때문입니다.
이 키는 테스트 전용이고, Play 스토어 출시용으로는 별도의 비공개 키를 만들어야 합니다.

#### 직접 빌드 (Android Studio)

Android Studio와 JDK 21이 필요합니다. `www/` 내용을 수정한 뒤에는 sync를 다시 실행합니다.

```bash
npm install
```

```bash
npm run android:sync
```

```bash
npm run android:open
```

앱에서 관리자 메뉴를 숨기려면 `www/js/config.js`의 `showAdminInApp`을 `false`로 바꿉니다.

## Supabase 전환 (무료 플랜)

1. supabase.com에서 프로젝트 생성
2. SQL Editor에서 `supabase/schema.sql` 실행
3. `www/js/config.js`에서 `backend: 'supabase'`, `supabase.url`, `supabase.anonKey` 입력
4. 앱에서 이메일로 회원가입 → SQL로 해당 계정에 `role: admin` 부여 (schema.sql 하단 참고)
5. 관리자로 로그인 → Admin → Data → **Reset to default data** (또는 Import JSON)로 초기 데이터 업로드

콘텐츠는 `content(collection, id, data jsonb)` 하나의 테이블에 저장되며, 읽기는 모두 허용되고 쓰기는 관리자만 가능합니다(RLS).

## 지도 데이터

`www/data/korea-map.json`은 `scripts/build-map.mjs`가 만듭니다 (`npm install` 후 `npm run build:map`).

- 원본: KOSTAT 2013 행정경계 ([southkorea/southkorea-maps](https://github.com/southkorea/southkorea-maps), `data-src/`)
- 현재 행정구역으로 보정: 일반구 → 시로 통합 (수원·성남·안양·부천·안산·고양·용인·청주·천안·전주·포항·창원), 청원군 → 청주시, 군위군 → 대구광역시, 인천 남구 → 미추홀구, 강원특별자치도 · 전북특별자치도 명칭
- 미반영: 2026년 7월 인천 행정체제 개편(중구·동구 → 제물포구·영종구, 서구 → 서구·검단구). 새 경계 데이터가 생기면 `data-src/`를 교체하고 스크립트를 다시 실행하면 됩니다.

## 기본 데이터에 대해

`www/data/seed.json`에는 17개 시·도의 공식 홈페이지와 소개, 대표 축제 13개, 투자 정보 예시 4개가 들어 있습니다.
**단체장 인사말과 투자 정보는 `Sample` 표시가 붙은 예시**이며 실제 성명/사진/공식 문구로 교체해야 합니다. 축제 시기와 홈페이지 주소도 공개 전에 한 번 확인해 주세요.
기초 지자체 홈페이지는 일부만 등록되어 있고, 미등록 지역은 "공식 홈페이지 찾기"(검색) 버튼이 표시됩니다 — Admin → Regions에서 채워 넣으세요.

## 폴더 구조

```
www/                  웹/앱 공통 소스 (정적 파일)
  index.html
  css/style.css
  js/config.js        백엔드·언어·테스트 계정 설정
  js/app.js           화면/라우팅 (#/, #/map/31/31010, #/festivals …)
  js/map.js           SVG 지도
  js/admin.js         관리자 모드
  js/store.js         데이터 저장 (local / Supabase)
  js/auth.js          로그인 (테스트 계정 / Supabase Auth)
  js/i18n.js          다국어 문구 (en, ko, ja, zh)
  js/schemas.js       관리 항목 필드 정의
  data/korea-map.json 지도 경로 데이터 (생성 파일)
  data/seed.json      기본 콘텐츠
scripts/build-map.mjs 지도 데이터 생성 스크립트
supabase/schema.sql   Supabase 테이블/권한
capacitor.config.json 안드로이드 앱 설정
```
