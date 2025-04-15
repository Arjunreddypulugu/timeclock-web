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
      
      // Basic constraints - no fancy options that might not be supported
      const constraints = {
        video: true,
        audio: false
      };
      
      console.log('Requesting camera access with constraints:', constraints);
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      // Successfully got camera access
      console.log('Camera access granted');
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        console.log('Video element connected to stream');
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraError(`Could not access camera: ${err.message}`);
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
      // Keep resolution small for compatibility
      const width = 640;
      const height = 480;
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw video frame on canvas
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, width, height);
      
      console.log('Image captured and drawn to canvas');
      
      // Convert to data URL with low quality JPEG to ensure compatibility
      const base64data = canvas.toDataURL('image/jpeg', 0.5);
      console.log('Image converted to data URL, size:', base64data.length);
      
      // Safety check for image data
      if (base64data && base64data.startsWith('data:image/')) {
        setCapturedImage(base64data);
        onCapture(base64data);
        console.log('Image successfully captured and set');
      } else {
        throw new Error('Invalid image data generated');
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