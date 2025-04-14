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
  const [isMobile, setIsMobile] = useState(false);
  
  // Detect mobile devices
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(isMobileDevice);
      console.log("Device detected:", isMobileDevice ? "Mobile" : "Desktop");
    };
    
    checkMobile();
  }, []);
  
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
      
      // Different constraints for mobile vs desktop
      const constraints = {
        video: isMobile ? 
          { facingMode: { exact: "user" } } : // Force front camera on mobile
          { 
            facingMode: "user",
            width: { ideal: 1280 },
            height: { ideal: 720 }
          },
        audio: false
      };
      
      console.log("Using constraints:", JSON.stringify(constraints));
      
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      
      setStream(mediaStream);
      console.log("Camera access granted, setting up video element");
      
      if (videoRef.current) {
        // Reset video element
        if (videoRef.current.srcObject) {
          videoRef.current.srcObject = null;
        }
        
        videoRef.current.srcObject = mediaStream;
        
        // Try to handle mobile-specific issues
        videoRef.current.setAttribute('playsinline', true);
        videoRef.current.setAttribute('autoplay', true);
        videoRef.current.setAttribute('muted', true);
        
        // Use both event and promise-based approaches for better mobile support
        videoRef.current.onloadedmetadata = () => {
          console.log("Video metadata loaded");
          
          // Try to play video with both approaches for better mobile compatibility
          const playPromise = videoRef.current.play();
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                console.log("Camera started successfully via promise");
                setIsVideoActive(true);
                setVideoLoaded(true);
              })
              .catch(err => {
                console.error("Error playing video via promise:", err);
                // On mobile, we may need user interaction, so don't set error yet
                if (!isMobile) {
                  setError("Could not play video stream. Please try again or tap the Start Camera button.");
                }
              });
          }
        };
        
        // Additional event listeners for troubleshooting
        videoRef.current.oncanplay = () => {
          console.log("Video can play event triggered");
          setIsVideoActive(true);
          setVideoLoaded(true);
        };
        
        videoRef.current.onplaying = () => {
          console.log("Video is playing event triggered");
          setIsVideoActive(true);
          setVideoLoaded(true);
        };
        
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
      } else if (err.name === 'OverconstrainedError') {
        console.log("Constraints too strict, trying fallback...");
        // Fallback to basic constraints for mobile
        try {
          const fallbackStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: false 
          });
          
          setStream(fallbackStream);
          
          if (videoRef.current) {
            videoRef.current.srcObject = fallbackStream;
            videoRef.current.setAttribute('playsinline', true);
            videoRef.current.setAttribute('autoplay', true);
            videoRef.current.setAttribute('muted', true);
            
            // Try to play immediately
            videoRef.current.play()
              .then(() => {
                console.log("Camera started successfully with fallback");
                setIsVideoActive(true);
                setVideoLoaded(true);
              })
              .catch(e => console.error("Fallback play failed:", e));
          }
        } catch (fallbackErr) {
          console.error("Fallback camera access failed:", fallbackErr);
          setError("Could not access camera. Please ensure you've granted camera permissions.");
        }
      } else {
        setError("Could not access camera. Please ensure you've granted camera permissions.");
      }
    }
  }, [stream, setError, isMobile]);
  
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
    
    if (!videoRef.current || !canvasRef.current) {
      console.error("Cannot capture: video or canvas not ready");
      setError("Camera is not ready. Please try again.");
      return;
    }
    
    // On mobile, we might need to force video activation for capture
    if (!isVideoActive && videoRef.current.srcObject) {
      setIsVideoActive(true);
    }
    
    if (!videoLoaded && videoRef.current.srcObject) {
      setVideoLoaded(true);
    }
    
    // Set capturing state
    setIsCapturing(true);
    console.log("Starting photo capture...");
    
    // Small delay to ensure video is fully ready
    setTimeout(() => {
      try {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        
        // Special handling for mobile devices
        if (isMobile) {
          console.log("Mobile capture: using available dimensions");
          // Use the actual element dimensions on mobile
          const videoWidth = video.videoWidth || video.clientWidth || 640;
          const videoHeight = video.videoHeight || video.clientHeight || 480;
          
          canvas.width = videoWidth;
          canvas.height = videoHeight;
          
          console.log(`Using dimensions ${videoWidth}x${videoHeight} for capture`);
        } else {
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
        }
        
        // Draw video frame to canvas
        const context = canvas.getContext('2d');
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        
        // Convert to base64 image
        const photoData = canvas.toDataURL('image/jpeg', 0.7); // Lower quality for mobile
        
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
    }, isMobile ? 800 : 500); // Longer delay for mobile devices
  }, [isVideoActive, onCapture, stopCamera, isCapturing, videoLoaded, setError, isMobile]);

  // Attempt to start camera as soon as component mounts
  useEffect(() => {
    console.log("Camera component mounted");
    // For mobile, we'll wait for user interaction rather than auto-starting
    if (!isMobile) {
      console.log("Auto-starting camera on non-mobile device");
      startCamera();
    }
    
    // Cleanup function when component unmounts
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera, isMobile]);

  // Retry camera initialization if it failed to load
  useEffect(() => {
    let retryTimeout;
    
    if (isVideoActive && !videoLoaded && !isMobile) {
      retryTimeout = setTimeout(() => {
        console.log("Video not loaded after activation, restarting camera");
        stopCamera();
        startCamera();
      }, 3000);
    }
    
    return () => {
      if (retryTimeout) clearTimeout(retryTimeout);
    };
  }, [isVideoActive, videoLoaded, startCamera, stopCamera, isMobile]);

  return (
    <div className="camera-container">
      <div className="video-container">
        {/* Always render the video element to avoid mobile permission issues */}
        <video 
          ref={videoRef} 
          className="camera-video" 
          playsInline 
          muted
          autoPlay
          style={{ display: isVideoActive ? 'block' : 'none' }}
        />
        
        {isVideoActive && (
          <div className="camera-overlay">
            <div className="face-guide"></div>
          </div>
        )}
        
        {!isVideoActive && (
          <div className="camera-placeholder">
            {permissionDenied ? (
              <div className="permission-denied">
                <span>📷</span>
                <p>Camera permission denied</p>
              </div>
            ) : (
              <div className="camera-start-prompt">
                <span>📷</span>
                <p>{isMobile ? 'Tap "Start Camera" below' : 'Starting camera...'}</p>
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
            disabled={isCapturing}
          >
            {isCapturing ? 'Capturing...' : 'Take Photo'}
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