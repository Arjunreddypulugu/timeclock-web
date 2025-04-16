import React, { useRef, useState, useEffect } from 'react';
import styled from 'styled-components';
import Button from './Button';

// Debug logger
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

const debugLog = (message, data) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Camera${isIOS ? '-iOS' : ''}${isSafari ? '-Safari' : ''}] ${message}`, data || '');
  }
};

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
  background-color: #000;
  
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
  justify-content: center;
  width: 100%;
  max-width: 400px;
`;

const ErrorMessage = styled.div`
  color: red;
  margin: 1rem 0;
  padding: 10px;
  border-radius: 4px;
  background-color: rgba(255, 0, 0, 0.1);
  text-align: center;
  width: 100%;
  max-width: 400px;
`;

const TipMessage = styled.div`
  color: #666;
  margin: 0.5rem 0;
  padding: 8px;
  font-size: 0.85rem;
  text-align: center;
  width: 100%;
  max-width: 400px;
`;

const Camera = ({ onCapture, onClear }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [cameraStarted, setCameraStarted] = useState(false);
  const [countdown, setCountdown] = useState(null);
  
  // On mount, don't auto-start camera to avoid iOS issues
  useEffect(() => {
    debugLog('Camera component mounted');
    
    // On unmount, ensure we clean up
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    setCameraStarted(true);
    setCameraError('');
    try {
      debugLog('Starting camera...');
      
      // Always use simpler constraints, especially for iOS
      const constraints = {
        video: {
          facingMode: 'user', // Always use FRONT camera
          width: { ideal: 640 },     // Lower resolution 
          height: { ideal: 480 }
        }
      };
      
      // iOS Safari specific
      if (isIOS) {
        debugLog('Using iOS specific camera constraints');
        // iOS works better with very simple constraints
        constraints.video = { facingMode: 'user' }; // Ensure front camera for iOS too
      }
      
      debugLog('Using camera constraints:', constraints);
      
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          
          // Essential attributes for iOS
          videoRef.current.setAttribute('playsinline', true);
          videoRef.current.setAttribute('autoplay', true);
          videoRef.current.setAttribute('muted', true);
          
          // Listen for loadedmetadata event
          videoRef.current.onloadedmetadata = () => {
            debugLog('Video metadata loaded');
            videoRef.current.play().catch(e => {
              console.error("Error playing video:", e);
              setCameraError(`Video playback error: ${e.message}`);
            });
          };
        }
      } catch (err) {
        // If it fails with environment camera, try again with any camera
        console.warn('Failed with environment camera, trying default camera');
        
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(mediaStream);
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.setAttribute('playsinline', true);
          videoRef.current.setAttribute('autoplay', true);
          videoRef.current.setAttribute('muted', true);
          
          videoRef.current.onloadedmetadata = () => {
            debugLog('Video metadata loaded (fallback)');
            videoRef.current.play().catch(e => {
              console.error("Error playing video:", e);
              setCameraError(`Video playback error: ${e.message}`);
            });
          };
        }
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      let errorMessage = `Could not access camera: ${err.message}. `;
      
      if (err.name === 'NotAllowedError') {
        errorMessage = 'Camera permission denied. Please allow camera access in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMessage = 'No camera device found. Please make sure your device has a working camera.';
      } else if (err.name === 'NotReadableError') {
        errorMessage = 'Camera is in use by another application. Please close other apps that might be using your camera.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage = 'Camera requirements not met. Trying simpler settings...';
        
        // Try one more time with the simplest possible constraints
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.setAttribute('playsinline', true);
            videoRef.current.setAttribute('autoplay', true);
            videoRef.current.setAttribute('muted', true);
            videoRef.current.play().catch(e => console.error("Fallback video play error:", e));
          }
          return; // Exit early if fallback succeeded
        } catch (fallbackErr) {
          errorMessage = 'Could not access any camera. Please check your device permissions.';
        }
      }
      
      // iOS specific guidance
      if (isIOS) {
        errorMessage += ' On iOS, make sure you allow camera access when prompted.';
      }
      
      setCameraError(errorMessage);
    }
  };

  const stopCamera = () => {
    debugLog('Stopping camera');
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setCameraStarted(false);
    setCountdown(null);
  };

  const startCountdown = () => {
    if (!stream) return;
    
    debugLog('Starting photo countdown');
    setCountdown(3);
    
    const countdownInterval = setInterval(() => {
      setCountdown(prevCount => {
        if (prevCount <= 1) {
          clearInterval(countdownInterval);
          capturePhoto();
          return null;
        }
        return prevCount - 1;
      });
    }, 1000);
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) {
      setCameraError('Camera not ready. Please try again.');
      return;
    }
    
    debugLog('Capturing photo');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    try {
      // Use a lower resolution for iOS devices to improve performance
      const width = isIOS ? 640 : (video.videoWidth || 640);
      const height = isIOS ? 480 : (video.videoHeight || 480);
      
      // Set canvas dimensions
      canvas.width = width;
      canvas.height = height;
      
      debugLog('Canvas dimensions set', { width, height });
      
      // Draw video frame on canvas
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Use lower quality for iOS to ensure successful processing
      const quality = isIOS ? 0.4 : 0.7;
      
      try {
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        debugLog('Generated data URL', { length: dataUrl.length });
        
        if (!dataUrl || dataUrl === 'data:,') {
          throw new Error('Generated empty data URL');
        }
        
        // Send the image data to parent component
        setCapturedImage(dataUrl);
        onCapture(dataUrl);
        stopCamera(); // Stop camera after successful capture
      } catch (canvasError) {
        console.error('Canvas error:', canvasError);
        
        // iOS Safari fallback using blob
        try {
          debugLog('Trying blob fallback for iOS');
          canvas.toBlob(
            (blob) => {
              if (!blob) {
                setCameraError('Failed to capture image. Please try again.');
                return;
              }
              
              const reader = new FileReader();
              reader.onloadend = () => {
                const base64data = reader.result;
                setCapturedImage(base64data);
                onCapture(base64data);
                stopCamera(); // Stop camera after successful capture
              };
              reader.onerror = () => {
                setCameraError('Failed to process image. Please try again.');
              };
              reader.readAsDataURL(blob);
            },
            'image/jpeg',
            quality
          );
        } catch (blobError) {
          console.error('Blob creation error:', blobError);
          setCameraError('Failed to process image. Please try again.');
        }
      }
    } catch (err) {
      console.error('Error capturing photo:', err);
      setCameraError('Failed to capture image. Please make sure camera is ready and try again.');
    }
  };

  const retakePhoto = () => {
    debugLog('Retaking photo');
    setCapturedImage(null);
    if (onClear) onClear();
    
    // Reset camera
    stopCamera();
    setTimeout(() => startCamera(), 500);
  };

  return (
    <CameraContainer>
      <VideoContainer>
        {!cameraStarted && !capturedImage && (
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: '#000',
            color: '#fff',
            fontSize: '1.2rem',
            textAlign: 'center',
            padding: '1rem'
          }}>
            Click "Start Camera" below
          </div>
        )}
        
        <StyledVideo ref={videoRef} autoPlay playsInline muted />
        <StyledCanvas ref={canvasRef} />
        <ImagePreview src={capturedImage} alt="Captured" show={!!capturedImage} />
        
        {countdown !== null && (
          <div style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.5)',
            color: '#fff',
            fontSize: '4rem',
            fontWeight: 'bold'
          }}>
            {countdown}
          </div>
        )}
      </VideoContainer>
      
      {cameraError && <ErrorMessage>{cameraError}</ErrorMessage>}
      
      {isIOS && !capturedImage && (
        <TipMessage>
          iOS tip: Make sure to allow camera access when prompted. Hold your device steady.
        </TipMessage>
      )}
      
      <ButtonContainer>
        {!cameraStarted && !capturedImage && (
          <Button variant="primary" onClick={startCamera} style={{ width: '100%' }}>
            Start Camera
          </Button>
        )}
        
        {cameraStarted && !capturedImage && !countdown && (
          <>
            <Button variant="secondary" onClick={stopCamera}>
              Cancel
            </Button>
            <Button variant="primary" onClick={startCountdown}>
              Take Photo
            </Button>
          </>
        )}
        
        {capturedImage && (
          <>
            <Button variant="secondary" onClick={retakePhoto}>
              Retake
            </Button>
            <Button variant="primary" onClick={() => {}}>
              Use Photo
            </Button>
          </>
        )}
      </ButtonContainer>
    </CameraContainer>
  );
};

export default Camera; 