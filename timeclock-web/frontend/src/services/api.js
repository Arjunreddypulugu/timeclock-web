// Use environment variable if available, otherwise default to localhost
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Detect if device is iOS
const isIOS = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};

// Log function for debugging
const logMessage = (message) => {
  console.log(`[API] ${message}`);
};

// Helper function to safely process image data before sending to API
const prepareImageData = (imageData) => {
  if (!imageData) return null;
  
  try {
    logMessage('Preparing image data for API');
    
    // Skip processing if not a string
    if (typeof imageData !== 'string') {
      logMessage('Image data is not a string');
      return null;
    }
    
    // Already in data URL format
    if (imageData.startsWith('data:image/')) {
      logMessage('Image is already in data URL format');
      return imageData;
    }
    
    // Try to convert to proper format
    logMessage('Converting image to proper format');
    return `data:image/jpeg;base64,${imageData}`;
  } catch (err) {
    logMessage(`Error preparing image data: ${err.message}`);
    return null;
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

// Helper function to convert Data URL to Blob - with iOS handling
function dataURLtoBlob(dataURL) {
  try {
    logMessage('Converting data URL to blob');
    
    // Handle both formats of data URL
    const splitDataURL = dataURL.split(',');
    if (splitDataURL.length !== 2) {
      throw new Error('Invalid data URL format');
    }
    
    // Get MIME type from the data URL
    const mimeMatch = splitDataURL[0].match(/:(.*?);/);
    if (!mimeMatch) {
      throw new Error('Could not extract MIME type');
    }
    
    const mimeString = mimeMatch[1];
    const byteString = atob(splitDataURL[1]);
    
    // Create ArrayBuffer
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    
    // Convert binary string to ArrayBuffer
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    // Special handling for iOS - limit blob size
    if (isIOS() && ab.byteLength > 1000000) {
      logMessage('Image too large for iOS, may encounter issues');
    }
    
    // Create and return blob 
    const blob = new Blob([ab], { type: mimeString });
    
    // Log blob size for debugging
    logMessage(`Created blob of type ${mimeString}, size: ${blob.size} bytes`);
    
    return blob;
  } catch (error) {
    logMessage(`Failed to convert data URL to blob: ${error.message}`);
    throw error;
  }
}

// Helper function for iOS-specific text/plain fallback
const createJSONTextPlain = (jsonData, imageData) => {
  try {
    const formText = new FormData();
    
    // Add JSON without image as text/plain
    const jsonWithoutImage = { ...jsonData };
    formText.append('json', JSON.stringify(jsonWithoutImage));
    
    // Add image as separate base64 text
    if (imageData) {
      formText.append('image', imageData);
    }
    
    logMessage('Created text/plain form data as iOS fallback');
    return formText;
  } catch (error) {
    logMessage(`Failed to create text/plain form: ${error.message}`);
    throw error;
  }
};

// Helper function to create form data - iOS friendly
async function createFormDataWithImage(jsonData, imageData, fileName) {
  const formData = new FormData();
  
  try {
    // Add JSON data
    formData.append('data', JSON.stringify(jsonData));
    logMessage('Added JSON data to form');
    
    // Add image if present
    if (imageData) {
      // For iOS, use a special minimal approach
      if (isIOS()) {
        try {
          // For iOS, try to minimize the image as much as possible
          const tempImg = document.createElement('img');
          tempImg.src = imageData;
          
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = 120; // Ultra small
          tempCanvas.height = 90;
          
          // Wait for image to load
          await new Promise(resolve => {
            tempImg.onload = resolve;
            // Set a timeout in case the image doesn't load
            setTimeout(resolve, 1000);
          });
          
          const ctx = tempCanvas.getContext('2d');
          ctx.drawImage(tempImg, 0, 0, 120, 90);
          
          // Create a tiny JPEG
          const tinyImage = tempCanvas.toDataURL('image/jpeg', 0.01);
          logMessage(`Created tiny image for iOS: ${tinyImage.length} bytes`);
          
          // Try to use the tiny image as blob
          try {
            const blob = dataURLtoBlob(tinyImage);
            formData.append('image', blob, fileName);
            logMessage('Successfully added tiny image blob to form data');
          } catch (blobError) {
            // If blob fails, use the base64 string directly
            formData.append('image', tinyImage);
            logMessage('Added tiny image as string to form data');
          }
        } catch (iosImageError) {
          logMessage(`iOS image processing error: ${iosImageError.message}, using original`);
          // If all else fails, just use the original image
          formData.append('image', imageData);
        }
      } else {
        // Standard approach for non-iOS
        try {
          const imageBlob = dataURLtoBlob(imageData);
          formData.append('image', imageBlob, fileName);
          logMessage(`Added image to form data as blob: ${fileName}`);
        } catch (blobError) {
          logMessage(`Blob creation failed: ${blobError.message}, using string`);
          formData.append('image', imageData);
        }
      }
    }
    
    return formData;
  } catch (error) {
    logMessage(`Failed to create form data: ${error.message}`);
    throw error;
  }
}

/**
 * Handles Clock In API call
 * @param {string} customerName - The customer name
 * @param {string} userId - The user ID
 * @param {number} latitude - The latitude coordinate
 * @param {number} longitude - The longitude coordinate
 * @param {string|null} imageData - Optional base64 image data
 * @param {string|null} subContractor - Optional subcontractor name
 * @returns {Promise<Object>} Response from API
 */
export const clockIn = async (customerName, userId, latitude, longitude, imageData, subContractor) => {
  try {
    console.log(`Clock In - Customer: ${customerName}, UserID: ${userId}, Location: ${latitude},${longitude}, Has Image: ${!!imageData}`);
    
    // Handle iOS image data without prefix
    let formattedImageData = imageData;
    
    // Check if the imageData is a simple base64 string without prefix (from iOS)
    if (imageData && !imageData.startsWith('data:')) {
      console.log('Adding prefix to iOS image data');
      formattedImageData = `data:image/jpeg;base64,${imageData}`;
    }
    
    const response = await fetch(`${API_URL}/record/clock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        customer_name: customerName,
        latitude,
        longitude,
        image: formattedImageData,
        ...(subContractor && { subcontractor: subContractor }),
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Clock in error response:', errorData);
      throw new Error(errorData.error || 'Failed to clock in');
    }

    return await response.json();
  } catch (error) {
    console.error('Clock in error:', error);
    throw error;
  }
};

/**
 * Handles Clock Out API call
 * @param {string} userId - The user ID
 * @param {number} latitude - The latitude coordinate
 * @param {number} longitude - The longitude coordinate
 * @param {string|null} imageData - Optional base64 image data
 * @returns {Promise<Object>} Response from API
 */
export const clockOut = async (userId, imageData) => {
  try {
    console.log(`Clock Out - UserID: ${userId}, Has Image: ${!!imageData}`);
    
    // Handle iOS image data without prefix
    let formattedImageData = imageData;
    
    // Check if the imageData is a simple base64 string without prefix (from iOS)
    if (imageData && !imageData.startsWith('data:')) {
      console.log('Adding prefix to iOS image data');
      formattedImageData = `data:image/jpeg;base64,${imageData}`;
    }
    
    const response = await fetch(`${API_URL}/record/clock-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        user_id: userId,
        image: formattedImageData,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.error('Clock out error response:', errorData);
      throw new Error(errorData.error || 'Failed to clock out');
    }

    return await response.json();
  } catch (error) {
    console.error('Clock out error:', error);
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
    logMessage('Testing image upload...');
    
    // For iOS, use a special minimal approach
    if (isIOS()) {
      logMessage('Using iOS-specific approach for test upload');
      
      // Create a small test image
      try {
        const tempImg = document.createElement('img');
        tempImg.src = imageData;
        
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 120;
        tempCanvas.height = 90;
        
        // Wait for image to load
        await new Promise(resolve => {
          tempImg.onload = resolve;
          setTimeout(resolve, 1000);
        });
        
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(tempImg, 0, 0, 120, 90);
        
        const tinyImage = tempCanvas.toDataURL('image/jpeg', 0.01);
        logMessage(`Created tiny test image: ${tinyImage.length} bytes`);
        
        // Use URL params for simplicity
        const response = await fetch(`${API_URL}/test-image-simple?image=true`, {
          method: 'GET'
        });
        
        const data = await response.json();
        return data;
      } catch (iosErr) {
        logMessage(`iOS test image creation failed: ${iosErr.message}`);
        // Fall through to standard approach
      }
    }
    
    // Try multipart upload first
    try {
      const formData = new FormData();
      const imageBlob = dataURLtoBlob(imageData);
      formData.append('image', imageBlob, 'test-image.jpg');
      
      const response = await fetch(`${API_URL}/test-image-multipart`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      logMessage('Test image response (multipart):', data);
      
      return data;
    } catch (multipartError) {
      logMessage(`Multipart test failed, trying JSON: ${multipartError.message}`);
      
      // Fall back to JSON if blob conversion fails
      const response = await fetch(`${API_URL}/test-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
      });
      
      const data = await response.json();
      logMessage('Test image response (JSON fallback):', data);
      
      return data;
    }
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