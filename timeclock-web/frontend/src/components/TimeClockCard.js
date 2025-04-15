import React, { useState, useEffect } from 'react';
import { Box, Card, CardContent, Typography, Button, CircularProgress, Snackbar, Alert } from '@mui/material';
import styled from '@emotion/styled';
import Camera from './Camera';
import { clockIn, clockOut, checkUserStatus, isIOS } from '../services/api';
import ErrorMessage from './ErrorMessage';

// Styled components
const StyledCard = styled(Card)(({ theme }) => ({
  margin: theme.spacing(2),
  padding: theme.spacing(2),
  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
  borderRadius: '12px',
  backgroundColor: theme.palette.background.paper,
  transition: 'transform 0.3s ease, box-shadow 0.3s ease',
  '&:hover': {
    transform: 'translateY(-5px)',
    boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
  }
}));

const ContentWrapper = styled(Box)({
  padding: '20px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
});

const StatusDisplay = styled(Box)({
  marginTop: '15px',
  marginBottom: '20px',
  padding: '10px 15px',
  borderRadius: '8px',
  width: '100%',
  textAlign: 'center',
});

const TimeClockCard = ({ 
  userId, 
  locationData, 
  customerName, 
  subContractor,
  onRefreshUserStatus
}) => {
  const [status, setStatus] = useState('loading'); // 'loading', 'clocked-in', 'clocked-out'
  const [showCamera, setShowCamera] = useState(false);
  const [isClockedIn, setIsClockedIn] = useState(false);
  const [lastClockIn, setLastClockIn] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState('');
  const [recordId, setRecordId] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [action, setAction] = useState(null); // 'in' or 'out'
  
  // Check if the user is clocked in
  useEffect(() => {
    if (userId) {
      fetchUserStatus();
    }
  }, [userId]);
  
  const fetchUserStatus = async () => {
    try {
      setStatus('loading');
      const result = await checkUserStatus(userId);
      
      if (result.success) {
        setIsClockedIn(result.isClockedIn);
        setLastClockIn(result.lastClockIn);
        setStatus(result.isClockedIn ? 'clocked-in' : 'clocked-out');
        if (result.isClockedIn && result.currentRecord) {
          setRecordId(result.currentRecord.id);
        }
      } else {
        setStatus('clocked-out');
        setError(result.message || 'Error checking status');
      }
    } catch (err) {
      console.error('Error checking user status:', err);
      setStatus('clocked-out');
      setError('Failed to check clock status');
    }
  };
  
  const handleClockIn = async (imageData) => {
    setShowCamera(false);
    setLoading(true);
    setError(null);
    setAction('in');
    
    try {
      console.log('Starting clock-in process');
      
      // Check if we have location data
      if (!locationData || !locationData.latitude || !locationData.longitude) {
        throw new Error('Location data is missing or invalid');
      }
      
      // Additional logging for iOS devices
      if (isIOS()) {
        console.log('iOS device detected, image data length:', imageData.length);
      }
      
      // Process the request
      const result = await clockIn({
        userId,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        customerName: customerName || 'Unknown',
        subContractor: subContractor || '',
        imageData,
        isIOS: isIOS() // Tell the backend if this is iOS
      });
      
      if (result.success) {
        setIsClockedIn(true);
        setStatus('clocked-in');
        setLastClockIn(new Date().toISOString());
        setSuccessMessage('Successfully clocked in!');
        setRecordId(result.data.recordId);
        
        // Refresh user status in parent component
        if (onRefreshUserStatus) {
          onRefreshUserStatus();
        }
      } else {
        setError(result.message || 'Failed to clock in');
      }
    } catch (err) {
      console.error('Clock in error:', err);
      setError(err.message || 'Failed to clock in');
    } finally {
      setLoading(false);
    }
  };
  
  const handleClockOut = async (imageData) => {
    setShowCamera(false);
    setLoading(true);
    setError(null);
    setAction('out');
    
    try {
      console.log('Starting clock-out process');
      
      // Check if we have location data
      if (!locationData || !locationData.latitude || !locationData.longitude) {
        throw new Error('Location data is missing or invalid');
      }
      
      // Process the request
      const result = await clockOut({
        userId,
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        imageData,
        isIOS: isIOS() // Tell the backend if this is iOS
      });
      
      if (result.success) {
        setIsClockedIn(false);
        setStatus('clocked-out');
        setSuccessMessage('Successfully clocked out!');
        setRecordId(null);
        setCapturedImage(null);
        
        // Refresh user status in parent component
        if (onRefreshUserStatus) {
          onRefreshUserStatus();
        }
      } else {
        setError(result.message || 'Failed to clock out');
      }
    } catch (err) {
      console.error('Clock out error:', err);
      setError(err.message || 'Failed to clock out');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCameraCapture = (imageData) => {
    console.log('Camera captured image, length:', imageData.length);
    
    if (status === 'clocked-out') {
      handleClockIn(imageData);
    } else {
      handleClockOut(imageData);
    }
  };
  
  const handleCameraCancel = () => {
    setShowCamera(false);
  };
  
  const handleCloseSnackbar = () => {
    setSuccessMessage('');
    setError(null);
  };

  if (status === 'loading') {
    return (
      <StyledCard>
        <CardContent>
          <ContentWrapper>
            <CircularProgress />
            <Typography variant="body2" sx={{ mt: 2 }}>
              Checking status...
            </Typography>
          </ContentWrapper>
        </CardContent>
      </StyledCard>
    );
  }

  return (
    <>
      <StyledCard>
        <CardContent>
          <Typography variant="h5" component="h2" textAlign="center" gutterBottom>
            Time Clock
          </Typography>
          
          {customerName && (
            <Typography variant="body1" textAlign="center" gutterBottom>
              Location: {customerName}
            </Typography>
          )}
          
          {subContractor && (
            <Typography variant="body2" textAlign="center" color="textSecondary" gutterBottom>
              Subcontractor: {subContractor}
            </Typography>
          )}
          
          <StatusDisplay 
            sx={{ 
              bgcolor: status === 'clocked-in' ? 'rgba(76, 175, 80, 0.1)' : 'rgba(255, 152, 0, 0.1)',
              color: status === 'clocked-in' ? 'success.main' : 'warning.main',
            }}
          >
            <Typography variant="h6" component="p">
              {status === 'clocked-in' ? 'Currently Clocked In' : 'Currently Clocked Out'}
            </Typography>
            
            {lastClockIn && status === 'clocked-in' && (
              <Typography variant="body2" color="textSecondary">
                Since: {new Date(lastClockIn).toLocaleString()}
              </Typography>
            )}
          </StatusDisplay>
          
          {showCamera ? (
            <Camera 
              onCapture={handleCameraCapture} 
              onCancel={handleCameraCancel} 
            />
          ) : (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <Button 
                variant="contained" 
                color={status === 'clocked-in' ? 'secondary' : 'primary'}
                onClick={() => setShowCamera(true)}
                disabled={loading || !locationData}
                sx={{ minWidth: '180px' }}
              >
                {loading ? (
                  <CircularProgress size={24} color="inherit" />
                ) : (
                  status === 'clocked-in' ? 'Clock Out' : 'Clock In'
                )}
              </Button>
            </Box>
          )}
          
          {!locationData && (
            <Typography 
              variant="body2" 
              color="error" 
              textAlign="center" 
              sx={{ mt: 2 }}
            >
              Location data is required. Please enable location services.
            </Typography>
          )}
          
          {capturedImage && (
            <Box mt={2}>
              <Typography variant="subtitle2" gutterBottom>
                Last Image Captured:
              </Typography>
              <img src={capturedImage} alt="Captured" style={{ maxWidth: '100%', borderRadius: '8px', border: '1px solid #ddd' }} />
            </Box>
          )}
        </CardContent>
      </StyledCard>
      
      <Snackbar 
        open={!!error || !!successMessage} 
        autoHideDuration={6000} 
        onClose={handleCloseSnackbar}
      >
        {error ? (
          <Alert severity="error" onClose={handleCloseSnackbar}>
            {error}
          </Alert>
        ) : (
          <Alert severity="success" onClose={handleCloseSnackbar}>
            {successMessage}
          </Alert>
        )}
      </Snackbar>
    </>
  );
};

export default TimeClockCard; 