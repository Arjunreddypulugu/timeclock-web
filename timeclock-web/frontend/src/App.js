import React, { useState, useEffect } from 'react';
import './App.css';
import './components/Camera.css';
import Camera from './components/Camera';
import { verifyLocation, getUserStatus, registerUser, clockIn, clockOut } from './services/api';

function App() {
  const [cookieId, setCookieId] = useState('');
  const [isNewUser, setIsNewUser] = useState(true);
  const [hasOpenSession, setHasOpenSession] = useState(false);
  const [openSession, setOpenSession] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [location, setLocation] = useState({ lat: null, lon: null });
  const [worksite, setWorksite] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  // Registration form state
  const [subContractor, setSubContractor] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Clock in/out state
  const [notes, setNotes] = useState('');
  
  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [cameraAction, setCameraAction] = useState(null); // 'clockIn' or 'clockOut'

  useEffect(() => {
    // Generate cookie ID if not exists
    const storedCookieId = localStorage.getItem('timeclockCookieId');
    if (storedCookieId) {
      setCookieId(storedCookieId);
      checkUserStatus(storedCookieId);
    } else {
      const newCookieId = 'tc-' + Date.now();
      localStorage.setItem('timeclockCookieId', newCookieId);
      setCookieId(newCookieId);
      setIsNewUser(true);
    }
  }, []);

  const checkUserStatus = async (id) => {
    try {
      setLoading(true);
      const response = await getUserStatus(id);
      setIsNewUser(response.isNewUser);
      setHasOpenSession(response.hasOpenSession);
      setOpenSession(response.openSession);
      setUserDetails(response.userDetails);
    } catch (err) {
      setError('Error checking user status: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleShareLocation = () => {
    setError('');
    if (navigator.geolocation) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            setLocation({ lat, lon });
            
            // Verify location with backend
            const response = await verifyLocation(lat, lon);
            setWorksite(response.customer_name || 'Unknown location');
            setLoading(false);
          } catch (err) {
            setError('Location verification failed: ' + err.message);
            setLoading(false);
          }
        },
        (err) => {
          setError('Geolocation error: ' + err.message);
          setLoading(false);
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    } else {
      setError('Geolocation is not supported by this browser');
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    
    if (!subContractor || !employeeName || !phoneNumber) {
      setError('Please fill in all fields');
      return;
    }
    
    try {
      setLoading(true);
      await registerUser({
        subContractor,
        employee: employeeName,
        number: phoneNumber,
        cookie: cookieId
      });
      checkUserStatus(cookieId);
    } catch (err) {
      setError('Registration failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCapturePhoto = (photoData) => {
    setPhoto(photoData);
    setShowCamera(false);
    
    // Proceed with clock in/out if photo was for a specific action
    if (cameraAction === 'clockIn') {
      performClockIn(photoData);
    } else if (cameraAction === 'clockOut') {
      performClockOut(photoData);
    }
  };

  const handleCancelPhoto = () => {
    setShowCamera(false);
    setCameraAction(null);
  };

  const initiateClockIn = () => {
    if (!location.lat || !location.lon) {
      setError('Please share your location first');
      return;
    }
    
    setCameraAction('clockIn');
    setShowCamera(true);
  };
  
  const initiateClockOut = () => {
    setCameraAction('clockOut');
    setShowCamera(true);
  };

  const performClockIn = async (photoData) => {
    try {
      setLoading(true);
      await clockIn({
        subContractor: userDetails?.SubContractor || subContractor,
        employee: userDetails?.Employee || employeeName,
        number: userDetails?.Number || phoneNumber,
        lat: location.lat,
        lon: location.lon,
        cookie: cookieId,
        notes,
        photo: photoData
      });
      setNotes('');
      setPhoto(null);
      checkUserStatus(cookieId);
    } catch (err) {
      setError('Clock in failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const performClockOut = async (photoData) => {
    try {
      setLoading(true);
      await clockOut({
        cookie: cookieId,
        notes,
        photo: photoData
      });
      setNotes('');
      setPhoto(null);
      checkUserStatus(cookieId);
    } catch (err) {
      setError('Clock out failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>TimeClock App</h1>
        
        {error && <div className="error-message">{error}</div>}
        {loading && <div className="loading">Loading...</div>}
        
        {showCamera ? (
          <Camera 
            onCapture={handleCapturePhoto} 
            onCancel={handleCancelPhoto}
          />
        ) : (
          <>
            <div className="location-section">
              <h2>Your Location</h2>
              <button onClick={handleShareLocation} className="share-location-btn">
                Share Location
              </button>
              
              {location.lat && location.lon && (
                <div className="location-info">
                  <p>Latitude: {location.lat.toFixed(6)}</p>
                  <p>Longitude: {location.lon.toFixed(6)}</p>
                  {worksite && <p>Worksite: {worksite}</p>}
                </div>
              )}
            </div>
            
            {isNewUser ? (
              <div className="registration-section">
                <h2>New User Registration</h2>
                <form onSubmit={handleRegister}>
                  <div className="form-group">
                    <label>Sub Contractor:</label>
                    <input 
                      type="text" 
                      value={subContractor}
                      onChange={(e) => setSubContractor(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Your Name:</label>
                    <input 
                      type="text" 
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Phone Number:</label>
                    <input 
                      type="text" 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      required
                    />
                  </div>
                  
                  <button type="submit" className="submit-btn">Register</button>
                </form>
              </div>
            ) : (
              <div className="timeclock-section">
                <div className="welcome-message">
                  Welcome back, {userDetails?.Employee || employeeName}!
                </div>
                
                {hasOpenSession ? (
                  <div className="open-session">
                    <p>You clocked in at: {new Date(openSession?.ClockIn).toLocaleString()}</p>
                    
                    <div className="form-group">
                      <label>Notes:</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes for clock-out"
                      />
                    </div>
                    
                    <button onClick={initiateClockOut} className="clock-btn clock-out">
                      Take Photo & Clock Out
                    </button>
                  </div>
                ) : (
                  <div className="new-session">
                    <div className="form-group">
                      <label>Notes:</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes for clock-in"
                      />
                    </div>
                    
                    <button 
                      onClick={initiateClockIn} 
                      className="clock-btn clock-in"
                      disabled={!location.lat || !location.lon}
                    >
                      Take Photo & Clock In
                    </button>
                    {(!location.lat || !location.lon) && (
                      <p className="hint">Please share your location to clock in</p>
                    )}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </header>
    </div>
  );
}

export default App; 