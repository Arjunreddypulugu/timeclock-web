import React from 'react';
import styled from 'styled-components';
import Logo from './Logo';

const Container = styled.div`
  min-height: 100vh;
  background: linear-gradient(135deg, ${props => props.theme.colors.background.dark} 0%, #2a4365 100%);
  padding: ${props => props.theme.space.md};
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Content = styled.main`
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  padding: ${props => props.theme.space.md} 0;
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const Footer = styled.footer`
  text-align: center;
  margin-top: auto;
  padding: ${props => props.theme.space.md};
  color: ${props => props.theme.colors.gray[400]};
  font-size: ${props => props.theme.fontSizes.sm};
  width: 100%;
`;

const ErrorContainer = styled.div`
  background-color: ${props => props.theme.colors.danger};
  color: white;
  padding: ${props => props.theme.space.md};
  border-radius: ${props => props.theme.radii.md};
  margin-bottom: ${props => props.theme.space.lg};
  width: 100%;
  max-width: 600px;
  text-align: center;
  font-weight: 500;
  box-shadow: ${props => props.theme.shadows.md};
  animation: shake 0.5s ease-in-out;
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
`;

const LoadingContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${props => props.theme.space.md};
  margin-bottom: ${props => props.theme.space.lg};
  color: white;
  
  .spinner {
    width: 40px;
    height: 40px;
    margin-bottom: ${props => props.theme.space.sm};
    border: 4px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: white;
    animation: spin 1s ease-in-out infinite;
  }
  
  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;

const Layout = ({ children, error, loading }) => {
  const currentYear = new Date().getFullYear();
  
  return (
    <Container>
      <Logo />
      
      {error && (
        <ErrorContainer>
          {error}
        </ErrorContainer>
      )}
      
      {loading && (
        <LoadingContainer>
          <div className="spinner"></div>
          Loading...
        </LoadingContainer>
      )}
      
      <Content>
        {children}
      </Content>
      
      <Footer>
        &copy; {currentYear} Van Dyk Recycling Solutions. All rights reserved.
      </Footer>
    </Container>
  );
};

export default Layout; 