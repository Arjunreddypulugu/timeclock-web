import React, { useState, useEffect } from 'react';
import { User, TimeEntry, Location } from './types';
import './App.css';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [location, setLocation] = useState<Location | null>(null);
  const [currentTimeEntry, setCurrentTimeEntry] = useState<TimeEntry | null>(null);
  const [subcontractor, setSubcontractor] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // Check for existing user session
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
  }, []);

  const handleLocationRequest = async () => {
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });
      
      setLocation({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude
      });
    } catch (error) {
      console.error('Error getting location:', error);
    }
  };

  const handleClockIn = async () => {
    if (!user || !location) return;
    
    setIsLoading(true);
    try {
      // API call to clock in
      const response = await fetch('/api/clock-in', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          latitude: location.latitude,
          longitude: location.longitude,
          subcontractor
        }),
      });
      
      const data = await response.json();
      setCurrentTimeEntry(data);
    } catch (error) {
      console.error('Error clocking in:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClockOut = async () => {
    if (!currentTimeEntry) return;
    
    setIsLoading(true);
    try {
      // API call to clock out
      await fetch('/api/clock-out', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          timeEntryId: currentTimeEntry.id
        }),
      });
      
      setCurrentTimeEntry(null);
    } catch (error) {
      console.error('Error clocking out:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Timeclock</h1>
      </header>

      <main className="app-main">
        {!user ? (
          <div className="auth-section">
            <h2>Welcome</h2>
            <input
              type="text"
              placeholder="Enter subcontractor name"
              value={subcontractor}
              onChange={(e) => setSubcontractor(e.target.value)}
            />
            <button onClick={handleLocationRequest}>
              Share Location
            </button>
          </div>
        ) : (
          <div className="time-clock-section">
            <div className="user-info">
              <h2>Welcome, {user.name}</h2>
              <p>Subcontractor: {user.subcontractor}</p>
            </div>

            {location && (
              <div className="location-info">
                <p>Location: {location.latitude}, {location.longitude}</p>
              </div>
            )}

            <div className="clock-actions">
              {currentTimeEntry ? (
                <button 
                  onClick={handleClockOut}
                  disabled={isLoading}
                >
                  {isLoading ? 'Processing...' : 'Clock Out'}
                </button>
              ) : (
                <button 
                  onClick={handleClockIn}
                  disabled={!location || isLoading}
                >
                  {isLoading ? 'Processing...' : 'Clock In'}
                </button>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App; 