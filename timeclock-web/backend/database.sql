-- Create Employees table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[Employees]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[Employees] (
        [EmployeeId] INT IDENTITY(1,1) PRIMARY KEY,
        [FirstName] NVARCHAR(50) NOT NULL,
        [LastName] NVARCHAR(50) NOT NULL,
        [Email] NVARCHAR(100) UNIQUE NOT NULL,
        [CreatedAt] DATETIME DEFAULT GETDATE()
    )
END

-- Create TimeEntries table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TimeEntries]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[TimeEntries] (
        [EntryId] INT IDENTITY(1,1) PRIMARY KEY,
        [EmployeeId] INT NOT NULL,
        [ClockInTime] DATETIME NOT NULL,
        [ClockOutTime] DATETIME NULL,
        FOREIGN KEY ([EmployeeId]) REFERENCES [Employees]([EmployeeId])
    )
END

-- Add index for faster queries
IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_TimeEntries_EmployeeId' AND object_id = OBJECT_ID('TimeEntries'))
BEGIN
    CREATE INDEX [IX_TimeEntries_EmployeeId] ON [TimeEntries]([EmployeeId])
END

-- Create LocationCustomerMapping table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[LocationCustomerMapping]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[LocationCustomerMapping] (
        [customer_name] NVARCHAR(100) NOT NULL,
        [min_latitude] FLOAT NOT NULL,
        [max_latitude] FLOAT NOT NULL,
        [min_longitude] FLOAT NOT NULL,
        [max_longitude] FLOAT NOT NULL,
        [CustomerID] INT IDENTITY(1,1) PRIMARY KEY
    )
END

-- Create SubContractorEmployees table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[SubContractorEmployees]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[SubContractorEmployees] (
        [SubContractor] NVARCHAR(100) NOT NULL,
        [Employee] NVARCHAR(100) NOT NULL,
        [Number] NVARCHAR(50) NOT NULL,
        PRIMARY KEY ([SubContractor], [Employee])
    )
END

-- Create TimeClock table
IF NOT EXISTS (SELECT * FROM sys.objects WHERE object_id = OBJECT_ID(N'[dbo].[TimeClock]') AND type in (N'U'))
BEGIN
    CREATE TABLE [dbo].[TimeClock] (
        [ID] INT IDENTITY(1,1) PRIMARY KEY,
        [SubContractor] NVARCHAR(100) NOT NULL,
        [Employee] NVARCHAR(100) NOT NULL,
        [Number] NVARCHAR(50) NOT NULL,
        [ClockIn] DATETIME NOT NULL,
        [ClockOut] DATETIME NULL,
        [Lat] FLOAT NOT NULL,
        [Lon] FLOAT NOT NULL,
        [Cookie] NVARCHAR(100) NOT NULL,
        [AutoFlag] BIT DEFAULT 0,
        [HoursWorked] FLOAT NULL,
        [ClockInNotes] NVARCHAR(MAX) NULL,
        [ClockOutNotes] NVARCHAR(MAX) NULL
    )
END 