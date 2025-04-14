import React, { useState, useRef, useEffect } from 'react';
import './Camera.css';

const Camera = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [error, setError] = useState(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    // Function to initialize camera
    const setupCamera = async () => {
      try {
        // Clear any existing stream
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
        
        // Get camera stream
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'user',
            width: { ideal: 640 },
            height: { ideal: 480 } 
          },
          audio: false
        });
        
        // Save the stream reference for cleanup
        streamRef.current = stream;
        
        // Set video source
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraReady(true);
          setError(null);
        }
      } catch (err) {
        console.error('Camera setup error:', err);
        setError('Unable to access camera. Please ensure camera permissions are enabled.');
        setCameraReady(false);
      }
    };

    // Start camera when component mounts
    setupCamera();

    // Cleanup function to stop camera when component unmounts
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          track.stop();
        });
        streamRef.current = null;
      }
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      setCameraReady(false);
    };
  }, []);

  const takePhoto = () => {
    if (!cameraReady || !videoRef.current) return;
    
    try {
      const canvas = document.createElement('canvas');
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const context = canvas.getContext('2d');
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      const photoData = canvas.toDataURL('image/jpeg');
      
      // Stop the camera before sending back photo data
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      
      onCapture(photoData);
    } catch (err) {
      console.error('Error taking photo:', err);
      setError('Failed to capture photo.');
    }
  };

  const handleCancel = () => {
    // Stop the camera before canceling
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    
    onCancel();
  };

  return (
    <div className="camera-container">
      <div className="video-container">
        <video ref={videoRef} className="camera-video" playsInline />
      </div>
      
      {error && <div className="camera-error">{error}</div>}
      
      <div className="camera-controls">
        <button 
          className="capture-btn" 
          onClick={takePhoto} 
          disabled={!cameraReady}
        >
          Take Photo
        </button>
        <button className="cancel-btn" onClick={handleCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
};

export default Camera; 