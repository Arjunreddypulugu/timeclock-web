// Use environment variable if available, otherwise default to localhost
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Detect browser for better debugging
const getBrowser = () => {
  const userAgent = navigator.userAgent;
  let browserName = "Unknown";
  
  if (userAgent.match(/chrome|chromium|crios/i)) {
    browserName = "Chrome";
  } else if (userAgent.match(/firefox|fxios/i)) {
    browserName = "Firefox";
  } else if (userAgent.match(/safari/i) && !userAgent.match(/chrome|chromium|crios/i)) {
    browserName = "Safari";
  } else if (userAgent.match(/opr\//i)) {
    browserName = "Opera";
  } else if (userAgent.match(/edg/i)) {
    browserName = "Edge";
  }
  
  const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent);
  
  return { 
    name: browserName, 
    isMobile, 
    userAgent
  };
};

// Debug logger - only log in development
const debugLog = (message, data) => {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[${getBrowser().name}] ${message}`, data || '');
  }
};

// Helper function to validate and sanitize base64 image data
const sanitizeImageData = (imageData) => {
  if (!imageData) return '';
  
  debugLog('Original image data type:', typeof imageData);
  debugLog('Image data starts with:', imageData.substring(0, 30) + '...');
  
  // For Safari, ensure data is properly formatted
  try {
    // If it already has the data URI prefix, handle it with care
    if (imageData.startsWith('data:image/')) {
      // Safari sometimes adds whitespace or newlines - clean it up
      const cleanedData = imageData.trim();
      debugLog('Data already has prefix, returning cleaned data');
      return cleanedData;
    }
    
    // Check if it's a valid base64 string
    const isBase64 = /^[A-Za-z0-9+/=]+$/.test(imageData.replace(/\s/g, ''));
    if (!isBase64) {
      debugLog('Invalid base64 data detected, trying to clean');
      const cleaned = imageData.replace(/[^A-Za-z0-9+/=]/g, '');
      if (cleaned.length < 10) {
        throw new Error('Invalid image data format');
      }
      return `data:image/jpeg;base64,${cleaned}`;
    }
    
    // Otherwise, add the prefix
    debugLog('Adding prefix to base64 data');
    return `data:image/jpeg;base64,${imageData.replace(/\s/g, '')}`;
  } catch (error) {
    console.error('Error sanitizing image data:', error);
    throw new Error('Could not process image data: ' + error.message);
  }
};

// Helper function to safely parse JSON responses
const safeParseJSON = async (response) => {
  const text = await response.text();
  debugLog('Response status:', response.status);
  debugLog('Raw response text (first 100 chars):', text.substring(0, 100));
  
  try {
    return JSON.parse(text);
  } catch (error) {
    console.error('Error parsing JSON response:', error);
    console.error('Response text:', text);
    
    // Special handling for HTML responses (often from server errors)
    if (text.includes('<!DOCTYPE html>') || text.includes('<html>')) {
      debugLog('Received HTML instead of JSON');
      throw new Error('The server returned an HTML page instead of JSON. There might be a server error.');
    }
    
    throw new Error(`Failed to parse server response: ${text.substring(0, 150)}...`);
  }
};

export const verifyLocation = async (lat, lon) => {
  try {
    debugLog('Verifying location:', { lat, lon });
    
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
    debugLog('Getting user status for cookie:', cookie);
    
    const response = await fetch(`${API_URL}/user-status?cookie=${cookie}`);
    return await safeParseJSON(response);
  } catch (error) {
    console.error('Get user status error:', error);
    throw error;
  }
};

export const registerUser = async (userData) => {
  try {
    debugLog('Registering user:', userData);
    
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
    const browser = getBrowser();
    debugLog('API clockIn called with data:', {...clockInData, image: '(image data omitted)'});
    debugLog('Browser info:', browser);
    
    // Special handling for Safari
    let sanitizedData;
    try {
      // Ensure image is properly formatted for all browsers
      sanitizedData = {
        ...clockInData,
        image: sanitizeImageData(clockInData.image)
      };
      
      debugLog('Sanitized data:', {...sanitizedData, image: '(sanitized image data omitted)'});
    } catch (sanitizeError) {
      console.error('Error sanitizing data:', sanitizeError);
      throw new Error(`Image processing error: ${sanitizeError.message}`);
    }
    
    // Validate the JSON stringification before sending
    let requestBody;
    try {
      requestBody = JSON.stringify(sanitizedData);
      debugLog('Stringified request length:', requestBody.length);
    } catch (jsonError) {
      console.error('Error stringifying clock-in data:', jsonError);
      throw new Error('Failed to prepare clock-in data: ' + jsonError.message);
    }
    
    // For Safari and iOS, use a different fetch approach
    let response;
    if (browser.name === 'Safari') {
      debugLog('Using Safari-specific fetch approach');
      
      // Create a blob if there's an issue with long strings in Safari
      response = await fetch(`${API_URL}/clock-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Browser': browser.name,
          'X-Mobile': browser.isMobile ? 'true' : 'false'
        },
        body: requestBody,
        mode: 'cors',
        credentials: 'same-origin'
      });
    } else {
      // Standard approach for other browsers
      response = await fetch(`${API_URL}/clock-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Browser': browser.name,
          'X-Mobile': browser.isMobile ? 'true' : 'false'
        },
        body: requestBody,
      });
    }
    
    debugLog('Fetch response received:', { status: response.status, ok: response.ok });
    
    const data = await safeParseJSON(response);
    debugLog('API clockIn response:', data);
    
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
    const browser = getBrowser();
    debugLog('API clockOut called with data:', {...clockOutData, image: '(image data omitted)'});
    debugLog('Browser info:', browser);
    
    // Special handling for Safari
    let sanitizedData;
    try {
      // Ensure image is properly formatted for all browsers
      sanitizedData = {
        ...clockOutData,
        image: sanitizeImageData(clockOutData.image)
      };
      
      debugLog('Sanitized data:', {...sanitizedData, image: '(sanitized image data omitted)'});
    } catch (sanitizeError) {
      console.error('Error sanitizing data:', sanitizeError);
      throw new Error(`Image processing error: ${sanitizeError.message}`);
    }
    
    // Validate the JSON stringification before sending
    let requestBody;
    try {
      requestBody = JSON.stringify(sanitizedData);
      debugLog('Stringified request length:', requestBody.length);
    } catch (jsonError) {
      console.error('Error stringifying clock-out data:', jsonError);
      throw new Error('Failed to prepare clock-out data: ' + jsonError.message);
    }
    
    // For Safari and iOS, use a different fetch approach
    let response;
    if (browser.name === 'Safari') {
      debugLog('Using Safari-specific fetch approach');
      
      response = await fetch(`${API_URL}/clock-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Browser': browser.name,
          'X-Mobile': browser.isMobile ? 'true' : 'false'
        },
        body: requestBody,
        mode: 'cors',
        credentials: 'same-origin'
      });
    } else {
      // Standard approach for other browsers
      response = await fetch(`${API_URL}/clock-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Browser': browser.name,
          'X-Mobile': browser.isMobile ? 'true' : 'false'
        },
        body: requestBody,
      });
    }
    
    debugLog('Fetch response received:', { status: response.status, ok: response.ok });
    
    const data = await safeParseJSON(response);
    debugLog('API clockOut response:', data);
    
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