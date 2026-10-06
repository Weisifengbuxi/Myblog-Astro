import { useCallback, useEffect, useRef, useState } from 'react';
import { welcomeConfig } from '@/constants/site-config';
import '@/styles/components/welcome.css';

/**
 * Visitor welcome card — ported from the previous Hexo blog's `card-welcome.js`,
 * which showed:
 *
 *   欢迎来自 <地点> 的朋友
 *   您当前距博主约 <N> 公里！
 *   您的IP地址：<IP>
 *   <时段问候>
 *   Tip：<地域问候>
 *
 * Design notes
 * ------------
 * **Location accuracy.** IP geolocation resolves to the ISP's egress node, so a
 * visitor in 珠海 can be reported as 广州 (measured: exactly that). The browser's
 * own geolocation API is the only accurate source, so it is tried first and the
 * coordinates it returns are reverse-geocoded into a city name. IP geolocation
 * is the fallback when permission is denied or unavailable. Whichever source
 * wins supplies *both* the place name and the distance, so the two can never
 * contradict each other.
 *
 * **No API key.** The original shipped a hardcoded key belonging to another blog
 * (`IP_CONFIG.API_KEY`, for v1.nsuuu.com). Everything here uses keyless public
 * endpoints with fallback chains.
 *
 * **Flicker.** Only one state transition happens in the whole lifecycle: the
 * place-dependent lines are replaced once, when the lookup settles. The
 * time-of-day greeting renders immediately because it needs no network, and the
 * skeleton stays up until the lookup actually finishes so the card never shrinks
 * from content back to a placeholder.
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

/** Names used for both the greeting lookup and the displayed place. */
interface Place {
  country: string;
  province: string;
  city: string;
}

type Status = 'loading' | 'ready' | 'unavailable';

const REQUEST_TIMEOUT_MS = 6000;
const GEO_TIMEOUT_MS = 8000;
const GEO_MAX_AGE_MS = 10 * 60 * 1000;

const CN_NAMES_BY_CODE: Record<string, string> = {
  CN: '中国',
  HK: '香港特别行政区',
  MO: '澳门特别行政区',
  TW: '台湾',
};

/**
 * Canonicalize a country name to the key used by `welcome.greetings`.
 *
 * The services disagree in two ways: ipwho.is returns English (`China`), while
 * BigDataCloud's `localityLanguage=zh` returns the *formal* name
 * (`中华人民共和国`, "People's Republic of China"). Neither matches the table's
 * plain `中国`, so both flavours are folded in here.
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

/** `珠海市` → `珠海`, `广东省` → `广东`, `四川省` → `四川` … */
function stripAdminSuffix(name: string): string {
  return name.replace(/(特别行政区|维吾尔自治区|壮族自治区|回族自治区|自治区|省|市|县|区)$/u, '');
}

/**
 * Chinese city name → the key used in the greetings table.
 *
 * BigDataCloud returns official names (`珠海市`) while the table — copied from
 * the previous blog — uses the bare form (`珠海`). Both are accepted, and the
 * table is also probed with the suffix stripped, so an unmapped city still
 * resolves through its province instead of falling straight to `其他`.
 */
function cityKeyFor(city: string, province: string): string {
  if (!city) return '';
  const bare = stripAdminSuffix(city);
  const provinceEntry = welcomeConfig.greetings['中国'];
  const table = typeof provinceEntry === 'object' && provinceEntry !== null ? provinceEntry[province] : undefined;
  if (table && typeof table === 'object') {
    if (table[city] !== undefined) return city;
    if (bare && table[bare] !== undefined) return bare;
  }
  return bare || city;
}

/**
 * English country name → the Chinese key used by `welcome.greetings`.
 *
 * ipwho.is returns `country: "China"` / `"United States"`; the greeting table
 * (ported verbatim from the previous blog) is keyed in Chinese, so without this
 * map every visitor would fall through to the generic `其他` line. ipapi.co
 * already returns Chinese names and short-circuits this.
 */
const COUNTRY_CN: Record<string, string> = {
  China: '中国',
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
  'Guangxi Zhuangzu Zizhiqu': '广西壮族自治区',
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
  'Inner Mongolia Zizhiqu': '内蒙古自治区',
  'Ningxia Huizu Zizhiqu': '宁夏回族自治区',
  'Qinghai Sheng': '青海',
  Qinghai: '青海',
  'Xinjiang Uygur Zizhiqu': '新疆维吾尔自治区',
  'Xizang Zizhiqu': '西藏自治区',
  Tibet: '西藏自治区',
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

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

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

/** Country name from any provider → the canonical table key. */
function canonicalCountry(raw: string, code = ''): string {
  const upper = code.toUpperCase();
  if (CN_NAMES_BY_CODE[upper]) return CN_NAMES_BY_CODE[upper];
  return COUNTRY_ALIASES[raw] ?? COUNTRY_CN[raw] ?? (stripAdminSuffix(raw) || raw);
}

/**
 * Parse a coordinate pair.
 *
 * Providers disagree on shape: ipapi.co/ipwho.is use numeric `longitude`/`lat`,
 * while ipinfo.io packs both into `loc: "23.0180,113.7487"` (lat,lng).
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
  // ipinfo.io puts the ISO code in `country`; others use `country_code` or a name.
  const rawCountryField = str(raw.country);
  const code = (str(raw.country_code) || (/^[A-Za-z]{2}$/.test(rawCountryField) ? rawCountryField : '')).toUpperCase();
  const rawRegion = str(raw.region) || str(raw.region_name);
  const rawCity = str(raw.city);
  const rawCountry = str(raw.country_name) || (/^[A-Za-z]{2}$/.test(rawCountryField) ? '' : rawCountryField);
  const country = canonicalCountry(rawCountry, code);
  // Only translate Chinese place names when we are actually in China — "Dublin"
  // must not be rewritten just because some other country has a similar name.
  const isCn = country === '中国';

  return {
    ip: str(raw.ip) || fallbackIp,
    country,
    province: (isCn ? CN_REGIONS[rawRegion] : undefined) ?? (isCn ? stripAdminSuffix(rawRegion) : rawRegion),
    city: (isCn ? CN_CITIES[rawCity] : undefined) ?? (isCn ? stripAdminSuffix(rawCity) : rawCity),
    ...parseCoords(raw),
  };
}

/** Keyless IP-geolocation providers, tried in order. */
async function lookupIp(): Promise<IpInfo> {
  const providers = [
    () => fetchJson('https://ipapi.co/json/'),
    () => fetchJson('https://ipwho.is/'),
    () => fetchJson('https://ipinfo.io/json'),
  ];

  for (const provider of providers) {
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

/**
 * Reverse-geocode browser coordinates into a city name.
 *
 * BigDataCloud's client endpoint is keyless and CORS-enabled, which is why it is
 * first. ipwho.is also accepts coordinates and is the fallback. Returns `null`
 * when both fail — the caller then keeps the IP-derived name.
 */
async function reverseGeocode(lat: number, lng: number): Promise<Place | null> {
  try {
    const d = await fetchJson(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=zh`,
    );
    const country = canonicalCountry(str(d.countryName));
    if (country) {
      const isCn = country === '中国';
      const province = str(d.principalSubdivision);
      const city = str(d.city) || str(d.locality);
      return {
        country,
        province: isCn ? stripAdminSuffix(province) : province,
        city: isCn ? stripAdminSuffix(city) : city,
      };
    }
  } catch {
    /* try the next service */
  }

  try {
    const d = await fetchJson(`https://ipwho.is/${lat},${lng}`);
    if (d.success !== false) {
      const country = canonicalCountry(str(d.country), str(d.country_code));
      const isCn = country === '中国';
      const region = str(d.region);
      const city = str(d.city);
      return {
        country,
        province: (isCn ? CN_REGIONS[region] : undefined) ?? (isCn ? stripAdminSuffix(region) : region),
        city: (isCn ? CN_CITIES[city] : undefined) ?? (isCn ? stripAdminSuffix(city) : city),
      };
    }
  } catch {
    /* fall through */
  }

  return null;
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
 * Country → province → city lookup with an `其他` fallback at each level.
 *
 * `cityOnly` matters when the place came from the browser's coordinates but
 * reverse-geocoding failed: without it, `city` would hold a Romanized IP city
 * name that cannot match the Chinese table, so we skip straight to the
 * province-level entry instead of missing it.
 */
function regionalGreeting(place: Place | null, cityOnly = false): string {
  const table = welcomeConfig.greetings;
  if (!place) return str(table['其他']);

  const byCountry = table[place.country] ?? table['其他'];
  if (typeof byCountry === 'string') return byCountry;

  const byProvince = byCountry[place.province] ?? byCountry['其他'];
  if (typeof byProvince === 'string') return byProvince;
  if (!byProvince) return '';

  const cityKey = cityOnly ? '' : cityKeyFor(place.city, place.province);
  return byProvince[cityKey] ?? byProvince['其他'] ?? '';
}

/**
 * `中国 广东 珠海` → `广东 珠海`; other countries keep their own name.
 *
 * Inside China only already-Chinese names are trusted (`CN_REGIONS` /
 * `CN_CITIES` cover every province and the main cities). If a small city is not
 * mapped we show less rather than mixing `Shantou` into a Chinese place name.
 * `cityOnly` skips the province because a coordinate-derived city has no
 * province attached.
 */
function formatLocation(place: Place, cityOnly = false): string {
  if (!place.country) return '神秘地区';
  const cn = (v: string) => (v && !/[A-Za-z]/.test(v) ? v : '');

  if (place.country === '中国') {
    const parts = cityOnly ? [cn(place.city)] : [cn(place.province), cn(place.city)];
    return parts.filter(Boolean).join(' ') || '中国';
  }
  return [place.country, place.city].filter(Boolean).join(' · ');
}

/** Session cache + in-flight de-duplication (the sider mounts two islands). */
const CACHE_PREFIX = 'welcome-ip-v2:';

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

/**
 * Ask the browser for a precise fix. Resolves `null` when permission is denied,
 * the device has no fix, or it takes longer than `GEO_TIMEOUT_MS` — callers then
 * fall back to IP geolocation, so a refusal never blocks the card.
 */
function requestGeolocation(): Promise<{ lat: number; lng: number } | null> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return Promise.resolve(null);

  return new Promise((resolve) => {
    let settled = false;
    const done = (v: { lat: number; lng: number } | null) => {
      if (settled) return;
      settled = true;
      resolve(v);
    };

    // The API's own `timeout` only starts once a fix is being attempted, so add
    // an independent deadline for the common "permission prompt ignored" case.
    const timer = setTimeout(() => done(null), GEO_TIMEOUT_MS + 500);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        clearTimeout(timer);
        const { latitude, longitude } = pos.coords;
        done(Number.isFinite(latitude) && Number.isFinite(longitude) ? { lat: latitude, lng: longitude } : null);
      },
      () => {
        clearTimeout(timer);
        done(null);
      },
      { timeout: GEO_TIMEOUT_MS, maximumAge: GEO_MAX_AGE_MS, enableHighAccuracy: false },
    );
  });
}

export default function WelcomeVisitor() {
  const [status, setStatus] = useState<Status>('loading');
  const [ip, setIp] = useState<string | null>(null);
  const [place, setPlace] = useState<Place | null>(null);
  const [cityOnly, setCityOnly] = useState(false);
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
    const { lng: blogLng, lat: blogLat } = welcomeConfig.blogLocation;

    // Kick both sources off together: geolocation may sit behind a permission
    // prompt, and the IP request is needed either way as the fallback.
    const geoPromise = requestGeolocation();
    const ipPromise = resolveIp().catch(() => null);

    const [coords, ipInfo] = await Promise.all([geoPromise, ipPromise]);
    if (!alive.current) return;

    if (ipInfo?.ip) setIp(ipInfo.ip);

    if (coords) {
      // Precise: use the browser's fix for both the name and the distance.
      setDistance(distanceKm(coords.lng, coords.lat, blogLng, blogLat));

      const geoPlace = await reverseGeocode(coords.lat, coords.lng);
      if (!alive.current) return;

      if (geoPlace?.city || geoPlace?.province) {
        setPlace(geoPlace);
        setCityOnly(!geoPlace.province);
      } else if (ipInfo) {
        // Reverse-geocoding failed; keep the accurate distance but reuse the
        // IP's city name, skipping its city level in the greeting lookup so the
        // Romanized value cannot miss the Chinese table.
        setPlace({ country: ipInfo.country, province: ipInfo.province, city: ipInfo.city });
        setCityOnly(true);
      }
      setStatus('ready');
      return;
    }

    // No permission or no fix: fall back to IP geolocation entirely.
    if (ipInfo) {
      setPlace({ country: ipInfo.country, province: ipInfo.province, city: ipInfo.city });
      setCityOnly(false);
      setDistance(ipInfo.lng !== null && ipInfo.lat !== null ? distanceKm(ipInfo.lng, ipInfo.lat, blogLng, blogLat) : null);
      setStatus('ready');
      return;
    }

    setStatus('unavailable');
  }, []);

  useEffect(() => {
    void run();
  }, [run]);

  const greeting = timeGreeting();

  return (
    <div className="welcome-card">
      <div className="welcome-body">
        {status === 'ready' && place && (
          <p className="welcome-line">
            欢迎来自 <b className="welcome-strong">{formatLocation(place, cityOnly)}</b> 的朋友
          </p>
        )}

        {status === 'ready' && distance !== null && (
          <p className="welcome-line">
            您距离博主位置约 <b className="welcome-strong">{distance}</b> 公里！
          </p>
        )}

        {status === 'ready' && ip && (
          <p className="welcome-line">
            您的 IP 地址：
            {/* 常态模糊，鼠标悬停才清晰（与原博客 .ip-address 一致）。
                注意：这是纯视觉遮挡，完整 IP 仍在 DOM 中。 */}
            <b className="welcome-ip" title="鼠标悬停查看">
              {ip}
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

        {status === 'ready' && place && (
          <p className="welcome-line welcome-tip">
            Tip：<b className="welcome-strong">{regionalGreeting(place, cityOnly)}</b>
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
