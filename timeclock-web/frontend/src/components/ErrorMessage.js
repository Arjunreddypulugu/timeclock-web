import React from 'react';
import styled from 'styled-components';

const ErrorContainer = styled.div`
  background-color: ${props => props.theme.colors.danger || '#f44336'};
  color: #fff;
  padding: 16px;
  border-radius: 4px;
  margin-bottom: 16px;
  margin-top: 16px;
  width: 100%;
  text-align: center;
  box-shadow: 0px 2px 4px rgba(0, 0, 0, 0.2);
`;

const ErrorText = styled.p`
  margin: 0;
`;

const ErrorMessage = ({ message }) => {
  if (!message) return null;
  
  return (
    <ErrorContainer>
      <ErrorText>{message}</ErrorText>
    </ErrorContainer>
  );
};

export default ErrorMessage; 