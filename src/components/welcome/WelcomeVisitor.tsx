import { useCallback, useEffect, useRef, useState } from 'react';
import { welcomeConfig } from '@/constants/site-config';
import '@/styles/components/welcome.css';

/**
 * Visitor welcome card — ported from the previous Hexo blog's `card-welcome.js`:
 *
 *   欢迎来自 <地点> 的朋友
 *   您距离博主位置约 <N> 公里！
 *   您的 IP 地址：<IP>
 *   <时段问候>
 *   Tip：<地域问候>
 *
 * Location detection: IP only, no geolocation permission
 * ------------------------------------------------------
 * The previous blog never called `navigator.geolocation`; it relied entirely on
 * an IP database (`https://v1.nsuuu.com/api/ipip?ip=…`, an ipip.net mirror) and
 * was accurate. The difference is **which database**, not IP vs GPS:
 *
 *   For the same Chinese IP (113.76.180.239, China Telecom Guangdong):
 *     ip-api.com     → 广州市    (wrong: the provincial egress node)
 *     ipwho.is       → Guangzhou (wrong, same reason)
 *     api.ip.sb      → 珠海市    (correct — 22.28, 113.57 is Zhuhai)
 *
 * So `api.ip.sb`, whose database resolves Chinese IPs to the actual city, is
 * tried first and the international services are the fallback. There is no
 * permission prompt.
 *
 * Those services return English names (`Guangdong` / `Zhuhai`) while the
 * greeting table is keyed in Chinese, so `CN_REGIONS` / `CN_CITIES` map the
 * common ones. Anything unmapped still shows the Chinese province (or country)
 * rather than leaking a Romanized name into the place text.
 *
 * See `.migration/NOTES-welcome-card.md` and `REF-welcome-original.md`.
 */

interface IpInfo {
  ip: string;
  country: string;
  province: string;
  city: string;
  lng: number | null;
  lat: number | null;
}

type Status = 'loading' | 'ready' | 'unavailable';

const REQUEST_TIMEOUT_MS = 6000;

const CN_NAMES_BY_CODE: Record<string, string> = {
  CN: '中国',
  HK: '香港特别行政区',
  MO: '澳门特别行政区',
  TW: '台湾',
};

/**
 * Canonicalize a country name to the key used by `welcome.greetings`.
 *
 * Services disagree: ipwho.is/ip.sb return English (`China`), ip-api.com returns
 * Chinese, and BigDataCloud returns the *formal* name (`中华人民共和国`). The
 * table key is the plain `中国`, so all flavours are folded in here.
 */
const COUNTRY_ALIASES: Record<string, string> = {
  中国: '中国',
  中华人民共和国: '中国',
  China: '中国',
  'People\u2019s Republic of China': '中国',
  "People's Republic of China": '中国',
  PRC: '中国',
  香港特别行政区: '香港特别行政区',
  香港: '香港特别行政区',
  'Hong Kong': '香港特别行政区',
  澳门特别行政区: '澳门特别行政区',
  澳门: '澳门特别行政区',
  Macau: '澳门特别行政区',
  Macao: '澳门特别行政区',
  台湾: '台湾',
  Taiwan: '台湾',
};

/** English country name → the Chinese key used by `welcome.greetings`. */
const COUNTRY_CN: Record<string, string> = {
  'United States': '美国',
  'United States of America': '美国',
  Japan: '日本',
  Russia: '俄罗斯',
  'Russian Federation': '俄罗斯',
  France: '法国',
  Germany: '德国',
  Australia: '澳大利亚',
  Canada: '加拿大',
  'United Kingdom': '英国',
  Italy: '意大利',
  Spain: '西班牙',
  Brazil: '巴西',
  India: '印度',
  Mexico: '墨西哥',
  'South Africa': '南非',
  Egypt: '埃及',
  Turkey: '土耳其',
  'South Korea': '韩国',
  'Korea, Republic of': '韩国',
  Vietnam: '越南',
  Thailand: '泰国',
  Philippines: '菲律宾',
  Malaysia: '马来西亚',
  Singapore: '新加坡',
  Indonesia: '印尼',
  'Saudi Arabia': '沙特阿拉伯',
  'United Arab Emirates': '阿联酋',
  Israel: '以色列',
  Netherlands: '荷兰',
  Belgium: '比利时',
  Switzerland: '瑞士',
  Sweden: '瑞典',
  Norway: '挪威',
  Denmark: '丹麦',
  Finland: '芬兰',
  Poland: '波兰',
  'Czech Republic': '捷克共和国',
  Czechia: '捷克共和国',
  Greece: '希腊',
  Portugal: '葡萄牙',
};

/**
 * Region name from any provider → the Chinese name used by the greeting table.
 *
 * Covers every provincial-level division, in the short form (`Guangdong`), the
 * long form ipwho.is prefers (`Guangdong Sheng`), and the Chinese form.
 */
const CN_REGIONS: Record<string, string> = {
  广东: '广东',
  广东省: '广东',
  Guangdong: '广东',
  'Guangdong Sheng': '广东',
  北京: '北京',
  北京市: '北京',
  Beijing: '北京',
  'Beijing Shi': '北京',
  上海: '上海',
  上海市: '上海',
  Shanghai: '上海',
  'Shanghai Shi': '上海',
  天津: '天津',
  天津市: '天津',
  Tianjin: '天津',
  'Tianjin Shi': '天津',
  重庆: '重庆',
  重庆市: '重庆',
  Chongqing: '重庆',
  'Chongqing Shi': '重庆',
  浙江: '浙江',
  浙江省: '浙江',
  Zhejiang: '浙江',
  'Zhejiang Sheng': '浙江',
  江苏: '江苏',
  江苏省: '江苏',
  Jiangsu: '江苏',
  'Jiangsu Sheng': '江苏',
  湖南: '湖南',
  湖南省: '湖南',
  Hunan: '湖南',
  'Hunan Sheng': '湖南',
  湖北: '湖北',
  湖北省: '湖北',
  Hubei: '湖北',
  'Hubei Sheng': '湖北',
  四川: '四川',
  四川省: '四川',
  Sichuan: '四川',
  'Sichuan Sheng': '四川',
  福建: '福建',
  福建省: '福建',
  Fujian: '福建',
  'Fujian Sheng': '福建',
  山东: '山东',
  山东省: '山东',
  Shandong: '山东',
  'Shandong Sheng': '山东',
  河南: '河南',
  河南省: '河南',
  Henan: '河南',
  'Henan Sheng': '河南',
  河北: '河北',
  河北省: '河北',
  Hebei: '河北',
  'Hebei Sheng': '河北',
  陕西: '陕西',
  陕西省: '陕西',
  Shaanxi: '陕西',
  'Shaanxi Sheng': '陕西',
  辽宁: '辽宁',
  辽宁省: '辽宁',
  Liaoning: '辽宁',
  'Liaoning Sheng': '辽宁',
  安徽: '安徽',
  安徽省: '安徽',
  Anhui: '安徽',
  'Anhui Sheng': '安徽',
  江西: '江西',
  江西省: '江西',
  Jiangxi: '江西',
  'Jiangxi Sheng': '江西',
  广西: '广西壮族自治区',
  广西壮族自治区: '广西壮族自治区',
  Guangxi: '广西壮族自治区',
  'Guangxi Zhuangzu Zizhiqu': '广西壮族自治区',
  云南: '云南',
  云南省: '云南',
  Yunnan: '云南',
  'Yunnan Sheng': '云南',
  贵州: '贵州',
  贵州省: '贵州',
  Guizhou: '贵州',
  'Guizhou Sheng': '贵州',
  山西: '山西',
  山西省: '山西',
  Shanxi: '山西',
  'Shanxi Sheng': '山西',
  黑龙江: '黑龙江',
  黑龙江省: '黑龙江',
  Heilongjiang: '黑龙江',
  'Heilongjiang Sheng': '黑龙江',
  吉林: '吉林',
  吉林省: '吉林',
  Jilin: '吉林',
  'Jilin Sheng': '吉林',
  海南: '海南',
  海南省: '海南',
  Hainan: '海南',
  'Hainan Sheng': '海南',
  甘肃: '甘肃',
  甘肃省: '甘肃',
  Gansu: '甘肃',
  'Gansu Sheng': '甘肃',
  内蒙古: '内蒙古自治区',
  内蒙古自治区: '内蒙古自治区',
  'Inner Mongolia': '内蒙古自治区',
  'Inner Mongolia Zizhiqu': '内蒙古自治区',
  宁夏: '宁夏回族自治区',
  宁夏回族自治区: '宁夏回族自治区',
  Ningxia: '宁夏回族自治区',
  'Ningxia Huizu Zizhiqu': '宁夏回族自治区',
  青海: '青海',
  青海省: '青海',
  Qinghai: '青海',
  'Qinghai Sheng': '青海',
  新疆: '新疆维吾尔自治区',
  新疆维吾尔自治区: '新疆维吾尔自治区',
  Xinjiang: '新疆维吾尔自治区',
  'Xinjiang Uygur Zizhiqu': '新疆维吾尔自治区',
  西藏: '西藏自治区',
  西藏自治区: '西藏自治区',
  Tibet: '西藏自治区',
  'Xizang Zizhiqu': '西藏自治区',
};

/**
 * City name → the Chinese key used by the greeting table.
 *
 * The Chinese IP databases return English city names (`Zhuhai`), and some
 * Chinese services return the official form (`珠海市`). Guangdong is covered
 * exhaustively because that is where this blog and most of its audience are; the
 * rest are the major cities. Lookups also try the 市-stripped form, so a missed
 * city still resolves through its province entry.
 */
const CN_CITIES: Record<string, string> = {
  // 广东 21 个地级市
  Guangzhou: '广州',
  广州市: '广州',
  Shenzhen: '深圳',
  深圳市: '深圳',
  Zhuhai: '珠海',
  珠海市: '珠海',
  Shantou: '汕头',
  汕头市: '汕头',
  Foshan: '佛山',
  佛山市: '佛山',
  Shaoguan: '韶关',
  Zhanjiang: '湛江',
  Zhaoqing: '肇庆',
  Jiangmen: '江门',
  Maoming: '茂名',
  Huizhou: '惠州',
  Meizhou: '梅州',
  Shanwei: '汕尾',
  Heyuan: '河源',
  Yangjiang: '阳江',
  Qingyuan: '清远',
  Dongguan: '东莞',
  东莞市: '东莞',
  Zhongshan: '中山',
  中山市: '中山',
  Chaozhou: '潮州',
  Jieyang: '揭阳',
  Yunfu: '云浮',
  // 其它主要城市
  Beijing: '北京',
  Shanghai: '上海',
  Tianjin: '天津',
  Chongqing: '重庆',
  Hangzhou: '杭州',
  Nanjing: '南京',
  Suzhou: '苏州',
  Wuhan: '武汉',
  Changsha: '长沙',
  Chengdu: '成都',
  Xiamen: '厦门',
  Fuzhou: '福州',
  Qingdao: '青岛',
  Jinan: '济南',
  Zhengzhou: '郑州',
  Xian: '西安',
  "Xi'an": '西安',
  Shenyang: '沈阳',
  Dalian: '大连',
  Harbin: '哈尔滨',
  Changchun: '长春',
  Hefei: '合肥',
  Nanchang: '南昌',
  Kunming: '昆明',
  Guiyang: '贵阳',
  Nanning: '南宁',
  Haikou: '海口',
  Sanya: '三亚',
  Lanzhou: '兰州',
  Taiyuan: '太原',
  Shijiazhuang: '石家庄',
  Urumqi: '乌鲁木齐',
  Hohhot: '呼和浩特',
  Yinchuan: '银川',
  Xining: '西宁',
  Lhasa: '拉萨',
  'Hong Kong': '香港特别行政区',
  Macau: '澳门特别行政区',
  Taipei: '台北',
};

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** `珠海市` → `珠海`, `广东省` → `广东`, `四川省` → `四川` … */
function stripAdminSuffix(value: string): string {
  return value.replace(/(特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市|县|区)$/u, '');
}

function canonicalCountry(raw: string, code = ''): string {
  const upper = code.toUpperCase();
  if (CN_NAMES_BY_CODE[upper]) return CN_NAMES_BY_CODE[upper];
  return COUNTRY_ALIASES[raw] ?? COUNTRY_CN[raw] ?? (stripAdminSuffix(raw) || raw);
}

async function fetchJson(url: string): Promise<Record<string, unknown>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as Record<string, unknown>;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Parse a coordinate pair.
 *
 * Providers disagree on shape: most use numeric `longitude`/`latitude`, while
 * ipinfo.io packs both into `loc: "23.0180,113.7487"` (lat,lng).
 */
function parseCoords(raw: Record<string, unknown>): { lng: number | null; lat: number | null } {
  const direct = { lng: num(raw.longitude ?? raw.lng), lat: num(raw.latitude ?? raw.lat) };
  if (direct.lng !== null && direct.lat !== null) return direct;

  const loc = str(raw.loc);
  if (loc) {
    const [latPart, lngPart] = loc.split(',');
    const lat = Number.parseFloat(latPart);
    const lng = Number.parseFloat(lngPart);
    if (Number.isFinite(lat) && Number.isFinite(lng)) return { lng, lat };
  }
  return direct;
}

/** Normalize an IP-geolocation payload from any provider into `IpInfo`. */
function normalizeIp(raw: Record<string, unknown>, fallbackIp: string): IpInfo {
  // ipinfo.io puts the ISO code in `country`; others use `country_code`.
  const rawCountryField = str(raw.country);
  const code = (str(raw.country_code) || (/^[A-Za-z]{2}$/.test(rawCountryField) ? rawCountryField : '')).toUpperCase();
  const rawRegion = str(raw.region) || str(raw.regionName) || str(raw.region_name);
  const rawCity = str(raw.city);
  const rawCountry = str(raw.country_name) || (/^[A-Za-z]{2}$/.test(rawCountryField) ? '' : rawCountryField);
  const country = canonicalCountry(rawCountry, code);
  // Only translate Chinese place names when we are actually in China — "Dublin"
  // must not be rewritten just because some other country has a similar name.
  const isCn = country === '中国';

  return {
    ip: str(raw.ip) || fallbackIp,
    country,
    province: isCn ? (CN_REGIONS[rawRegion] ?? stripAdminSuffix(rawRegion)) : rawRegion,
    city: isCn ? (CN_CITIES[rawCity] ?? stripAdminSuffix(rawCity)) : rawCity,
    ...parseCoords(raw),
  };
}

/**
 * Keyless IP-geolocation providers, in priority order.
 *
 * `api.ip.sb` first: its database resolves Chinese IPs to the actual city
 * (Zhuhai), whereas the international services stop at the provincial egress
 * node (Guangzhou) — the discrepancy the previous blog never had because it too
 * used a Chinese database. The rest are fallbacks for non-Chinese visitors and
 * for when ip.sb is unreachable.
 */
const IP_PROVIDERS: Array<() => Promise<Record<string, unknown>>> = [
  () => fetchJson('https://api.ip.sb/geoip'),
  () => fetchJson('https://ipwho.is/'),
  () => fetchJson('https://ipapi.co/json/'),
  () => fetchJson('https://ipinfo.io/json'),
];

async function lookupIp(): Promise<IpInfo> {
  for (const provider of IP_PROVIDERS) {
    try {
      const info = normalizeIp(await provider(), '');
      // A payload with no country cannot drive the greeting table; keep trying.
      if (info.country) return info;
    } catch {
      /* next provider */
    }
  }
  throw new Error('all IP providers failed');
}

/** Haversine distance in whole kilometres — same constants as the original. */
function distanceKm(aLng: number, aLat: number, bLng: number, bLat: number): number {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (bLat - aLat) * rad;
  const dLon = (bLng - aLng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * rad) * Math.cos(bLat * rad) * Math.sin(dLon / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

/** Time-of-day greeting. Needs no network, so it paints on the first frame. */
function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '深夜了🌙 注意休息呀~';
  if (hour < 11) return '早上好🌤️ 一日之计在于晨';
  if (hour < 13) return '中午好☀️ 记得午休喔~';
  if (hour < 17) return '下午好🕞 饮茶先啦！';
  if (hour < 19) return '即将下班🚶 记得按时吃饭~';
  return '晚上好🌙 夜生活嗨起来！';
}

/**
 * Chinese city name → the key used in the greetings table.
 *
 * The table uses bare names (`珠海`) while some services return the official
 * form (`珠海市`); the suffix-stripped form is probed too, so an unmapped city
 * still resolves through its province instead of `其他`.
 */
function cityKeyFor(city: string, province: string): string {
  if (!city) return '';
  const bare = stripAdminSuffix(city);
  const countryEntry = welcomeConfig.greetings['中国'];
  const provinceEntry = typeof countryEntry === 'object' && countryEntry !== null ? countryEntry[province] : undefined;
  if (provinceEntry && typeof provinceEntry === 'object') {
    if (provinceEntry[city] !== undefined) return city;
    if (bare && provinceEntry[bare] !== undefined) return bare;
  }
  return bare || city;
}

/** Country → province → city lookup with an `其他` fallback at each level. */
function regionalGreeting(info: IpInfo): string {
  const table = welcomeConfig.greetings;
  const byCountry = table[info.country] ?? table['其他'];
  if (typeof byCountry === 'string') return byCountry;

  const byProvince = byCountry[info.province] ?? byCountry['其他'];
  if (typeof byProvince === 'string' || !byProvince) {
    return typeof byProvince === 'string' ? byProvince : '';
  }

  return byProvince[cityKeyFor(info.city, info.province)] ?? byProvince['其他'] ?? '';
}

/**
 * `广东 珠海` for China; other countries keep their own name.
 *
 * Inside China only already-Chinese names are trusted (`CN_REGIONS` /
 * `CN_CITIES`). If a small city is not mapped we show less rather than mixing
 * `Shantou` into a Chinese place name.
 */
function formatLocation(info: IpInfo): string {
  if (!info.country) return '神秘地区';
  const cn = (v: string) => (v && !/[A-Za-z]/.test(v) ? v : '');
  if (info.country === '中国') {
    return [cn(info.province), cn(info.city)].filter(Boolean).join(' ') || '中国';
  }
  return [info.country, info.city].filter(Boolean).join(' · ');
}

/** Session cache + in-flight de-duplication (the sider mounts two islands). */
const CACHE_PREFIX = 'welcome-ip-v3:';

let cachedIp: IpInfo | null = null;
let ipInFlight: Promise<IpInfo> | null = null;

function readCache(): IpInfo | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + 'self');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; info: IpInfo };
    if (Date.now() - parsed.at > welcomeConfig.cacheHours * 3600_000) return null;
    return parsed.info;
  } catch {
    return null;
  }
}

function writeCache(info: IpInfo): void {
  try {
    sessionStorage.setItem(CACHE_PREFIX + 'self', JSON.stringify({ at: Date.now(), info }));
  } catch {
    /* private mode or quota — caching is optional */
  }
}

function resolveIp(): Promise<IpInfo> {
  if (cachedIp) return Promise.resolve(cachedIp);

  const fromSession = readCache();
  if (fromSession) {
    cachedIp = fromSession;
    return Promise.resolve(fromSession);
  }

  if (!ipInFlight) {
    ipInFlight = lookupIp()
      .then((info) => {
        cachedIp = info;
        writeCache(info);
        return info;
      })
      .finally(() => {
        ipInFlight = null;
      });
  }
  return ipInFlight;
}

export default function WelcomeVisitor() {
  const [status, setStatus] = useState<Status>('loading');
  const [info, setInfo] = useState<IpInfo | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    setStatus('loading');
    try {
      const next = await resolveIp();
      if (!alive.current) return;

      const { lng: blogLng, lat: blogLat } = welcomeConfig.blogLocation;
      setInfo(next);
      setDistance(next.lng !== null && next.lat !== null ? distanceKm(next.lng, next.lat, blogLng, blogLat) : null);
      setStatus('ready');
    } catch {
      if (alive.current) setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const greeting = timeGreeting();

  return (
    <div className="welcome-card">
      <div className="welcome-body">
        {status === 'ready' && info && (
          <p className="welcome-line">
            欢迎来自 <b className="welcome-strong">{formatLocation(info)}</b> 的朋友
          </p>
        )}

        {status === 'ready' && distance !== null && (
          <p className="welcome-line">
            您距离博主位置约 <b className="welcome-strong">{distance}</b> 公里！
          </p>
        )}

        {status === 'ready' && info?.ip && (
          <p className="welcome-line">
            您的 IP 地址：
            {/* 常态模糊，鼠标悬停才清晰（与原博客 .ip-address 一致）。
                注意：这是纯视觉遮挡，完整 IP 仍在 DOM 中。 */}
            <b className="welcome-ip" title="鼠标悬停查看">
              {info.ip}
            </b>
          </p>
        )}

        {/* 时段问候不需要网络，首帧就渲染，骨架只占位置相关的行 */}
        <p className="welcome-line">{greeting}</p>

        {status === 'loading' && (
          <div className="welcome-skeleton-group" aria-hidden="true">
            <span className="welcome-skeleton" />
            <span className="welcome-skeleton welcome-skeleton-short" />
          </div>
        )}

        {status === 'unavailable' && <p className="welcome-line welcome-tip">未能获取到你的位置信息，不过还是欢迎你的到来～</p>}

        {status === 'ready' && info && (
          <p className="welcome-line welcome-tip">
            Tip：<b className="welcome-strong">{regionalGreeting(info)}</b>
          </p>
        )}

        {status !== 'loading' && (
          <button type="button" className="welcome-refresh" onClick={() => void run()} title="重新获取">
            ↻
          </button>
        )}
      </div>
    </div>
  );
}
