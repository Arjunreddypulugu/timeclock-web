import React, { useState } from 'react';
import styled from 'styled-components';
import Camera from './Camera';
import FileUploader from './FileUploader';
import Button from './Button';

const Container = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
`;

const OptionButtons = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
  justify-content: center;
`;

const OptionButton = styled(Button)`
  flex: 1;
  max-width: 200px;
`;

const CaptureContainer = styled.div`
  width: 100%;
`;

const CaptureOptions = ({ onCapture, onClear, mode }) => {
  const [captureMethod, setCaptureMethod] = useState(null);
  
  const handleCapture = (imageData) => {
    if (onCapture) onCapture(imageData);
  };
  
  const handleClear = () => {
    if (onClear) onClear();
  };
  
  const resetMethod = () => {
    setCaptureMethod(null);
    handleClear();
  };
  
  if (!captureMethod) {
    return (
      <Container>
        <h3>Choose a photo method:</h3>
        <OptionButtons>
          <OptionButton variant="primary" onClick={() => setCaptureMethod('camera')}>
            Take a Photo
          </OptionButton>
          <OptionButton variant="secondary" onClick={() => setCaptureMethod('upload')}>
            Upload a Photo
          </OptionButton>
        </OptionButtons>
        <p style={{ textAlign: 'center', fontSize: '0.9em', color: '#666' }}>
          {mode === 'clockIn' ? 'Take or select a photo to clock in' : 'Take or select a photo to clock out'}
        </p>
        <p style={{ textAlign: 'center', fontSize: '0.8em', color: '#666' }}>
          Using iOS? Uploading a photo is recommended for best results.
        </p>
      </Container>
    );
  }
  
  return (
    <Container>
      <CaptureContainer>
        {captureMethod === 'camera' ? (
          <Camera onCapture={handleCapture} onClear={handleClear} />
        ) : (
          <FileUploader onCapture={handleCapture} onClear={handleClear} />
        )}
      </CaptureContainer>
      
      <Button variant="secondary" onClick={resetMethod} style={{ marginTop: '1rem' }}>
        Try Different Method
      </Button>
    </Container>
  );
};

export default CaptureOptions; 