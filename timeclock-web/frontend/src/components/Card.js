import styled from 'styled-components';

const Card = styled.div`
  background-color: ${props => props.theme.colors.background.primary};
  border-radius: ${props => props.theme.radii.md};
  box-shadow: ${props => props.theme.shadows.md};
  padding: ${props => props.theme.space.xl};
  margin-bottom: ${props => props.theme.space.lg};
  width: 100%;
  max-width: 500px;
  transition: ${props => props.theme.transitions.default};
  
  &:hover {
    box-shadow: ${props => props.theme.shadows.lg};
    transform: translateY(-2px);
  }
  
  @media (max-width: 768px) {
    padding: ${props => props.theme.space.lg};
    margin-bottom: ${props => props.theme.space.md};
  }
`;

export default Card; 