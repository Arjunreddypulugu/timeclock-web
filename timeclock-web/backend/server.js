require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max size
  }
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' })); // Increased limit for JSON
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

// Helper function for processing base64 images
const processBase64Image = (imageData) => {
  if (!imageData) return null;
  
  try {
    // Handle different image data formats
    let base64Data = imageData;
    let formatMatch = false;
    
    // Check if it's a valid data URI
    if (base64Data.startsWith('data:image/')) {
      const parts = base64Data.split(',');
      if (parts.length > 1) {
        base64Data = parts[1];
        formatMatch = true;
      }
    }
    
    // If it's not a recognized format, try to clean it anyway
    if (!formatMatch) {
      base64Data = base64Data.replace(/^data:image\/\w+;base64,/, '');
    }
    
    // Clean the base64 string - remove any non-base64 characters
    base64Data = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
    
    // Add padding if needed (must be multiple of 4)
    while (base64Data.length % 4 !== 0) {
      base64Data += '=';
    }
    
    // Safety check - should be a reasonable length
    if (base64Data.length < 10) {
      throw new Error('Image data too short to be valid');
    }
    
    const buffer = Buffer.from(base64Data, 'base64');
    
    // Basic validation that this looks like an image
    if (buffer.length < 100) {
      console.warn('Warning: Very small image buffer');
    }
    
    return buffer;
  } catch (err) {
    console.error(`Error processing image: ${err.message}`);
    if (imageData && typeof imageData === 'string') {
      console.error(`First 20 chars of image data: ${imageData.substring(0, 20)}...`);
    }
    throw err;
  }
};

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
      isNewUser: userDetails.recordset.length === 0,
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

// Common clock-in function for both regular and multipart requests
const performClockIn = async (subContractor, employee, number, lat, lon, cookie, notes, imageBuffer) => {
  // Validate required fields
  if (!subContractor || !employee || !cookie) {
    throw new Error('Missing required fields');
  }

  // First verify location is valid before allowing clock in
  const validLocation = await pool.request()
    .input('lat', sql.Float, lat)
    .input('lon', sql.Float, lon)
    .query(`
      SELECT customer_name
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
    throw new Error('Invalid worksite location. Cannot clock in.');
  }

  // Check for open session
  const openSession = await pool.request()
    .input('cookie', sql.NVarChar, cookie)
    .query(`
      SELECT TOP 1 ID FROM TimeClock
      WHERE Cookie = @cookie AND ClockOut IS NULL
    `);

  if (openSession.recordset.length > 0) {
    throw new Error('You already have an open session');
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
  let hasImage = false;
  if (imageBuffer && imageBuffer.length > 0) {
    request.input('image', sql.VarBinary(sql.MAX), imageBuffer);
    hasImage = true;
  }
  
  // Build the query dynamically based on whether we have an image
  let query = `
    INSERT INTO TimeClock (
      SubContractor, Employee, Number, ClockIn, Lat, Lon, Cookie, ClockInNotes
      ${hasImage ? ', ClockInImage' : ''}
    )
    VALUES (
      @subContractor, @employee, @number, GETDATE(), @lat, @lon, @cookie, @notes
      ${hasImage ? ', @image' : ''}
    );
    SELECT SCOPE_IDENTITY() as id;
  `;
  
  console.log('Executing SQL insert...');
  const result = await request.query(query);
  console.log(`Insert completed, new ID: ${result.recordset[0].id}`);

  return { 
    id: result.recordset[0].id, 
    customer_name: validLocation.recordset[0].customer_name,
    imageIncluded: hasImage
  };
};

// Clock in (JSON version)
app.post('/api/clock-in', async (req, res) => {
  try {
    await poolConnect;
    const { subContractor, employee, number, lat, lon, cookie, notes, image } = req.body;

    // Process base64 image if provided
    let imageBuffer = null;
    if (image) {
      try {
        imageBuffer = processBase64Image(image);
        console.log(`Received image for clock-in: ${imageBuffer ? imageBuffer.length : 0} bytes`);
      } catch (imgErr) {
        console.error(`Error processing image: ${imgErr.message}`);
        return res.status(400).json({ error: `Image processing failed: ${imgErr.message}` });
      }
    }

    const result = await performClockIn(
      subContractor, employee, number, lat, lon, cookie, notes, imageBuffer
    );
    
    res.json(result);
  } catch (err) {
    console.error(`Clock in error: ${err.message}`);
    console.error(err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Clock in (multipart version)
app.post('/api/clock-in-multipart', upload.single('image'), async (req, res) => {
  try {
    await poolConnect;
    
    // Get JSON data from form data
    const jsonData = JSON.parse(req.body.data || '{}');
    const { subContractor, employee, number, lat, lon, cookie, notes } = jsonData;
    
    // Get image from uploaded file
    let imageBuffer = null;
    if (req.file) {
      imageBuffer = req.file.buffer;
      console.log(`Received multipart image for clock-in: ${imageBuffer.length} bytes`);
    }
    
    const result = await performClockIn(
      subContractor, employee, number, lat, lon, cookie, notes, imageBuffer
    );
    
    res.json(result);
  } catch (err) {
    console.error(`Multipart clock in error: ${err.message}`);
    console.error(err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Common clock-out function for both regular and multipart requests
const performClockOut = async (id, cookie, notes, imageBuffer) => {
  // Validate required fields
  if (!id && !cookie) {
    throw new Error('Missing ID or cookie for clock-out');
  }

  // Create the request object
  const request = pool.request()
    .input('cookie', sql.NVarChar, cookie)
    .input('notes', sql.NVarChar(sql.MAX), notes || '');
  
  // Only add image if it's valid
  let hasImage = false;
  if (imageBuffer && imageBuffer.length > 0) {
    request.input('image', sql.VarBinary(sql.MAX), imageBuffer);
    hasImage = true;
  }
  
  // Build the query dynamically based on whether we have an image
  let query = `
    UPDATE TimeClock 
    SET ClockOut = GETDATE(),
        ClockOutNotes = @notes
        ${hasImage ? ', ClockOutImage = @image' : ''}
    WHERE Cookie = @cookie AND ClockOut IS NULL;
    
    SELECT @@ROWCOUNT as updated;
  `;
  
  console.log('Executing SQL update for clock-out...');
  const result = await request.query(query);
  console.log(`Update completed, rows affected: ${result.recordset[0].updated}`);

  if (result.recordset[0].updated === 0) {
    throw new Error('No open session found');
  }

  return { 
    success: true,
    imageIncluded: hasImage
  };
};

// Clock out (JSON version)
app.post('/api/clock-out', async (req, res) => {
  try {
    await poolConnect;
    const { id, cookie, notes, image } = req.body;

    // Process base64 image if provided
    let imageBuffer = null;
    if (image) {
      try {
        imageBuffer = processBase64Image(image);
        console.log(`Received image for clock-out: ${imageBuffer ? imageBuffer.length : 0} bytes`);
      } catch (imgErr) {
        console.error(`Error processing image: ${imgErr.message}`);
        return res.status(400).json({ error: `Image processing failed: ${imgErr.message}` });
      }
    }

    const result = await performClockOut(id, cookie, notes, imageBuffer);
    res.json(result);
  } catch (err) {
    console.error(`Clock out error: ${err.message}`);
    console.error(err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Clock out (multipart version)
app.post('/api/clock-out-multipart', upload.single('image'), async (req, res) => {
  try {
    await poolConnect;
    
    // Get JSON data from form data
    const jsonData = JSON.parse(req.body.data || '{}');
    const { id, cookie, notes } = jsonData;
    
    // Get image from uploaded file
    let imageBuffer = null;
    if (req.file) {
      imageBuffer = req.file.buffer;
      console.log(`Received multipart image for clock-out: ${imageBuffer.length} bytes`);
    }
    
    const result = await performClockOut(id, cookie, notes, imageBuffer);
    res.json(result);
  } catch (err) {
    console.error(`Multipart clock out error: ${err.message}`);
    console.error(err.stack);
    res.status(500).json({ error: err.message });
  }
});

// Test image upload endpoint (JSON version)
app.post('/api/test-image', async (req, res) => {
  try {
    const { image } = req.body;
    console.log('Test image endpoint called');
    
    if (!image) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }
    
    // Process base64 image
    try {
      const imageBuffer = processBase64Image(image);
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

// Test image upload endpoint (multipart version)
app.post('/api/test-image-multipart', upload.single('image'), async (req, res) => {
  try {
    console.log('Test image multipart endpoint called');
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }
    
    const imageBuffer = req.file.buffer;
    console.log(`Test multipart image processed: ${imageBuffer.length} bytes`);
    
    // Just for testing, we'll echo back some info but not store it
    res.json({ 
      success: true, 
      imageSize: imageBuffer.length,
      message: 'Image successfully processed via multipart'
    });
  } catch (err) {
    console.error(`Test image multipart endpoint error: ${err.message}`);
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