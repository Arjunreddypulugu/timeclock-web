// Use environment variable if available, otherwise default to localhost
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Helper function to validate and sanitize base64 image data
const sanitizeImageData = (imageData) => {
  if (!imageData) return '';
  
  // If it already has the data URI prefix, return as is
  if (imageData.startsWith('data:image/')) {
    return imageData;
  }
  
  // Otherwise, add the prefix
  return `data:image/jpeg;base64,${imageData}`;
};

// Helper function to safely parse JSON responses
const safeParseJSON = async (response) => {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Error parsing JSON response:', error);
    console.error('Response text:', text);
    throw new Error(`Failed to parse server response: ${text.substring(0, 150)}...`);
  }
};

export const verifyLocation = async (lat, lon) => {
  try {
    const response = await fetch(`${API_URL}/verify-location`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ lat, lon }),
    });
    return await safeParseJSON(response);
  } catch (error) {
    console.error('Location verification error:', error);
    throw error;
  }
};

export const getUserStatus = async (cookie) => {
  try {
    const response = await fetch(`${API_URL}/user-status?cookie=${cookie}`);
    return await safeParseJSON(response);
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
    return await safeParseJSON(response);
  } catch (error) {
    console.error('Registration error:', error);
    throw error;
  }
};

export const clockIn = async (clockInData) => {
  try {
    console.log('API clockIn called with data:', {...clockInData, image: '(image data omitted)'});
    
    // Ensure image is properly formatted for all browsers
    const sanitizedData = {
      ...clockInData,
      image: sanitizeImageData(clockInData.image)
    };
    
    // Validate the JSON stringification before sending
    let requestBody;
    try {
      requestBody = JSON.stringify(sanitizedData);
    } catch (jsonError) {
      console.error('Error stringifying clock-in data:', jsonError);
      throw new Error('Failed to prepare clock-in data: ' + jsonError.message);
    }
    
    const response = await fetch(`${API_URL}/clock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });
    
    const data = await safeParseJSON(response);
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
    
    // Ensure image is properly formatted for all browsers
    const sanitizedData = {
      ...clockOutData,
      image: sanitizeImageData(clockOutData.image)
    };
    
    // Validate the JSON stringification before sending
    let requestBody;
    try {
      requestBody = JSON.stringify(sanitizedData);
    } catch (jsonError) {
      console.error('Error stringifying clock-out data:', jsonError);
      throw new Error('Failed to prepare clock-out data: ' + jsonError.message);
    }
    
    const response = await fetch(`${API_URL}/clock-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: requestBody,
    });
    
    const data = await safeParseJSON(response);
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
    return await safeParseJSON(response);
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
      body: JSON.stringify({ image: sanitizeImageData(imageData) }),
    });
    
    const data = await safeParseJSON(response);
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
      const errorData = await safeParseJSON(response);
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    
    return await safeParseJSON(response);
  } catch (error) {
    console.error('Generate subcontractor links error:', error);
    throw error;
  }
};

export const getSubcontractorLinks = async () => {
  try {
    const response = await fetch(`${API_URL}/subcontractor-links`);
    
    if (!response.ok) {
      const errorData = await safeParseJSON(response);
      throw new Error(errorData.error || `Server error: ${response.status}`);
    }
    
    return await safeParseJSON(response);
  } catch (error) {
    console.error('Get subcontractor links error:', error);
    throw error;
  }
}; 