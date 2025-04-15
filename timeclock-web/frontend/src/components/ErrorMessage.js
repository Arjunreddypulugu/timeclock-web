import React from 'react';
import styled from 'styled-components';
import { Typography } from '@mui/material';

const ErrorContainer = styled.div`
  padding: 12px 16px;
  margin: 8px 0;
  border-radius: 4px;
  background-color: rgba(244, 67, 54, 0.1);
  border: 1px solid rgba(244, 67, 54, 0.3);
`;

const ErrorMessage = ({ children }) => {
  if (!children) return null;
  
  return (
    <ErrorContainer>
      <Typography color="error">
        {children}
      </Typography>
    </ErrorContainer>
  );
};

export default ErrorMessage; 