import React, { useRef, useState, useEffect } from 'react';
import styled from 'styled-components';
import { Button, CircularProgress, Typography } from '@mui/material';
import { isIOS } from '../services/api';

const CameraContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
`;

const VideoContainer = styled.div`
  width: 100%;
  position: relative;
  overflow: hidden;
  border-radius: 8px;
  margin-bottom: 16px;
  background-color: #f0f0f0;
`;

const StyledVideo = styled.video`
  width: 100%;
  height: auto;
  transform: ${props => props.mirror ? 'scaleX(-1)' : 'none'};
`;

const StyledCanvas = styled.canvas`
  display: none;
`;

const StyledImage = styled.img`
  width: 100%;
  height: auto;
  display: block;
  border-radius: 8px;
`;

const ButtonContainer = styled.div`
  display: flex;
  justify-content: space-around;
  width: 100%;
  margin-top: 16px;
`;

const Camera = ({ onCapture, onClose, facingMode = 'environment' }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cameraFacing, setCameraFacing] = useState(facingMode);
  const iOS = isIOS();

  useEffect(() => {
    let mounted = true;
    
    const startCamera = async () => {
      try {
        setLoading(true);
        setError(null);
        
        console.log(`Attempting to start camera with facing mode: ${cameraFacing}`);
        
        // Stop any existing stream
        if (stream) {
          stream.getTracks().forEach(track => track.stop());
        }

        // Special constraints for iOS
        const constraints = {
          audio: false,
          video: iOS ? 
            { facingMode: cameraFacing } : 
            { 
              facingMode: cameraFacing,
              width: { ideal: 1280 },
              height: { ideal: 720 }
            }
        };
        
        console.log('Camera constraints:', constraints);
        
        const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
        
        if (mounted) {
          console.log('Camera stream obtained successfully');
          setStream(mediaStream);
          
          if (videoRef.current) {
            videoRef.current.srcObject = mediaStream;
            
            // Special handling for iOS
            if (iOS) {
              videoRef.current.setAttribute('playsinline', 'true');
              videoRef.current.setAttribute('webkit-playsinline', 'true');
            }
          }
        }
      } catch (err) {
        console.error('Error starting camera:', err);
        if (mounted) {
          setError(`Camera error: ${err.message || 'Could not access camera'}`);
          
          // Try fallback to user facing camera if environment fails
          if (cameraFacing === 'environment' && !iOS) {
            console.log('Trying fallback to user facing camera');
            setCameraFacing('user');
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    startCamera();

    return () => {
      mounted = false;
      // Clean up by stopping all tracks
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [cameraFacing, iOS]);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    
    try {
      console.log('Capturing image...');
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw the video frame to the canvas
      const context = canvas.getContext('2d');
      
      // If using front camera (user), flip the image horizontally
      if (cameraFacing === 'user') {
        context.translate(canvas.width, 0);
        context.scale(-1, 1);
      }
      
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to data URL (base64)
      let imageDataUrl;
      
      // Special handling for iOS
      if (iOS) {
        // Lower quality for iOS to reduce data size
        imageDataUrl = canvas.toDataURL('image/jpeg', 0.5);
      } else {
        imageDataUrl = canvas.toDataURL('image/jpeg', 0.7);
      }
      
      console.log(`Captured image size: ${Math.round(imageDataUrl.length / 1024)} KB`);
      
      setCapturedImage(imageDataUrl);
    } catch (err) {
      console.error('Error capturing image:', err);
      setError(`Error capturing image: ${err.message}`);
    }
  };

  const handleAccept = () => {
    console.log('Accepting captured image');
    if (onCapture && capturedImage) {
      onCapture(capturedImage);
    }
  };

  const handleRetake = () => {
    console.log('Retaking photo');
    setCapturedImage(null);
  };

  const handleSwitchCamera = () => {
    const newMode = cameraFacing === 'user' ? 'environment' : 'user';
    console.log(`Switching camera to: ${newMode}`);
    setCameraFacing(newMode);
  };

  if (loading) {
    return (
      <CameraContainer>
        <CircularProgress />
        <Typography variant="body2" style={{ marginTop: 16 }}>
          Starting camera...
        </Typography>
      </CameraContainer>
    );
  }

  if (error) {
    return (
      <CameraContainer>
        <Typography color="error" variant="body1" style={{ marginBottom: 16 }}>
          {error}
        </Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={onClose}
        >
          Close
        </Button>
      </CameraContainer>
    );
  }

  return (
    <CameraContainer>
      {capturedImage ? (
        <>
          <VideoContainer>
            <StyledImage src={capturedImage} alt="Captured" />
          </VideoContainer>
          <ButtonContainer>
            <Button 
              variant="outlined" 
              color="secondary" 
              onClick={handleRetake}
            >
              Retake
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleAccept}
            >
              Accept
            </Button>
          </ButtonContainer>
        </>
      ) : (
        <>
          <VideoContainer>
            <StyledVideo 
              ref={videoRef}
              autoPlay 
              playsInline
              muted
              mirror={cameraFacing === 'user'}
            />
          </VideoContainer>
          <ButtonContainer>
            <Button 
              variant="outlined" 
              color="secondary" 
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button 
              variant="outlined" 
              color="primary" 
              onClick={handleSwitchCamera}
            >
              Switch Camera
            </Button>
            <Button 
              variant="contained" 
              color="primary" 
              onClick={handleCapture}
            >
              Capture
            </Button>
          </ButtonContainer>
        </>
      )}
      <StyledCanvas ref={canvasRef} />
    </CameraContainer>
  );
};

export default Camera; 