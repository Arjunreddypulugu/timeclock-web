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
    
    // Create a safe copy of the data with properly handled image
    const safeData = {...clockInData};
    
    // Ensure image is properly formatted for all browsers
    if (safeData.image && typeof safeData.image === 'string') {
      // Safari compatibility fix
      try {
        // Make sure image has the correct data URI prefix
        if (!safeData.image.startsWith('data:image/')) {
          safeData.image = 'data:image/jpeg;base64,' + safeData.image.replace(/^data:image\/\w+;base64,/, '');
        }
        
        // Clean up the base64 string for Safari - remove any whitespace or non-base64 characters
        const parts = safeData.image.split(',');
        if (parts.length > 1) {
          const prefix = parts[0];
          // Clean the base64 part - Keep only valid base64 characters
          let cleanBase64 = parts[1].replace(/[^A-Za-z0-9+/=]/g, '');
          // Make sure the string length is a multiple of 4 (required for valid base64)
          while (cleanBase64.length % 4 !== 0) {
            cleanBase64 += '=';
          }
          safeData.image = prefix + ',' + cleanBase64;
        }
      } catch (err) {
        console.error('Error formatting image data:', err);
        // Don't throw here, let the server handle it
      }
    }
    
    const response = await fetch(`${API_URL}/clock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(safeData),
    });
    
    // Check for non-JSON responses (which cause the error)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text);
      throw new Error('Server returned invalid format. Please try again.');
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
    
    // Create a safe copy of the data with properly handled image
    const safeData = {...clockOutData};
    
    // Ensure image is properly formatted for all browsers
    if (safeData.image && typeof safeData.image === 'string') {
      // Safari compatibility fix
      try {
        // Make sure image has the correct data URI prefix
        if (!safeData.image.startsWith('data:image/')) {
          safeData.image = 'data:image/jpeg;base64,' + safeData.image.replace(/^data:image\/\w+;base64,/, '');
        }
        
        // Clean up the base64 string for Safari - remove any whitespace or non-base64 characters
        const parts = safeData.image.split(',');
        if (parts.length > 1) {
          const prefix = parts[0];
          // Clean the base64 part - Keep only valid base64 characters
          let cleanBase64 = parts[1].replace(/[^A-Za-z0-9+/=]/g, '');
          // Make sure the string length is a multiple of 4 (required for valid base64)
          while (cleanBase64.length % 4 !== 0) {
            cleanBase64 += '=';
          }
          safeData.image = prefix + ',' + cleanBase64;
        }
      } catch (err) {
        console.error('Error formatting image data:', err);
        // Don't throw here, let the server handle it
      }
    }
    
    const response = await fetch(`${API_URL}/clock-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(safeData),
    });
    
    // Check for non-JSON responses (which cause the error)
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response:', text);
      throw new Error('Server returned invalid format. Please try again.');
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