import styled, { css } from 'styled-components';

const getButtonColor = (props) => {
  const { theme, variant } = props;
  
  switch (variant) {
    case 'primary':
      return css`
        background-color: ${theme.colors.primary};
        color: ${theme.colors.text.light};
        &:hover:not(:disabled) {
          background-color: ${theme.colors.secondary};
        }
      `;
    case 'success':
      return css`
        background-color: ${theme.colors.success};
        color: ${theme.colors.text.light};
        &:hover:not(:disabled) {
          background-color: #388e3c;
        }
      `;
    case 'danger':
      return css`
        background-color: ${theme.colors.danger};
        color: ${theme.colors.text.light};
        &:hover:not(:disabled) {
          background-color: #d32f2f;
        }
      `;
    case 'accent':
      return css`
        background-color: ${theme.colors.accent};
        color: ${theme.colors.text.light};
        &:hover:not(:disabled) {
          background-color: #e67e00;
        }
      `;
    case 'outline':
      return css`
        background-color: transparent;
        color: ${theme.colors.primary};
        border: 2px solid ${theme.colors.primary};
        &:hover:not(:disabled) {
          background-color: rgba(15, 76, 129, 0.1);
        }
      `;
    default:
      return css`
        background-color: ${theme.colors.primary};
        color: ${theme.colors.text.light};
        &:hover:not(:disabled) {
          background-color: ${theme.colors.secondary};
        }
      `;
  }
};

const Button = styled.button`
  font-family: ${props => props.theme.fonts.body};
  font-weight: 500;
  padding: ${props => props.size === 'large' 
    ? `${props.theme.space.md} ${props.theme.space.xl}` 
    : props.size === 'small' 
      ? `${props.theme.space.xs} ${props.theme.space.md}` 
      : `${props.theme.space.sm} ${props.theme.space.lg}`
  };
  font-size: ${props => props.size === 'large' 
    ? props.theme.fontSizes.lg 
    : props.size === 'small' 
      ? props.theme.fontSizes.sm 
      : props.theme.fontSizes.md
  };
  border-radius: ${props => props.theme.radii.md};
  border: none;
  cursor: pointer;
  transition: ${props => props.theme.transitions.default};
  box-shadow: ${props => props.theme.shadows.sm};
  width: ${props => props.fullWidth ? '100%' : 'auto'};
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${props => props.theme.space.sm};
  
  ${getButtonColor}
  
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  &:hover:not(:disabled) {
    transform: translateY(-2px);
    box-shadow: ${props => props.theme.shadows.md};
  }
  
  &:active:not(:disabled) {
    transform: translateY(1px);
    box-shadow: ${props => props.theme.shadows.sm};
  }
`;

export default Button; 