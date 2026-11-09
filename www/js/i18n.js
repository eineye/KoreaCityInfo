import { CONFIG } from './config.js';

const STRINGS = {
  en: {
    tagline: 'Discover the cities and provinces of Korea',
    menu: 'Menu', home: 'Korea Map', mayors: "Mayor's Greetings", festivals: 'Festivals', investment: 'Investment',
    youtube: 'YouTube', facebook: 'Facebook', x: 'X', language: 'Language',
    login: 'Log in', logout: 'Log out', signup: 'Sign up', admin: 'Admin',
    username: 'ID', password: 'Password', name: 'Name', submit: 'Submit',
    loginTitle: 'Log in', signupTitle: 'Create account',
    testNotice: 'Test version: use a temporary ID/password. Social login will be added later.',
    noAccount: "Don't have an account?", haveAccount: 'Already have an account?',
    loginFailed: 'Wrong ID or password.', userExists: 'This ID is already taken.', signupDone: 'Account created. You are now logged in.',
    mapHint: 'Tap a province to explore its cities, counties and districts.',
    back: 'Back', allKorea: 'All Korea', officialSite: 'Official website', visit: 'Visit',
    findSite: 'Find official website', localGovs: 'Cities · Counties · Districts',
    related: 'Related', noItems: 'Nothing here yet.', allRegions: 'All regions', filter: 'Region',
    openProfile: 'Open our {p} page', latest: 'Latest from our channel', posts: 'Featured posts',
    more: 'More', close: 'Close', search: 'Search region…',
    adminTitle: 'Administrator', adminOnly: 'Administrator login required.',
    add: 'Add', edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel', confirmDelete: 'Delete this item?',
    saved: 'Saved.', deleted: 'Deleted.', regions: 'Regions', homeBanners: 'Home banners', social: 'Social posts',
    settings: 'Settings', users: 'Members', data: 'Data', exportData: 'Export JSON', importData: 'Import JSON',
    resetData: 'Reset to default data', confirmReset: 'Reset all content to the default data?',
    imported: 'Data imported.', storageLocal: 'Storage: this browser (test mode)', storageSupabase: 'Storage: Supabase',
    image: 'Image', uploadImage: 'Upload image', active: 'Visible', order: 'Order',
    sample: 'Sample', period: 'Period', sector: 'Sector', notRegistered: 'Not registered yet'
  },
  ko: {
    tagline: '대한민국의 도시와 지역을 만나보세요',
    menu: '메뉴', home: '한국 지도', mayors: '단체장 인사말', festivals: '축제', investment: '투자유치',
    youtube: '유튜브', facebook: '페이스북', x: 'X', language: '언어',
    login: '로그인', logout: '로그아웃', signup: '회원가입', admin: '관리자',
    username: '아이디', password: '비밀번호', name: '이름', submit: '확인',
    loginTitle: '로그인', signupTitle: '회원가입',
    testNotice: '테스트 버전: 임시 아이디/비밀번호를 사용합니다. 소셜 로그인은 추후 지원됩니다.',
    noAccount: '계정이 없으신가요?', haveAccount: '이미 계정이 있으신가요?',
    loginFailed: '아이디 또는 비밀번호가 올바르지 않습니다.', userExists: '이미 사용 중인 아이디입니다.', signupDone: '가입이 완료되어 로그인되었습니다.',
    mapHint: '시·도를 누르면 시·군·구를 볼 수 있습니다.',
    back: '뒤로', allKorea: '전국', officialSite: '공식 홈페이지', visit: '바로가기',
    findSite: '공식 홈페이지 찾기', localGovs: '시 · 군 · 구',
    related: '관련 정보', noItems: '등록된 내용이 없습니다.', allRegions: '전체 지역', filter: '지역',
    openProfile: '{p} 페이지 열기', latest: '채널 최신 영상', posts: '추천 게시물',
    more: '더보기', close: '닫기', search: '지역 검색…',
    adminTitle: '관리자 모드', adminOnly: '관리자 로그인이 필요합니다.',
    add: '추가', edit: '수정', delete: '삭제', save: '저장', cancel: '취소', confirmDelete: '이 항목을 삭제할까요?',
    saved: '저장되었습니다.', deleted: '삭제되었습니다.', regions: '지역 정보', homeBanners: '메인 배너', social: 'SNS 게시물',
    settings: '설정', users: '회원', data: '데이터', exportData: 'JSON 내보내기', importData: 'JSON 가져오기',
    resetData: '기본 데이터로 초기화', confirmReset: '모든 콘텐츠를 기본 데이터로 초기화할까요?',
    imported: '데이터를 가져왔습니다.', storageLocal: '저장소: 이 브라우저 (테스트 모드)', storageSupabase: '저장소: Supabase',
    image: '이미지', uploadImage: '이미지 업로드', active: '노출', order: '순서',
    sample: '샘플', period: '기간', sector: '분야', notRegistered: '아직 등록되지 않음'
  },
  ja: {
    tagline: '韓国の都市と地域を発見しよう',
    menu: 'メニュー', home: '韓国地図', mayors: '首長あいさつ', festivals: 'お祭り', investment: '投資誘致',
    language: '言語', login: 'ログイン', logout: 'ログアウト', signup: '新規登録', admin: '管理者',
    username: 'ID', password: 'パスワード', name: '名前', submit: '送信',
    mapHint: '道・広域市をタップすると市・郡・区が表示されます。',
    back: '戻る', allKorea: '全国', officialSite: '公式サイト', visit: '開く', localGovs: '市・郡・区',
    related: '関連情報', noItems: 'まだ登録がありません。', allRegions: 'すべての地域', filter: '地域', close: '閉じる'
  },
  zh: {
    tagline: '探索韩国的城市与地区',
    menu: '菜单', home: '韩国地图', mayors: '市长致辞', festivals: '节庆', investment: '招商引资',
    language: '语言', login: '登录', logout: '退出', signup: '注册', admin: '管理员',
    username: '账号', password: '密码', name: '姓名', submit: '提交',
    mapHint: '点击省/市，查看下属市、郡、区。',
    back: '返回', allKorea: '全国', officialSite: '官方网站', visit: '访问', localGovs: '市 · 郡 · 区',
    related: '相关信息', noItems: '暂无内容。', allRegions: '全部地区', filter: '地区', close: '关闭'
  }
};

const KEY = 'kci.lang';
let lang = (() => {
  try { return localStorage.getItem(KEY) || CONFIG.defaultLanguage; } catch { return CONFIG.defaultLanguage; }
})();

export const getLang = () => lang;
export const setLang = (l) => {
  lang = l;
  try { localStorage.setItem(KEY, l); } catch {}
  document.documentElement.lang = l;
};

export function t(key, vars) {
  let s = STRINGS[lang]?.[key] ?? STRINGS.en[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}

// Localised content field: either a plain string or { en, ko, ... }
export function L(field) {
  if (field == null) return '';
  if (typeof field === 'string') return field;
  return field[lang] || field.en || Object.values(field).find(Boolean) || '';
}

// Region names: Korean for ko, English otherwise
export const regionName = (r) => (r ? (lang === 'ko' ? r.ko : r.en) : '');
