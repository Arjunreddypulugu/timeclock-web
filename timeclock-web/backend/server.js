require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();

// Configure multer for file uploads with higher size limits for iOS compatibility
const storage = multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB limit to accommodate iOS images
});

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' })); // Increased limit for JSON to handle iOS
app.use(cookieParser());
app.use(express.urlencoded({ extended: true, limit: '15mb' })); // For URL-encoded data from forms

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

// Enhanced image validation function with iOS support
function validateAndSanitizeBase64Image(imageData) {
  if (!imageData) {
    console.log("No image data provided");
    return { valid: false, sanitized: null, message: "No image data provided" };
  }

  console.log(`Validating image data (length: ${imageData.length})`);
  
  try {
    // Check if it has the proper prefix
    if (!imageData.startsWith('data:image/')) {
      console.log("Image data doesn't have valid prefix");
      return { valid: false, sanitized: null, message: "Invalid image format" };
    }

    // Split the string to get the base64 part
    const parts = imageData.split(',');
    if (parts.length !== 2) {
      console.log("Image data doesn't have expected format (comma separated parts)");
      return { valid: false, sanitized: null, message: "Invalid image format structure" };
    }

    const prefix = parts[0];
    let base64Data = parts[1];
    
    // Check for valid base64 characters
    const validBase64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
    const isValidBase64 = validBase64Regex.test(base64Data);

    if (!isValidBase64) {
      console.log("Image data contains invalid base64 characters, attempting sanitization");
      
      // Try to sanitize by removing invalid characters
      const sanitizedBase64 = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
      
      // Ensure proper padding
      let paddedBase64 = sanitizedBase64;
      while (paddedBase64.length % 4 !== 0) {
        paddedBase64 += '=';
      }
      
      // Reconstruct the data URL
      const sanitizedImageData = `${prefix},${paddedBase64}`;
      
      console.log("Image data sanitized, new length:", sanitizedImageData.length);
      return { 
        valid: true, 
        sanitized: sanitizedImageData,
        message: "Image was sanitized",
        wasFixed: true
      };
    }

    return { valid: true, sanitized: imageData, message: "Valid image data" };
  } catch (error) {
    console.error("Error during image validation:", error);
    return { valid: false, sanitized: null, message: `Validation error: ${error.message}` };
  }
}

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
    try {
      // Process the image buffer further for iOS compatibility
      // This can include resizing or compressing if needed
      request.input('image', sql.VarBinary(sql.MAX), imageBuffer);
      hasImage = true;
      console.log(`Adding image to SQL query, size: ${imageBuffer.length} bytes`);
    } catch (imgErr) {
      console.error(`Error processing image for SQL: ${imgErr.message}`);
      // Continue without the image if there's an error
    }
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

// Handle clock in
app.post('/api/clock-in', (req, res) => {
  console.log('Clock in request received');
  
  try {
    const { latitude, longitude, customerName, userId, imageData, subContractor } = req.body;
    
    if (!customerName || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Get current date/time
    const clockInTime = new Date().toISOString();
    
    // SQL query to insert clock in data
    const query = `
      INSERT INTO TimeRecords (userId, customer_name, clock_in_time, clock_in_latitude, clock_in_longitude, clock_in_image, subcontractor)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    // Handle possible missing image data
    let imageBinary = null;
    if (imageData) {
      try {
        // Extract the base64 data part (remove data:image/jpeg;base64, prefix if present)
        const base64Data = imageData.split(';base64,').pop();
        imageBinary = Buffer.from(base64Data, 'base64');
        console.log(`Processed image of size: ${imageBinary.length} bytes`);
      } catch (imgError) {
        console.error('Error processing image:', imgError.message);
        // Continue without image rather than failing
        imageBinary = null;
      }
    }
    
    // Execute the query
    db.run(query, [userId, customerName, clockInTime, latitude, longitude, imageBinary, subContractor], function(err) {
      if (err) {
        console.error('Database error on clock-in:', err.message);
        return res.status(500).json({ error: `Database error: ${err.message}` });
      }
      
      console.log(`Clock in recorded with ID: ${this.lastID}`);
      res.json({ 
        success: true, 
        recordId: this.lastID,
        message: 'Clock in successful'
      });
    });
  } catch (error) {
    console.error('Error in clock-in endpoint:', error);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

// Handle clock out
app.post('/api/clock-out/:recordId', (req, res) => {
  console.log('Clock out request received');
  
  try {
    const { recordId } = req.params;
    const { imageData } = req.body;
    
    if (!recordId) {
      return res.status(400).json({ error: 'Missing record ID' });
    }
    
    // Get current date/time
    const clockOutTime = new Date().toISOString();
    
    // Handle possible missing image data
    let imageBinary = null;
    if (imageData) {
      try {
        // Extract the base64 data part (remove data:image/jpeg;base64, prefix if present)
        const base64Data = imageData.split(';base64,').pop();
        imageBinary = Buffer.from(base64Data, 'base64');
        console.log(`Processed image of size: ${imageBinary.length} bytes`);
      } catch (imgError) {
        console.error('Error processing image:', imgError.message);
        // Continue without image rather than failing
        imageBinary = null;
      }
    }
    
    // Check if record exists
    db.get('SELECT * FROM TimeRecords WHERE id = ?', [recordId], (err, row) => {
      if (err) {
        console.error('Database error checking record:', err.message);
        return res.status(500).json({ error: `Database error: ${err.message}` });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Record not found' });
      }
      
      if (row.clock_out_time) {
        return res.status(400).json({ error: 'Already clocked out for this record' });
      }
      
      // Update record with clock out data
      const query = `
        UPDATE TimeRecords 
        SET clock_out_time = ?, clock_out_image = ?
        WHERE id = ?
      `;
      
      db.run(query, [clockOutTime, imageBinary, recordId], function(err) {
        if (err) {
          console.error('Database error on clock-out:', err.message);
          return res.status(500).json({ error: `Database error: ${err.message}` });
        }
        
        console.log(`Clock out recorded for record ID: ${recordId}`);
        res.json({ 
          success: true, 
          message: 'Clock out successful'
        });
      });
    });
  } catch (error) {
    console.error('Error in clock-out endpoint:', error);
    res.status(500).json({ error: `Server error: ${error.message}` });
  }
});

// Clock in (multipart version)
app.post('/api/clock-in-multipart', upload.single('image'), async (req, res) => {
  try {
    await poolConnect;
    
    console.log('Received multipart clock-in request');
    console.log('Request form fields:', Object.keys(req.body));
    
    let jsonData;
    try {
      // Parse the JSON data from the form
      jsonData = JSON.parse(req.body.data || '{}');
      console.log('Parsed JSON data from form, keys:', Object.keys(jsonData));
    } catch (jsonErr) {
      console.error('Error parsing JSON data from multipart form:', jsonErr);
      return res.status(400).json({ error: 'Invalid JSON data in request' });
    }
    
    const { subContractor, employee, number, lat, lon, cookie, notes } = jsonData;
    
    // Get image from uploaded file
    let imageBuffer = null;
    if (req.file) {
      imageBuffer = req.file.buffer;
      console.log(`Received multipart image for clock-in: ${imageBuffer.length} bytes, mimetype: ${req.file.mimetype}`);
    }
    
    // Validate and sanitize the image data
    let processedImageData = imageBuffer;
    if (imageBuffer) {
      processedImageData = validateAndSanitizeBase64Image(imageBuffer.toString('base64'));
      if (!processedImageData) {
        console.log('Image validation failed, proceeding without image');
        // Continue without image rather than failing the whole request
        processedImageData = null;
      }
    }
    
    const result = await performClockIn(
      subContractor, employee, number, lat, lon, cookie, notes, processedImageData
    );
    
    console.log('Sending multipart clock-in response:', result);
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
  if (!cookie) {
    throw new Error('Missing cookie for clock-out');
  }

  // Create the request object
  const request = pool.request()
    .input('cookie', sql.NVarChar, cookie)
    .input('notes', sql.NVarChar(sql.MAX), notes || '');
  
  // Only add image if it's valid
  let hasImage = false;
  if (imageBuffer && imageBuffer.length > 0) {
    try {
      // Process the image buffer further for iOS compatibility if needed
      request.input('image', sql.VarBinary(sql.MAX), imageBuffer);
      hasImage = true;
      console.log(`Adding image to SQL query, size: ${imageBuffer.length} bytes`);
    } catch (imgErr) {
      console.error(`Error processing image for SQL: ${imgErr.message}`);
      // Continue without the image if there's an error
    }
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
    
    console.log('Received JSON clock-out request');
    console.log('Request body keys:', Object.keys(req.body));
    
    const { id, cookie, notes, image } = req.body;

    // Validate and sanitize the image data
    let processedImageData = image;
    if (image) {
      processedImageData = validateAndSanitizeBase64Image(image);
      if (!processedImageData) {
        console.log('Clock-out image validation failed, proceeding without image');
        // Continue without image rather than failing the whole request
        processedImageData = null;
      }
    }

    const result = await performClockOut(id, cookie, notes, processedImageData);
    
    console.log('Sending clock-out response:', result);
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
    
    console.log('Received multipart clock-out request');
    console.log('Request form fields:', Object.keys(req.body));
    
    let jsonData;
    try {
      // Parse the JSON data from the form
      jsonData = JSON.parse(req.body.data || '{}');
      console.log('Parsed JSON data from form, keys:', Object.keys(jsonData));
    } catch (jsonErr) {
      console.error('Error parsing JSON data from multipart form:', jsonErr);
      return res.status(400).json({ error: 'Invalid JSON data in request' });
    }
    
    const { id, cookie, notes } = jsonData;
    
    // Get image from uploaded file
    let imageBuffer = null;
    if (req.file) {
      imageBuffer = req.file.buffer;
      console.log(`Received multipart image for clock-out: ${imageBuffer.length} bytes, mimetype: ${req.file.mimetype}`);
    }
    
    // Validate and sanitize the image data
    let processedImageData = imageBuffer;
    if (imageBuffer) {
      processedImageData = validateAndSanitizeBase64Image(imageBuffer.toString('base64'));
      if (!processedImageData) {
        console.log('Image validation failed, proceeding without image');
        // Continue without image rather than failing the whole request
        processedImageData = null;
      }
    }
    
    const result = await performClockOut(id, cookie, notes, processedImageData);
    
    console.log('Sending multipart clock-out response:', result);
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
    console.log('Test image endpoint called (JSON)');
    const { image } = req.body;
    
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
        message: 'Image successfully processed',
        mode: 'json'
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
    console.log('Test image upload received');
    
    // Debug the request body and file
    const fileInfo = req.file ? {
      fieldname: req.file.fieldname,
      originalname: req.file.originalname,
      encoding: req.file.encoding,
      mimetype: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer ? `Buffer (${req.file.buffer.length} bytes)` : 'No buffer'
    } : 'No file received';
    
    // Debug the data part
    let jsonData = null;
    try {
      if (req.body && req.body.data) {
        jsonData = JSON.parse(req.body.data);
      }
    } catch (err) {
      console.error('Error parsing JSON data:', err);
    }
    
    const response = {
      success: true,
      message: 'Test upload completed',
      file: fileInfo,
      bodyData: jsonData || req.body,
      headers: req.headers,
      contentType: req.headers['content-type']
    };

    console.log('Test response:', JSON.stringify(response, null, 2));
    
    return res.json(response);
  } catch (error) {
    console.error('Error in test image upload:', error);
    return res.status(500).json({
      success: false,
      message: `Error processing test image: ${error.message}`,
      stack: process.env.NODE_ENV === 'production' ? null : error.stack
    });
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

// Add iOS-specific simplified endpoints
app.post('/api/clock-in-simple', async (req, res) => {
  console.log('iOS simplified clock-in endpoint hit', req.query);
  
  try {
    // Extract data from URL parameters instead of JSON body
    const { cookie, lat, lon, customerName, time } = req.query;
    
    if (!cookie) {
      return res.status(400).json({ error: 'Cookie is required' });
    }
    
    // Get the employee ID from the cookie
    const employee = await pool.request()
      .input('cookie', sql.NVarChar, cookie)
      .query(`
        SELECT ID FROM TimeClock
        WHERE Cookie = @cookie
      `);
    
    if (!employee.recordset || employee.recordset.length === 0) {
      return res.status(400).json({ error: 'Invalid cookie' });
    }
    
    const employeeId = employee.recordset[0].ID;
    const currentTime = time || new Date().toISOString();
    
    // For simplified endpoint, we don't require image
    const result = await pool.request()
      .input('employeeId', sql.Int, employeeId)
      .input('clockInTime', sql.DateTime, new Date(currentTime))
      .input('customerName', sql.NVarChar, customerName || null)
      .input('latitude', sql.Float, lat ? parseFloat(lat) : null)
      .input('longitude', sql.Float, lon ? parseFloat(lon) : null)
      .query(`
        INSERT INTO TimeEntries (EmployeeID, ClockInTime, CustomerName, Latitude, Longitude)
        VALUES (@employeeId, @clockInTime, @customerName, @latitude, @longitude);
        SELECT SCOPE_IDENTITY() AS id;
      `);
    
    console.log('iOS simplified clock-in success', result);
    
    return res.json({
      success: true,
      message: 'Clock-in successful (iOS simplified)',
      recordId: result.recordset[0].id
    });
  } catch (error) {
    console.error('iOS simplified clock-in error:', error);
    return res.status(500).json({ 
      error: 'Error processing clock-in', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.post('/api/clock-out-simple', async (req, res) => {
  console.log('iOS simplified clock-out endpoint hit', req.query);
  
  try {
    // Extract data from URL parameters instead of JSON body
    const { cookie, lat, lon, time } = req.query;
    
    if (!cookie) {
      return res.status(400).json({ error: 'Cookie is required' });
    }
    
    // Get the employee ID from the cookie
    const employee = await pool.request()
      .input('cookie', sql.NVarChar, cookie)
      .query(`
        SELECT ID FROM TimeClock
        WHERE Cookie = @cookie
      `);
    
    if (!employee.recordset || employee.recordset.length === 0) {
      return res.status(400).json({ error: 'Invalid cookie' });
    }
    
    const employeeId = employee.recordset[0].ID;
    const currentTime = time || new Date().toISOString();
    
    // Find the most recent clock-in entry without a clock-out
    const openEntries = await pool.request()
      .input('employeeId', sql.Int, employeeId)
      .query(`
        SELECT TOP 1 ID 
        FROM TimeEntries
        WHERE EmployeeID = @employeeId 
        AND ClockInTime IS NOT NULL 
        AND ClockOutTime IS NULL
        ORDER BY ClockInTime DESC
      `);
    
    if (!openEntries.recordset || openEntries.recordset.length === 0) {
      return res.status(400).json({ error: 'No open clock-in found' });
    }
    
    const entryId = openEntries.recordset[0].ID;
    
    // For simplified endpoint, we don't require image
    await pool.request()
      .input('clockOutTime', sql.DateTime, new Date(currentTime))
      .input('latitude', sql.Float, lat ? parseFloat(lat) : null)
      .input('longitude', sql.Float, lon ? parseFloat(lon) : null)
      .input('entryId', sql.Int, entryId)
      .query(`
        UPDATE TimeEntries 
        SET ClockOutTime = @clockOutTime, 
            ClockOutLatitude = @latitude, 
            ClockOutLongitude = @longitude
        WHERE ID = @entryId
      `);
    
    console.log('iOS simplified clock-out success for entry ID:', entryId);
    
    return res.json({
      success: true,
      message: 'Clock-out successful (iOS simplified)',
      recordId: entryId
    });
  } catch (error) {
    console.error('iOS simplified clock-out error:', error);
    return res.status(500).json({ 
      error: 'Error processing clock-out', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Multipart form endpoints for image uploads
app.post('/api/clock-in-multipart', upload.single('image'), async (req, res) => {
  console.log('Clock-in multipart endpoint hit');
  
  try {
    let jsonData;
    
    // Parse JSON data from the form
    if (req.body && req.body.data) {
      try {
        jsonData = JSON.parse(req.body.data);
        console.log('Successfully parsed JSON data from multipart form');
      } catch (jsonError) {
        console.error('Error parsing JSON from multipart form:', jsonError);
        return res.status(400).json({ error: 'Invalid JSON data in multipart form' });
      }
    } else {
      console.error('No JSON data found in multipart request');
      return res.status(400).json({ error: 'Missing JSON data in multipart form' });
    }
    
    const { cookie, lat, lon, customerName, time } = jsonData;
    
    if (!cookie) {
      return res.status(400).json({ error: 'Cookie is required' });
    }
    
    // Get the employee ID from the cookie
    const employee = await pool.request()
      .input('cookie', sql.NVarChar, cookie)
      .query(`
        SELECT ID FROM TimeClock
        WHERE Cookie = @cookie
      `);
    
    if (!employee.recordset || employee.recordset.length === 0) {
      return res.status(400).json({ error: 'Invalid cookie' });
    }
    
    const employeeId = employee.recordset[0].ID;
    const currentTime = time || new Date().toISOString();
    
    // Process the uploaded image if available
    let imageData = null;
    
    if (req.file) {
      console.log('Image file received in multipart form, size:', req.file.size);
      imageData = req.file.buffer.toString('base64');
    } else {
      console.log('No image file in multipart request');
    }
    
    const result = await pool.request()
      .input('employeeId', sql.Int, employeeId)
      .input('clockInTime', sql.DateTime, new Date(currentTime))
      .input('customerName', sql.NVarChar, customerName || null)
      .input('latitude', sql.Float, lat ? parseFloat(lat) : null)
      .input('longitude', sql.Float, lon ? parseFloat(lon) : null)
      .input('clockInImage', sql.NVarChar(sql.MAX), imageData)
      .query(`
        INSERT INTO TimeEntries (EmployeeID, ClockInTime, CustomerName, Latitude, Longitude, ClockInImage)
        VALUES (@employeeId, @clockInTime, @customerName, @latitude, @longitude, @clockInImage);
        SELECT SCOPE_IDENTITY() AS id;
      `);
    
    console.log('Clock-in multipart success', result);
    
    return res.json({
      success: true,
      message: 'Clock-in successful (multipart)',
      recordId: result.recordset[0].id
    });
  } catch (error) {
    console.error('Clock-in multipart error:', error);
    return res.status(500).json({ 
      error: 'Error processing clock-in', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.post('/api/clock-out-multipart', upload.single('image'), async (req, res) => {
  console.log('Clock-out multipart endpoint hit');
  
  try {
    let jsonData;
    
    // Parse JSON data from the form
    if (req.body && req.body.data) {
      try {
        jsonData = JSON.parse(req.body.data);
        console.log('Successfully parsed JSON data from multipart form');
      } catch (jsonError) {
        console.error('Error parsing JSON from multipart form:', jsonError);
        return res.status(400).json({ error: 'Invalid JSON data in multipart form' });
      }
    } else {
      console.error('No JSON data found in multipart request');
      return res.status(400).json({ error: 'Missing JSON data in multipart form' });
    }
    
    const { cookie, lat, lon, time } = jsonData;
    
    if (!cookie) {
      return res.status(400).json({ error: 'Cookie is required' });
    }
    
    // Get the employee ID from the cookie
    const employee = await pool.request()
      .input('cookie', sql.NVarChar, cookie)
      .query(`
        SELECT ID FROM TimeClock
        WHERE Cookie = @cookie
      `);
    
    if (!employee.recordset || employee.recordset.length === 0) {
      return res.status(400).json({ error: 'Invalid cookie' });
    }
    
    const employeeId = employee.recordset[0].ID;
    
    // Find the most recent clock-in entry without a clock-out
    const openEntries = await pool.request()
      .input('employeeId', sql.Int, employeeId)
      .query(`
        SELECT TOP 1 ID 
        FROM TimeEntries
        WHERE EmployeeID = @employeeId 
        AND ClockInTime IS NOT NULL 
        AND ClockOutTime IS NULL
        ORDER BY ClockInTime DESC
      `);
    
    if (!openEntries.recordset || openEntries.recordset.length === 0) {
      return res.status(400).json({ error: 'No open clock-in found' });
    }
    
    const entryId = openEntries.recordset[0].ID;
    const currentTime = time || new Date().toISOString();
    
    // Process the uploaded image if available
    let imageData = null;
    
    if (req.file) {
      console.log('Image file received in multipart form, size:', req.file.size);
      imageData = req.file.buffer.toString('base64');
    } else {
      console.log('No image file in multipart request');
    }
    
    await pool.request()
      .input('clockOutTime', sql.DateTime, new Date(currentTime))
      .input('latitude', sql.Float, lat ? parseFloat(lat) : null)
      .input('longitude', sql.Float, lon ? parseFloat(lon) : null)
      .input('clockOutImage', sql.NVarChar(sql.MAX), imageData)
      .input('entryId', sql.Int, entryId)
      .query(`
        UPDATE TimeEntries 
        SET ClockOutTime = @clockOutTime, 
            ClockOutLatitude = @latitude, 
            ClockOutLongitude = @longitude, 
            ClockOutImage = @clockOutImage
        WHERE ID = @entryId
      `);
    
    console.log('Clock-out multipart success for entry ID:', entryId);
    
    return res.json({
      success: true,
      message: 'Clock-out successful (multipart)',
      recordId: entryId
    });
  } catch (error) {
    console.error('Clock-out multipart error:', error);
    return res.status(500).json({ 
      error: 'Error processing clock-out', 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined  
    });
  }
});

// Test endpoint for iOS image uploads
app.get('/api/test-image-simple', (req, res) => {
  console.log('iOS simple test image endpoint hit');
  res.json({ 
    success: true,
    message: 'iOS test image endpoint works',
    query: req.query
  });
});

app.post('/api/test-image-multipart', upload.single('image'), (req, res) => {
  console.log('Test image multipart endpoint hit');
  
  try {
    if (req.file) {
      console.log('Image received in multipart test, size:', req.file.size);
      const imageSize = req.file.size;
      const imageSample = req.file.buffer.toString('base64').substring(0, 50) + '...';
      
      res.json({
        success: true,
        message: 'Image uploaded successfully via multipart',
        size: imageSize,
        sample: imageSample
      });
    } else {
      console.log('No image in multipart test request');
      res.json({
        success: false,
        message: 'No image found in multipart request'
      });
    }
  } catch (error) {
    console.error('Test image multipart error:', error);
    res.status(500).json({
      error: 'Error processing test image',
      message: error.message
    });
  }
});

// Image retrieval endpoint
app.get('/api/get-image/:recordId/:imageType', async (req, res) => {
  const recordId = req.params.recordId;
  const imageType = req.params.imageType;
  
  if (!recordId || !['clock-in', 'clock-out'].includes(imageType)) {
    return res.status(400).json({ error: 'Invalid parameters' });
  }
  
  try {
    // Determine which column to query based on imageType
    const columnName = imageType === 'clock-in' ? 'ClockInImageData' : 'ClockOutImageData';
    
    // Query the database
    const query = `SELECT ${columnName} FROM Records WHERE ID = @recordId`;
    const result = await pool.request()
      .input('recordId', sql.Int, recordId)
      .query(query);
    
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }
    
    const imageData = result.recordset[0][columnName];
    
    if (!imageData) {
      return res.status(404).json({ error: `No ${imageType} image found for this record` });
    }
    
    // Extract the data from the base64 string (remove the "data:image/jpeg;base64," part)
    const base64Data = imageData.includes('base64,') 
      ? imageData.split('base64,')[1] 
      : imageData;
    
    // Convert base64 to buffer
    const imageBuffer = Buffer.from(base64Data, 'base64');
    
    // Set the content type and send the image
    res.set('Content-Type', 'image/jpeg');
    res.send(imageBuffer);
  } catch (err) {
    console.error('Error retrieving image:', err);
    res.status(500).json({ error: 'Failed to retrieve image', details: err.message });
  }
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Express error handler caught:', err);
  
  // Handle multer errors specifically
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: 'The uploaded image exceeds the size limit (15MB)'
      });
    }
    
    return res.status(400).json({
      error: 'File upload error',
      message: err.message
    });
  }
  
  // Handle other errors
  res.status(500).json({
    error: 'Server error',
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 