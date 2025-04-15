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

const Camera = ({ onCapture, onClear }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [isMobileDevice, setIsMobileDevice] = useState(false);
  
  useEffect(() => {
    // Check if user is on a mobile device, particularly iOS
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
    const isAndroid = /android/i.test(userAgent);
    setIsMobileDevice(isIOS || isAndroid);
    
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
          width: { ideal: 1280 },
          height: { ideal: 720 },
          // On iOS devices, use the front camera
          facingMode: 'user'
        }
      };
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        // Ensure video is properly loaded on all browsers
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play().catch(e => {
            console.error("Error playing video:", e);
            setCameraError(`Video playback error: ${e.message}`);
          });
        };
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraError(`Could not access camera: ${err.message}. Please ensure camera permissions are granted.`);
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

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    try {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      
      // Draw video frame on canvas
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Generate data URL directly first for immediate preview
      const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
      setCapturedImage(dataUrl);
      
      // For iOS compatibility, use this approach:
      try {
        // Convert to base64 for API sending - more reliable across browsers
        onCapture(dataUrl);
      } catch (conversionError) {
        console.error('Error converting image:', conversionError);
        setCameraError(`Image processing error: ${conversionError.message}`);
      }
    } catch (captureError) {
      console.error('Error capturing photo:', captureError);
      setCameraError(`Failed to capture image: ${captureError.message}`);
    }
  };

  const retakePhoto = () => {
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
        <div style={{ color: 'red', marginBottom: '1rem' }}>
          {cameraError}
        </div>
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