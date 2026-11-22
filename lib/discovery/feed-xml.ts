import {SaxesParser, type SaxesTagNS} from 'saxes';

const ATOM = 'http://www.w3.org/2005/Atom';
const GOOGLE = 'http://base.google.com/ns/1.0';
type Format = 'xml' | 'rss' | 'atom';
type Row = Record<string, string>;

function attribute(tag: SaxesTagNS, name: string) {
  return tag.attributes[name]?.value;
}

// Extract only direct scalar fields from a record at its format's exact path.
export function xmlFeedRows(text: string, format: Format, mappedFields: string[]): Row[] {
  const parser = new SaxesParser({xmlns: true});
  const path: SaxesTagNS[] = [];
  const names = format === 'xml' ? ['products', 'product']
    : format === 'rss' ? ['rss', 'channel', 'item'] : ['feed', 'entry'];
  const namespace = format === 'atom' ? ATOM : '';
  const rows: Row[] = [];
  let row: Row | undefined;
  let field: {key: string, value: string, nested: boolean} | undefined;
  const scalarFields = new Set(['sourceId','variantId','title','url','sourceUrl','categories','brand',
    'type','generation','year','price','currency','seller','condition','availability','shippingEligibility']);

  const wanted = new Set([...scalarFields, ...mappedFields, 'category', 'guid', 'id', 'link',
    'g:id', 'g:price', 'g:availability', 'g:brand']);

  function record(key: string, value: string) {
    if (!row || !value) return;
    if (key === 'category' && format !== 'xml') key = 'categories';
    if (key === 'categories' && row[key]) row[key] += '|' + value;
    else if (Object.hasOwn(row, key) && row[key] !== value) throw Error('Ambiguous XML feed field: ' + key);
    else row[key] = value;
  }

  parser.on('doctype', () => { throw Error('Feed document types are unsupported'); });
  parser.on('opentag', tag => {
    path.push(tag);
    if (path.length > 32) throw Error('Feed nesting exceeds 32 elements');
    if (path.length === 1 && (tag.local !== names[0] || tag.uri !== namespace))
      throw Error('Unexpected root for ' + format + ' feed');
    if (path.length === names.length && path.every((p,i) => p.local === names[i] && p.uri === namespace)) {
      if (rows.length >= 250) throw Error('Feed exceeds 250 records');
      row = Object.create(null);
      return;
    }
    if (!row) return;
    if (field && path.length > names.length + 1) field.nested = true;
    if (path.length !== names.length + 1) return;
    if (tag.uri !== '' && tag.uri !== namespace && tag.uri !== GOOGLE) return;
    if (format === 'atom' && tag.uri === ATOM) {
      if (tag.local === 'link') {
        const rel = attribute(tag, 'rel'), type = attribute(tag, 'type');
        if ((!rel || rel === 'alternate') && (!type || type === 'text/html'))
          record('url', attribute(tag, 'href') || '');
        return;
      }
      if (tag.local === 'category') { record('categories', attribute(tag,'term') || ''); return; }
    }
    const key = tag.uri === GOOGLE ? 'g:' + tag.local : tag.local;
    if (wanted.has(key)) field = {key, value: '', nested: false};
  });
  function append(value: string) {
    if (field && !field.nested) field.value += value;
  }
  parser.on('text', append);
  parser.on('cdata', append);
  parser.on('closetag', () => {
    if (row && path.length === names.length + 1 && field) {
      if (!field.nested) record(field.key, field.value.trim());
      else throw Error('Expected plain text for ' + field.key);
      field = undefined;
    }
    if (row && path.length === names.length) {
      row.sourceId ||= row['g:id'] || (format === 'rss' ? row.guid : format === 'atom' ? row.id : '');
      if (format === 'rss') row.url ||= row.link;
      if (row['g:price']) {
        const amount = /^(\d+(?:\.\d+)?) ([A-Z]{3})$/.exec(row['g:price']);
        if (!amount) throw Error('Invalid merchant price and currency');
        if ((row.currency && row.currency !== amount[2]) || (row.price && Number(row.price) !== Number(amount[1])))
          throw Error('Conflicting merchant price or currency');
        row.price ||= amount[1];
        row.currency ||= amount[2];
      }
      if (!row.availability && row['g:availability']) {
        const status = row['g:availability'].toLowerCase().replaceAll(' ', '_');
        row.availability = status === 'in_stock' ? 'available' : status === 'out_of_stock' ? 'unavailable' : 'unknown';
      }
      if (!row.brand && row['g:brand']) row.brand = row['g:brand'];
      rows.push(row);
      row = undefined;
    }
    path.pop();
  });
  parser.write(text).close();
  return rows;
}
