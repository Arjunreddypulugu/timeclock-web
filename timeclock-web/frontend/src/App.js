import React, { useState, useEffect } from 'react';
import { ThemeProvider } from 'styled-components';
import theme from './theme';
import GlobalStyles from './GlobalStyles';
import Layout from './components/Layout';
import LocationCard from './components/LocationCard';
import RegistrationForm from './components/RegistrationForm';
import TimeClockCard from './components/TimeClockCard';
import Camera from './components/Camera';
import Button from './components/Button';
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
  const [clockInImage, setClockInImage] = useState('');
  const [clockOutImage, setClockOutImage] = useState('');
  const [captureMode, setCaptureMode] = useState(''); // 'clockIn' or 'clockOut'

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
            setError('Location verification failed: ' + (err.message || 'Unknown error'));
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
    if (e) e.preventDefault();
    
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
      setError('Registration failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const handleCaptureImage = (imageData) => {
    if (captureMode === 'clockIn') {
      setClockInImage(imageData);
    } else if (captureMode === 'clockOut') {
      setClockOutImage(imageData);
    }
  };

  const startClockIn = () => {
    if (!location.lat || !location.lon) {
      setError('Please share your location first');
      return;
    }
    
    if (!worksite || worksite === 'Unknown location') {
      setError('You must be at a valid worksite to clock in');
      return;
    }
    
    setCaptureMode('clockIn');
    setShowCamera(true);
    setError('');
  };

  const handleClockIn = async () => {
    if (!clockInImage) {
      setError('Please take a photo first');
      return;
    }
    
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
        image: clockInImage
      });
      setNotes('');
      setClockInImage('');
      setShowCamera(false);
      checkUserStatus(cookieId);
    } catch (err) {
      setError('Clock in failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const startClockOut = () => {
    setCaptureMode('clockOut');
    setShowCamera(true);
    setError('');
  };

  const handleClockOut = async () => {
    if (!clockOutImage) {
      setError('Please take a photo first');
      return;
    }
    
    try {
      setLoading(true);
      await clockOut({
        cookie: cookieId,
        notes,
        image: clockOutImage
      });
      setNotes('');
      setClockOutImage('');
      setShowCamera(false);
      checkUserStatus(cookieId);
    } catch (err) {
      setError('Clock out failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const cancelCapture = () => {
    setShowCamera(false);
    setCaptureMode('');
    if (captureMode === 'clockIn') {
      setClockInImage('');
    } else if (captureMode === 'clockOut') {
      setClockOutImage('');
    }
  };

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <Layout error={error} loading={false}>
        {showCamera ? (
          <div>
            <h2>{captureMode === 'clockIn' ? 'Take Clock-In Photo' : 'Take Clock-Out Photo'}</h2>
            <Camera 
              onCapture={handleCaptureImage}
              onClear={() => handleCaptureImage('')}
            />
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <Button 
                variant="secondary" 
                onClick={cancelCapture}
              >
                Cancel
              </Button>
              <Button 
                variant="primary" 
                onClick={captureMode === 'clockIn' ? handleClockIn : handleClockOut}
                disabled={
                  (captureMode === 'clockIn' && !clockInImage) || 
                  (captureMode === 'clockOut' && !clockOutImage)
                }
              >
                {captureMode === 'clockIn' ? 'Complete Clock In' : 'Complete Clock Out'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <LocationCard 
              location={location}
              worksite={worksite}
              handleShareLocation={handleShareLocation}
              loading={loading}
            />
            
            {isNewUser ? (
              <RegistrationForm 
                handleRegister={handleRegister}
                loading={loading}
                subContractor={subContractor}
                setSubContractor={setSubContractor}
                employeeName={employeeName}
                setEmployeeName={setEmployeeName}
                phoneNumber={phoneNumber}
                setPhoneNumber={setPhoneNumber}
              />
            ) : (
              <TimeClockCard 
                hasOpenSession={hasOpenSession}
                openSession={openSession}
                userDetails={userDetails}
                handleClockIn={startClockIn}
                handleClockOut={startClockOut}
                notes={notes}
                setNotes={setNotes}
                loading={loading}
                location={location}
                worksite={worksite}
              />
            )}
          </>
        )}
      </Layout>
    </ThemeProvider>
  );
}

export default App; 