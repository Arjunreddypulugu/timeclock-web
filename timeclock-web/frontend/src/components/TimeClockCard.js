import React, { useState, useEffect } from 'react';
import styled, { keyframes } from 'styled-components';
import Card from './Card';
import Button from './Button';
import { clockIn, clockOut } from '../services/api';
import Camera from './Camera';
import IOSImageCapture from './IOSImageCapture';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const Container = styled.div`
  animation: ${fadeIn} 0.5s ease-out;
`;

const WelcomeMessage = styled.div`
  color: ${props => props.theme.colors.accent};
  font-family: ${props => props.theme.fonts.heading};
  font-size: ${props => props.theme.fontSizes['2xl']};
  font-weight: 600;
  text-align: center;
  margin-bottom: ${props => props.theme.space.lg};
`;

const ClockInfo = styled.div`
  background-color: ${props => props.theme.colors.background.secondary};
  border-radius: ${props => props.theme.radii.md};
  padding: ${props => props.theme.space.md};
  margin-bottom: ${props => props.theme.space.md};
  
  p {
    font-size: ${props => props.theme.fontSizes.lg};
    color: ${props => props.theme.colors.text.primary};
    text-align: center;
    margin: 0;
    
    span {
      font-weight: 600;
      color: ${props => props.theme.colors.primary};
    }
  }
`;

const TimeElapsed = styled.div`
  text-align: center;
  font-family: ${props => props.theme.fonts.heading};
  font-size: ${props => props.theme.fontSizes['3xl']};
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
  margin: ${props => props.theme.space.md} 0;
  padding: ${props => props.theme.space.md};
  background-color: rgba(15, 76, 129, 0.1);
  border-radius: ${props => props.theme.radii.md};
`;

const ErrorMessage = styled.div`
  background-color: ${props => props.theme.colors.danger?.light || '#ffeeee'};
  color: ${props => props.theme.colors.danger?.dark || '#cc0000'};
  padding: ${props => props.theme.space.sm};
  border-radius: ${props => props.theme.radii.md};
  margin-bottom: ${props => props.theme.space.md};
  text-align: center;
  font-size: ${props => props.theme.fontSizes.sm};
`;

const Hint = styled.p`
  font-size: ${props => props.theme.fontSizes.sm};
  color: ${props => props.theme.colors.text.secondary};
  text-align: center;
  margin-top: ${props => props.theme.space.md};
  font-style: italic;
`;

/**
 * TimeClockCard component for handling clock-in and clock-out functionality
 */
const TimeClockCard = ({
  location,
  customerName,
  subContractor,
  loading: externalLoading
}) => {
  // State
  const [isIOS, setIsIOS] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [isClockingOut, setIsClockingOut] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [clockInTime, setClockInTime] = useState('');
  const [recordId, setRecordId] = useState(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [skipImages, setSkipImages] = useState(false);
  const [userId, setUserId] = useState('');
  
  // Initialization
  useEffect(() => {
    // Load user ID from localStorage
    const storedUserId = localStorage.getItem('userId');
    if (storedUserId) {
      setUserId(storedUserId);
    }
    
    // Check if user is already clocked in
    const storedIsClockedIn = localStorage.getItem('isClockedIn') === 'true';
    const storedClockInTime = localStorage.getItem('clockInTime');
    const storedRecordId = localStorage.getItem('recordId');
    
    setIsClockedIn(storedIsClockedIn);
    setClockInTime(storedClockInTime || '');
    setRecordId(storedRecordId || null);
    
    // Detect iOS devices
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isIOSDevice = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    setIsIOS(isIOSDevice);
    
    // If we've had previous image errors on iOS, skip images by default
    const hadImageErrors = localStorage.getItem('hadImageErrors') === 'true';
    if (isIOSDevice && hadImageErrors) {
      setSkipImages(true);
    }
    
    console.log(`Device detected: ${isIOSDevice ? 'iOS' : 'Non-iOS'}`);
  }, []);

  // Format timestamp for display
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };

  // Handle clock-in button click
  const handleClockInClick = async () => {
    console.log('Clock In initiated');
    setIsClockingIn(true);
    setError('');
    
    try {
      // Show camera component for photo capture
      setShowCamera(true);
    } catch (error) {
      console.error('Clock in error:', error);
      setError('Error starting camera: ' + (error.message || 'Unknown error'));
      setIsClockingIn(false);
    }
  };
  
  // Handle clock-out button click
  const handleClockOutClick = async () => {
    console.log('Clock Out initiated');
    setIsClockingOut(true);
    setError('');
    
    try {
      // Show camera component for photo capture
      setShowCamera(true);
    } catch (error) {
      console.error('Clock out error:', error);
      setError('Error starting camera: ' + (error.message || 'Unknown error'));
      setIsClockingOut(false);
    }
  };
  
  // Handle camera capture result
  const handleCameraCapture = async (imageData) => {
    try {
      console.log('Image captured, processing...');
      
      if (isClockingIn) {
        await processClockIn(imageData);
      } else if (isClockingOut) {
        await processClockOut(imageData);
      }
    } catch (error) {
      console.error('Error processing image:', error);
      setError('Error processing image: ' + (error.message || 'Unknown error'));
    } finally {
      setShowCamera(false);
      setIsClockingIn(false);
      setIsClockingOut(false);
    }
  };
  
  // Handle camera cancellation
  const handleCameraCancel = () => {
    setShowCamera(false);
    setIsClockingIn(false);
    setIsClockingOut(false);
  };
  
  // Process clock-in with captured image
  const processClockIn = async (imageData) => {
    setIsLoading(true);
    
    try {
      console.log('Processing clock in with image data');
      
      // Get current position for location
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      
      const { latitude, longitude } = position.coords;
      
      // Submit to API
      const response = await clockIn(
        userId, 
        customerName, 
        latitude, 
        longitude, 
        imageData, 
        subContractor
      );
      
      if (response && response.success) {
        setIsClockedIn(true);
        setClockInTime(response.data.clockInTime);
        setRecordId(response.data.recordId);
        
        // Save to localStorage
        localStorage.setItem('isClockedIn', 'true');
        localStorage.setItem('clockInTime', response.data.clockInTime);
        localStorage.setItem('recordId', response.data.recordId);
        
        console.log('Successfully clocked in');
      } else {
        console.error('Clock in API returned error:', response?.error);
        setError(response?.error || 'Failed to clock in. Please try again.');
      }
    } catch (error) {
      console.error('Clock in processing error:', error);
      setError('Error clocking in: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };
  
  // Process clock-out with captured image
  const processClockOut = async (imageData) => {
    setIsLoading(true);
    
    try {
      console.log('Processing clock out with image data');
      
      // Submit to API
      const response = await clockOut(recordId, imageData);
      
      if (response && response.success) {
        setIsClockedIn(false);
        setClockInTime('');
        setRecordId(null);
        
        // Clear localStorage
        localStorage.removeItem('isClockedIn');
        localStorage.removeItem('clockInTime');
        localStorage.removeItem('recordId');
        
        console.log('Successfully clocked out');
      } else {
        console.error('Clock out API returned error:', response?.error);
        setError(response?.error || 'Failed to clock out. Please try again.');
      }
    } catch (error) {
      console.error('Clock out processing error:', error);
      setError('Error clocking out: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  // Toggle skipping images (for iOS troubleshooting)
  const toggleSkipImages = () => {
    setSkipImages(!skipImages);
    localStorage.setItem('hadImageErrors', (!skipImages).toString());
  };

  return (
    <Container>
      <Card>
        <WelcomeMessage>
          {isClockedIn ? 'Currently Working' : 'Ready to Start Work?'}
        </WelcomeMessage>
        
        {error && (
          <ErrorMessage>
            {error}
          </ErrorMessage>
        )}
        
        {isClockedIn && (
          <ClockInfo>
            <p>You clocked in at <span>{formatTimestamp(clockInTime)}</span></p>
          </ClockInfo>
        )}
        
        {showCamera ? (
          <>
            {isIOS ? (
              <IOSImageCapture 
                onCapture={handleCameraCapture}
                onCancel={handleCameraCancel}
              />
            ) : (
              <Camera 
                onCapture={handleCameraCapture}
                onClear={handleCameraCancel}
              />
            )}
          </>
        ) : (
          <>
            {isClockedIn ? (
              <Button 
                onClick={handleClockOutClick} 
                primary={false} 
                danger 
                full
                disabled={isLoading || externalLoading}
              >
                {isLoading ? 'Processing...' : 'Clock Out'}
              </Button>
            ) : (
              <Button 
                onClick={handleClockInClick} 
                primary 
                full
                disabled={isLoading || externalLoading}
              >
                {isLoading ? 'Processing...' : 'Clock In'}
              </Button>
            )}
            
            {isIOS && (
              <Hint>
                Using iOS device: {skipImages ? 'Image capture disabled' : 'Optimized mode enabled'}
                <Button 
                  onClick={toggleSkipImages}
                  secondary 
                  small
                  style={{ marginLeft: '10px' }}
                >
                  {skipImages ? 'Enable Images' : 'Disable Images'}
                </Button>
              </Hint>
            )}
          </>
        )}
      </Card>
    </Container>
  );
};

export default TimeClockCard; 