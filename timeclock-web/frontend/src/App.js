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

// TEMPORARILY DISABLE access restriction for debugging
const ACCESS_RESTRICTED = false;

function App() {
  const [cookieId, setCookieId] = useState('');
  const [isNewUser, setIsNewUser] = useState(true);
  const [hasOpenSession, setHasOpenSession] = useState(false);
  const [openSession, setOpenSession] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [location, setLocation] = useState({ lat: null, lon: null });
  const [customerName, setCustomerName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redirectToHome, setRedirectToHome] = useState(false);
  
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

  // Application initialization & parameter handling
  useEffect(() => {
    console.log('App initializing, checking for parameters...');
    
    try {
      // Check for subcontractor parameter in URL
      const params = new URLSearchParams(window.location.search);
      const encodedSubcontractor = params.get('sc');
      
      if (encodedSubcontractor) {
        try {
          // Decode the base64 parameter
          const decodedSubcontractor = atob(encodedSubcontractor);
          setSubContractor(decodedSubcontractor);
          console.log('Auto-filled subcontractor:', decodedSubcontractor);
        } catch (err) {
          console.error('Error decoding subcontractor parameter:', err);
          if (ACCESS_RESTRICTED) {
            setError('Invalid access link. Please use a valid subcontractor link.');
            return;
          }
        }
      } else if (ACCESS_RESTRICTED) {
        console.log('Access restricted and no SC parameter found');
        setError('Access restricted. Please use a proper subcontractor link to access this application.');
        return;
      }
      
      // Generate cookie ID if not exists
      const storedCookieId = localStorage.getItem('timeclockCookieId');
      if (storedCookieId) {
        console.log('Found existing cookie ID:', storedCookieId);
        setCookieId(storedCookieId);
        checkUserStatus(storedCookieId);
      } else {
        const newCookieId = 'tc-' + Date.now();
        console.log('Creating new cookie ID:', newCookieId);
        localStorage.setItem('timeclockCookieId', newCookieId);
        setCookieId(newCookieId);
        setIsNewUser(true);
      }
    } catch (error) {
      console.error('Error in initialization:', error);
      setError('Application initialization error: ' + (error.message || 'Unknown error'));
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
            setCustomerName(response.customer_name || 'Unknown location');
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
    
    if (!customerName || customerName === 'Unknown location') {
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
      console.log('Starting clock-in process...');
      
      // Add more validation
      if (!location.lat || !location.lon) {
        throw new Error('Location data is missing. Please share your location and try again.');
      }
      
      if (!customerName || customerName === 'Unknown location') {
        throw new Error('Valid worksite location is required. Please try again.');
      }
      
      const clockInData = {
        subContractor: userDetails?.SubContractor || subContractor,
        employee: userDetails?.Employee || employeeName,
        number: userDetails?.Number || phoneNumber,
        lat: location.lat,
        lon: location.lon,
        cookie: cookieId,
        notes,
        image: clockInImage
      };
      
      console.log(`Sending clock-in data for ${clockInData.employee} at location ${location.lat},${location.lon}`);
      
      const response = await clockIn(clockInData);
      console.log('Clock-in response:', response);
      
      if (response.id) {
        setNotes('');
        setClockInImage('');
        setShowCamera(false);
        console.log('Successfully clocked in with ID:', response.id);
        checkUserStatus(cookieId);
      } else if (response.error) {
        setError('Clock in failed: ' + response.error);
      }
    } catch (err) {
      console.error('Clock in error:', err);
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
      console.log('Starting clock-out process...');
      
      if (!openSession) {
        throw new Error('No active session found. Please refresh and try again.');
      }
      
      const clockOutData = {
        id: openSession.ID,
        cookie: cookieId,
        notes,
        image: clockOutImage
      };
      
      console.log(`Sending clock-out data for session ${clockOutData.id}`);
      
      const response = await clockOut(clockOutData);
      console.log('Clock-out response:', response);
      
      if (response.success) {
        setNotes('');
        setClockOutImage('');
        setShowCamera(false);
        console.log('Successfully clocked out');
        checkUserStatus(cookieId);
      } else if (response.error) {
        setError('Clock out failed: ' + response.error);
      }
    } catch (err) {
      console.error('Clock out error:', err);
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

  // If access is restricted and no valid subcontractor parameter, show an error
  if (redirectToHome) {
    return (
      <ThemeProvider theme={theme}>
        <GlobalStyles />
        <Layout error={error} loading={false}>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h2>Access Restricted</h2>
            <p>{error}</p>
            <p>Please contact your supervisor for the correct link.</p>
          </div>
        </Layout>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={theme}>
      <GlobalStyles />
      <Layout error={error} loading={loading}>
        {showCamera ? (
          <Camera
            onCapture={handleCaptureImage}
            onClose={cancelCapture}
            mode={captureMode}
          />
        ) : (
          <>
            {isNewUser ? (
              <RegistrationForm
                subContractor={subContractor}
                setSubContractor={setSubContractor}
                employeeName={employeeName}
                setEmployeeName={setEmployeeName}
                phoneNumber={phoneNumber}
                setPhoneNumber={setPhoneNumber}
                onSubmit={handleRegister}
              />
            ) : (
              <>
                {!location.lat || !location.lon ? (
                  <LocationCard onShareLocation={handleShareLocation} subContractor={subContractor} />
                ) : (
                  <TimeClockCard
                    customerName={customerName}
                    subContractor={subContractor}
                    hasOpenSession={hasOpenSession}
                    onClockIn={startClockIn}
                    onClockOut={startClockOut}
                    onTakePhoto={handleCaptureImage}
                    clockInImage={clockInImage}
                    clockOutImage={clockOutImage}
                    notes={notes}
                    setNotes={setNotes}
                    handleClockIn={handleClockIn}
                    handleClockOut={handleClockOut}
                  />
                )}
              </>
            )}
          </>
        )}
      </Layout>
    </ThemeProvider>
  );
}

export default App; 