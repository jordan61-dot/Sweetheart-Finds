import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {withEditionCover} from '../lib/open-library-covers.ts';
import {displayImages} from '../lib/domain.ts';

const catalog = JSON.parse(fs.readFileSync(new URL('../data/catalog.json', import.meta.url)));
const lalaloopsy = catalog.find(p => p.id === 'openlibrary-OL17400503W');
const shopkins = catalog.find(p => p.id === 'openlibrary-OL21116258W');
const pictured = 'https://openlibrary.org/books/OL25981455M';

test('a seeded work links to the pictured edition while its catalog and saved identities stay intact', () => {
  const before = structuredClone(lalaloopsy);
  for (const isbn of ['0545477700', '9780545477703', '978-0-545-47770-3']) {
    const book = {...lalaloopsy, identifiers:{...lalaloopsy.identifiers, isbn}};
    const result = withEditionCover(book);
    assert.equal(result.id, book.id);
    assert.equal(result.sourceUrl, book.sourceUrl);
    assert.equal(result.images[0].source, pictured);
    assert.match(result.images[0].attribution, /9780545477703/);
    assert.equal(result.images[0].url, 'https://covers.openlibrary.org/b/id/7503845-M.jpg?default=false');
    assert.deepEqual(withEditionCover(result), result);
  }
  assert.deepEqual(lalaloopsy, before);
});

test('different works, editions, source URLs, image rights and removed galleries keep their original contents', () => {
  const image = lalaloopsy.images[0];
  for (const change of [
    {id:'alternate'}, {source:'Another source'}, {sourceUrl:'https://example.org/'}, {images:[]},
    {identifiers:{...lalaloopsy.identifiers, isbn:'9780545392167'}},
    {identifiers:{...lalaloopsy.identifiers, edition:'OL25969880M'}},
    {images:[{...image, url:'https://covers.openlibrary.org/b/id/7482326-M.jpg?default=false'}]},
    {images:[{...image, permission:'owner-permitted'}]},
    {images:[{...image, source:'https://example.org/rights'}]},
  ]) {
    const book = {...lalaloopsy, ...change};
    assert.deepEqual(withEditionCover(book), book);
  }
});

test('custom credits and expiry survive; an old URL check cannot verify the new URL', () => {
  const original = {...lalaloopsy.images[0], attribution:'Credit retained by owner',
    verifiedAt:'2025-01-01T00:00:00Z', expiresAt:'2025-02-01T00:00:00Z'};
  const book = withEditionCover({...lalaloopsy, images:[original]});
  assert.match(book.images[0].attribution, /Credit retained by owner/);
  assert.equal(book.images[0].verifiedAt, undefined);
  assert.equal(book.images[0].expiresAt, original.expiresAt);
  assert.deepEqual(displayImages(book, Date.parse('2026-11-21')), []);
});

test('the Shopkins work can show a separately identified Scholastic edition, without assigning that cover to the other ISBN', () => {
  const picture = withEditionCover(shopkins).images[0];
  assert.equal(picture.source, 'https://openlibrary.org/books/OL28583526M');
  assert.match(picture.url, /10408106-M/);
  assert.match(picture.attribution, /Scholastic edition shown \(ISBN 9780545940412\)/);
  assert.doesNotMatch(picture.attribution, /1484470451/);
  for (const patch of [
    {identifiers:{...shopkins.identifiers, isbn:'9781484470459'}}, {collector:{isbns:'["1484470451"]'}},
    {collector:{isbns:'invalid'}}, {variants:['library binding']}, {images:[]},
    {images:[{...shopkins.images[0], attribution:'Owner-selected library binding cover'}]},
  ]) {
    const book = {...shopkins, ...patch};
    assert.deepEqual(withEditionCover(book), book);
  }
});
