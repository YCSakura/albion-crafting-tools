export function getItemIconUrl(itemId: string, quality = 1): string {
  return `https://render.albiononline.com/v1/item/${encodeURIComponent(itemId)}.png?quality=${quality}&size=217`;
}
