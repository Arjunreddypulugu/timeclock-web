import React, { useRef, useState, useEffect } from 'react';
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

const Camera = ({ onCapture, onClear }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [isIOS, setIsIOS] = useState(false);
  
  // Check for iOS device
  useEffect(() => {
    const checkIsIOS = () => {
      const userAgent = navigator.userAgent.toLowerCase();
      return /iphone|ipad|ipod/.test(userAgent);
    };
    
    setIsIOS(checkIsIOS());
    console.log('Device check - Is iOS:', checkIsIOS());
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
          { // iOS specific constraints
            facingMode: 'user',
            width: { ideal: 320 },
            height: { ideal: 240 }
          } : 
          { // Default constraints for other devices
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
        audio: false
      };
      
      console.log('Requesting camera access with constraints:', JSON.stringify(constraints));
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Successfully got camera access
      console.log('Camera access granted');
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        console.log('Video element connected to stream');
        
        // For iOS, we need to manually play the video
        if (isIOS) {
          try {
            await videoRef.current.play();
            console.log('Video playback started manually (iOS)');
          } catch (playErr) {
            console.error('Error starting video playback:', playErr);
          }
        }
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraError(`Could not access camera: ${err.message}. Please check camera permissions.`);
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

  const capturePhoto = () => {
    console.log('Attempting to capture photo');
    if (!videoRef.current || !canvasRef.current) {
      console.error('Video or canvas ref is null');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    try {
      // Use smaller dimensions for iOS to ensure it works
      const width = isIOS ? 320 : 640;
      const height = isIOS ? 240 : 480;
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw video frame on canvas
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, width, height);
      
      console.log('Image captured and drawn to canvas');
      
      // Use lower quality for iOS
      const imageQuality = isIOS ? 0.4 : 0.6;
      
      // Convert to data URL with appropriate quality setting
      const base64data = canvas.toDataURL('image/jpeg', imageQuality);
      console.log('Image converted to data URL, size:', base64data.length);
      
      // For iOS, we need to make sure the image isn't too large
      if (isIOS && base64data.length > 100000) {
        console.log('Image is too large for iOS, reducing quality further');
        // Further reduce quality for iOS if image is large
        const reducedImage = canvas.toDataURL('image/jpeg', 0.1);
        setCapturedImage(reducedImage);
        onCapture(reducedImage);
        console.log('Reduced image quality for iOS, new size:', reducedImage.length);
      } else {
        // Safety check for image data
        if (base64data && base64data.startsWith('data:image/')) {
          setCapturedImage(base64data);
          onCapture(base64data);
          console.log('Image successfully captured and set');
        } else {
          throw new Error('Invalid image data generated');
        }
      }
    } catch (err) {
      console.error('Error capturing photo:', err);
      setCameraError(`Failed to capture photo: ${err.message}`);
    }
  };

  const retakePhoto = () => {
    console.log('Retaking photo');
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
    </CameraContainer>
  );
};

export default Camera; 