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

// Browser detection helper
const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || 
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Safari detection
const isSafari = () => {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
};

const Camera = ({ onCapture, onClear }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [capturedImage, setCapturedImage] = useState(null);
  const [cameraError, setCameraError] = useState('');
  const [isMobileSafari, setIsMobileSafari] = useState(false);

  useEffect(() => {
    // Check if we're on iOS Safari
    setIsMobileSafari(isIOS() && isSafari());
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
          facingMode: 'user'
        }
      };
      
      // On iOS Safari, use specific constraints to avoid issues
      if (isIOS() && isSafari()) {
        constraints.video = {
          facingMode: 'user',
          width: 640,
          height: 480
        };
      }
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        
        // For iOS Safari, we need to play in response to a user gesture
        if (isIOS() && isSafari()) {
          videoRef.current.setAttribute('playsinline', true);
          videoRef.current.setAttribute('webkit-playsinline', true);
          // We'll automatically play when the stream is ready
          videoRef.current.onloadedmetadata = () => {
            videoRef.current.play().catch(e => {
              console.error('Error playing video:', e);
              setCameraError(`Error playing video: ${e.message}`);
            });
          };
        }
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      setCameraError(`Could not access camera: ${err.message}`);
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
      
      // Get data URL for preview
      const imageDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setCapturedImage(imageDataUrl);
      
      // For iOS Safari, we'll directly use the data URL
      if (isIOS() && isSafari()) {
        onCapture(imageDataUrl);
        return;
      }
      
      // For other browsers, convert to blob then base64
      canvas.toBlob(blob => {
        const imageUrl = URL.createObjectURL(blob);
        setCapturedImage(imageUrl);
        
        // Convert blob to base64 for API sending
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = () => {
          const base64data = reader.result;
          onCapture(base64data);
        };
      }, 'image/jpeg', 0.7); // JPEG format with 70% quality
    } catch (err) {
      console.error('Error capturing photo:', err);
      setCameraError(`Error capturing photo: ${err.message}`);
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
          webkit-playsinline="true"
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
      
      {isMobileSafari && (
        <div style={{ color: 'orange', marginBottom: '1rem', textAlign: 'center', fontSize: '0.9rem' }}>
          Using iOS Safari mode
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