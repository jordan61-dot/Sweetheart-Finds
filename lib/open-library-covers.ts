import type {Product} from './domain';

// Verified against each individual Open Library edition record on 2026-11-21.
// The ISBNs identify the pictured edition. The catalog identity remains the work.
type Edition = {work:string; edition:string; isbn13:string; isbn10:string; cover:string; alternateFor?:string};
const editions: Edition[] = [
  {work:'OL17400503W', edition:'OL25981455M', isbn13:'9780545477703', isbn10:'0545477700', cover:'7503845'},
  {work:'OL17389720W', edition:'OL25969880M', isbn13:'9780545392167', isbn10:'0545392160', cover:'7482326'},
  {work:'OL8116230W', edition:'OL10506118M', isbn13:'9780545007955', isbn10:'054500795X', cover:'2480250'},
  {work:'OL8115800W', edition:'OL9569071M', isbn13:'9780545034333', isbn10:'0545034337', cover:'1278786'},
  {work:'OL15155018W', edition:'OL24222665M', isbn13:'9780439919043', isbn10:'0439919045', cover:'6572017'},
  {work:'OL4322863W', edition:'OL7999548M', isbn13:'9780810992252', isbn10:'0810992256', cover:'597776'},
  {work:'OL20217956W', edition:'OL27407831M', isbn13:'9781474833981', isbn10:'1474833985', cover:'8869738'},
  {work:'OL21282165W', edition:'OL28814161M', isbn13:'9781499803563', isbn10:'1499803567', cover:'13087962'},
  {work:'OL19086822W', edition:'OL26753445M', isbn13:'9780316282864', isbn10:'0316282863', cover:'8402740'},
  {work:'OL16262987W', edition:'OL25094221M', isbn13:'9780316099172', isbn10:'0316099171', cover:'9847735'},
  {work:'OL20217914W', edition:'OL27407776M', isbn13:'9781474871433', isbn10:'1474871437', cover:'8869689'},
  {work:'OL19945384W', edition:'OL27125795M', isbn13:'9786071106414', isbn10:'6071106419', cover:'12452369'},
  {work:'OL21116258W', edition:'OL28583526M', isbn13:'9780545940412', isbn10:'0545940419', cover:'10408106', alternateFor:'1484470451'},
];
const byWork = new Map(editions.map(entry => [entry.work, entry]));
export const picturedWorkIds = editions.map(entry => 'openlibrary-' + entry.work);
const coverBase = 'https://covers.openlibrary.org/b/';
const normalizeIsbn = (value:string) => value.replace(/[-\s]/g, '').toUpperCase();

/** Public read projection. Never change stored galleries, edition identity, rights or backups. */
export function withEditionCover(product:Product):Product {
  const entry = byWork.get(product.identifiers?.olid);
  if (!entry || product.id !== 'openlibrary-' + entry.work || product.type !== 'Books'
      || product.source !== 'Open Library' || product.sourceUrl !== 'https://openlibrary.org/works/' + entry.work) return product;
  const isbns = [entry.isbn10, entry.isbn13];
  const {isbn, edition} = product.identifiers;
  if ((isbn && !isbns.includes(normalizeIsbn(isbn))) || (edition && edition !== entry.edition)) return product;
  const coverUrl = coverBase + 'id/' + entry.cover + '-M.jpg?default=false';
  const originalUrls = [coverUrl, ...isbns.map(id => coverBase + 'isbn/' + id + '-M.jpg?default=false')];
  // A work can list several printings. For the one missing cover with a verified
  // alternate, require both ISBNs in the catalog and retain any owner-selected image.
  let alternateUrl: string | undefined;
  if (entry.alternateFor && !isbn && !edition && !product.collector?.edition && !product.variants?.length) {
    let catalogIsbns:unknown;
    try { catalogIsbns = JSON.parse(String(product.collector?.isbns)); } catch { /* No recorded ISBN list. */ }
    if (Array.isArray(catalogIsbns) && catalogIsbns.includes(entry.alternateFor) && catalogIsbns.includes(entry.isbn13)) {
      alternateUrl = coverBase + 'isbn/' + entry.alternateFor + '-M.jpg?default=false';
    }
  }
  const credit = 'Cover via Open Library; artwork belongs to its respective rights holder.';
  const images = product.images.map(image => {
    if (image.permission !== 'source-api' || image.source !== product.sourceUrl) return image;
    const alternate = !!alternateUrl && image.url === alternateUrl && image.attribution === credit + ' ISBN ' + entry.alternateFor;
    if (!alternate && !originalUrls.includes(image.url)) return image;
    const source = 'https://openlibrary.org/books/' + entry.edition;
    const standardCredit = [credit, ...isbns.map(id => credit + ' ISBN ' + id)];
    if (alternate) return {url:coverUrl, source, permission:image.permission, expiresAt:image.expiresAt,
      attribution:'Scholastic edition shown (ISBN ' + entry.isbn13 + '). ' + credit};
    const attribution = 'Pictured edition: ISBN ' + entry.isbn13 + '. ' + (standardCredit.includes(image.attribution) ? credit : image.attribution);
    return {...image, url:coverUrl, source, attribution, verifiedAt:image.url === coverUrl ? image.verifiedAt : undefined};
  });
  return images.some((image, index) => image !== product.images[index]) ? {...product, images} : product;
}
