// Version 1.0.1 - Fix iOS image handling issues
import React, { useState, useEffect, useRef } from 'react';
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
import styled from 'styled-components';

// Add this constant at the top, outside of the function to prevent access without proper link
const ACCESS_RESTRICTED = true;

// iOS Emergency Form styling
const EmergencyForm = styled.div`
  padding: 15px;
  margin: 15px 0;
  border: 2px solid #f44336;
  border-radius: 5px;
  background-color: rgba(244, 67, 54, 0.1);
`;

const FormField = styled.div`
  margin-bottom: 10px;
`;

const Label = styled.label`
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
`;

const Input = styled.input`
  width: 100%;
  padding: 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
`;

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
  
  // iOS-specific emergency form state
  const [showEmergencyForm, setShowEmergencyForm] = useState(false);
  const [emergencySubContractor, setEmergencySubContractor] = useState('');
  const [emergencyEmployee, setEmergencyEmployee] = useState('');
  const [emergencyNumber, setEmergencyNumber] = useState('');
  
  // Browser detection
  const browserInfo = detectBrowser();
  
  // Save original handleClockIn reference for emergency form
  const originalHandleClockInRef = useRef(null);

  useEffect(() => {
    debugLog('App initialized', browserInfo);
    
    // Load any emergency data from localStorage
    if (browserInfo.isIOS) {
      try {
        const savedEmergencyData = localStorage.getItem('emergencyUserData');
        if (savedEmergencyData) {
          const data = JSON.parse(savedEmergencyData);
          setEmergencySubContractor(data.subContractor || '');
          setEmergencyEmployee(data.employee || '');
          setEmergencyNumber(data.number || '');
          debugLog('Loaded emergency data from localStorage', data);
        }
      } catch (err) {
        console.error('Error loading emergency data:', err);
      }
    }
    
    // Check for subcontractor parameter in URL
    const params = new URLSearchParams(window.location.search);
    const encodedSubcontractor = params.get('sc');
    
    if (encodedSubcontractor) {
      try {
        // Decode the base64 parameter
        const decodedSubcontractor = atob(encodedSubcontractor);
        setSubContractor(decodedSubcontractor);
        setEmergencySubContractor(decodedSubcontractor);
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
      
      // Update emergency form data if we have user details
      if (response.userDetails) {
        setEmergencySubContractor(response.userDetails.SubContractor || '');
        setEmergencyEmployee(response.userDetails.Employee || '');
        setEmergencyNumber(response.userDetails.Number || '');
      }
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
      
      // Save these details for emergency use
      const emergencyData = {
        subContractor,
        employee: employeeName,
        number: phoneNumber
      };
      localStorage.setItem('emergencyUserData', JSON.stringify(emergencyData));
      setEmergencySubContractor(subContractor);
      setEmergencyEmployee(employeeName);
      setEmergencyNumber(phoneNumber);
      
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
    // Store original function for emergency form
    if (!originalHandleClockInRef.current) {
      originalHandleClockInRef.current = handleClockIn;
    }
    
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
      
      // Use the stored user data if available, simplifying the process
      let userData = userDetails;
      
      // If we don't have user details but there's a cookie, try to get from localStorage
      if (!userData && !isNewUser) {
        try {
          const storedUser = localStorage.getItem('userDetails');
          if (storedUser) {
            userData = JSON.parse(storedUser);
            debugLog('Retrieved user details from localStorage', userData);
          }
        } catch (e) {
          console.error('Error parsing stored user details:', e);
        }
      }
      
      // If still no user data and not a new user, show emergency form
      if (!userData && !isNewUser) {
        debugLog('No user details available, showing emergency form');
        setShowEmergencyForm(true);
        setLoading(false);
        return;
      }
      
      // Prepare clock-in data with all fields explicitly defined
      const clockInData = {
        subContractor: (userData?.SubContractor || subContractor || '').trim(),
        employee: (userData?.Employee || employeeName || '').trim(),
        number: (userData?.Number || phoneNumber || '').trim(),
        lat: location.lat,
        lon: location.lon,
        cookie: cookieId,
        notes: notes || '',
        image: clockInImage
      };
      
      // Validate required fields
      const requiredFields = ['subContractor', 'employee', 'number', 'lat', 'lon', 'cookie'];
      const missingFields = requiredFields.filter(field => !clockInData[field]);
      
      if (missingFields.length > 0) {
        debugLog('Missing required fields', missingFields);
        setShowEmergencyForm(true);
        const errorMessage = `Missing required fields: ${missingFields.join(', ')}`;
        setError(errorMessage + '. Please fill in the form below.');
        setLoading(false);
        return;
      }
      
      // Save the current user details to localStorage for future use
      localStorage.setItem('userDetails', JSON.stringify({
        SubContractor: clockInData.subContractor,
        Employee: clockInData.employee,
        Number: clockInData.number
      }));
      
      debugLog(`Sending clock-in data for ${clockInData.employee} at location ${location.lat},${location.lon}`);
      
      try {
        const response = await clockIn(clockInData);
        debugLog('Clock-in response:', response);
        
        if (response.id) {
          setNotes('');
          setClockInImage('');
          setShowCamera(false);
          setShowEmergencyForm(false);
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
        } else if (errorMessage.includes('image')) {
          errorMessage = 'There was a problem with your photo. Please try again using the Upload option.';
        } else if (errorMessage.includes('network')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (errorMessage.includes('Missing required fields')) {
          setShowEmergencyForm(true);
          errorMessage += '. Please fill in the form below.';
          setLoading(false);
          return;
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
  
  // Handle emergency form submission
  const handleEmergencySubmit = (e) => {
    e.preventDefault();
    
    // Save the emergency data
    setEmergencySubContractor(emergencySubContractor.trim());
    setEmergencyEmployee(emergencyEmployee.trim());
    setEmergencyNumber(emergencyNumber.trim());
    
    // Save to localStorage
    const emergencyData = {
      subContractor: emergencySubContractor.trim(),
      employee: emergencyEmployee.trim(),
      number: emergencyNumber.trim()
    };
    localStorage.setItem('emergencyUserData', JSON.stringify(emergencyData));
    
    // Also save as userDetails to be safe
    localStorage.setItem('userDetails', JSON.stringify({
      SubContractor: emergencySubContractor.trim(),
      Employee: emergencyEmployee.trim(),
      Number: emergencyNumber.trim()
    }));
    
    // Continue with the clock in process
    debugLog('Continuing with clock in after emergency form', emergencyData);
    setShowEmergencyForm(false);
    
    // Use a timeout to ensure state updates before continuing
    setTimeout(() => {
      if (originalHandleClockInRef.current) {
        originalHandleClockInRef.current();
      }
    }, 300);
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

  // Emergency form for iOS when user details are missing
  if (showEmergencyForm) {
    return (
      <ThemeProvider theme={theme}>
        <GlobalStyles />
        <Layout error={error} loading={loading}>
          <EmergencyForm>
            <h2>User Information Required</h2>
            <p>Please enter your details to continue:</p>
            
            <form onSubmit={handleEmergencySubmit}>
              <FormField>
                <Label htmlFor="emergency-subcontractor">Subcontractor:</Label>
                <Input 
                  id="emergency-subcontractor"
                  type="text"
                  value={emergencySubContractor}
                  onChange={(e) => setEmergencySubContractor(e.target.value)}
                  required
                />
              </FormField>
              
              <FormField>
                <Label htmlFor="emergency-employee">Employee Name:</Label>
                <Input 
                  id="emergency-employee"
                  type="text"
                  value={emergencyEmployee}
                  onChange={(e) => setEmergencyEmployee(e.target.value)}
                  required
                />
              </FormField>
              
              <FormField>
                <Label htmlFor="emergency-number">Phone Number:</Label>
                <Input 
                  id="emergency-number"
                  type="text"
                  value={emergencyNumber}
                  onChange={(e) => setEmergencyNumber(e.target.value)}
                  required
                />
              </FormField>
              
              <Button variant="primary" type="submit">
                Continue
              </Button>
              
              <Button 
                variant="secondary" 
                style={{ marginLeft: '10px' }}
                onClick={() => setShowEmergencyForm(false)}
              >
                Cancel
              </Button>
            </form>
          </EmergencyForm>
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