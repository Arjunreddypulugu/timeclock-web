require('dotenv').config();

// Database configuration
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: true, // For Azure SQL
    trustServerCertificate: true // Change to false in production
  }
};

module.exports = config; 