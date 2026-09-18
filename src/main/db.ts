import sql from 'mssql'
import 'dotenv/config'

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
                CHECK (Quantity <= (SELECT MainProduct FROM Harvests WHERE HarvestID = Sales.HarvestID) OR (SELECT MainProduct FROM Harvests WHERE HarvestID = Sales.HarvestID) IS NULL)
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

    await pool.request().query(`
        IF OBJECT_ID(N'dbo.GMReport', N'V') IS NULL
        BEGIN
            CREATE VIEW GMReport AS
            SELECT 
                f.Name AS FieldName,
                c.Name AS CropName,
                f.Area,
                h.YieldPerHa,
                f.Area * h.YieldPerHa AS GrossHarvest,
                COALESCE(r.GrossRevenue, f.Area * h.YieldPerHa * h.Price) AS GrossRevenue,
                (SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.Category = N'Насіння' AND vc.FieldID = f.FieldID) AS Seeds,
                (SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.Category = N'Добрива' AND vc.FieldID = f.FieldID) AS Fertilizers,
                (SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.Category = N'ЗЗР' AND vc.FieldID = f.FieldID) AS CropProtection,
                (SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.Category = N'Пальне' AND vc.FieldID = f.FieldID) AS Fuel,
                (SELECT SUM(vo.HoursWorked * e.HourRate) FROM FieldOperations vo JOIN Employees e ON vo.EmployeeID = e.EmployeeID WHERE vo.FieldID = f.FieldID) AS Labor,
                (SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.Category = N'Послуги' AND vc.FieldID = f.FieldID) AS Services,
                (SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.FieldID = f.FieldID) AS TotalVariableCosts,
                COALESCE(r.GrossRevenue, f.Area * h.YieldPerHa * h.Price) - (SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.FieldID = f.FieldID) AS GM_I,
                COALESCE(r.GrossRevenue, f.Area * h.YieldPerHa * h.Price) - (SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.FieldID = f.FieldID) - (SELECT SUM(vo.HoursWorked * e.HourRate) FROM FieldOperations vo JOIN Employees e ON vo.EmployeeID = e.EmployeeID WHERE vo.FieldID = f.FieldID) AS GM_II,
                COALESCE(r.GrossRevenue, f.Area * h.YieldPerHa * h.Price) - (SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.FieldID = f.FieldID) - (SELECT SUM(vo.HoursWorked * e.HourRate) FROM FieldOperations vo JOIN Employees e ON vo.EmployeeID = e.EmployeeID WHERE vo.FieldID = f.FieldID) AS GM_III,
                COALESCE(r.GrossRevenue, f.Area * h.YieldPerHa * h.Price) - (SELECT SUM(vc.Amount) FROM VariableCosts vc WHERE vc.FieldID = f.FieldID) - (SELECT SUM(vo.HoursWorked * e.HourRate) FROM FieldOperations vo JOIN Employees e ON vo.EmployeeID = e.EmployeeID WHERE vo.FieldID = f.FieldID) AS EconomicProfit
            FROM Fields f
            JOIN Harvests h ON h.FieldID = f.FieldID
            JOIN Crops c ON c.CropID = h.CropID
            LEFT JOIN Revenue r ON r.HarvestID = h.HarvestID
        END
    `)

}

const pool = await poolPromise

ensureSchema().catch(console.error)
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

export async function getAllCrops() {
    const pool = await poolPromise
    const result = await pool.request().query('Select CropID, Name FROM Crops')
    console.log('CROPS IN DATABASE:', getAllCrops())
    return result.recordset
}