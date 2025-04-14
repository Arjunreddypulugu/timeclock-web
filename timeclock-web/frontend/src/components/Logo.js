import React from 'react';
import styled from 'styled-components';

const LogoContainer = styled.div`
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
  width: 100%;
`;

const LogoImage = styled.img`
  max-width: 240px;
  height: auto;
`;

const Logo = () => {
  return (
    <LogoContainer>
      <LogoImage 
        src="https://vdrs.com/wp-content/uploads/2022/08/VDRS-lockup-mod-8-19-22-350.png" 
        alt="VDRS Logo" 
      />
    </LogoContainer>
  );
};

export default Logo; 