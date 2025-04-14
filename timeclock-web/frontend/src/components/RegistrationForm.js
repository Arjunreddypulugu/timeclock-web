import React, { useState } from 'react';
import styled from 'styled-components';
import Card from './Card';
import Input from './Input';
import Button from './Button';

const Title = styled.h2`
  font-family: ${props => props.theme.fonts.heading};
  font-size: ${props => props.theme.fontSizes['2xl']};
  color: ${props => props.theme.colors.text.primary};
  text-align: center;
  margin-bottom: ${props => props.theme.space.lg};
`;

const StyledForm = styled.form`
  width: 100%;
`;

const RegistrationForm = ({ 
  handleRegister, 
  loading,
  subContractor,
  setSubContractor,
  employeeName,
  setEmployeeName,
  phoneNumber,
  setPhoneNumber
}) => {
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!subContractor.trim()) {
      newErrors.subContractor = 'Sub Contractor is required';
    }

    if (!employeeName.trim()) {
      newErrors.employeeName = 'Name is required';
    }

    if (!phoneNumber.trim()) {
      newErrors.phoneNumber = 'Phone Number is required';
    } else if (!/^\d{10}$/.test(phoneNumber.replace(/\D/g, ''))) {
      newErrors.phoneNumber = 'Please enter a valid 10-digit phone number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validate()) {
      handleRegister(e);
    }
  };

  return (
    <Card>
      <Title>New User Registration</Title>
      <StyledForm onSubmit={handleSubmit}>
        <Input
          label="Sub Contractor"
          id="subContractor"
          value={subContractor}
          onChange={(e) => setSubContractor(e.target.value)}
          placeholder="Enter sub contractor name"
          error={errors.subContractor}
          disabled={loading}
        />
        
        <Input
          label="Your Name"
          id="employeeName"
          value={employeeName}
          onChange={(e) => setEmployeeName(e.target.value)}
          placeholder="Enter your full name"
          error={errors.employeeName}
          disabled={loading}
        />
        
        <Input
          label="Phone Number"
          id="phoneNumber"
          type="tel"
          value={phoneNumber}
          onChange={(e) => setPhoneNumber(e.target.value)}
          placeholder="Enter your phone number"
          error={errors.phoneNumber}
          disabled={loading}
        />
        
        <Button 
          type="submit" 
          variant="accent" 
          fullWidth 
          size="large"
          disabled={loading}
        >
          {loading ? 'Registering...' : 'Register'}
        </Button>
      </StyledForm>
    </Card>
  );
};

export default RegistrationForm; 