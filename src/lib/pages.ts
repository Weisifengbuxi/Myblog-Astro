/**
 * Typed accessors for the custom-page catalog in `config/pages.yaml`.
 *
 * Kept separate from `@lib/config/*` (which is the theme's own configuration
 * layer) because these are this blog's own content, migrated from the previous
 * Hexo `source/_data/*.yml` files.
 */

import pagesYaml from '../../config/pages.yaml';

export interface AlbumItem {
  date: string;
  content: string;
  address?: string;
  from?: string;
  link?: string;
  images: string[];
}

export interface Album {
  id: string;
  name: string;
  description: string;
  cover: string;
  category?: boolean;
  items: AlbumItem[];
}

export interface EquipmentItem {
  name: string;
  specification?: string;
  description?: string;
  image?: string;
  link?: string;
}

export interface EquipmentGroup {
  title: string;
  description?: string;
  items: EquipmentItem[];
}

export interface EssayItem {
  date: string;
  content: string;
  link?: string;
  images?: string[];
}

const pages = pagesYaml as {
  albums?: Album[];
  equipment?: { intro?: string; groups?: EquipmentGroup[] };
  essay?: { subTitle?: string; tips?: string; items?: EssayItem[] };
};

/** All albums, in config order. */
export const albums: Album[] = pages.albums ?? [];

/** Albums flagged `category: true` — the ones listed on the /album index. */
export const albumCategories: Album[] = albums.filter((album) => album.category);

/** Look up a single album by its id (also its URL slug). */
export function getAlbum(id: string): Album | undefined {
  return albums.find((album) => album.id === id);
}

/** An album's items, newest first. */
export function getAlbumItems(id: string): AlbumItem[] {
  const album = getAlbum(id);
  if (!album) return [];
  return [...album.items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

export const equipmentIntro: string = pages.equipment?.intro ?? '';
export const equipmentGroups: EquipmentGroup[] = pages.equipment?.groups ?? [];

export const essaySubTitle: string = pages.essay?.subTitle ?? '';
export const essayTips: string = pages.essay?.tips ?? '';

/** Essay entries, newest first. */
export const essayItems: EssayItem[] = [...(pages.essay?.items ?? [])].sort((a, b) =>
  a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
);

/** Total number of photos across every album. */
export const totalPhotos: number = albums.reduce(
  (sum, album) => sum + album.items.reduce((n, item) => n + item.images.length, 0),
  0,
);
