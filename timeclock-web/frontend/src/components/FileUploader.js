import React, { useRef, useState } from 'react';
import styled from 'styled-components';
import Button from './Button';

const UploaderContainer = styled.div`
  width: 100%;
  margin-bottom: ${props => props.theme.space.md};
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const InputContainer = styled.div`
  position: relative;
  width: 100%;
  max-width: 400px;
  margin-bottom: ${props => props.theme.space.md};
`;

const HiddenInput = styled.input`
  display: none;
`;

const ImagePreview = styled.img`
  width: 100%;
  max-width: 400px;
  height: auto;
  border-radius: ${props => props.theme.radii.md};
  margin-bottom: ${props => props.theme.space.md};
  display: ${props => (props.src ? 'block' : 'none')};
  object-fit: contain;
  border: 1px solid ${props => props.theme.colors.gray[300]};
`;

const UploadButton = styled(Button)`
  width: 100%;
  max-width: 400px;
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.danger};
  margin-top: ${props => props.theme.space.sm};
  text-align: center;
`;

const FileUploader = ({ onCapture, onClear }) => {
  const fileInputRef = useRef(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setError('');

    // Check file type
    if (!file.type.match('image.*')) {
      setError('Please select an image file (JPEG, PNG)');
      return;
    }

    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image is too large. Maximum size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const imageData = e.target.result;
      setPreviewUrl(imageData);
      onCapture(imageData);
    };

    reader.onerror = () => {
      setError('Error reading file. Please try again.');
    };

    reader.readAsDataURL(file);
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const clearImage = () => {
    setPreviewUrl('');
    setError('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    if (onClear) onClear();
  };

  return (
    <UploaderContainer>
      <ImagePreview src={previewUrl} alt="Preview" />
      
      <InputContainer>
        <HiddenInput
          type="file"
          accept="image/*"
          ref={fileInputRef}
          onChange={handleFileChange}
        />
        
        {previewUrl ? (
          <UploadButton variant="secondary" onClick={clearImage}>
            Clear Image
          </UploadButton>
        ) : (
          <UploadButton variant="primary" onClick={triggerFileInput}>
            Select Photo from Device
          </UploadButton>
        )}
      </InputContainer>
      
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </UploaderContainer>
  );
};

export default FileUploader; 