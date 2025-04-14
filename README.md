# TimeClock Web Application

A web-based time clock system for tracking employee work hours. The application verifies employee location and manages clock-in/clock-out sessions, with special handling for subcontractors.

## Features

- Cookie-based user authentication
- Location verification against defined worksites
- New user registration
- Clock in/out with timestamps
- Session tracking
- Note-taking for each clock event
- Worksite detection based on GPS coordinates

## Tech Stack

- **Frontend**: React.js
- **Backend**: Node.js with Express
- **Database**: Microsoft SQL Server on Azure

## Project Structure

```
timeclock-web/
├── frontend/          # React frontend application
│   ├── public/        # Static files
│   ├── src/           # Source code
│   └── package.json   # Dependencies
├── backend/           # Node.js backend server
│   ├── server.js      # Server entry point
│   ├── database.sql   # SQL schema
│   └── package.json   # Dependencies
```

## Deployment Instructions

### Local Development

1. Clone the repository:
   ```
   git clone https://github.com/Arjunreddypulugu/timeclock-web.git
   cd timeclock-web
   ```

2. Start the backend:
   ```
   cd backend
   npm install
   npm start
   ```

3. Start the frontend:
   ```
   cd frontend
   npm install
   npm start
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser

### Production Deployment

#### Azure Deployment

1. Create an Azure Web App
2. Configure Azure SQL Database connection
3. Set up environment variables for database credentials
4. Deploy using Azure CLI or GitHub Actions

## Database Schema

- **LocationCustomerMapping**: Defines geographical boundaries for worksites
- **SubContractorEmployees**: Records employee information by subcontractor
- **TimeClock**: Stores all clock in/out events with location data

## License

MIT

## Author

[Arjun Reddy](https://github.com/Arjunreddypulugu) 