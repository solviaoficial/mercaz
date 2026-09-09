import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from 'node:crypto';
export const dataDir = path.resolve(process.env.DATA_DIR || 'data');
mkdirSync(dataDir, { recursive: true });
mkdirSync(path.join(dataDir, 'uploads'), { recursive: true });
export const db = new DatabaseSync(path.join(dataDir, 'mercaz.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,name TEXT NOT NULL,email TEXT UNIQUE NOT NULL,password TEXT NOT NULL,address TEXT NOT NULL DEFAULT '{}',created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS stores(id INTEGER PRIMARY KEY,user_id INTEGER UNIQUE NOT NULL REFERENCES users(id),name TEXT NOT NULL,description TEXT NOT NULL,prep_days INTEGER NOT NULL DEFAULT 2,shipping INTEGER NOT NULL DEFAULT 1990,shipping_days INTEGER NOT NULL DEFAULT 5,paused INTEGER NOT NULL DEFAULT 0,days TEXT NOT NULL DEFAULT 'Segunda a sexta',document TEXT NOT NULL DEFAULT '',mp_token TEXT,mp_refresh TEXT,mp_expires INTEGER,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS products(id INTEGER PRIMARY KEY,store_id INTEGER NOT NULL REFERENCES stores(id),title TEXT NOT NULL,description TEXT NOT NULL,category TEXT NOT NULL,price INTEGER NOT NULL CHECK(price>0),stock INTEGER NOT NULL CHECK(stock>=0),images TEXT NOT NULL,variants TEXT NOT NULL DEFAULT '[]',status TEXT NOT NULL DEFAULT 'active',views INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),store_id INTEGER NOT NULL REFERENCES stores(id),status TEXT NOT NULL DEFAULT 'pending',subtotal INTEGER NOT NULL,shipping INTEGER NOT NULL,fee INTEGER NOT NULL,total INTEGER NOT NULL,address TEXT NOT NULL,prep_days INTEGER NOT NULL,shipping_days INTEGER NOT NULL,payment_id TEXT,payment_data TEXT NOT NULL DEFAULT '{}',tracking TEXT NOT NULL DEFAULT '',demo INTEGER NOT NULL,checkout_key TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS order_items(id INTEGER PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),product_id INTEGER NOT NULL REFERENCES products(id),title TEXT NOT NULL,image TEXT NOT NULL,variant TEXT NOT NULL,qty INTEGER NOT NULL,price INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),status TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS reviews(id INTEGER PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),product_id INTEGER NOT NULL REFERENCES products(id),user_id INTEGER NOT NULL REFERENCES users(id),rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),text TEXT NOT NULL,media TEXT NOT NULL DEFAULT '[]',context TEXT NOT NULL DEFAULT '',hidden INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(order_id,product_id));
CREATE TABLE IF NOT EXISTS reactions(review_id INTEGER NOT NULL REFERENCES reviews(id),user_id INTEGER NOT NULL REFERENCES users(id),PRIMARY KEY(review_id,user_id));
CREATE TABLE IF NOT EXISTS reports(id INTEGER PRIMARY KEY,review_id INTEGER NOT NULL REFERENCES reviews(id),user_id INTEGER NOT NULL REFERENCES users(id),reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS questions(id INTEGER PRIMARY KEY,product_id INTEGER NOT NULL REFERENCES products(id),user_id INTEGER NOT NULL REFERENCES users(id),question TEXT NOT NULL,answer TEXT NOT NULL DEFAULT '',created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS tickets(id INTEGER PRIMARY KEY,order_id TEXT NOT NULL REFERENCES orders(id),user_id INTEGER NOT NULL REFERENCES users(id),type TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS messages(id INTEGER PRIMARY KEY,ticket_id INTEGER NOT NULL REFERENCES tickets(id),user_id INTEGER NOT NULL REFERENCES users(id),text TEXT NOT NULL,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS favorites(user_id INTEGER NOT NULL REFERENCES users(id),kind TEXT NOT NULL,item_id INTEGER NOT NULL,PRIMARY KEY(user_id,kind,item_id));
CREATE TABLE IF NOT EXISTS notifications(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),text TEXT NOT NULL,href TEXT NOT NULL,seen INTEGER NOT NULL DEFAULT 0,created TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
CREATE TABLE IF NOT EXISTS uploads(path TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),type TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS oauth(state TEXT PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS payment_requests(order_id TEXT PRIMARY KEY REFERENCES orders(id),payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS idx_products_store ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id,created);
CREATE INDEX IF NOT EXISTS idx_orders_store ON orders(store_id,created);
CREATE INDEX IF NOT EXISTS idx_orders_payment ON orders(payment_id);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
PRAGMA optimize;`);
