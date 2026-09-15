import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync('agroculture.db')

db.exec(`
    CREATE TABLE IF NOT EXISTS Enterprises (
    EnterpriseID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL,
    Region TEXT NOT NULL,
    District TEXT NOT NULL,
    TotalArea REAL NOT NULL CHECK (TotalArea > 0),
    Year INTEGER CHECK (Year BETWEEN 2020 AND 2035),
    Rainfall REAL,
    Irrigation BOOLEAN DEFAULT 0 CHECK (Irrigation IN (0, 1)),
    FarmingSystem TEXT
    )
`)

db.exec(`
    CREATE TABLE IF NOT EXISTS Fields (
    FieldID INTEGER PRIMARY KEY AUTOINCREMENT,
    EnterpriseID INTEGER REFERENCES Enterprises(EnterpriseID),
    Name TEXT NOT NULL UNIQUE,
    Area REAL NOT NULL,
    SoilType TEXT NOT NULL,
    Latitude REAL NOT NULL,
    Longitude REAL NOT NULL
    )
`)

db.exec(`
    CREATE TABLE IF NOT EXISTS Crops(
    CropID INTEGER PRIMARY KEY AUTOINCREMENT,
    Name TEXT NOT NULL UNIQUE,
    Unit TEXT NOT NULL
    )
`)

db.exec("INSERT OR IGNORE INTO Crops (Name, Unit) VALUES ('Озима Пшениця', 'кг'), ('Кукурудза', 'кг'), ('Соняшник', 'кг'), ('Соя', 'л')")

export function getAllCrops() {
    return db.prepare('SELECT CropID, Name FROM Crops').all()
}

console.log('CROPS IN DATABASE:', getAllCrops())
console.log('TABLES:', db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all())