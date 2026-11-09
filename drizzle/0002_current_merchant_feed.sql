CREATE TABLE merchant_feed_items (id TEXT PRIMARY KEY NOT NULL, title TEXT NOT NULL, categories TEXT NOT NULL, data TEXT NOT NULL, generation TEXT NOT NULL, first_seen TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX merchant_feed_generation ON merchant_feed_items(generation);
CREATE VIRTUAL TABLE merchant_feed_search USING fts5(item_id UNINDEXED,title,tokenize='unicode61');
CREATE TRIGGER merchant_feed_ai AFTER INSERT ON merchant_feed_items BEGIN INSERT INTO merchant_feed_search(item_id,title) VALUES(new.id,new.title); END;
CREATE TRIGGER merchant_feed_ad AFTER DELETE ON merchant_feed_items BEGIN DELETE FROM merchant_feed_search WHERE item_id=old.id; END;
CREATE TRIGGER merchant_feed_au AFTER UPDATE OF title ON merchant_feed_items BEGIN DELETE FROM merchant_feed_search WHERE item_id=old.id; INSERT INTO merchant_feed_search(item_id,title) VALUES(new.id,new.title); END;
