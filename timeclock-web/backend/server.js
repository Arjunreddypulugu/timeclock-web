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
    
    // Special handling for negative longitude values in western hemisphere
    const result = await pool.request()
      .input('lat', sql.Float, lat)
      .input('lon', sql.Float, lon)
      .query(`
        SELECT customer_name, min_latitude, max_latitude, min_longitude, max_longitude
        FROM LocationCustomerMapping
        WHERE @lat BETWEEN min_latitude AND max_latitude
        AND (
          -- Handle both possibilities for longitude storage (important for negative values)
          (@lon BETWEEN min_longitude AND max_longitude)
          OR 
          (@lon BETWEEN max_longitude AND min_longitude)
        )
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
      console.log(`Current coordinates: lat=${lat}, lon=${lon}`);
      
      // Example coordinate check for debugging
      allLocations.recordset.forEach(loc => {
        const latInRange = lat >= loc.min_latitude && lat <= loc.max_latitude;
        const lonInRange1 = lon >= loc.min_longitude && lon <= loc.max_longitude;
        const lonInRange2 = lon >= loc.max_longitude && lon <= loc.min_longitude;
        console.log(`${loc.customer_name}: lat in range: ${latInRange}, lon in range: ${lonInRange1 || lonInRange2}`);
      });
      
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
    
    // Log the request but omit the image data
    const { image, ...logData } = req.body;
    console.log('Clock-in request received:', logData);
    
    // Validate required fields
    const { subContractor, employee, number, lat, lon, cookie, notes } = req.body;
    if (!subContractor || !employee || !number || !lat || !lon || !cookie) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Process base64 image if provided
    let imageBuffer = null;
    if (image) {
      try {
        // Handle different image encodings from different browsers
        let base64Data;
        if (image.startsWith('data:image/')) {
          // Remove data URI prefix (e.g., 'data:image/jpeg;base64,')
          base64Data = image.split(',')[1];
        } else {
          base64Data = image;
        }
        
        // Verify the base64 string is valid
        if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
          console.warn('Invalid base64 characters in image data');
          return res.status(400).json({ error: 'The image data contains invalid characters' });
        }
        
        // Create buffer from base64
        imageBuffer = Buffer.from(base64Data, 'base64');
        console.log(`Received image for clock-in: ${imageBuffer.length} bytes`);
        
        // Validate image data
        if (imageBuffer.length < 100) {
          console.warn('Image data too small, likely invalid');
          return res.status(400).json({ error: 'The provided image appears to be invalid' });
        }
      } catch (imgErr) {
        console.error(`Error processing clock-in image: ${imgErr.message}`);
        return res.status(400).json({ error: `Image processing error: ${imgErr.message}` });
      }
    }
    
    // Verify worksite location
    const validLocation = await pool.request()
      .input('lat', sql.Float, lat)
      .input('lon', sql.Float, lon)
      .query(`
        SELECT TOP 1 customer_name
        FROM LocationCustomerMapping
        WHERE @lat BETWEEN min_latitude AND max_latitude
        AND (
          -- Handle both possibilities for longitude storage (important for negative values)
          (@lon BETWEEN min_longitude AND max_longitude)
          OR 
          (@lon BETWEEN max_longitude AND min_longitude)
        )
      `);
    
    console.log(`Clock-in location check: lat=${lat}, lon=${lon}, found=${validLocation.recordset.length}`);
    
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

    // Create the request object
    const request = pool.request()
      .input('subContractor', sql.NVarChar, subContractor)
      .input('employee', sql.NVarChar, employee)
      .input('number', sql.NVarChar, number)
      .input('lat', sql.Float, lat)
      .input('lon', sql.Float, lon)
      .input('cookie', sql.NVarChar, cookie)
      .input('notes', sql.NVarChar(sql.MAX), notes || '');
    
    // Only add image if it's valid
    if (imageBuffer && imageBuffer.length > 0) {
      request.input('image', sql.VarBinary(sql.MAX), imageBuffer);
    }
    
    // Build the query dynamically based on whether we have an image
    let query = `
      INSERT INTO TimeClock (
        SubContractor, Employee, Number, ClockIn, Lat, Lon, Cookie, ClockInNotes
        ${imageBuffer && imageBuffer.length > 0 ? ', ClockInImage' : ''}
      )
      VALUES (
        @subContractor, @employee, @number, GETDATE(), @lat, @lon, @cookie, @notes
        ${imageBuffer && imageBuffer.length > 0 ? ', @image' : ''}
      );
      SELECT SCOPE_IDENTITY() as id;
    `;
    
    console.log('Executing SQL insert...');
    const result = await request.query(query);
    console.log(`Insert completed, new ID: ${result.recordset[0].id}`);

    res.json({ 
      id: result.recordset[0].id, 
      customer_name: validLocation.recordset[0].customer_name,
      imageIncluded: !!(imageBuffer && imageBuffer.length > 0)
    });
  } catch (err) {
    console.error(`Clock in error: ${err.message}`);
    console.error(err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Clock out
app.post('/api/clock-out', async (req, res) => {
  try {
    await poolConnect;
    
    // Log the request but omit the image data
    const { image, ...logData } = req.body;
    console.log('Clock-out request received:', logData);
    
    const { cookie, notes } = req.body;
    
    if (!cookie) {
      return res.status(400).json({ error: 'Missing required cookie field' });
    }

    // Process base64 image if provided
    let imageBuffer = null;
    if (image) {
      try {
        // Handle different image encodings from different browsers
        let base64Data;
        if (image.startsWith('data:image/')) {
          // Remove data URI prefix (e.g., 'data:image/jpeg;base64,')
          base64Data = image.split(',')[1];
        } else {
          base64Data = image;
        }
        
        // Verify the base64 string is valid
        if (!/^[A-Za-z0-9+/=]+$/.test(base64Data)) {
          console.warn('Invalid base64 characters in image data');
          return res.status(400).json({ error: 'The image data contains invalid characters' });
        }
        
        // Create buffer from base64
        imageBuffer = Buffer.from(base64Data, 'base64');
        console.log(`Received image for clock-out: ${imageBuffer.length} bytes`);
        
        // Validate image data
        if (imageBuffer.length < 100) {
          console.warn('Image data too small, likely invalid');
          return res.status(400).json({ error: 'The provided image appears to be invalid' });
        }
      } catch (imgErr) {
        console.error(`Error processing clock-out image: ${imgErr.message}`);
        return res.status(400).json({ error: `Image processing error: ${imgErr.message}` });
      }
    }

    // Create the request object
    const request = pool.request()
      .input('cookie', sql.NVarChar, cookie)
      .input('notes', sql.NVarChar(sql.MAX), notes || '');
    
    // Only add image if it's valid
    if (imageBuffer && imageBuffer.length > 0) {
      request.input('image', sql.VarBinary(sql.MAX), imageBuffer);
    }
    
    // Build the query dynamically based on whether we have an image
    let query = `
      UPDATE TimeClock 
      SET ClockOut = GETDATE(),
          ClockOutNotes = @notes
          ${imageBuffer && imageBuffer.length > 0 ? ', ClockOutImage = @image' : ''}
      WHERE Cookie = @cookie AND ClockOut IS NULL;
      
      SELECT @@ROWCOUNT as updated;
    `;
    
    console.log('Executing SQL update for clock-out...');
    const result = await request.query(query);
    console.log(`Update completed, rows affected: ${result.recordset[0].updated}`);

    if (result.recordset[0].updated === 0) {
      return res.status(404).json({ error: 'No open session found' });
    }

    res.json({ 
      success: true,
      imageIncluded: !!(imageBuffer && imageBuffer.length > 0)
    });
  } catch (err) {
    console.error(`Clock out error: ${err.message}`);
    console.error(err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Test image upload endpoint
app.post('/api/test-image', async (req, res) => {
  try {
    const { image } = req.body;
    console.log('Test image endpoint called');
    
    if (!image) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }
    
    // Process base64 image
    try {
      const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
      const imageBuffer = Buffer.from(base64Data, 'base64');
      console.log(`Test image processed: ${imageBuffer.length} bytes`);
      
      // Just for testing, we'll echo back some info but not store it
      res.json({ 
        success: true, 
        imageSize: imageBuffer.length,
        message: 'Image successfully processed'
      });
    } catch (imgErr) {
      console.error(`Error processing test image: ${imgErr.message}`);
      res.status(400).json({ 
        success: false, 
        error: `Image processing error: ${imgErr.message}`
      });
    }
  } catch (err) {
    console.error(`Test image endpoint error: ${err.message}`);
    res.status(500).json({ success: false, error: err.message });
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

// Generate and store subcontractor encoded links
app.post('/api/generate-subcontractor-links', async (req, res) => {
  try {
    await poolConnect;
    
    // Get all subcontractors from the database
    const subcontractors = await pool.request().query(`
      SELECT DISTINCT SubContractor 
      FROM SubContractorEmployees
      ORDER BY SubContractor
    `);
    
    const baseURL = 'https://timeclock-frontend-8d5n.onrender.com?sc=';
    const results = [];
    
    // Process each subcontractor
    for (const entry of subcontractors.recordset) {
      const subcontractor = entry.SubContractor;
      if (!subcontractor) continue;
      
      // Create base64 encoded value
      const encodedName = Buffer.from(subcontractor).toString('base64');
      const fullLink = baseURL + encodedName;
      
      // Check if entry already exists
      const existing = await pool.request()
        .input('subcontractor', sql.NVarChar, subcontractor)
        .query(`
          SELECT EncodedLink 
          FROM SubcontractorLinks 
          WHERE Subcontractor = @subcontractor
        `);
      
      if (existing.recordset.length === 0) {
        // Insert new link
        await pool.request()
          .input('subcontractor', sql.NVarChar, subcontractor)
          .input('encodedLink', sql.NVarChar, fullLink)
          .query(`
            INSERT INTO SubcontractorLinks (Subcontractor, EncodedLink)
            VALUES (@subcontractor, @encodedLink)
          `);
      } else {
        // Update existing link
        await pool.request()
          .input('subcontractor', sql.NVarChar, subcontractor)
          .input('encodedLink', sql.NVarChar, fullLink)
          .query(`
            UPDATE SubcontractorLinks 
            SET EncodedLink = @encodedLink
            WHERE Subcontractor = @subcontractor
          `);
      }
      
      results.push({
        subcontractor,
        encodedLink: fullLink
      });
    }
    
    res.json({
      success: true,
      message: `Generated ${results.length} subcontractor links`,
      links: results
    });
  } catch (err) {
    console.error(`Error generating subcontractor links: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// Get all subcontractor links
app.get('/api/subcontractor-links', async (req, res) => {
  try {
    await poolConnect;
    const result = await pool.request().query(`
      SELECT Subcontractor, EncodedLink
      FROM SubcontractorLinks
      ORDER BY Subcontractor
    `);
    
    res.json(result.recordset);
  } catch (err) {
    console.error(`Error fetching subcontractor links: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 