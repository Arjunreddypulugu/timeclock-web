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
  const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !window.MSStream;
  
  return { 
    name: browserName, 
    isMobile, 
    isIOS,
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

// Helper function to safely stringify large objects
const safeStringify = (obj) => {
  try {
    return JSON.stringify(obj);
  } catch (e) {
    console.error('Error stringifying object:', e);
    return '{"error": "Unable to stringify object"}';
  }
};

// Initialize browser info once
const browserInfo = getBrowser();
debugLog('Browser detected', browserInfo);

// Validate required fields and return any missing ones
const validateRequiredFields = (data, requiredFields) => {
  const missing = {};
  let hasMissing = false;
  
  for (const field of requiredFields) {
    // Special check for image data which could be very large
    if (field === 'image' && (!data.image || typeof data.image !== 'string' || !data.image.includes('base64'))) {
      missing[field] = true;
      hasMissing = true;
      continue;
    }
    
    // For other fields, just check if they exist and are not empty
    if (!data[field] || (typeof data[field] === 'string' && data[field].trim() === '')) {
      missing[field] = true;
      hasMissing = true;
    }
  }
  
  return { hasMissing, missing };
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
  // Ensure required fields are present
  const requiredFields = ['subContractor', 'employee', 'number', 'cookie'];
  const { hasMissing, missing } = validateRequiredFields(userData, requiredFields);
  
  if (hasMissing) {
    debugLog('Missing required fields for registration:', missing);
    throw new Error(`Missing required fields: ${Object.keys(missing).join(', ')}`);
  }
  
  try {
    // Make sure all fields are trimmed strings
    const sanitizedData = {
      subContractor: String(userData.subContractor || '').trim(),
      employee: String(userData.employee || '').trim(),
      number: String(userData.number || '').trim(),
      cookie: String(userData.cookie || '').trim()
    };
    
    // Save to localStorage as a backup
    try {
      localStorage.setItem('userDetails', JSON.stringify({
        SubContractor: sanitizedData.subContractor,
        Employee: sanitizedData.employee,
        Number: sanitizedData.number
      }));
      
      localStorage.setItem('emergencyUserData', JSON.stringify({
        subContractor: sanitizedData.subContractor,
        employee: sanitizedData.employee,
        number: sanitizedData.number
      }));
    } catch (e) {
      console.error('Error saving user details to localStorage:', e);
    }
    
    const response = await fetch(`${API_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sanitizedData),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      debugLog('Registration error:', errorText);
      throw new Error(errorText || `HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    debugLog('Registration failed:', error);
    throw new Error(`Registration failed: ${error.message}`);
  }
};

export const clockIn = async (clockInData) => {
  debugLog('Clock-in request received', { dataKeys: Object.keys(clockInData) });
  
  // Filter out undefined or null values
  const filteredData = Object.fromEntries(
    Object.entries(clockInData).filter(([_, v]) => v !== undefined && v !== null)
  );
  
  // Required fields for clock in
  const requiredFields = ['subContractor', 'employee', 'number', 'lat', 'lon', 'cookie'];
  
  // Log any missing fields
  const missingFieldNames = requiredFields.filter(field => 
    !filteredData[field] || 
    (typeof filteredData[field] === 'string' && filteredData[field].trim() === '')
  );
  
  if (missingFieldNames.length > 0) {
    debugLog('Missing required clock-in fields:', missingFieldNames);
    
    // Try to recover missing fields from localStorage
    let recovered = false;
    
    if ((missingFieldNames.includes('subContractor') || 
         missingFieldNames.includes('employee') || 
         missingFieldNames.includes('number'))) {
      
      try {
        // Try emergency data first
        const emergencyData = localStorage.getItem('emergencyUserData');
        if (emergencyData) {
          const parsed = JSON.parse(emergencyData);
          if (parsed.subContractor) filteredData.subContractor = parsed.subContractor;
          if (parsed.employee) filteredData.employee = parsed.employee; 
          if (parsed.number) filteredData.number = parsed.number;
          debugLog('Recovered missing fields from emergencyUserData', parsed);
          recovered = true;
        }
        
        // If still missing, try userDetails
        if (!recovered) {
          const userDetails = localStorage.getItem('userDetails');
          if (userDetails) {
            const parsed = JSON.parse(userDetails);
            if (parsed.SubContractor) filteredData.subContractor = parsed.SubContractor;
            if (parsed.Employee) filteredData.employee = parsed.Employee;
            if (parsed.Number) filteredData.number = parsed.Number;
            debugLog('Recovered missing fields from userDetails', parsed);
            recovered = true;
          }
        }
      } catch (e) {
        console.error('Error recovering data from localStorage:', e);
      }
    }
    
    // If we couldn't recover fields, throw detailed error
    const stillMissingFields = requiredFields.filter(field => 
      !filteredData[field] || 
      (typeof filteredData[field] === 'string' && filteredData[field].trim() === '')
    );
    
    if (stillMissingFields.length > 0) {
      debugLog('Still missing fields after recovery attempt:', stillMissingFields);
      
      const error = new Error(`Missing required fields: ${stillMissingFields.join(', ')}`);
      error.missing = stillMissingFields.reduce((acc, field) => {
        acc[field] = true;
        return acc;
      }, {});
      throw error;
    }
  }
  
  // Verify image data if provided
  if (filteredData.image && typeof filteredData.image === 'string') {
    if (!filteredData.image.includes('base64') && !filteredData.image.startsWith('data:image/')) {
      throw new Error('Invalid image format');
    }
  }
  
  // Prepare data for sending - make sure all string fields are actually strings
  const sanitizedData = {
    subContractor: String(filteredData.subContractor || '').trim(),
    employee: String(filteredData.employee || '').trim(),
    number: String(filteredData.number || '').trim(),
    lat: filteredData.lat,
    lon: filteredData.lon,
    cookie: String(filteredData.cookie || '').trim(),
    notes: String(filteredData.notes || '').trim(),
    image: filteredData.image || '',
    browserInfo: filteredData.browserInfo || browserInfo.name,
    isMobile: filteredData.isMobile !== undefined ? filteredData.isMobile : browserInfo.isMobile,
    isIOS: browserInfo.isIOS
  };
  
  // Move any non-standard fields into browserInfo for debugging
  const standardFields = ['subContractor', 'employee', 'number', 'lat', 'lon', 'cookie', 'notes', 'image', 'browserInfo', 'isMobile', 'isIOS'];
  
  const extraFields = Object.keys(filteredData).filter(key => !standardFields.includes(key));
  if (extraFields.length > 0) {
    sanitizedData.extraData = {};
    extraFields.forEach(field => {
      sanitizedData.extraData[field] = filteredData[field];
    });
    debugLog('Moving non-standard fields to extraData:', extraFields);
  }
  
  try {
    debugLog('Sending clock-in data', { sanitizedDataKeys: Object.keys(sanitizedData) });
    
    // Special handling for Safari/iOS
    if (browserInfo.name === 'Safari' || browserInfo.isIOS) {
      debugLog('Using Safari-specific API approach');
      
      try {
        // For Safari/iOS, we'll use a different approach that doesn't involve
        // sending the entire image data as JSON, which can be problematic
        
        // First try to get blob from image data
        let imageBlob = null;
        let didCreateBlob = false;
        
        try {
          if (sanitizedData.image && sanitizedData.image.startsWith('data:')) {
            debugLog('Converting image data to blob...');
            const base64Response = await fetch(sanitizedData.image);
            imageBlob = await base64Response.blob();
            didCreateBlob = true;
            debugLog('Successfully converted image to blob', { 
              size: imageBlob.size,
              type: imageBlob.type
            });
          }
        } catch (imageError) {
          console.error('Failed to convert image to blob:', imageError);
          debugLog('Image conversion failed:', { error: imageError.message });
        }
        
        // Create a FormData object for multipart/form-data
        const formData = new FormData();
        
        // Add browser info to help with debugging
        formData.append('browserInfo', browserInfo.name);
        formData.append('isMobile', browserInfo.isIOS ? 'true' : 'false');
        
        // Add all the fields except image
        Object.keys(sanitizedData).forEach(key => {
          if (key !== 'image') {
            formData.append(key, sanitizedData[key]);
            debugLog(`Added form field: ${key}`);
          }
        });
        
        // Add the image as a blob if we have it
        if (didCreateBlob && imageBlob && imageBlob.size > 0) {
          formData.append('image', imageBlob, 'photo.jpg');
          debugLog(`Added image blob to form data: ${imageBlob.size} bytes`);
        } else if (sanitizedData.image) {
          // If no blob but we have image string data, add it as a field
          debugLog('Using image data as string instead of blob');
          formData.append('imageData', sanitizedData.image);
          debugLog('Added image data string to form data');
        }
        
        // Log what we're about to send
        debugLog('Sending multipart form data to /api/clock-in-multipart');
        
        // Send the form data
        const response = await fetch(`${API_URL}/clock-in-multipart`, {
          method: 'POST',
          body: formData,
        });
      
        if (!response.ok) {
          const errorText = await response.text();
          debugLog('Clock-in error (multipart):', errorText);
          throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }
        
        try {
          const data = await response.json();
          debugLog('Received successful response from server:', data);
          return data;
        } catch (jsonError) {
          debugLog('Failed to parse server response (multipart):', jsonError);
          throw new Error('Failed to parse server response: ' + jsonError.message);
        }
      } catch (iosError) {
        debugLog('iOS-specific handling failed:', iosError);
        throw iosError;
      }
    } else {
      // Standard approach for other browsers
      const response = await fetch(`${API_URL}/clock-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: safeStringify(sanitizedData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        debugLog('Clock-in error:', errorText);
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }
      
      try {
        const data = await response.json();
        return data;
      } catch (jsonError) {
        debugLog('Failed to parse server response:', jsonError);
        throw new Error('Failed to parse server response: ' + jsonError.message);
      }
    }
  } catch (error) {
    debugLog('Clock-in failed:', error);
    
    // If this is a network error, be more specific
    if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection and try again.');
    }
    
    throw error;
  }
};

export const clockOut = async (clockOutData) => {
  debugLog('Clock-out request received', { dataKeys: Object.keys(clockOutData) });
  
  // Filter out undefined or null values
  const filteredData = Object.fromEntries(
    Object.entries(clockOutData).filter(([_, v]) => v !== undefined && v !== null)
  );
  
  // Required fields for clock out
  const requiredFields = ['cookie'];
  
  // Log any missing fields
  const missingFieldNames = requiredFields.filter(field => 
    !filteredData[field] || 
    (typeof filteredData[field] === 'string' && filteredData[field].trim() === '')
  );
  
  if (missingFieldNames.length > 0) {
    debugLog('Missing required clock-out fields:', missingFieldNames);
    throw new Error(`Missing required fields: ${missingFieldNames.join(', ')}`);
  }
  
  // Verify image data if provided
  if (filteredData.image && typeof filteredData.image === 'string') {
    if (!filteredData.image.includes('base64') && !filteredData.image.startsWith('data:image/')) {
      throw new Error('Invalid image format');
    }
  }
  
  // Prepare data for sending
  const sanitizedData = {
    cookie: String(filteredData.cookie || '').trim(),
    notes: String(filteredData.notes || '').trim(),
    image: filteredData.image || '',
    browserInfo: browserInfo.name,
    isMobile: browserInfo.isMobile,
    isIOS: browserInfo.isIOS
  };
  
  try {
    debugLog('Sending clock-out data', { sanitizedDataKeys: Object.keys(sanitizedData) });
    
    // Special handling for Safari/iOS
    if (browserInfo.name === 'Safari' || browserInfo.isIOS) {
      debugLog('Using Safari-specific API approach for clock-out');
      
      try {
        // First try to get blob from image data
        let imageBlob = null;
        let didCreateBlob = false;
        
        try {
          if (sanitizedData.image && sanitizedData.image.startsWith('data:')) {
            debugLog('Converting clock-out image data to blob...');
            const base64Response = await fetch(sanitizedData.image);
            imageBlob = await base64Response.blob();
            didCreateBlob = true;
            debugLog('Successfully converted clock-out image to blob', { 
              size: imageBlob.size,
              type: imageBlob.type
            });
          }
        } catch (imageError) {
          console.error('Failed to convert clock-out image to blob:', imageError);
          debugLog('Clock-out image conversion failed:', { error: imageError.message });
        }
        
        // Create a FormData object for multipart/form-data
        const formData = new FormData();
        
        // Add browser info to help with debugging
        formData.append('browserInfo', browserInfo.name);
        formData.append('isMobile', browserInfo.isIOS ? 'true' : 'false');
        
        // Add all the fields except image
        Object.keys(sanitizedData).forEach(key => {
          if (key !== 'image') {
            formData.append(key, sanitizedData[key]);
            debugLog(`Added clock-out form field: ${key}`);
          }
        });
        
        // Add the image as a blob if we have it
        if (didCreateBlob && imageBlob && imageBlob.size > 0) {
          formData.append('image', imageBlob, 'photo.jpg');
          debugLog(`Added clock-out image blob to form data: ${imageBlob.size} bytes`);
        } else if (sanitizedData.image) {
          // If no blob but we have image string data, add it as a field
          debugLog('Using clock-out image data as string instead of blob');
          formData.append('imageData', sanitizedData.image);
          debugLog('Added clock-out image data string to form data');
        }
        
        // Log what we're about to send
        debugLog('Sending multipart form data to /api/clock-out-multipart endpoint');
        
        // Send the form data
        const response = await fetch(`${API_URL}/clock-out-multipart`, {
          method: 'POST',
          body: formData,
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          debugLog('Clock-out error (multipart):', errorText);
          throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }
        
        try {
          const data = await response.json();
          debugLog('Received successful clock-out response:', data);
          return data;
        } catch (jsonError) {
          debugLog('Failed to parse clock-out server response:', jsonError);
          throw new Error('Failed to parse server response: ' + jsonError.message);
        }
      } catch (iosError) {
        debugLog('iOS-specific clock-out handling failed:', iosError);
        throw iosError;
      }
    } else {
      // Standard approach for other browsers
      const response = await fetch(`${API_URL}/clock-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: safeStringify(sanitizedData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        debugLog('Clock-out error:', errorText);
        throw new Error(errorText || `HTTP error! status: ${response.status}`);
      }
      
      try {
        const data = await response.json();
        return data;
      } catch (jsonError) {
        debugLog('Failed to parse server response:', jsonError);
        throw new Error('Failed to parse server response: ' + jsonError.message);
      }
    }
  } catch (error) {
    debugLog('Clock-out failed:', error);
    
    // If this is a network error, be more specific
    if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
      throw new Error('Network error. Please check your internet connection and try again.');
    }
    
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