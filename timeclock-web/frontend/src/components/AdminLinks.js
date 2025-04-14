import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import Button from './Button';
import Card from './Card';
import { generateSubcontractorLinks, getSubcontractorLinks } from '../services/api';

const Container = styled.div`
  margin-bottom: ${props => props.theme.space.lg};
`;

const Title = styled.h2`
  color: ${props => props.theme.colors.primary};
  margin-bottom: ${props => props.theme.space.md};
  text-align: center;
`;

const LinkList = styled.div`
  margin-top: ${props => props.theme.space.md};
  max-height: 400px;
  overflow-y: auto;
  padding: ${props => props.theme.space.sm};
  background-color: ${props => props.theme.colors.background};
  border-radius: ${props => props.theme.radii.md};
`;

const LinkItem = styled.div`
  padding: ${props => props.theme.space.sm};
  border-bottom: 1px solid ${props => props.theme.colors.border};
  
  &:last-child {
    border-bottom: none;
  }
`;

const SubcontractorName = styled.div`
  font-weight: bold;
  margin-bottom: ${props => props.theme.space.xs};
`;

const LinkDisplay = styled.div`
  word-break: break-all;
  font-family: monospace;
  font-size: 0.85em;
  background-color: #f5f5f5;
  padding: ${props => props.theme.space.xs};
  border-radius: ${props => props.theme.radii.sm};
  margin-bottom: ${props => props.theme.space.xs};
`;

const Message = styled.div`
  margin-top: ${props => props.theme.space.md};
  padding: ${props => props.theme.space.sm};
  border-radius: ${props => props.theme.radii.md};
  background-color: ${props => props.status === 'success' ? props.theme.colors.success : props.theme.colors.danger};
  color: white;
`;

const CopyButton = styled(Button)`
  margin-top: ${props => props.theme.space.xs};
  font-size: 0.8em;
  padding: 4px 8px;
`;

const AdminLinks = () => {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [copySuccess, setCopySuccess] = useState(null);
  
  useEffect(() => {
    fetchLinks();
  }, []);
  
  const fetchLinks = async () => {
    try {
      setLoading(true);
      const data = await getSubcontractorLinks();
      setLinks(data);
    } catch (err) {
      setMessage({
        text: `Error fetching links: ${err.message}`,
        status: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleGenerateLinks = async () => {
    try {
      setLoading(true);
      setMessage(null);
      
      const result = await generateSubcontractorLinks();
      
      if (result.success) {
        setMessage({
          text: result.message,
          status: 'success'
        });
        
        // Refresh links
        fetchLinks();
      }
    } catch (err) {
      setMessage({
        text: `Error generating links: ${err.message}`,
        status: 'error'
      });
    } finally {
      setLoading(false);
    }
  };
  
  const copyToClipboard = (link, index) => {
    navigator.clipboard.writeText(link).then(
      () => {
        setCopySuccess(index);
        setTimeout(() => setCopySuccess(null), 2000);
      },
      (err) => {
        console.error('Could not copy text: ', err);
      }
    );
  };
  
  return (
    <Card>
      <Container>
        <Title>Subcontractor Links</Title>
        
        <Button 
          variant="primary" 
          onClick={handleGenerateLinks}
          disabled={loading}
          fullWidth
        >
          {loading ? 'Processing...' : 'Generate Subcontractor Links'}
        </Button>
        
        {message && (
          <Message status={message.status}>
            {message.text}
          </Message>
        )}
        
        {links.length > 0 && (
          <LinkList>
            {links.map((link, index) => (
              <LinkItem key={index}>
                <SubcontractorName>{link.Subcontractor}</SubcontractorName>
                <LinkDisplay>{link.EncodedLink}</LinkDisplay>
                <CopyButton 
                  variant="secondary" 
                  onClick={() => copyToClipboard(link.EncodedLink, index)}
                >
                  {copySuccess === index ? 'Copied!' : 'Copy Link'}
                </CopyButton>
              </LinkItem>
            ))}
          </LinkList>
        )}
      </Container>
    </Card>
  );
};

export default AdminLinks; 