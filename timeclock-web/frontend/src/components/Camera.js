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
  padding: 10px;
  border-radius: 4px;
  background-color: rgba(255, 0, 0, 0.1);
  text-align: center;
`;

const Camera = ({ onCapture, onClear }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  const [usingFrontCamera, setUsingFrontCamera] = useState(true);
  
  useEffect(() => {
    // Check if user is on a mobile device, particularly iOS
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    const isAndroid = /android/i.test(userAgent);
    setIsMobileDevice(isIOS || isAndroid);
    
    debugLog('Device detection', { isIOS, isAndroid, userAgent });
    
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraError('');
      const constraints = {
        video: {
          width: { ideal: 640 }, // Lower resolution for better compatibility
          height: { ideal: 480 },
          facingMode: usingFrontCamera ? 'user' : 'environment'
        }
      };
      
      debugLog('Requesting camera with constraints', constraints);
      
      // For iOS Safari, we need to handle permissions differently
      if (isIOS && isSafari) {
        debugLog('Using iOS Safari specific camera handling');
        constraints.video.facingMode = 'user'; // Always start with front camera on iOS Safari
      }
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // For iOS Safari, we need to make sure the video is properly loaded
        videoRef.current.setAttribute('playsinline', true);
        videoRef.current.setAttribute('autoplay', true);
        videoRef.current.setAttribute('muted', true);
        
        // Ensure video is properly loaded on all browsers
        videoRef.current.onloadedmetadata = () => {
          debugLog('Video metadata loaded');
          videoRef.current.play().catch(e => {
            console.error("Error playing video:", e);
            setCameraError(`Video playback error: ${e.message}`);
          });
        };
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      let errorMessage = `Could not access camera: ${err.message}. `;
      
      if (err.name === 'NotAllowedError') {
        errorMessage += 'Please grant camera permissions in your browser settings.';
      } else if (err.name === 'NotFoundError') {
        errorMessage += 'No camera device found.';
      } else if (err.name === 'NotReadableError') {
        errorMessage += 'Camera is already in use by another application.';
      } else if (err.name === 'OverconstrainedError') {
        errorMessage += 'Camera constraints not satisfied, trying fallback...';
        // Try again with simpler constraints
        try {
          const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
          setStream(mediaStream);
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            videoRef.current.play().catch(e => console.error("Fallback video play error:", e));
          }
          return; // Exit early if fallback succeeded
        } catch (fallbackErr) {
          errorMessage += ` Fallback failed: ${fallbackErr.message}`;
        }
      }
      
      setCameraError(errorMessage);
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    debugLog('Capturing photo');

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    try {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      debugLog('Canvas dimensions set', { width: canvas.width, height: canvas.height });
      
      // Draw video frame on canvas
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Generate data URL with lower quality for Safari
      let quality = 0.7;
      if (isIOS || isSafari) {
        quality = 0.5; // Lower quality for Safari to reduce payload size
      }
      
      try {
        // First try the simplest approach for most browsers
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        debugLog('Generated data URL length', dataUrl.length);
        
        // Verify data URL is valid
        if (!dataUrl || dataUrl === 'data:,') {
          throw new Error('Generated empty data URL');
        }
        
        setCapturedImage(dataUrl);
        onCapture(dataUrl);
      } catch (canvasError) {
        console.error('Canvas error:', canvasError);
        
        // Alternative approach for Safari if the first one fails
        try {
          debugLog('Trying alternative image capture for Safari');
          
          // Create a blob from the canvas
          canvas.toBlob(blob => {
            const imageUrl = URL.createObjectURL(blob);
            setCapturedImage(imageUrl);
            
            // Convert blob to base64
            const reader = new FileReader();
            reader.readAsDataURL(blob);
            reader.onloadend = () => {
              const base64data = reader.result;
              debugLog('Blob converted to base64', { length: base64data.length });
              onCapture(base64data);
            };
          }, 'image/jpeg', quality);
        } catch (blobError) {
          console.error('Blob conversion error:', blobError);
          setCameraError(`Failed to process image: ${blobError.message}`);
        }
      }
    } catch (captureError) {
      console.error('Error capturing photo:', captureError);
      setCameraError(`Failed to capture image: ${captureError.message}`);
    }
  };

  const retakePhoto = () => {
    debugLog('Retaking photo');
    setCapturedImage(null);
    if (onClear) onClear();
    startCamera();
  };

  const switchCamera = async () => {
    setUsingFrontCamera(!usingFrontCamera);
    stopCamera();
    setTimeout(() => {
      startCamera();
    }, 300); // A small delay to ensure camera is properly stopped
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
        </ErrorMessage>
      )}
      
      <ButtonContainer>
        {!capturedImage ? (
          <>
            <Button 
              variant="primary" 
              onClick={capturePhoto}
              disabled={!stream}
            >
              Take Photo
            </Button>
            {isMobileDevice && (
              <Button 
                variant="secondary" 
                onClick={switchCamera}
                disabled={!stream}
              >
                Switch Camera
              </Button>
            )}
          </>
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
    </CameraContainer>
  );
};

export default Camera; 