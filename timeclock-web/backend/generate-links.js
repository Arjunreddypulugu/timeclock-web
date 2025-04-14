// Script to generate subcontractor links
const sql = require('mssql');
const config = require('./db-config');

async function generateLinks() {
  try {
    console.log('Connecting to database...');
    const pool = await sql.connect(config);
    
    console.log('Getting all subcontractors...');
    // Get all subcontractors from the database
    const subcontractors = await pool.request().query(`
      SELECT DISTINCT SubContractor 
      FROM SubContractorEmployees
      ORDER BY SubContractor
    `);
    
    const baseURL = 'https://timeclock-frontend-8d5n.onrender.com?sc=';
    let createdCount = 0;
    let updatedCount = 0;
    
    console.log(`Found ${subcontractors.recordset.length} subcontractors.`);
    
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
        createdCount++;
        console.log(`Created link for: ${subcontractor}`);
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
        updatedCount++;
        console.log(`Updated link for: ${subcontractor}`);
      }
      
      console.log(`${subcontractor}: ${fullLink}`);
    }
    
    console.log(`Finished! ${createdCount} links created, ${updatedCount} links updated.`);
    
    // Close the connection
    await sql.close();
    console.log('Connection closed.');
    
  } catch (err) {
    console.error(`Error: ${err.message}`);
    
    // Ensure SQL connection is closed
    try {
      await sql.close();
    } catch (closeErr) {
      console.error('Error closing SQL connection:', closeErr.message);
    }
  }
}

// Run the function
generateLinks(); 