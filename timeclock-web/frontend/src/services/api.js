// Use environment variable if available, otherwise default to localhost
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const verifyLocation = async (lat, lon) => {
  try {
    const response = await fetch(`${API_URL}/verify-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lat, lon }),
    });
    return await response.json();
  } catch (error) {
    console.error('Location verification error:', error);
    throw error;
  }
};

export const getUserStatus = async (cookie) => {
  try {
    const response = await fetch(`${API_URL}/user-status?cookie=${cookie}`);
    return await response.json();
  } catch (error) {
    console.error('Get user status error:', error);
    throw error;
  }
};

export const registerUser = async (userData) => {
  try {
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
    });
    return await response.json();
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const clockIn = async (clockInData) => {
  try {
    console.log('API clockIn called with data:', {...clockInData, image: '(image data omitted)'});
    
    const response = await fetch(`${API_URL}/clock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clockInData),
    });
    
    // Check for non-JSON responses first
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const textResponse = await response.text();
      console.error('Non-JSON response received:', textResponse);
      throw new Error('Server returned non-JSON response. Please try again.');
    }
    
    const data = await response.json();
    console.log('API clockIn response:', data);
    
    if (!response.ok) {
      throw new Error(data.error || `Server error: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('Clock in API error:', error);
    throw error;
  }
};

export const clockOut = async (clockOutData) => {
  try {
    console.log('API clockOut called with data:', {...clockOutData, image: '(image data omitted)'});
    
    const response = await fetch(`${API_URL}/clock-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clockOutData),
    });
    
    // Check for non-JSON responses first
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const textResponse = await response.text();
      console.error('Non-JSON response received:', textResponse);
      throw new Error('Server returned non-JSON response. Please try again.');
    }
    
    const data = await response.json();
    console.log('API clockOut response:', data);
    
    if (!response.ok) {
      throw new Error(data.error || `Server error: ${response.status}`);
    }
    
    return data;
  } catch (error) {
    console.error('Clock out API error:', error);
    throw error;
  }
};

export const getTimeEntries = async (employeeId) => {
  try {
    const response = await fetch(`${API_URL}/time-entries/${employeeId}`);
    return await response.json();
  } catch (error) {
    console.error('Get time entries error:', error);
    throw error;
  }
};

export const testImageUpload = async (imageData) => {
  try {
    console.log('Testing image upload...');
    
    const response = await fetch(`${API_URL}/test-image`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ image: imageData }),
    });
    
    const data = await response.json();
    console.log('Test image response:', data);
    
    return data;
  } catch (error) {
    console.error('Test image error:', error);
    throw error;
  }
};

export const generateSubcontractorLinks = async () => {
  try {
    const response = await fetch(`${API_URL}/generate-subcontractor-links`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Generate subcontractor links error:', error);
    throw error;
  }
};

export const getSubcontractorLinks = async () => {
  try {
    const response = await fetch(`${API_URL}/subcontractor-links`);
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Get subcontractor links error:', error);
    throw error;
  }
}; 