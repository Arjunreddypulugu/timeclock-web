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
  const [success, setSuccess] = useState('');
  
  // Registration form state
  const [subContractor, setSubContractor] = useState('');
  const [employeeName, setEmployeeName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  
  // Clock in/out state
  const [notes, setNotes] = useState('');
  
  // Camera state
  const [showCamera, setShowCamera] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
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
      setError('');
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
    setSuccess('');
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
            setSuccess('Location verified: ' + (response.customer_name || 'Unknown location'));
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
      setError('');
      setSuccess('');
      await registerUser({
        subContractor,
        employee: employeeName,
        number: phoneNumber,
        cookie: cookieId
      });
      setSuccess('Registration successful!');
      checkUserStatus(cookieId);
    } catch (err) {
      setError('Registration failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCapturePhoto = (photoData) => {
    console.log("Received photo data in App component");
    
    // Validate photo data
    if (!photoData || photoData === 'data:,') {
      setError('Failed to capture photo. Please try again.');
      setShowCamera(false);
      setCameraAction(null);
      return;
    }
    
    // Store the photo and display preview
    setPhoto(photoData);
    setPhotoPreview(photoData);
    setShowCamera(false);
    
    // Show processing message
    setLoading(true);
    setSuccess('Processing photo...');
    
    // Use setTimeout to ensure UI updates before heavy processing
    setTimeout(() => {
      // Proceed with clock in/out if photo was for a specific action
      if (cameraAction === 'clockIn') {
        console.log("Processing clock-in with photo");
        performClockIn(photoData);
      } else if (cameraAction === 'clockOut') {
        console.log("Processing clock-out with photo");
        performClockOut(photoData);
      } else {
        setLoading(false);
        setSuccess('Photo captured successfully!');
      }
      
      // Reset camera action after processing
      setCameraAction(null);
    }, 300); // Increased delay to ensure UI is updated
  };

  const handleCancelPhoto = () => {
    setShowCamera(false);
    setCameraAction(null);
    setError(''); // Clear any errors when canceling
  };

  const initiateClockIn = () => {
    if (!location.lat || !location.lon) {
      setError('Please share your location first');
      return;
    }
    
    setSuccess('');  // Clear any success messages
    setError('');    // Clear any error messages
    setCameraAction('clockIn');
    setShowCamera(true);
    setPhotoPreview(null);
  };
  
  const initiateClockOut = () => {
    setSuccess('');  // Clear any success messages
    setError('');    // Clear any error messages
    setCameraAction('clockOut');
    setShowCamera(true);
    setPhotoPreview(null);
  };

  const performClockIn = async (photoData) => {
    try {
      setLoading(true);
      setError('');
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
      setSuccess('Successfully clocked in!');
      setNotes('');
      setPhoto(null);
      checkUserStatus(cookieId);
    } catch (err) {
      console.error('Clock in failed:', err);
      setError('Clock in failed: ' + (err.message || 'Unknown error'));
      setPhotoPreview(null); // Clear photo preview on error
    } finally {
      setLoading(false);
    }
  };

  const performClockOut = async (photoData) => {
    try {
      setLoading(true);
      setError('');
      await clockOut({
        cookie: cookieId,
        notes,
        photo: photoData
      });
      setSuccess('Successfully clocked out!');
      setNotes('');
      setPhoto(null);
      checkUserStatus(cookieId);
    } catch (err) {
      console.error('Clock out failed:', err);
      setError('Clock out failed: ' + (err.message || 'Unknown error'));
      setPhotoPreview(null); // Clear photo preview on error
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <div className="app-title">
          <img 
            src="https://vdrs.com/wp-content/uploads/2022/08/VDRS-lockup-mod-8-19-22-350.png" 
            alt="Van Dyk Recycling Solutions Logo" 
            className="app-logo"
          />
          <h1>TimeClock Portal</h1>
        </div>
        
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        {loading && <div className="loading">Loading</div>}
        
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
                {location.lat && location.lon ? 'Update Location' : 'Share Location'}
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
                      placeholder="Enter subcontractor name"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Your Name:</label>
                    <input 
                      type="text" 
                      value={employeeName}
                      onChange={(e) => setEmployeeName(e.target.value)}
                      placeholder="Enter your full name"
                      required
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Phone Number:</label>
                    <input 
                      type="text" 
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Enter your phone number"
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
                
                {photoPreview && (
                  <div className="photo-preview-container">
                    <img src={photoPreview} alt="Captured" className="photo-preview" />
                  </div>
                )}
                
                {hasOpenSession ? (
                  <div className="open-session">
                    <p>You clocked in at: {new Date(openSession?.ClockIn).toLocaleString()}</p>
                    
                    <div className="form-group">
                      <label>Notes:</label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes for clock-out (optional)"
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
                        placeholder="Add notes for clock-in (optional)"
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