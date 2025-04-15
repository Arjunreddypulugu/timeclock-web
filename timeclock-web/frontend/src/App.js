// Version 1.0.1 - Fix iOS image handling issues
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

// Add this constant at the top, outside of the function to prevent access without proper link
const ACCESS_RESTRICTED = true;

// Helper for browser detection
const detectBrowser = () => {
  const userAgent = navigator.userAgent;
  let browser = "Unknown";
  
  if (userAgent.match(/chrome|chromium|crios/i)) {
    browser = "Chrome";
  } else if (userAgent.match(/firefox|fxios/i)) {
    browser = "Firefox";
  } else if (userAgent.match(/safari/i) && !userAgent.match(/chrome|chromium|crios/i)) {
    browser = "Safari";
  } else if (userAgent.match(/opr\//i)) {
    browser = "Opera";
  } else if (userAgent.match(/edg/i)) {
    browser = "Edge";
  }
  
  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  
  return { browser, isMobile, isIOS, userAgent };
};

// Debug log helper
const debugLog = (message, data) => {
  if (process.env.NODE_ENV !== 'production') {
    const { browser, isMobile } = detectBrowser();
    console.log(`[${browser}${isMobile ? '-Mobile' : ''}] ${message}`, data || '');
  }
};

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
  
  // Browser detection
  const browserInfo = detectBrowser();

  useEffect(() => {
    debugLog('App initialized', browserInfo);
    
    // Check for subcontractor parameter in URL
    const params = new URLSearchParams(window.location.search);
    const encodedSubcontractor = params.get('sc');
    
    if (encodedSubcontractor) {
      try {
        // Decode the base64 parameter
        const decodedSubcontractor = atob(encodedSubcontractor);
        setSubContractor(decodedSubcontractor);
        debugLog('Auto-filled subcontractor:', decodedSubcontractor);
      } catch (err) {
        console.error('Error decoding subcontractor parameter:', err);
        if (ACCESS_RESTRICTED) {
          setError('Invalid access link. Please use a valid subcontractor link.');
          setRedirectToHome(true);
          return;
        }
      }
    } else if (ACCESS_RESTRICTED) {
      setError('Access restricted. Please use a proper subcontractor link to access this application.');
      setRedirectToHome(true);
      return;
    }
    
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
    debugLog('Image captured', { mode: captureMode, size: imageData?.length || 0 });
    
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
    debugLog('Starting clock-in process');
  };

  const handleClockIn = async () => {
    if (!clockInImage) {
      setError('Please take a photo first');
      return;
    }
    
    try {
      setLoading(true);
      setError(''); // Clear any existing errors
      debugLog('Proceeding with clock-in', { imageSize: clockInImage.length });
      
      // Validate image data before sending
      if (!clockInImage.includes('base64') && !clockInImage.startsWith('data:image/')) {
        throw new Error('Invalid image format. Please retake the photo.');
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
      
      // Special handling for Safari
      if (browserInfo.browser === 'Safari' && browserInfo.isIOS) {
        debugLog('Using Safari-specific clock-in process');
      }
      
      debugLog(`Sending clock-in data for ${clockInData.employee} at location ${location.lat},${location.lon}`);
      
      try {
        const response = await clockIn(clockInData);
        debugLog('Clock-in response:', response);
        
        if (response.id) {
          setNotes('');
          setClockInImage('');
          setShowCamera(false);
          debugLog('Successfully clocked in with ID:', response.id);
          checkUserStatus(cookieId);
        } else {
          setError('Clock in failed: ' + (response.error || 'Unknown error'));
        }
      } catch (apiError) {
        console.error('Clock in API error:', apiError);
        let errorMessage = apiError.message || 'Unknown error';
        
        // More user-friendly error messages
        if (errorMessage.includes('Failed to parse server response')) {
          errorMessage = 'The server returned an invalid response. Please try again.';
          
          // For Safari, provide more specific guidance
          if (browserInfo.browser === 'Safari') {
            errorMessage += ' This issue is more common on Safari. Try using Chrome if available.';
          }
        } else if (errorMessage.includes('image')) {
          errorMessage = 'There was a problem with your photo. Please retake it.';
          
          // For Safari, add extra suggestions
          if (browserInfo.browser === 'Safari') {
            errorMessage += ' Make sure you are in a well-lit area and the camera has good focus.';
          }
        } else if (errorMessage.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
        
        setError('Clock in failed: ' + errorMessage);
      }
    } catch (err) {
      console.error('Clock in client error:', err);
      setError('Clock in failed: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const startClockOut = () => {
    setCaptureMode('clockOut');
    setShowCamera(true);
    setError('');
    debugLog('Starting clock-out process');
  };

  const handleClockOut = async () => {
    if (!clockOutImage) {
      setError('Please take a photo first');
      return;
    }
    
    try {
      setLoading(true);
      setError(''); // Clear any existing errors
      debugLog('Proceeding with clock-out', { imageSize: clockOutImage.length });
      
      // Validate image data before sending
      if (!clockOutImage.includes('base64') && !clockOutImage.startsWith('data:image/')) {
        throw new Error('Invalid image format. Please retake the photo.');
      }
      
      const clockOutData = {
        cookie: cookieId,
        notes,
        image: clockOutImage
      };
      
      // Special handling for Safari
      if (browserInfo.browser === 'Safari' && browserInfo.isIOS) {
        debugLog('Using Safari-specific clock-out process');
      }
      
      debugLog(`Sending clock-out data for cookie ${cookieId}`);
      
      try {
        const response = await clockOut(clockOutData);
        debugLog('Clock-out response:', response);
        
        if (response.success) {
          setNotes('');
          setClockOutImage('');
          setShowCamera(false);
          debugLog('Successfully clocked out');
          checkUserStatus(cookieId);
        } else {
          setError('Clock out failed: ' + (response.error || 'Unknown error'));
        }
      } catch (apiError) {
        console.error('Clock out API error:', apiError);
        let errorMessage = apiError.message || 'Unknown error';
        
        // More user-friendly error messages
        if (errorMessage.includes('Failed to parse server response')) {
          errorMessage = 'The server returned an invalid response. Please try again.';
          
          // For Safari, provide more specific guidance
          if (browserInfo.browser === 'Safari') {
            errorMessage += ' This issue is more common on Safari. Try using Chrome if available.';
          }
        } else if (errorMessage.includes('image')) {
          errorMessage = 'There was a problem with your photo. Please retake it.';
          
          // For Safari, add extra suggestions
          if (browserInfo.browser === 'Safari') {
            errorMessage += ' Make sure you are in a well-lit area and the camera has good focus.';
          }
        } else if (errorMessage.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        }
        
        setError('Clock out failed: ' + errorMessage);
      }
    } catch (err) {
      console.error('Clock out client error:', err);
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
    debugLog('Camera capture cancelled');
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
            
            {/* Safari-specific guidance */}
            {browserInfo.browser === 'Safari' && (
              <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '5px' }}>
                <p style={{ fontSize: '14px', textAlign: 'center' }}>
                  <strong>Note for Safari users:</strong> If you encounter issues, try using Chrome for best results.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            <LocationCard 
              location={location}
              customerName={customerName}
              subContractor={subContractor}
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
                customerName={customerName}
                subContractor={subContractor}
              />
            )}
          </>
        )}
      </Layout>
    </ThemeProvider>
  );
}

export default App; 