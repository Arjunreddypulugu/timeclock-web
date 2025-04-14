import { createGlobalStyle } from 'styled-components';

const GlobalStyles = createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }
  
  body {
    margin: 0;
    font-family: ${props => props.theme.fonts.body};
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    background-color: ${props => props.theme.colors.background.dark};
    color: ${props => props.theme.colors.text.primary};
  }
  
  a {
    color: ${props => props.theme.colors.primary};
    text-decoration: none;
    transition: ${props => props.theme.transitions.fast};
    
    &:hover {
      color: ${props => props.theme.colors.secondary};
    }
  }
  
  h1, h2, h3, h4, h5, h6 {
    font-family: ${props => props.theme.fonts.heading};
    margin: 0 0 ${props => props.theme.space.md} 0;
  }
  
  p {
    line-height: 1.6;
    margin-bottom: ${props => props.theme.space.md};
  }
  
  button, input, select, textarea {
    font-family: ${props => props.theme.fonts.body};
  }
  
  img {
    max-width: 100%;
  }
`;

export default GlobalStyles; 