import React from 'react';
import { Box, Typography } from '@mui/material';
import styled from '@emotion/styled';

const ErrorContainer = styled(Box)(({ theme }) => ({
  backgroundColor: theme.palette.error.light,
  color: theme.palette.error.contrastText,
  padding: theme.spacing(2),
  borderRadius: theme.shape.borderRadius,
  marginBottom: theme.spacing(2),
  marginTop: theme.spacing(2),
  width: '100%',
  textAlign: 'center',
  boxShadow: theme.shadows[2]
}));

const ErrorMessage = ({ message }) => {
  if (!message) return null;
  
  return (
    <ErrorContainer>
      <Typography variant="body1">{message}</Typography>
    </ErrorContainer>
  );
};

export default ErrorMessage; 