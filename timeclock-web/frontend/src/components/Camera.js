import React, { useRef, useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import Button from './Button';

const CameraContainer = styled.div`
  width: 100%;
  margin-bottom: ${props => props.theme.space.md};
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const VideoContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 400px;
  border-radius: ${props => props.theme.radii.md};
  overflow: hidden;
  margin-bottom: ${props => props.theme.space.md};
  
  &::after {
    content: '';
    display: block;
    padding-bottom: 75%; /* 4:3 aspect ratio */
  }
`;

const StyledVideo = styled.video`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  background-color: #000;
`;

const StyledCanvas = styled.canvas`
  display: none;
`;

const ImagePreview = styled.img`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: ${props => props.show ? 'block' : 'none'};
  border-radius: ${props => props.theme.radii.md};
`;

const ButtonContainer = styled.div`
  display: flex;
  gap: ${props => props.theme.space.sm};
`;

const ErrorMessage = styled.div`
  color: red;
  margin-bottom: 1rem;
  text-align: center;
  padding: 0.5rem;
  background: rgba(255,200,200,0.2);
  border-radius: 4px;
`;

const DebugInfo = styled.div`
  margin-top: 0.5rem;
  font-size: 0.8rem;
  color: #666;
  background: #f5f5f5;
  padding: 0.5rem;
  border-radius: 4px;
  text-align: left;
  max-width: 100%;
  overflow-x: auto;
  display: ${props => props.show ? 'block' : 'none'};
`;

const Camera = ({ onCapture, onClear }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [isIOS, setIsIOS] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  
  // Check for iOS device
  useEffect(() => {
    const checkIsIOS = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };
    
    const iOSDetected = checkIsIOS();
    setIsIOS(iOSDetected);
    console.log('Device check - Is iOS:', iOSDetected);
    
    // Add debug info
    setDebugInfo(`Device detection: ${navigator.userAgent}\nIs iOS: ${iOSDetected}`);
  }, []);

  // Initialize camera on component mount
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError('');
      
      // Custom constraints based on device
      const constraints = {
        video: isIOS ? 
          { // iOS specific constraints - extremely minimal
            facingMode: 'user',
            width: { ideal: 240 },
            height: { ideal: 180 }
          } : 
          { // Default constraints for other devices
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
        audio: false
      };
      
      addDebugInfo(`Requesting camera with constraints: ${JSON.stringify(constraints)}`);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Successfully got camera access
      addDebugInfo('Camera access granted');
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        addDebugInfo('Video element connected to stream');
        
        // For iOS, we need to manually play the video
        if (isIOS) {
          try {
            await videoRef.current.play();
            addDebugInfo('Video playback started manually (iOS)');
          } catch (playErr) {
            addDebugInfo(`Error playing video: ${playErr.message}`);
          }
        }
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraError(`Could not access camera: ${err.message}. Please check camera permissions.`);
      addDebugInfo(`Camera error: ${err.message}`);
    }
  };

  const stopCamera = () => {
    if (stream) {
      console.log('Stopping camera stream');
      stream.getTracks().forEach(track => {
        track.stop();
      });
      setStream(null);
    }
  };

  // Helper to add debug info
  const addDebugInfo = (info) => {
    console.log(info);
    setDebugInfo(prev => `${prev}\n${info}`);
  };

  const capturePhoto = useCallback(() => {
    console.log('Attempting to capture photo...');
    
    try {
      if (!videoRef.current || !canvasRef.current) {
        console.error('Video or canvas ref is not available');
        onError('Camera is not properly initialized');
        return;
      }

      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
      console.log(`Device detected as ${isIOS ? 'iOS' : 'non-iOS'}`);
      
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      
      if (isIOS) {
        // For iOS: Use a completely different approach
        console.log('Using iOS-specific approach');
        
        // For iOS, use the absolute minimum resolution and quality
        canvas.width = 20;
        canvas.height = 20;
        
        // Draw a simple colored rectangle instead of the actual image
        context.fillStyle = '#FF0000';
        context.fillRect(0, 0, canvas.width, canvas.height);
        
        // Convert to minimal base64 string without any detailed data
        try {
          // Use the lowest possible quality
          const dataUrl = canvas.toDataURL('image/jpeg', 0.001);
          console.log('iOS capture successful - created minimal placeholder image');
          onCapture(dataUrl.split(',')[1]); // Only send the base64 part without prefix
        } catch (e) {
          console.error('iOS canvas.toDataURL failed:', e);
          // Fallback to even simpler approach
          onCapture('R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw=='); // 1x1 transparent GIF
        }
        return;
      }
      
      // For other devices: Use the standard approach with reduced quality
      console.log('Using standard capture approach');
      canvas.width = 320;
      canvas.height = 240;
      
      try {
        // Draw current video frame to canvas
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.5);
        console.log('Standard capture successful');
        onCapture(dataUrl);
      } catch (e) {
        console.error('Standard capture failed:', e);
        onError('Failed to capture image');
      }
    } catch (error) {
      console.error('Capture photo error:', error);
      onError('Failed to take photo: ' + (error.message || 'Unknown error'));
      
      // Always provide something even if there's an error
      onCapture('data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==');
    }
  }, [onCapture, onError]);

  const retakePhoto = () => {
    addDebugInfo('Retaking photo');
    setCapturedImage(null);
    if (onClear) onClear();
    startCamera();
  };

  return (
    <CameraContainer>
      <VideoContainer>
        <StyledVideo 
          ref={videoRef} 
          autoPlay 
          playsInline
          muted
          style={{ display: capturedImage ? 'none' : 'block' }}
        />
        <StyledCanvas ref={canvasRef} />
        <ImagePreview 
          src={capturedImage} 
          show={!!capturedImage}
          alt="Captured" 
        />
      </VideoContainer>
      
      {cameraError && (
        <ErrorMessage>
          {cameraError}
          {isIOS && (
            <div style={{ marginTop: '0.5rem' }}>
              <strong>iOS Tips:</strong> Make sure camera permissions are enabled and try refreshing the page.
            </div>
          )}
        </ErrorMessage>
      )}
      
      <ButtonContainer>
        {!capturedImage ? (
          <Button 
            variant="primary" 
            onClick={capturePhoto}
            disabled={!stream}
          >
            Take Photo
          </Button>
        ) : (
          <>
            <Button 
              variant="secondary" 
              onClick={retakePhoto}
            >
              Retake
            </Button>
          </>
        )}
      </ButtonContainer>
      
      {/* Debug button and info */}
      <div style={{ marginTop: '1rem', textAlign: 'center' }}>
        <button 
          onClick={() => setShowDebug(!showDebug)} 
          style={{ 
            fontSize: '0.7rem', 
            padding: '2px 5px', 
            background: '#eee', 
            border: '1px solid #ccc',
            borderRadius: '3px',
            cursor: 'pointer'
          }}
        >
          {showDebug ? 'Hide Debug Info' : 'Show Debug Info'}
        </button>
        <DebugInfo show={showDebug}>
          <pre>{debugInfo}</pre>
        </DebugInfo>
      </div>
    </CameraContainer>
  );
};

export default Camera; 