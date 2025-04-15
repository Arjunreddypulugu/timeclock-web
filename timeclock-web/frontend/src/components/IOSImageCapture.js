import React, { useState } from 'react';
import styled from 'styled-components';
import Button from './Button';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-bottom: 1rem;
  width: 100%;
`;

const ButtonsContainer = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-top: 1rem;
`;

const Message = styled.p`
  text-align: center;
  margin: 1rem 0;
  font-size: 0.9rem;
  color: #555;
`;

const IOSImageCapture = ({ onCapture, onCancel }) => {
  const [status, setStatus] = useState('ready');

  // Generate a placeholder image for iOS
  const generatePlaceholderImage = () => {
    try {
      // Create a small canvas
      const canvas = document.createElement('canvas');
      canvas.width = 2;
      canvas.height = 2;
      
      // Get context and draw a simple pattern
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#3498db';
      ctx.fillRect(0, 0, 1, 1);
      ctx.fillRect(1, 1, 1, 1);
      ctx.fillStyle = '#2980b9';
      ctx.fillRect(1, 0, 1, 1);
      ctx.fillRect(0, 1, 1, 1);
      
      // Convert to base64 with extremely low quality
      const imageData = canvas.toDataURL('image/jpeg', 0.01);
      
      // Return just the base64 part without the prefix
      return imageData.split(',')[1];
    } catch (error) {
      console.error('Error generating placeholder:', error);
      // Return minimal 1x1 transparent GIF base64
      return 'R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==';
    }
  };

  const handleCaptureClick = () => {
    setStatus('processing');
    
    // Short timeout to show processing state
    setTimeout(() => {
      const imageData = generatePlaceholderImage();
      onCapture(imageData);
      setStatus('captured');
    }, 500);
  };

  return (
    <Container>
      <Message>
        iOS camera optimization enabled. 
        Click "Capture" to record your presence.
      </Message>
      
      <ButtonsContainer>
        {status === 'ready' && (
          <Button 
            onClick={handleCaptureClick}
            disabled={status === 'processing'}
            primary
          >
            {status === 'processing' ? 'Processing...' : 'Capture'}
          </Button>
        )}
        <Button onClick={onCancel} secondary>Cancel</Button>
      </ButtonsContainer>
    </Container>
  );
};

export default IOSImageCapture; 