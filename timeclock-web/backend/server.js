require('dotenv').config();
const express = require('express');
const cors = require('cors');
const sql = require('mssql');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const app = express();

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
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
    console.log(`Registration attempt:`, { subContractor, employee, number, cookie }); // Keep minimal log

    if (!subContractor || !employee || !number || !cookie) {
      return res.status(400).json({ error: 'Missing required fields for registration' });
    }

    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      // Step 1: Check/Insert into SubContractorEmployees
      const employeeRequest = new sql.Request(transaction);
      const existingUser = await employeeRequest
        .input('subContractor', sql.NVarChar, subContractor)
        .input('employee', sql.NVarChar, employee)
        .query(`SELECT Employee FROM SubContractorEmployees WHERE SubContractor = @subContractor AND Employee = @employee`);

      if (existingUser.recordset.length === 0) {
        const insertEmployeeRequest = new sql.Request(transaction);
        await insertEmployeeRequest
          .input('subContractor', sql.NVarChar, subContractor)
          .input('employee', sql.NVarChar, employee)
          .input('number', sql.NVarChar, number)
          .query(`INSERT INTO SubContractorEmployees (SubContractor, Employee, Number) VALUES (@subContractor, @employee, @number)`);
      }

      // Step 2: Insert minimal placeholder into TimeClock to link cookie if it doesn't exist
      const cookieCheckRequest = new sql.Request(transaction);
      const existingCookieEntry = await cookieCheckRequest
        .input('cookie', sql.NVarChar, cookie)
        .query(`SELECT TOP 1 ID FROM TimeClock WHERE Cookie = @cookie`);

      if (existingCookieEntry.recordset.length === 0) {
        console.log(`Inserting minimal TimeClock record for cookie ${cookie}`); // Keep minimal log
        const insertTimeClockRequest = new sql.Request(transaction);
        await insertTimeClockRequest
          .input('subContractor', sql.NVarChar, subContractor)
          .input('employee', sql.NVarChar, employee)
          .input('number', sql.NVarChar, number)
          .input('cookie', sql.NVarChar, cookie)
          .query(`INSERT INTO TimeClock (SubContractor, Employee, Number, Cookie, ClockIn) VALUES (@subContractor, @employee, @number, @cookie, NULL)`);
      }

      await transaction.commit();
      res.json({ success: true });

    } catch (err) {
      console.error('Error during registration transaction:', err); // Keep minimal log
      await transaction.rollback();
      res.status(500).json({ error: `Registration failed: ${err.message}` });
    }

  } catch (err) {
    console.error('Error setting up registration:', err); // Keep minimal log
    res.status(500).json({ error: `Registration setup failed: ${err.message}` });
  }
});

// Clock in
app.post('/api/clock-in', async (req, res) => {
  try {
    await poolConnect;
    
    // Log the request but omit the image data
    const { image, ...logData } = req.body;
    const browser = req.headers['x-browser'] || 'Unknown';
    const isMobile = req.headers['x-mobile'] === 'true';
    
    console.log(`Clock-in request received from ${browser}${isMobile ? ' mobile' : ''}:`, logData);
    
    // Validate required fields with detailed logging
    const { subContractor, employee, number, lat, lon, cookie, notes } = req.body;
    
    // Extra detailed debugging for iOS
    if (browser === 'Safari' && isMobile) {
      console.log('iOS Safari request body validation:');
      console.log('- subContractor:', typeof subContractor, subContractor ? 'present' : 'missing');
      console.log('- employee:', typeof employee, employee ? 'present' : 'missing');
      console.log('- number:', typeof number, number ? 'present' : 'missing'); 
      console.log('- lat:', typeof lat, lat ? 'present' : 'missing');
      console.log('- lon:', typeof lon, lon ? 'present' : 'missing');
      console.log('- cookie:', typeof cookie, cookie ? 'present' : 'missing');
      console.log('- image:', typeof image, image ? `${image.substring(0, 30)}...` : 'missing');
      console.log('- Raw body keys:', Object.keys(req.body));
    }
    
    // Special handling for iOS Safari
    if (browser === 'Safari' && isMobile) {
      // For iOS, if we have a cookie and the other values are missing,
      // attempt to retrieve user details from database
      if (cookie && (!subContractor || !employee || !number)) {
        console.log('Attempting to retrieve missing user details for iOS Safari user');
        
        // Get user details
        const userDetails = await pool.request()
          .input('cookie', sql.NVarChar, cookie)
          .query(`
            SELECT TOP 1 SubContractor, Employee, Number
            FROM TimeClock
            WHERE Cookie = @cookie
            ORDER BY ClockIn DESC
          `);
        
        if (userDetails.recordset.length > 0) {
          const userData = userDetails.recordset[0];
          console.log('Retrieved user details:', userData);
          
          // Use user details if missing in request
          req.body.subContractor = subContractor || userData.SubContractor;
          req.body.employee = employee || userData.Employee;
          req.body.number = number || userData.Number;
        }
      }
    }
    
    // Re-check after potential fixes
    const { 
      subContractor: finalSubContractor, 
      employee: finalEmployee, 
      number: finalNumber, 
      lat: finalLat, 
      lon: finalLon, 
      cookie: finalCookie 
    } = req.body;
    
    // Final validation
    if (!finalSubContractor || !finalEmployee || !finalNumber || !finalLat || !finalLon || !finalCookie) {
      console.log('Still missing required fields after fixes:');
      console.log('- subContractor:', finalSubContractor ? 'present' : 'missing');
      console.log('- employee:', finalEmployee ? 'present' : 'missing');
      console.log('- number:', finalNumber ? 'present' : 'missing');
      console.log('- lat:', finalLat ? 'present' : 'missing');
      console.log('- lon:', finalLon ? 'present' : 'missing');
      console.log('- cookie:', finalCookie ? 'present' : 'missing');
      
      return res.status(400).json({ 
        error: 'Missing required fields',
        missing: {
          subContractor: !finalSubContractor,
          employee: !finalEmployee,
          number: !finalNumber,
          lat: !finalLat,
          lon: !finalLon,
          cookie: !finalCookie
        }
      });
    }
    
    // Process base64 image if provided
    let imageBuffer = null;
    if (image) {
      try {
        // Handle different image encodings from different browsers
        let base64Data;
        
        // Handle Safari's unique formatting
        if (browser === 'Safari') {
          console.log('Processing image from Safari browser');
          
          if (image.startsWith('data:image/')) {
            // Split on comma and take the second part
            const parts = image.split(',');
            if (parts.length >= 2) {
              base64Data = parts[1].trim();
            } else {
              return res.status(400).json({ 
                error: 'Invalid image format from Safari. Please try again.' 
              });
            }
          } else {
            // Try to clean the data - Safari sometimes adds whitespace
            base64Data = image.replace(/\s/g, '');
          }
        } else {
          // Standard processing for other browsers
          if (image.startsWith('data:image/')) {
            // Remove data URI prefix (e.g., 'data:image/jpeg;base64,')
            base64Data = image.split(',')[1];
          } else {
            base64Data = image;
          }
        }
        
        // Extra logging for debugging Safari issues
        if (browser === 'Safari') {
          console.log(`Safari image data length: ${base64Data.length}`);
          console.log(`First 20 chars: ${base64Data.substring(0, 20)}...`);
          console.log(`Last 20 chars: ${base64Data.substring(base64Data.length - 20)}...`);
        }
        
        // Verify the base64 string is valid - with extra care for Safari
        const validBase64Regex = /^[A-Za-z0-9+/=]+$/;
        if (!validBase64Regex.test(base64Data)) {
          console.warn(`Invalid base64 characters in image data from ${browser}`);
          
          // For Safari, try to clean the string more aggressively
          if (browser === 'Safari') {
            base64Data = base64Data.replace(/[^A-Za-z0-9+/=]/g, '');
            
            // Check again after cleaning
            if (!validBase64Regex.test(base64Data)) {
              return res.status(400).json({ 
                error: 'The image data contains invalid characters. Please retake the photo.' 
              });
            }
            console.log('Successfully cleaned Safari image data');
          } else {
            return res.status(400).json({ 
              error: 'The image data contains invalid characters' 
            });
          }
        }
        
        // Create buffer from base64
        imageBuffer = Buffer.from(base64Data, 'base64');
        console.log(`Received image for clock-in: ${imageBuffer.length} bytes from ${browser}`);
        
        // Validate image data size
        if (imageBuffer.length < 100) {
          console.warn(`Image data too small (${imageBuffer.length} bytes), likely invalid`);
          return res.status(400).json({ 
            error: 'The provided image appears to be invalid or too small. Please retake the photo.' 
          });
        }
      } catch (imgErr) {
        console.error(`Error processing clock-in image from ${browser}: ${imgErr.message}`);
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

    // Send response with browser info for debugging
    const response = { 
      id: result.recordset[0].id, 
      customer_name: validLocation.recordset[0].customer_name,
      imageIncluded: !!(imageBuffer && imageBuffer.length > 0),
      browser,
      isMobile
    };
    
    console.log(`Sending successful response to ${browser}:`, response);
    res.json(response);
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

// Special endpoints for multipart form data (iOS Safari)
app.post('/api/clock-in-multipart', upload.single('image'), async (req, res) => {
  try {
    await poolConnect;
    // Keep minimal logs
    console.log('Received multipart clock-in request from:', req.body.browserInfo, req.body.isMobile ? '(Mobile)' : '(Desktop)');
    
    // Extract data from form fields (req.body)
    const { subContractor, employee, number, lat, lon, cookie, notes } = req.body;

    // Basic validation
    if (!subContractor || !employee || !number || !lat || !lon || !cookie) {
      console.error('Multipart clock-in missing required fields');
      return res.status(400).json({ error: 'Missing required fields in multipart request' });
    }

    // Process image
    let imageBuffer = null;
    if (req.file) {
      imageBuffer = req.file.buffer;
    } else if (req.body.imageData) {
      try {
        const base64Data = req.body.imageData.replace(/^data:image\/\w+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
      } catch (imgErr) {
        console.error(`Multipart image processing error: ${imgErr.message}`);
        return res.status(400).json({ error: `Image processing error: ${imgErr.message}` });
      }
    }
    // Basic image size validation
    if (imageBuffer && imageBuffer.length < 100) {
      return res.status(400).json({ error: 'The provided image appears to be invalid or too small.' });
    }

    // Verify worksite location
    const validLocation = await pool.request()
      .input('lat', sql.Float, parseFloat(lat))
      .input('lon', sql.Float, parseFloat(lon))
      .query(`SELECT TOP 1 customer_name FROM LocationCustomerMapping WHERE @lat BETWEEN min_latitude AND max_latitude AND (@lon BETWEEN min_longitude AND max_longitude OR @lon BETWEEN max_longitude AND min_longitude)`);
    
    if (validLocation.recordset.length === 0) {
      return res.status(400).json({ error: 'Invalid worksite location. Cannot clock in.' });
    }

    // Check for open session
    const openSession = await pool.request()
      .input('cookie', sql.NVarChar, cookie)
      .query(`SELECT TOP 1 ID FROM TimeClock WHERE Cookie = @cookie AND ClockOut IS NULL`);

    if (openSession.recordset.length > 0) {
      return res.status(400).json({ error: 'You already have an open session' });
    }

    // Prepare SQL request
    const request = pool.request()
      .input('subContractor', sql.NVarChar, subContractor)
      .input('employee', sql.NVarChar, employee)
      .input('number', sql.NVarChar, number)
      .input('lat', sql.Float, parseFloat(lat))
      .input('lon', sql.Float, parseFloat(lon))
      .input('cookie', sql.NVarChar, cookie)
      .input('notes', sql.NVarChar(sql.MAX), notes || '');
    
    if (imageBuffer) {
      request.input('image', sql.VarBinary(sql.MAX), imageBuffer);
    }
    
    // Build query
    let query = `
      INSERT INTO TimeClock (SubContractor, Employee, Number, ClockIn, Lat, Lon, Cookie, ClockInNotes${imageBuffer ? ', ClockInImage' : ''})
      VALUES (@subContractor, @employee, @number, GETDATE(), @lat, @lon, @cookie, @notes${imageBuffer ? ', @image' : ''});
      SELECT SCOPE_IDENTITY() as id;
    `;
    
    // Execute query
    const result = await request.query(query);
    const newId = result.recordset[0].id;
      
    // Respond
    res.json({
      id: newId,
      customer_name: validLocation.recordset[0].customer_name,
      imageIncluded: !!imageBuffer,
      browser: req.body.browserInfo,
      isMobile: req.body.isMobile === 'true'
    });

  } catch (error) {
    console.error('Error in /api/clock-in-multipart:', error); // Keep minimal log
    res.status(500).json({ error: `Server error during multipart clock-in: ${error.message}` });
  }
});

app.post('/api/clock-out-multipart', upload.single('image'), async (req, res) => {
  try {
    console.log('Received multipart clock-out request');
    
    // Extract data from form fields
    const { cookie, notes } = req.body;
    
    // Get image data from either the file or the imageData field
    let imageBuffer = null;
    if (req.file) {
      // If file was uploaded as binary
      console.log('Image received as binary file');
      imageBuffer = req.file.buffer;
    } else if (req.body.imageData) {
      // If image was sent as base64 string
      console.log('Image received as base64 string');
      let base64Data = req.body.imageData;
      if (base64Data.startsWith('data:image/')) {
        base64Data = base64Data.split(',')[1];
      }
      imageBuffer = Buffer.from(base64Data, 'base64');
    }
    
    // Create a clock-out record in the same way as the JSON endpoint
    const pool = await sql.connect(dbConfig);
    
    // Check for existing user
    const userCheck = await pool.request()
      .input('cookie', sql.NVarChar, cookie)
      .query('SELECT * FROM TimeClock WHERE Cookie = @cookie');
      
    if (userCheck.recordset.length === 0) {
      console.log('User not found in clock-out-multipart');
      return res.status(404).json({ error: 'User not found' });
    }
    
    const userId = userCheck.recordset[0].ID;
    
    // Find the latest clock-in record without a clock-out
    const latestRecord = await pool.request()
      .input('userId', sql.Int, userId)
      .query(`
        SELECT TOP 1 * FROM TimeClock
        WHERE ID = @userId AND ClockOut IS NULL
        ORDER BY ClockIn DESC
      `);
      
    if (latestRecord.recordset.length === 0) {
      return res.status(400).json({ error: 'No active clock-in found' });
    }
    
    const recordId = latestRecord.recordset[0].ID;
    
    // Update the record with clock-out information
    await pool.request()
      .input('recordId', sql.Int, recordId)
      .input('clockOutImage', sql.VarBinary(sql.MAX), imageBuffer)
      .input('notes', sql.NVarChar, notes || null)
      .query(`
        UPDATE TimeClock
        SET ClockOut = GETDATE(), ClockOutImage = @clockOutImage, ClockOutNotes = @notes
        WHERE ID = @recordId
      `);
      
    return res.json({ success: true, message: 'Clock out successful' });
  } catch (error) {
    console.error('Error in clock-out-multipart:', error);
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 