/** require() of a bundled image returns its asset id. */
type AssetId = number;

/** Official brand photography (docs/marca). */
export const photos = {
  heroCrossedArms: require('../../assets/brand/foto-profissional-bone-bracos-cruzados.webp'),
  construction: require('../../assets/brand/foto-profissional-capacete-obras.webp'),
  electrician: require('../../assets/brand/foto-profissional-eletricista-quadro.webp'),
  plumber: require('../../assets/brand/foto-profissional-encanador.webp'),
  drill: require('../../assets/brand/foto-profissional-instalacao-furadeira.webp'),
  cleaning: require('../../assets/brand/foto-profissional-limpeza.webp'),
} satisfies Record<string, AssetId>;

const BY_CATEGORY: Array<[RegExp, AssetId]> = [
  [/el[eé]tr/i, photos.electrician],
  [/hidr|encan|bomb/i, photos.plumber],
  [/limp|faxin|diar/i, photos.cleaning],
  [/obra|pedreir|constru|reform/i, photos.construction],
  [/repar|instal|montag|manut|ar.?cond/i, photos.drill],
];

/** Cover photo for a service category; falls back to the brand hero photo. */
export function categoryPhoto(cat: { name?: string | null; slug?: string | null }): AssetId {
  const key = `${cat.slug ?? ''} ${cat.name ?? ''}`;
  for (const [re, img] of BY_CATEGORY) if (re.test(key)) return img;
  return photos.heroCrossedArms;
}
