import React, { useRef, useState, useCallback } from 'react';

const Camera = ({ onCapture, onCancel }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [isVideoActive, setIsVideoActive] = useState(false);
  
  const startCamera = useCallback(async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'user' },
        audio: false
      });
      
      setStream(mediaStream);
      
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          setIsVideoActive(true);
        };
      }
    } catch (err) {
      console.error("Error accessing camera:", err);
      alert("Could not access camera. Please ensure you've granted camera permissions.");
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
    
    // Set canvas dimensions to match video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Draw video frame to canvas
    const context = canvas.getContext('2d');
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Convert to base64 image
    const photoData = canvas.toDataURL('image/jpeg', 0.7); // 0.7 quality to reduce size
    
    // Stop camera after capturing
    stopCamera();
    
    // Pass photo data to parent component
    onCapture(photoData);
  }, [isVideoActive, onCapture, stopCamera]);

  // Start camera when component mounts
  React.useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  return (
    <div className="camera-container">
      <div className="video-container">
        <video 
          ref={videoRef} 
          className="camera-video" 
          playsInline 
          muted
        />
        {isVideoActive && (
          <div className="camera-overlay">
            <div className="face-guide"></div>
          </div>
        )}
        <canvas ref={canvasRef} style={{ display: 'none' }} />
      </div>
      
      <div className="camera-controls">
        {isVideoActive ? (
          <button onClick={capturePhoto} className="capture-btn">
            Take Photo
          </button>
        ) : (
          <button onClick={startCamera} className="start-btn">
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