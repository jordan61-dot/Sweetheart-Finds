"""SQLite/D1-compatible migration, transaction and query regressions in isolation."""
import sqlite3, unittest, json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class DatabaseTests(unittest.TestCase):
 def setUp(self):
  self.db=sqlite3.connect(':memory:');self.db.execute('PRAGMA foreign_keys=ON')
  self.db.executescript((ROOT/'drizzle/0000_easy_red_shift.sql').read_text())
 def product(self,id='p1',title='My Melody Plush',search='my melody plush sanrio'):
  self.db.execute('INSERT INTO products VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)',(id,title,id,'Sanrio','Plush','','Japan',None,'catalog','reviewed',search,json.dumps({'title':title,'images':[]}), '2026-11-07','2026-11-07',0))
 def test_migration_and_fts_trigger(self):
  self.product();self.assertEqual(self.db.execute('SELECT product_id FROM product_search WHERE product_search MATCH ?',('"mel"*',)).fetchone()[0],'p1')
  self.db.execute('UPDATE products SET search=? WHERE id=?',('usahana stationery','p1'));self.assertEqual(self.db.execute('SELECT COUNT(*) FROM product_search WHERE product_search MATCH ?',('"usahana"*',)).fetchone()[0],1)
  self.db.execute('DELETE FROM products');self.assertEqual(self.db.execute('SELECT COUNT(*) FROM product_search').fetchone()[0],0)
 def test_foreign_keys_unique_ids_and_rollback(self):
  self.product();self.db.commit()
  with self.assertRaises(sqlite3.IntegrityError):
   with self.db:
    self.db.execute('INSERT INTO product_categories VALUES (?,?)',('p1','sanrio'))
    self.db.execute('INSERT INTO product_categories VALUES (?,?)',('missing','my-melody'))
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM product_categories').fetchone()[0],0)
 def test_compare_and_swap_prevents_lost_update(self):
  self.db.execute('INSERT INTO personal VALUES (?,?,?,?)',('user',0,'{}','now'))
  a=self.db.execute('UPDATE personal SET revision=revision+1,data=? WHERE user_id=? AND revision=?',('{"favorites":["p1"]}','user',0)).rowcount
  b=self.db.execute('UPDATE personal SET revision=revision+1,data=? WHERE user_id=? AND revision=?',('{"favorites":["p2"]}','user',0)).rowcount
  self.assertEqual((a,b),(1,0));self.assertIn('p1',self.db.execute('SELECT data FROM personal').fetchone()[0])
 def test_cross_currency_filter_and_null_price(self):
  self.product()
  for id,price,currency in [('usd',10000000,'USD'),('jpy',500000000,'JPY'),('null',None,'USD')]:self.db.execute('INSERT INTO listings VALUES (?,?,?,?,?,?,?,?,?,?,?)',(id,'p1','Fixture','https://example.com/'+id,price,currency,'Unknown','unknown','unverified',None,'{}'))
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM listings WHERE currency=? AND price_micros<=?',('USD',25000000)).fetchone()[0],1)
 def test_sql_injection_values_remain_data(self):
  self.product();self.assertEqual(self.db.execute('SELECT COUNT(*) FROM products WHERE title LIKE ?',("%'; DROP TABLE products; --%",)).fetchone()[0],0)
  self.assertEqual(self.db.execute('SELECT COUNT(*) FROM products').fetchone()[0],1)
if __name__=='__main__':unittest.main()
