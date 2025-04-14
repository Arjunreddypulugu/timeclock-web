require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const cookieParser = require('cookie-parser');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(cookieParser());

// Database configuration
const dbConfig = {
  driver: process.env.DB_DRIVER,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  options: {
    encrypt: true,
    trustServerCertificate: false
  }
};

// Database connection pool
const pool = new sql.ConnectionPool(dbConfig);
const poolConnect = pool.connect();

// Test database connection
poolConnect.then(() => {
  console.log('Connected to database');
}).catch(err => {
  console.error('Database connection failed:', err);
});

// Get customer name from location
app.post('/api/verify-location', async (req, res) => {
  try {
    await poolConnect;
    const { lat, lon } = req.body;
    console.log(`Checking location: lat=${lat}, lon=${lon}`);
    
    const result = await pool.request()
      .input('lat', sql.Float, lat)
      .input('lon', sql.Float, lon)
      .query(`
        SELECT customer_name, min_latitude, max_latitude, min_longitude, max_longitude
        FROM LocationCustomerMapping
        WHERE @lat BETWEEN min_latitude AND max_latitude
        AND @lon BETWEEN min_longitude AND max_longitude
      `);
    
    console.log(`Found ${result.recordset.length} matching locations`);
    if (result.recordset.length > 0) {
      console.log(`Matched location: ${JSON.stringify(result.recordset[0])}`);
      res.json({ customer_name: result.recordset[0].customer_name });
    } else {
      // Get all location boundaries for debugging
      const allLocations = await pool.request().query(`
        SELECT customer_name, min_latitude, max_latitude, min_longitude, max_longitude
        FROM LocationCustomerMapping
      `);
      console.log(`All locations: ${JSON.stringify(allLocations.recordset)}`);
      res.status(404).json({ error: 'Location not found in any customer area' });
    }
  } catch (err) {
    console.error(`Location verification error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Check user status by cookie
app.get('/api/user-status', async (req, res) => {
  try {
    await poolConnect;
    const cookie = req.cookies.userId || req.query.cookie;
    
    if (!cookie) {
      return res.json({ isNewUser: true });
    }

    // Check for open session
    const openSession = await pool.request()
      .input('cookie', sql.NVarChar, cookie)
      .query(`
        SELECT TOP 1 ID, ClockIn, SubContractor, Employee, Number
        FROM TimeClock
        WHERE Cookie = @cookie AND ClockOut IS NULL
        ORDER BY ClockIn DESC
      `);

    // Get user details
    const userDetails = await pool.request()
      .input('cookie', sql.NVarChar, cookie)
      .query(`
        SELECT TOP 1 SubContractor, Employee, Number
        FROM TimeClock
        WHERE Cookie = @cookie
        ORDER BY ClockIn DESC
      `);

    res.json({
      isNewUser: false,
      hasOpenSession: openSession.recordset.length > 0,
      openSession: openSession.recordset[0] || null,
      userDetails: userDetails.recordset[0] || null
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Register new user
app.post('/api/register', async (req, res) => {
  try {
    await poolConnect;
    const { subContractor, employee, number, cookie } = req.body;
    
    // Check if user already exists
    const existingUser = await pool.request()
      .input('subContractor', sql.NVarChar, subContractor)
      .input('employee', sql.NVarChar, employee)
      .query(`
        SELECT * FROM SubContractorEmployees
        WHERE SubContractor = @subContractor AND Employee = @employee
      `);

    if (existingUser.recordset.length === 0) {
      // Add to SubContractorEmployees
      await pool.request()
        .input('subContractor', sql.NVarChar, subContractor)
        .input('employee', sql.NVarChar, employee)
        .input('number', sql.NVarChar, number)
        .query(`
          INSERT INTO SubContractorEmployees (SubContractor, Employee, Number)
          VALUES (@subContractor, @employee, @number)
        `);
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clock in
app.post('/api/clock-in', async (req, res) => {
  try {
    await poolConnect;
    const { subContractor, employee, number, lat, lon, cookie, notes } = req.body;

    // First verify location is valid before allowing clock in
    const validLocation = await pool.request()
      .input('lat', sql.Float, lat)
      .input('lon', sql.Float, lon)
      .query(`
        SELECT customer_name
        FROM LocationCustomerMapping
        WHERE @lat BETWEEN min_latitude AND max_latitude
        AND @lon BETWEEN min_longitude AND max_longitude
      `);
    
    if (validLocation.recordset.length === 0) {
      return res.status(400).json({ error: 'Invalid worksite location. Cannot clock in.' });
    }

    // Check for open session
    const openSession = await pool.request()
      .input('cookie', sql.NVarChar, cookie)
      .query(`
        SELECT TOP 1 ID FROM TimeClock
        WHERE Cookie = @cookie AND ClockOut IS NULL
      `);

    if (openSession.recordset.length > 0) {
      return res.status(400).json({ error: 'You already have an open session' });
    }

    const result = await pool.request()
      .input('subContractor', sql.NVarChar, subContractor)
      .input('employee', sql.NVarChar, employee)
      .input('number', sql.NVarChar, number)
      .input('lat', sql.Float, lat)
      .input('lon', sql.Float, lon)
      .input('cookie', sql.NVarChar, cookie)
      .input('notes', sql.NVarChar, notes)
      .input('worksite', sql.NVarChar, validLocation.recordset[0].customer_name)
      .query(`
        INSERT INTO TimeClock (SubContractor, Employee, Number, ClockIn, Lat, Lon, Cookie, ClockInNotes, Worksite)
        VALUES (@subContractor, @employee, @number, GETDATE(), @lat, @lon, @cookie, @notes, @worksite);
        SELECT SCOPE_IDENTITY() as id;
      `);

    res.json({ id: result.recordset[0].id, worksite: validLocation.recordset[0].customer_name });
  } catch (err) {
    console.error(`Clock in error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Clock out
app.post('/api/clock-out', async (req, res) => {
  try {
    await poolConnect;
    const { cookie, notes } = req.body;

    const result = await pool.request()
      .input('cookie', sql.NVarChar, cookie)
      .input('notes', sql.NVarChar, notes)
      .query(`
        UPDATE TimeClock 
        SET ClockOut = GETDATE(),
            ClockOutNotes = @notes
        WHERE Cookie = @cookie AND ClockOut IS NULL;
        
        SELECT @@ROWCOUNT as updated;
      `);

    if (result.recordset[0].updated === 0) {
      return res.status(404).json({ error: 'No open session found' });
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get time entries for an employee
app.get('/api/time-entries/:employeeId', async (req, res) => {
  try {
    await poolConnect;
    const { employeeId } = req.params;
    const result = await pool.request()
      .input('employeeId', sql.Int, employeeId)
      .query(`
        SELECT * FROM TimeEntries 
        WHERE EmployeeId = @employeeId 
        ORDER BY ClockInTime DESC;
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 