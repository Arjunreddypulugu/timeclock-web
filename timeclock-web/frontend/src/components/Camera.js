import React, { useRef, useState, useCallback, useEffect } from 'react';
import './Camera.css';

const Camera = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  
  const startCamera = useCallback(async () => {
    try {
      setCameraError('');
      setPermissionDenied(false);
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play()
            .then(() => {
              setIsVideoActive(true);
            })
            .catch(err => {
              console.error("Error playing video:", err);
              setCameraError("Could not play video stream. Please try again.");
            });
        };
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setCameraError("Camera access denied. Please allow camera access in your browser settings and try again.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setCameraError("No camera found. Please ensure your device has a camera.");
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setCameraError("Camera is in use by another application or not accessible.");
      } else {
        setCameraError("Could not access camera. Please ensure you've granted camera permissions.");
      }
    }
  }, []);
  
  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
    setIsVideoActive(false);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!isVideoActive || !videoRef.current || !canvasRef.current) return;
    
    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    try {
      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      // Draw video frame to canvas
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      // Convert to base64 image
      const photoData = canvas.toDataURL('image/jpeg', 0.8); // Slightly higher quality
      
      // Stop camera after capturing
      stopCamera();
      
      // Pass photo data to parent component
      onCapture(photoData);
    } catch (err) {
      console.error("Error capturing photo:", err);
      setCameraError("Failed to capture photo. Please try again.");
    }
  }, [isVideoActive, onCapture, stopCamera]);

  // Start camera when component mounts, but not automatically
  // This allows better user control over permissions
  useEffect(() => {
    // Cleanup function to stop camera when unmounting
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  // Auto-start camera if browser policy allows it (not on first load)
  useEffect(() => {
    const hasSeenCamera = sessionStorage.getItem('hasSeenCamera');
    if (hasSeenCamera === 'true') {
      startCamera();
    } else {
      // Don't auto-start first time for better UX around permissions
      sessionStorage.setItem('hasSeenCamera', 'true');
    }
  }, [startCamera]);

  return (
    <div className="camera-container">
      <div className="video-container">
        {isVideoActive ? (
          <>
            <video 
              ref={videoRef} 
              className="camera-video" 
              playsInline 
              muted
            />
            <div className="camera-overlay">
              <div className="face-guide"></div>
            </div>
          </>
        ) : (
          <div className="camera-placeholder">
            {permissionDenied ? (
              <div className="permission-denied">
                <span>📷</span>
                <p>Camera permission denied</p>
              </div>
            ) : (
              <div className="camera-start-prompt">
                <span>📷</span>
                <p>Camera access required</p>
              </div>
            )}
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
      
      {cameraError && (
        <div className="camera-message error-message">
          {cameraError}
        </div>
      )}
      
      <div className="camera-controls">
        {isVideoActive ? (
          <button onClick={capturePhoto} className="capture-btn">
            Take Photo
          </button>
        ) : (
          <button onClick={startCamera} className="start-btn">
            {permissionDenied ? 'Retry Camera Access' : 'Start Camera'}
          </button>
        )}
        <button onClick={onCancel} className="cancel-btn">
          Cancel
        </button>
      </div>
    </div>
  );
};

export default Camera; 