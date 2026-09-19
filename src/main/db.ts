import sql from 'mssql'
import dotenv from 'dotenv'
import { app } from 'electron'
import { join } from 'path'

function envPath(): string {
    return app.isPackaged
        ? join(process.resourcesPath, 'env', '.env')
        : join(app.getAppPath(), '.env')
}
dotenv.config({ path: envPath() })

const config: sql.config = {
    user: process.env.DB_USER ?? 'sa',
    password: process.env.DB_PASSWORD ?? '',
    server: process.env.DB_SERVER ?? 'localhost',
    database: process.env.DB_DATABASE ?? 'AgroCultureDB',
    port: Number(process.env.DB_PORT ?? 1433),
    options: {
        encrypt: process.env.DB_ENCRYPT === 'true',
        trustServerCertificate: true
    }
}

const poolPromise = new sql.ConnectionPool(config).connect()
async function ensureSchema() {
    const pool = await poolPromise

    await pool.request().query(`
        IF OBJECT_ID(N'dbo.Enterprises', N'U') IS NULL
        BEGIN
            CREATE TABLE Enterprises (
                EnterpriseID INT IDENTITY(1,1) PRIMARY KEY,
                Name NVARCHAR(150) NOT NULL,
                Region NVARCHAR(50) NOT NULL,
                District NVARCHAR(50) NOT NULL,
                TotalArea DECIMAL(8, 2) NOT NULL CHECK (TotalArea > 0),
                Year INT CHECK (Year BETWEEN 2020 AND 2035),
                Rainfall DECIMAL(6, 1),
                Irrigation BIT DEFAULT 0,
                FarmingSystem NVARCHAR(50)
            )
        END
    `)

    await pool.request().query(`
        IF OBJECT_ID(N'dbo.Fields', N'U') IS NULL
        BEGIN
            CREATE TABLE Fields (
                FieldID INT IDENTITY(1,1) PRIMARY KEY,
                EnterpriseID INT NOT NULL REFERENCES Enterprises(EnterpriseID),
                Name NVARCHAR(50) NOT NULL,
                Area DECIMAL(8, 2) NOT NULL CHECK (Area > 0),
                SoilType NVARCHAR(50) NOT NULL,
                Latitude DECIMAL(9, 6) NOT NULL,
                Longitude DECIMAL(9, 6) NOT NULL,
                CONSTRAINT UQ_Fields_Enterprise_Name UNIQUE (EnterpriseID, Name)
            )
        END
    `)

    await pool.request().query(`
        IF OBJECT_ID(N'dbo.Crops', N'U') IS NULL
        BEGIN
            CREATE TABLE Crops (
                CropID INT IDENTITY(1,1) PRIMARY KEY,
                Name NVARCHAR(100) NOT NULL UNIQUE,
                Unit NVARCHAR(20) NOT NULL
            )
        END
    `)

    await pool.request().query(`
        IF OBJECT_ID(N'dbo.Seasons', N'U') IS NULL
        BEGIN
            CREATE TABLE Seasons (
                SeasonID INT IDENTITY(1,1) PRIMARY KEY,
                Name NVARCHAR(20) NOT NULL,
                StartDate DATE NOT NULL,
                EndDate DATE NOT NULL,
                CHECK (EndDate > StartDate)
            )
        END
    `)

    await pool.request().query(`
        IF OBJECT_ID(N'dbo.Harvests', N'U') IS NULL
        BEGIN
            CREATE TABLE Harvests (
                HarvestID INT IDENTITY(1,1) PRIMARY KEY,
                FieldID INT NOT NULL REFERENCES Fields(FieldID),
                CropID INT NOT NULL REFERENCES Crops(CropID),
                SeasonID INT NOT NULL REFERENCES Seasons(SeasonID),
                YieldPerHa DECIMAL(5, 2) NOT NULL CHECK (YieldPerHa >= 0),
                MainProduct DECIMAL(10, 2),
                ByProduct DECIMAL(10, 2),
                Price DECIMAL(10, 2),
                Moisture DECIMAL(4, 2) CHECK (Moisture BETWEEN 5 AND 35)
            )
        END
    `)

    await pool.request().query(`
        IF OBJECT_ID(N'dbo.Employees', N'U') IS NULL
        BEGIN
            CREATE TABLE Employees (
                EmployeeID INT IDENTITY(1,1) PRIMARY KEY,
                FullName NVARCHAR(100) NOT NULL,
                Position NVARCHAR(50) NOT NULL,
                HourRate DECIMAL(8, 2) NOT NULL
            )
        END
    `)

    await pool.request().query(`
        IF OBJECT_ID(N'dbo.FieldOperations', N'U') IS NULL
        BEGIN
            CREATE TABLE FieldOperations (
                OperationID INT IDENTITY(1,1) PRIMARY KEY,
                FieldID INT NOT NULL REFERENCES Fields(FieldID),
                EmployeeID INT NOT NULL REFERENCES Employees(EmployeeID),
                OperationType NVARCHAR(50) NOT NULL,
                OperationDate DATE NOT NULL,
                HoursWorked DECIMAL(5, 2) NOT NULL
            )
        END
    `)

    await pool.request().query(`
        IF OBJECT_ID(N'dbo.FuelConsumption', N'U') IS NULL
        BEGIN
            CREATE TABLE FuelConsumption (
                FuelID INT IDENTITY(1,1) PRIMARY KEY,
                OperationID INT NOT NULL REFERENCES FieldOperations(OperationID),
                Diesel DECIMAL(8, 2) NOT NULL,
                Lubricants DECIMAL(8, 2) NOT NULL,
                FuelPrice DECIMAL(8, 2) NOT NULL,
                FuelCost AS Diesel * FuelPrice
            )
        END
    `)

    await pool.request().query(`
        IF OBJECT_ID(N'dbo.Sales', N'U') IS NULL
        BEGIN
            CREATE TABLE Sales (
                SaleID INT IDENTITY(1,1) PRIMARY KEY,
                HarvestID INT NOT NULL REFERENCES Harvests(HarvestID),
                Buyer NVARCHAR(100) NOT NULL,
                Quantity DECIMAL(10, 2) NOT NULL,
                Price DECIMAL(10, 2) NOT NULL,
                SaleDate DATE NOT NULL,
                CHECK (Quantity > 0)
            )
        END
    `)

    await pool.request().query(`
        IF OBJECT_ID(N'dbo.VariableCosts', N'U') IS NULL
        BEGIN
            CREATE TABLE VariableCosts (
                CostID INT IDENTITY(1,1) PRIMARY KEY,
                FieldID INT NOT NULL REFERENCES Fields(FieldID),
                Category NVARCHAR(50) NOT NULL,
                Description NVARCHAR(150),
                Amount DECIMAL(10, 2) NOT NULL
            )
        END
    `)

    await pool.request().query(`
        IF OBJECT_ID(N'dbo.Revenue', N'U') IS NULL
        BEGIN
            CREATE TABLE Revenue (
                RevenueID INT IDENTITY(1,1) PRIMARY KEY,
                HarvestID INT NOT NULL REFERENCES Harvests(HarvestID),
                GrossRevenue DECIMAL(12, 2),
                ByProductRevenue DECIMAL(12, 2)
            )
        END
    `)

     await pool.request().query(`IF OBJECT_ID(N'dbo.GMReport', N'V') IS NOT NULL DROP VIEW dbo.GMReport;`)

    await pool.request().query(`
        CREATE VIEW dbo.GMReport AS
        WITH Base AS (
            SELECT
                f.FieldID, f.Name AS FieldName, c.Name AS CropName, h.HarvestID,
                f.Area, h.YieldPerHa,
                f.Area * h.YieldPerHa AS GrossHarvest,
                COALESCE(r.GrossRevenue, f.Area * h.YieldPerHa * h.Price) AS GrossRevenue,
                COALESCE((SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.FieldID = f.FieldID AND vc.Category = N'Насіння'), 0) AS Seeds,
                COALESCE((SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.FieldID = f.FieldID AND vc.Category = N'Добрива'), 0) AS Fertilizers,
                COALESCE((SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.FieldID = f.FieldID AND vc.Category = N'ЗЗР'), 0) AS CropProtection,
                COALESCE((SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.FieldID = f.FieldID AND vc.Category = N'Пальне'), 0) AS Fuel,
                COALESCE((SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.FieldID = f.FieldID AND vc.Category = N'Послуги'), 0) AS Services,
                COALESCE((SELECT SUM(vo.HoursWorked * e.HourRate) FROM FieldOperations vo JOIN Employees e ON e.EmployeeID = vo.EmployeeID WHERE vo.FieldID = f.FieldID), 0) AS Labor,
                COALESCE((SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.FieldID = f.FieldID AND vc.Category = N'Амортизація'), 0) AS Amortization,
                COALESCE((SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.FieldID = f.FieldID AND vc.Category = N'Власна праця'), 0) AS OwnLabor,
                COALESCE((SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.FieldID = f.FieldID AND vc.Category NOT IN (N'Амортизація', N'Власна праця')), 0) AS TotalVariableCosts
            FROM Fields f
            JOIN Harvests h ON h.FieldID = f.FieldID
            JOIN Crops c ON c.CropID = h.CropID
            LEFT JOIN Revenue r ON r.HarvestID = h.HarvestID
        )
        SELECT
            FieldName, CropName, Area, YieldPerHa, GrossHarvest, GrossRevenue,
            Seeds, Fertilizers, CropProtection, Fuel, Services,
            TotalVariableCosts, Labor, Amortization, OwnLabor,
            GrossRevenue - TotalVariableCosts                        AS GM_I,
            GrossRevenue - TotalVariableCosts - Labor                AS GM_II,
            GrossRevenue - TotalVariableCosts - Labor - Amortization AS GM_III,
            GrossRevenue - TotalVariableCosts - Labor - Amortization - OwnLabor AS EconomicProfit
        FROM Base
    `)

}

const pool = await poolPromise

await ensureSchema()
await pool.request().query(`
    IF NOT EXISTS (SELECT 1 FROM Crops WHERE Name = N'Озима пшениця')
        INSERT INTO Crops (Name, Unit) VALUES
            (N'Озима пшениця', N'т'),
            (N'Яра пшениця', N'т'),
            (N'Кукурудза', N'т'),
            (N'Соняшник', N'т'),
            (N'Соя', N'т'),
            (N'Ячмінь озимий', N'т'),
            (N'Ячмінь ярий', N'т'),
            (N'Ріпак озимий', N'т'),
            (N'Ріпак ярий', N'т'),
            (N'Горох', N'т'),
            (N'Просо', N'т'),
            (N'Овес', N'т'),
            (N'Жито', N'т'),
            (N'Цукровий буряк', N'т'),
            (N'Картопля', N'т'),
            (N'Сорго', N'т'),
            (N'Льон', N'т'),
            (N'Гречка', N'т'),
            (N'Нут', N'т'),
            (N'Люцерна', N'т')
        `)

/** Deprecated: Not in use anymore. For debug purposes only.*/
export async function getAllCrops() {
    const pool = await poolPromise
    const result = await pool.request().query('Select CropID, Name FROM Crops ORDER BY CropID')
    return result.recordset
}


export async function getTables() {
    const pool = await poolPromise
    const result = await pool.request().query(
        `SELECT TABLE_NAME, TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW') AND TABLE_SCHEMA = 'dbo'
         ORDER BY CASE WHEN TABLE_TYPE = 'VIEW' THEN 1 ELSE 0 END, TABLE_NAME`
    )
    return result.recordset
}

export async function getSchema(tableName: string) {
    const pool = await poolPromise
    const result = await pool.request()
        .input('tableName', tableName)
        .query(`SELECT
            c.COLUMN_NAME, c.DATA_TYPE, c.IS_NULLABLE,
            ref.TABLE_NAME AS FK_REFERENCED_TABLE,
            COLUMNPROPERTY(OBJECT_ID(QUOTENAME(c.TABLE_SCHEMA) + '.' + QUOTENAME(c.TABLE_NAME)),
                c.COLUMN_NAME, 'IsComputed') AS IS_COMPUTED
        FROM INFORMATION_SCHEMA.COLUMNS c
        LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE kcu
            ON c.TABLE_SCHEMA = kcu.TABLE_SCHEMA AND c.TABLE_NAME = kcu.TABLE_NAME AND c.COLUMN_NAME = kcu.COLUMN_NAME
        LEFT JOIN INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS rc
            ON kcu.CONSTRAINT_NAME = rc.CONSTRAINT_NAME AND kcu.CONSTRAINT_SCHEMA = rc.CONSTRAINT_SCHEMA
        LEFT JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ref
            ON rc.UNIQUE_CONSTRAINT_NAME = ref.CONSTRAINT_NAME AND ref.ORDINAL_POSITION = kcu.ORDINAL_POSITION
        WHERE c.TABLE_NAME = @tableName
        ORDER BY c.ORDINAL_POSITION`)
    return result.recordset
}


export async function readTable(tableName: string) {
    const pool = await poolPromise
    const schema = await getSchema(tableName)

    const typeReq = pool.request()
    typeReq.input('typeTable', tableName)
    const type = await typeReq.query(
        `SELECT TABLE_TYPE FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = 'dbo' AND TABLE_NAME = @typeTable`
    )

    const result = await pool.request().query(`SELECT * FROM [${tableName}]`)
    return { columns: schema, rows: result.recordset, objectType: type.recordset[0]?.TABLE_TYPE ?? 'BASE TABLE' }
}


export async function updateRow(tableName: string, pkColumn: string, pkValue: any, values:
    Record<string, any>) {
    const pool = await poolPromise
    const sets = Object.entries(values).map(([k, v]) => `[${k}] = @${k}`).join(', ')
    const req = pool.request()
    Object.entries(values).forEach(([k, v]) => req.input(k, v))
    req.input('pkValue', pkValue)
    await req.query(`UPDATE [${tableName}] SET ${sets} WHERE [${pkColumn}] = @pkValue`)
    return true
}


export async function insertRow(tableName: string, values: Record<string, any>) {
    const pool = await poolPromise
    const cols = Object.keys(values).map(k => `[${k}]`).join(', ')
    const params = Object.keys(values).map(k => `@${k}`).join(', ')
    const req = pool.request()
    Object.entries(values).forEach(([k, v]) => req.input(k, v))
    await req.query(`INSERT INTO [${tableName}] (${cols}) VALUES (${params})`)
    return true
}


export async function deleteRow(tableName: string, pkColumn: string, pkValue: any) {
    const pool = await poolPromise
    await pool.request()
        .input('pkValue', pkValue)
        .query(`DELETE FROM [${tableName}] WHERE [${pkColumn}] = @pkValue`)
    return true
}