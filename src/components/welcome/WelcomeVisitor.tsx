import { useCallback, useEffect, useRef, useState } from 'react';
import { welcomeConfig } from '@/constants/site-config';
import '@/styles/components/welcome.css';

/**
 * Visitor welcome card.
 *
 * Ported from the previous Hexo blog's `card-welcome.js`, which showed:
 *
 *   欢迎来自 <地点> 的朋友
 *   您当前距博主约 <N> 公里！
 *   您的IP地址：<IP>
 *   <时段问候>
 *   Tip：<地域问候>
 *
 * Three deliberate changes from that original (see
 * `.migration/NOTES-welcome-card.md`):
 *
 *  1. **No API key.** The original shipped a hardcoded key belonging to another
 *     blog (`IP_CONFIG.API_KEY`, for v1.nsuuu.com). This uses keyless public
 *     endpoints with a fallback chain instead.
 *  2. **Geolocation is optional.** The original *required* the permission and
 *     showed an error dialog when refused. Here a refusal (or a timeout) simply
 *     drops the "distance" line; everything else still renders.
 *  3. **The IP is masked by default** (`113.76.*.*`), expanding only on click.
 *     The original put the full address in the DOM and relied on a CSS blur,
 *     which still leaks the value to copy/paste, screenshots, and scripts.
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
const GEO_TIMEOUT_MS = 7000;

/**
 * `ipapi.co` and `ipwho.is` share this shape closely enough for one normalizer.
 *
 * Two normalization problems surfaced in practice:
 *
 *  1. **Country names differ by locale.** ipwho.is returns `country` ("China")
 *     plus a `country_code`; ipapi.co returns a localized `country_name` (e.g.
 *     "中国"). We prefer the localized one so it matches the Chinese keys in
 *     `welcome.greetings`, mapping the common cases by ISO code otherwise.
 *  2. **Chinese province/city names come back romanized** ("Guangdong Sheng",
 *     "Guangzhou"), which neither matches the Chinese config keys nor reads well.
 *     A small table covers the provinces/ municipalities; anything else is shown
 *     as-is.
 */
const CN_NAMES_BY_CODE: Record<string, string> = {
  CN: '中国',
  HK: '中国香港',
  MO: '中国澳门',
  TW: '中国台湾',
};

/** Romanized Chinese province / municipality (ipwho.is style) → 中文名. */
const CN_REGIONS: Record<string, string> = {
  'Guangdong Sheng': '广东',
  Guangdong: '广东',
  'Beijing Shi': '北京',
  Beijing: '北京',
  'Shanghai Shi': '上海',
  Shanghai: '上海',
  'Tianjin Shi': '天津',
  Tianjin: '天津',
  'Chongqing Shi': '重庆',
  Chongqing: '重庆',
  'Zhejiang Sheng': '浙江',
  Zhejiang: '浙江',
  'Jiangsu Sheng': '江苏',
  Jiangsu: '江苏',
  'Hunan Sheng': '湖南',
  Hunan: '湖南',
  'Hubei Sheng': '湖北',
  Hubei: '湖北',
  'Sichuan Sheng': '四川',
  Sichuan: '四川',
  'Fujian Sheng': '福建',
  Fujian: '福建',
  'Shandong Sheng': '山东',
  Shandong: '山东',
  'Henan Sheng': '河南',
  Henan: '河南',
  'Hebei Sheng': '河北',
  Hebei: '河北',
  'Shaanxi Sheng': '陕西',
  Shaanxi: '陕西',
  'Liaoning Sheng': '辽宁',
  Liaoning: '辽宁',
  'Anhui Sheng': '安徽',
  Anhui: '安徽',
  'Jiangxi Sheng': '江西',
  Jiangxi: '江西',
  'Guangxi Zhuangzu Zizhiqu': '广西',
  'Yunnan Sheng': '云南',
  Yunnan: '云南',
  'Guizhou Sheng': '贵州',
  Guizhou: '贵州',
  'Shanxi Sheng': '山西',
  Shanxi: '山西',
  'Heilongjiang Sheng': '黑龙江',
  Heilongjiang: '黑龙江',
  'Jilin Sheng': '吉林',
  Jilin: '吉林',
  'Hainan Sheng': '海南',
  Hainan: '海南',
  'Gansu Sheng': '甘肃',
  Gansu: '甘肃',
  'Inner Mongolia Zizhiqu': '内蒙古',
  'Ningxia Huizu Zizhiqu': '宁夏',
  'Qinghai Sheng': '青海',
  Qinghai: '青海',
  'Xinjiang Uygur Zizhiqu': '新疆',
  'Xizang Zizhiqu': '西藏',
  Tibet: '西藏',
};

/** Common Chinese city names as ipwho.is romanizes them → 中文名. */
const CN_CITIES: Record<string, string> = {
  Guangzhou: '广州',
  Shenzhen: '深圳',
  Zhuhai: '珠海',
  Dongguan: '东莞',
  Foshan: '佛山',
  Zhongshan: '中山',
  Huizhou: '惠州',
  Shantou: '汕头',
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
};

function normalize(raw: Record<string, unknown>, fallbackIp: string): IpInfo {
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const code = str(raw.country_code).toUpperCase();
  const rawRegion = str(raw.region) || str(raw.region_name);
  const rawCity = str(raw.city);
  const country = str(raw.country_name) || CN_NAMES_BY_CODE[code] || str(raw.country);
  // Only translate Chinese place names when we are actually in China — "Dublin"
  // must not be rewritten just because some other country has a similar name.
  const isCn = country.startsWith('中国') || country === 'China';

  return {
    ip: str(raw.ip) || fallbackIp,
    country: country === 'China' ? '中国' : country,
    province: (isCn ? CN_REGIONS[rawRegion] : undefined) ?? rawRegion,
    city: (isCn ? CN_CITIES[rawCity] : undefined) ?? rawCity,
    lng: num(raw.longitude ?? raw.lng),
    lat: num(raw.latitude ?? raw.lat),
  };
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
 * Look up the visitor's IP geolocation. Two keyless providers are tried in
 * order; both return coordinates so the distance line can be computed without
 * a second request.
 */
async function lookupIp(): Promise<IpInfo> {
  // Provider 1: ipapi.co — includes country/region/city and lng/lat.
  try {
    return normalize(await fetchJson('https://ipapi.co/json/'), '');
  } catch {
    /* try the next provider */
  }

  // Provider 2: ipwho.is — same fields under slightly different names.
  try {
    return normalize(await fetchJson('https://ipwho.is/'), '');
  } catch {
    /* fall through to the error state */
  }

  throw new Error('all providers failed');
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

/** Time-of-day greeting. Kept close to the original wording. */
function timeGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 6) return '深夜了🌙 注意休息呀~';
  if (hour < 11) return '早上好🌤️ 一日之计在于晨';
  if (hour < 13) return '中午好☀️ 记得午休喔~';
  if (hour < 17) return '下午好🕞 饮茶先啦！';
  if (hour < 19) return '即将下班🚶 记得按时吃饭~';
  return '晚上好🌙 夜生活嗨起来！';
}

/** Country → province → city lookup with an `其他` fallback at each level. */
function regionalGreeting(info: IpInfo | null): string {
  const table = welcomeConfig.greetings;
  if (!info) return typeof table['其他'] === 'string' ? table['其他'] : '';

  const byCountry = table[info.country] ?? table['其他'];
  if (typeof byCountry === 'string') return byCountry;

  const byProvince = byCountry[info.province] ?? byCountry['其他'];
  if (typeof byProvince === 'string' || byProvince === undefined) {
    return typeof byProvince === 'string' ? byProvince : '';
  }

  return byProvince[info.city] ?? byProvince['其他'] ?? '';
}

/** `中国 广东 珠海` → `广东 珠海`; other countries keep their own name. */
function formatLocation(info: IpInfo): string {
  if (!info.country) return '神秘地区';
  if (info.country === '中国') return [info.province, info.city].filter(Boolean).join(' ') || '中国';
  return [info.country, info.city].filter(Boolean).join(' ');
}

/** `113.76.180.255` → `113.76.*.*`; IPv6 is collapsed entirely. */
function maskIp(ip: string): string {
  if (!ip) return '未知';
  if (ip.includes(':')) return 'IPv6 地址（已隐藏）';
  const parts = ip.split('.');
  if (parts.length !== 4) return ip;
  return `${parts[0]}.${parts[1]}.*.*`;
}

const CACHE_PREFIX = 'welcome-ip-v1:';

/**
 * In-memory cache + in-flight de-duplication.
 *
 * The sider renders twice (desktop column and mobile drawer), so two islands
 * mount and would each fire the same lookups — four requests on a cold load.
 * Sharing one promise across mounts reduces that to a single round trip.
 */
let cachedInfo: IpInfo | null = null;
let inFlight: Promise<IpInfo> | null = null;

function readCache(key: string): IpInfo | null {
  try {
    const raw = sessionStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; info: IpInfo };
    if (Date.now() - parsed.at > welcomeConfig.cacheHours * 3600_000) return null;
    return parsed.info;
  } catch {
    return null;
  }
}

function writeCache(key: string, info: IpInfo): void {
  try {
    sessionStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ at: Date.now(), info }));
  } catch {
    /* private mode or quota — caching is optional */
  }
}

/** Resolve the visitor's IP info, reusing memory/session caches and any in-flight request. */
function resolveIp(): Promise<IpInfo> {
  if (cachedInfo) return Promise.resolve(cachedInfo);

  const fromSession = readCache('self');
  if (fromSession) {
    cachedInfo = fromSession;
    return Promise.resolve(fromSession);
  }

  if (!inFlight) {
    inFlight = lookupIp()
      .then((info) => {
        cachedInfo = info;
        writeCache('self', info);
        return info;
      })
      .finally(() => {
        inFlight = null;
      });
  }
  return inFlight;
}

export default function WelcomeVisitor() {
  const [status, setStatus] = useState<Status>('loading');
  const [info, setInfo] = useState<IpInfo | null>(null);
  const [distance, setDistance] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    setStatus('loading');

    // --- geolocation is optional: never block the card on it ------------------
    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (!alive.current) return;
          const { longitude, latitude } = pos.coords;
          const { lng, lat } = welcomeConfig.blogLocation;
          if (Number.isFinite(longitude) && Number.isFinite(latitude)) {
            setDistance(distanceKm(longitude, latitude, lng, lat));
          }
        },
        () => {
          /* denied or unavailable — the distance line simply stays hidden */
        },
        { timeout: GEO_TIMEOUT_MS, maximumAge: 10 * 60 * 1000 },
      );
    }

    // --- IP geolocation -------------------------------------------------------
    try {
      const next = await resolveIp();
      if (alive.current) {
        setInfo(next);
        setStatus('ready');
      }
    } catch {
      if (alive.current) setStatus('unavailable');
    }
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  if (status === 'loading') {
    return (
      <div className="welcome-card" aria-busy="true">
        <div className="welcome-body">
          <span className="welcome-skeleton" />
          <span className="welcome-skeleton welcome-skeleton-short" />
          <span className="welcome-skeleton welcome-skeleton-short" />
        </div>
      </div>
    );
  }

  if (status === 'unavailable' || !info) {
    return (
      <div className="welcome-card">
        <div className="welcome-body">
          <p className="welcome-line">{timeGreeting()}</p>
          <p className="welcome-line welcome-tip">未能获取到你的位置信息，不过还是欢迎你的到来～</p>
        </div>
      </div>
    );
  }

  const location = formatLocation(info);
  const tip = regionalGreeting(info);

  return (
    <div className="welcome-card">
      <div className="welcome-body">
        <p className="welcome-line">
          欢迎来自 <b className="welcome-strong">{location}</b> 的朋友
        </p>

        {distance !== null && (
          <p className="welcome-line">
            你当前距博主约 <b className="welcome-strong">{distance}</b> 公里！
          </p>
        )}

        <p className="welcome-line">
          你的 IP 地址：
          <button
            type="button"
            className="welcome-ip"
            onClick={() => setRevealed((v) => !v)}
            aria-pressed={revealed}
            title={revealed ? '点击隐藏' : '点击显示完整地址'}
          >
            {revealed ? info.ip : maskIp(info.ip)}
          </button>
        </p>

        <p className="welcome-line">{timeGreeting()}</p>

        {tip && (
          <p className="welcome-line welcome-tip">
            Tip：
            <b className="welcome-strong">{tip}</b>
          </p>
        )}

        <button type="button" className="welcome-refresh" onClick={() => void run()} title="重新获取">
          ↻
        </button>
      </div>
    </div>
  );
}
