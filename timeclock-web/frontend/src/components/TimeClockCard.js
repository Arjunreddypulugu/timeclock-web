import React from 'react';
import styled, { keyframes } from 'styled-components';
import Card from './Card';
import Button from './Button';
import TextArea from './TextArea';

const fadeIn = keyframes`
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
`;

const Container = styled.div`
  animation: ${fadeIn} 0.5s ease-out;
`;

const WelcomeMessage = styled.div`
  color: ${props => props.theme.colors.accent};
  font-family: ${props => props.theme.fonts.heading};
  font-size: ${props => props.theme.fontSizes['2xl']};
  font-weight: 600;
  text-align: center;
  margin-bottom: ${props => props.theme.space.lg};
`;

const ClockInfo = styled.div`
  background-color: ${props => props.theme.colors.background.secondary};
  border-radius: ${props => props.theme.radii.md};
  padding: ${props => props.theme.space.md};
  margin-bottom: ${props => props.theme.space.md};
  
  p {
    font-size: ${props => props.theme.fontSizes.lg};
    color: ${props => props.theme.colors.text.primary};
    text-align: center;
    margin: 0;
    
    span {
      font-weight: 600;
      color: ${props => props.theme.colors.primary};
    }
  }
`;

const TimeElapsed = styled.div`
  text-align: center;
  font-family: ${props => props.theme.fonts.heading};
  font-size: ${props => props.theme.fontSizes['3xl']};
  font-weight: 700;
  color: ${props => props.theme.colors.primary};
  margin: ${props => props.theme.space.md} 0;
  padding: ${props => props.theme.space.md};
  background-color: rgba(15, 76, 129, 0.1);
  border-radius: ${props => props.theme.radii.md};
`;

const Hint = styled.p`
  font-size: ${props => props.theme.fontSizes.sm};
  color: ${props => props.theme.colors.text.secondary};
  text-align: center;
  margin-top: ${props => props.theme.space.md};
  font-style: italic;
`;

const TimeClockCard = ({
  hasOpenSession,
  openSession,
  userDetails,
  handleClockIn,
  handleClockOut,
  notes,
  setNotes,
  loading,
  location,
  customerName
}) => {
  const formatTimestamp = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    });
  };
  
  return (
    <Card>
      <Container>
        <WelcomeMessage>
          Welcome back, {userDetails?.Employee || ''}!
        </WelcomeMessage>
        
        {hasOpenSession ? (
          <>
            <ClockInfo>
              <p>You clocked in at: <span>{formatTimestamp(openSession?.ClockIn)}</span></p>
            </ClockInfo>
            
            <TextArea
              label="Clock-out Notes"
              id="clockOutNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any notes for your clock-out..."
            />
            
            <Button
              variant="danger"
              fullWidth
              size="large"
              onClick={handleClockOut}
              disabled={loading}
            >
              {loading ? 'Processing...' : 'Clock Out'}
            </Button>
          </>
        ) : (
          <>
            <TextArea
              label="Clock-in Notes"
              id="clockInNotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Enter any notes for your clock-in..."
            />
            
            <Button
              variant="success"
              fullWidth
              size="large"
              onClick={handleClockIn}
              disabled={loading || !location.lat || !location.lon || !customerName || customerName === 'Unknown location'}
            >
              {loading ? 'Processing...' : 'Clock In'}
            </Button>
            
            {(!location.lat || !location.lon) && (
              <Hint>Please share your location to clock in</Hint>
            )}
            
            {(location.lat && location.lon && (!customerName || customerName === 'Unknown location')) && (
              <Hint>You must be at a valid worksite to clock in</Hint>
            )}
          </>
        )}
      </Container>
    </Card>
  );
};

export default TimeClockCard; 