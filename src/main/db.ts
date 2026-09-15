import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync('agroculture.db')

db.exec(`
    CREATE TABLE IF NOT EXISTS crops (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
    )
`)

db.exec("INSERT OR IGNORE INTO crops (name) VALUES ('Wheat'), ('Maize'), ('Sunflower')")

export function getAllCrops() {
    return db.prepare('SELECT id, name FROM crops').all()
}

console.log('CROPS IN DATABASE:', getAllCrops())