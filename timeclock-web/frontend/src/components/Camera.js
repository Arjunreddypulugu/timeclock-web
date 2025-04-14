import React, { useRef, useState, useCallback, useEffect } from 'react';
import './Camera.css';

const Camera = ({ onCapture, onCancel, onError }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);
  
  // Helper function to set errors both locally and in parent
  const setError = useCallback((message) => {
    setCameraError(message);
    if (onError) {
      onError(message);
    }
  }, [onError]);
  
  const startCamera = useCallback(async () => {
    try {
      setCameraError('');
      setPermissionDenied(false);
      setVideoLoaded(false);
      
      // Stop any existing stream first
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      
      console.log("Requesting camera access...");
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });
      
      setStream(mediaStream);
      console.log("Camera access granted, setting up video element");
      
      if (videoRef.current) {
        // Reset video element
        if (videoRef.current.srcObject) {
          videoRef.current.srcObject = null;
        }
        
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded");
          videoRef.current.play()
            .then(() => {
              console.log("Camera started successfully");
              setIsVideoActive(true);
              setVideoLoaded(true);
            })
            .catch(err => {
              console.error("Error playing video:", err);
              setError("Could not play video stream. Please try again.");
            });
        };
        
        // Additional event listeners for troubleshooting
        videoRef.current.oncanplay = () => console.log("Video can play");
        videoRef.current.onplaying = () => console.log("Video is playing");
        videoRef.current.onerror = (e) => {
          console.error("Video error:", e);
          setError("Video error: " + (e.target.error ? e.target.error.message : "Unknown error"));
        };
      } else {
        console.error("Video reference is null");
        setError("Camera initialization failed. Please refresh and try again.");
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionDenied(true);
        setError("Camera access denied. Please allow camera access in your browser settings and try again.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setError("No camera found. Please ensure your device has a camera.");
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError("Camera is in use by another application or not accessible.");
      } else {
        setError("Could not access camera. Please ensure you've granted camera permissions.");
      }
    }
  }, [stream, setError]);
  
  const stopCamera = useCallback(() => {
    console.log("Stopping camera...");
    if (stream) {
      stream.getTracks().forEach(track => {
        console.log("Stopping track:", track.kind, track.readyState);
        track.stop();
      });
      setStream(null);
    }
    
    // Clear video source
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject = null;
    }
    
    setIsVideoActive(false);
    setVideoLoaded(false);
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (isCapturing) return; // Prevent multiple captures
    
    if (!isVideoActive || !videoRef.current || !canvasRef.current) {
      console.error("Cannot capture: video or canvas not ready");
      setError("Camera is not ready. Please try again.");
      return;
    }
    
    if (!videoLoaded) {
      console.error("Video not fully loaded yet");
      setError("Camera is still initializing. Please wait a moment and try again.");
      return;
    }
    
    // Set capturing state
    setIsCapturing(true);
    console.log("Starting photo capture...");
    
    // Small delay to ensure video is fully ready
    setTimeout(() => {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        // Double check that video dimensions are available
        if (!video.videoWidth || !video.videoHeight) {
          console.error("Video dimensions not available:", video.videoWidth, video.videoHeight);
          setError("Failed to capture photo. Video not fully loaded.");
          setIsCapturing(false);
          return;
        }
        
        console.log("Video dimensions:", video.videoWidth, video.videoHeight);
        
        // Set canvas dimensions to match video
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        // Draw video frame to canvas
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64 image
        const photoData = canvas.toDataURL('image/jpeg', 0.8);
        
        // Check if photo was captured successfully
        if (!photoData || photoData === 'data:,') {
          console.error("Failed to capture photo: empty data");
          setError("Failed to capture photo. Please try again.");
          setIsCapturing(false);
          return;
        }
        
        console.log("Photo captured successfully");
        
        // Stop camera after capturing
        stopCamera();
        
        // Pass photo data to parent component
        onCapture(photoData);
      } catch (err) {
        console.error("Error capturing photo:", err);
        setError("Failed to capture photo. Please try again.");
        setIsCapturing(false);
      }
    }, 500); // Increased delay before capture
  }, [isVideoActive, onCapture, stopCamera, isCapturing, videoLoaded, setError]);

  // Start camera when component mounts
  useEffect(() => {
    console.log("Camera component mounted, starting camera...");
    startCamera();
    
    // Cleanup function when component unmounts
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  // Retry camera initialization if it failed to load
  useEffect(() => {
    let retryTimeout;
    
    if (isVideoActive && !videoLoaded) {
      retryTimeout = setTimeout(() => {
        console.log("Video not loaded after activation, restarting camera");
        stopCamera();
        startCamera();
      }, 3000);
    }
    
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [isVideoActive, videoLoaded, startCamera, stopCamera]);

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
              autoPlay
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
                <p>Starting camera...</p>
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
          <button 
            onClick={capturePhoto} 
            className="capture-btn"
            disabled={isCapturing || !videoLoaded}
          >
            {isCapturing ? 'Capturing...' : (videoLoaded ? 'Take Photo' : 'Loading camera...')}
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

Camera.defaultProps = {
  onError: () => {}
};

export default Camera; 