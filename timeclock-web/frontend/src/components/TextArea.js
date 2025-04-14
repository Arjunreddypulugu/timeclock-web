import React from 'react';
import styled from 'styled-components';

const TextAreaWrapper = styled.div`
  margin-bottom: ${props => props.theme.space.md};
  width: 100%;
`;

const StyledLabel = styled.label`
  display: block;
  font-family: ${props => props.theme.fonts.heading};
  font-size: ${props => props.theme.fontSizes.sm};
  font-weight: 600;
  margin-bottom: ${props => props.theme.space.xs};
  color: ${props => props.theme.colors.text.primary};
`;

const StyledTextArea = styled.textarea`
  width: 100%;
  padding: ${props => props.theme.space.md};
  border: 1px solid ${props => props.error 
    ? props.theme.colors.danger 
    : props.theme.colors.gray[300]};
  border-radius: ${props => props.theme.radii.md};
  font-family: ${props => props.theme.fonts.body};
  font-size: ${props => props.theme.fontSizes.md};
  transition: ${props => props.theme.transitions.fast};
  background-color: ${props => props.theme.colors.background.primary};
  color: ${props => props.theme.colors.text.primary};
  resize: vertical;
  min-height: 100px;
  
  &:focus {
    outline: none;
    border-color: ${props => props.error 
      ? props.theme.colors.danger 
      : props.theme.colors.primary};
    box-shadow: 0 0 0 3px ${props => props.error 
      ? 'rgba(244, 67, 54, 0.2)' 
      : 'rgba(61, 133, 198, 0.2)'};
  }
  
  &::placeholder {
    color: ${props => props.theme.colors.gray[500]};
  }
`;

const ErrorMessage = styled.div`
  color: ${props => props.theme.colors.danger};
  font-size: ${props => props.theme.fontSizes.sm};
  margin-top: ${props => props.theme.space.xs};
`;

const TextArea = ({ 
  label, 
  id, 
  error, 
  ...rest 
}) => {
  return (
    <TextAreaWrapper>
      {label && <StyledLabel htmlFor={id}>{label}</StyledLabel>}
      <StyledTextArea id={id} error={error} {...rest} />
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </TextAreaWrapper>
  );
};

export default TextArea; 