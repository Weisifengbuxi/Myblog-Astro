declare module 'chinese-lunar' {
  export interface LunarDate {
    leap: boolean;
    year: number;
    month: number;
    day: number;
    leapMonth: number;
  }

  /** 公历 → 农历。 */
  export function solarToLunar(date: Date): LunarDate;

  /**
   * 格式化农历日期。
   * `A` 生肖、`T` 干支（含「年」）、`M` 月、`d` 日、`D` 初一显示月否则显示日。
   */
  export function format(lunar: LunarDate, pattern: string): string;
}
