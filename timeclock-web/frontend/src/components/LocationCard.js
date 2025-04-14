import React from 'react';
import styled, { keyframes } from 'styled-components';
import Card from './Card';
import Button from './Button';

const pulse = keyframes`
  0% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(15, 76, 129, 0.7);
  }
  
  70% {
    transform: scale(1);
    box-shadow: 0 0 0 10px rgba(15, 76, 129, 0);
  }
  
  100% {
    transform: scale(0.95);
    box-shadow: 0 0 0 0 rgba(15, 76, 129, 0);
  }
`;

const LocationIcon = styled.div`
  width: 60px;
  height: 60px;
  border-radius: 50%;
  background-color: ${props => props.theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 1.5rem auto;
  animation: ${pulse} 2s infinite;
  
  svg {
    fill: white;
    width: 30px;
    height: 30px;
  }
`;

const Title = styled.h2`
  font-family: ${props => props.theme.fonts.heading};
  font-size: ${props => props.theme.fontSizes['2xl']};
  color: ${props => props.theme.colors.text.primary};
  text-align: center;
  margin-bottom: ${props => props.theme.space.md};
`;

const LocationInfo = styled.div`
  background-color: ${props => props.theme.colors.background.secondary};
  border-radius: ${props => props.theme.radii.md};
  padding: ${props => props.theme.space.md};
  margin-top: ${props => props.theme.space.lg};
  
  p {
    margin: ${props => props.theme.space.xs} 0;
    color: ${props => props.theme.colors.text.primary};
    font-size: ${props => props.theme.fontSizes.md};
    display: flex;
    align-items: center;
    
    strong {
      margin-right: ${props => props.theme.space.xs};
      color: ${props => props.theme.colors.text.secondary};
    }
  }
`;

const Worksite = styled.div`
  margin-top: ${props => props.theme.space.md};
  padding: ${props => props.theme.space.md};
  border-radius: ${props => props.theme.radii.md};
  background-color: ${props => props.theme.colors.success};
  color: white;
  text-align: center;
  font-weight: 600;
  font-size: ${props => props.theme.fontSizes.lg};
  transform: translateY(0);
  animation: slideIn 0.5s ease-out;
  
  @keyframes slideIn {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;

const LocationCard = ({ 
  location, 
  worksite, 
  handleShareLocation,
  loading 
}) => {
  return (
    <Card>
      <LocationIcon>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
        </svg>
      </LocationIcon>
      
      <Title>Your Location</Title>
      
      <Button 
        variant="primary" 
        fullWidth 
        size="large" 
        onClick={handleShareLocation}
        disabled={loading}
      >
        {loading ? 'Getting Location...' : 'Share Location'}
      </Button>
      
      {location.lat && location.lon && (
        <LocationInfo>
          <p><strong>Latitude:</strong> {location.lat.toFixed(6)}</p>
          <p><strong>Longitude:</strong> {location.lon.toFixed(6)}</p>
          
          {worksite && (
            <Worksite>
              Worksite: {worksite}
            </Worksite>
          )}
        </LocationInfo>
      )}
    </Card>
  );
};

export default LocationCard; 