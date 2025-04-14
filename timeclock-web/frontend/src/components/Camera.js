import React, { useRef, useState, useEffect } from 'react';
import './Camera.css';

const Camera = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [isVideoActive, setIsVideoActive] = useState(false);
  const [error, setError] = useState('');
  const [isCapturing, setIsCapturing] = useState(false);
  
  // Simple function to start the camera
  const startCamera = async () => {
    try {
      setError('');
      console.log("Starting camera...");
      
      // Most basic camera request possible
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: true,
        audio: false
      });
      
      if (videoRef.current) {
        console.log("Got stream, setting to video element");
        videoRef.current.srcObject = stream;
        
        // Explicitly set video attributes for mobile
        videoRef.current.setAttribute('autoplay', '');
        videoRef.current.setAttribute('playsinline', '');
        videoRef.current.setAttribute('muted', '');
        
        // Mark video as active
        setIsVideoActive(true);
      }
    } catch (err) {
      console.error("Camera error:", err);
      setError("Could not access camera. Please check permissions and try again.");
    }
  };
  
  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
      }
    };
  }, []);
  
  // Simple photo capture function
  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current || isCapturing) return;
    
    setIsCapturing(true);
    
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      // Set canvas size to video size or fallback to 640x480
      const width = video.videoWidth || video.clientWidth || 640;
      const height = video.videoHeight || video.clientHeight || 480;
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw video to canvas
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, width, height);
      
      // Get image data
      const imageData = canvas.toDataURL('image/jpeg', 0.8);
      
      // Stop the camera stream
      if (videoRef.current && videoRef.current.srcObject) {
        const tracks = videoRef.current.srcObject.getTracks();
        tracks.forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
      
      setIsVideoActive(false);
      setIsCapturing(false);
      
      // Pass the photo up to parent
      onCapture(imageData);
    } catch (err) {
      console.error("Error capturing photo:", err);
      setError("Failed to capture photo. Please try again.");
      setIsCapturing(false);
    }
  };
  
  return (
    <div className="camera-container">
      <div className="video-container">
        <video 
          ref={videoRef}
          className="camera-video"
          autoPlay
          playsInline
          muted
        />
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        
        {!isVideoActive && !error && (
          <div className="camera-placeholder">
            <div className="camera-start-prompt">
              <span>📷</span>
              <p>Tap "Start Camera" to begin</p>
            </div>
          </div>
        )}
      </div>
      
      {error && (
        <div className="camera-message error-message">{error}</div>
      )}
      
      <div className="camera-controls">
        {isVideoActive ? (
          <button 
            onClick={capturePhoto}
            className="capture-btn"
            disabled={isCapturing}
          >
            {isCapturing ? "Capturing..." : "Take Photo"}
          </button>
        ) : (
          <button 
            onClick={startCamera}
            className="start-btn"
          >
            Start Camera
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