import axios from 'axios';

// Use environment variable for API URL or default to localhost
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

// Helper function to detect iOS devices
export const isIOS = () => {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

// Helper function to handle errors consistently
const handleError = (error, action) => {
  // Log the error for debugging
  console.error(`API ${action} error:`, error);
  
  let errorMessage = 'An unknown error occurred';
  
  if (error.response) {
    // The server responded with a status code outside of 2xx range
    errorMessage = error.response.data?.message || `Server error: ${error.response.status}`;
    console.log(`Server responded with error ${error.response.status}: ${errorMessage}`);
  } else if (error.request) {
    // The request was made but no response was received
    errorMessage = 'No response from server. Please check your connection.';
    console.log('No response received from server.');
  } else {
    // Something happened in setting up the request
    errorMessage = error.message || errorMessage;
    console.log(`Request setup error: ${errorMessage}`);
  }
  
  return {
    success: false,
    error: errorMessage
  };
};

// Register a new user
export const registerUser = async (userData) => {
  try {
    console.log('Registering user with data:', { ...userData, imageData: '[redacted]' });
    const response = await axios.post(`${API_URL}/register`, userData);
    console.log('Register response:', response.data);
    return {
      success: true,
      ...response.data
    };
  } catch (error) {
    return handleError(error, 'registration');
  }
};

// Check if a user is already registered
export const checkUser = async (cookieId) => {
  try {
    console.log('Checking user with cookieId:', cookieId);
    const response = await axios.get(`${API_URL}/check-user/${cookieId}`);
    console.log('Check user response:', response.data);
    return {
      success: true,
      ...response.data
    };
  } catch (error) {
    return handleError(error, 'check user');
  }
};

// Check if a user is currently clocked in
export const checkUserStatus = async (userId) => {
  try {
    console.log('Checking status for userId:', userId);
    const response = await axios.get(`${API_URL}/user-status/${userId}`);
    console.log('User status response:', response.data);
    return {
      success: true,
      ...response.data
    };
  } catch (error) {
    return handleError(error, 'check status');
  }
};

// Alias for checkUserStatus to maintain backward compatibility
export const getUserStatus = checkUserStatus;

// Clock in a user
export const clockIn = async (clockInData) => {
  try {
    console.log('Clocking in with data:', { 
      ...clockInData, 
      imageData: clockInData.imageData ? `[Image data: ${clockInData.imageData.length} chars]` : 'None' 
    });
    
    // Special handling for iOS devices
    const isIOS = clockInData.isIOS;
    if (isIOS) {
      console.log('Using iOS-specific handling for clock-in');
      
      // For iOS, we might need to compress the image or use a different format
      // This will depend on the specific iOS issues you're encountering
    }
    
    const response = await axios.post(`${API_URL}/clock-in`, clockInData, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000 // 30-second timeout for image upload
    });
    
    console.log('Clock in response:', response.data);
    return {
      success: true,
      ...response.data
    };
  } catch (error) {
    console.error('Clock in error details:', error);
    return handleError(error, 'clock in');
  }
};

// Clock out a user
export const clockOut = async (clockOutData) => {
  try {
    console.log('Clocking out with data:', { 
      ...clockOutData, 
      imageData: clockOutData.imageData ? `[Image data: ${clockOutData.imageData.length} chars]` : 'None' 
    });
    
    // Special handling for iOS devices
    const isIOS = clockOutData.isIOS;
    if (isIOS) {
      console.log('Using iOS-specific handling for clock-out');
      
      // For iOS, we might need to compress the image or use a different format
      // This will depend on the specific iOS issues you're encountering
    }
    
    const response = await axios.post(`${API_URL}/clock-out`, clockOutData, {
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000 // 30-second timeout for image upload
    });
    
    console.log('Clock out response:', response.data);
    return {
      success: true,
      ...response.data
    };
  } catch (error) {
    console.error('Clock out error details:', error);
    return handleError(error, 'clock out');
  }
};

// Get all subcontractor links
export const getSubcontractorLinks = async () => {
  try {
    const response = await axios.get(`${API_URL}/subcontractor-links`);
    return {
      success: true,
      links: response.data
    };
  } catch (error) {
    return handleError(error, 'get subcontractor links');
  }
};

// Create a new subcontractor link
export const createSubcontractorLink = async (subcontractorName) => {
  try {
    const response = await axios.post(`${API_URL}/subcontractor-links`, { subcontractorName });
    return {
      success: true,
      ...response.data
    };
  } catch (error) {
    return handleError(error, 'create subcontractor link');
  }
};

// Delete a subcontractor link
export const deleteSubcontractorLink = async (linkId) => {
  try {
    const response = await axios.delete(`${API_URL}/subcontractor-links/${linkId}`);
    return {
      success: true,
      ...response.data
    };
  } catch (error) {
    return handleError(error, 'delete subcontractor link');
  }
};

// Ultra-simple image conversion to string
const prepareImageForUpload = (imageData) => {
  if (!imageData) return null;
  
  // For iOS, we'll use a minimal image payload
  if (isIOS()) {
    console.log('Using iOS optimized image processing');
    // Ensure it's just the base64 data without prefix for iOS
    if (imageData.includes(',')) {
      return imageData.split(',')[1];
    }
    return imageData;
  }
  
  // For other devices, keep the data URL format
  return imageData;
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
    return await response.json();
  } catch (error) {
    console.error('Location verification error:', error);
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
    
    // Simplify for iOS
    if (isIOS()) {
      const simplifiedData = {
        image: prepareImageForUpload(imageData),
        _ios: true
      };
      
      const response = await fetch(`${API_URL}/test-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(simplifiedData),
      });
      
      const data = await response.json();
      console.log('Test image response (iOS):', data);
      return data;
    }
    
    // Standard for other devices
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