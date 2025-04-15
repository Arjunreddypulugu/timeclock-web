// Use environment variable if available, otherwise default to localhost
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Detect if device is iOS
const isIOS = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /iphone|ipad|ipod/.test(userAgent);
};

// Helper function to safely process image data before sending to API
const prepareImageData = (imageData) => {
  if (!imageData) return null;
  
  try {
    console.log('Preparing image data for API');
    
    // Skip processing if not a string
    if (typeof imageData !== 'string') {
      console.error('Image data is not a string');
      return null;
    }
    
    // Already in data URL format
    if (imageData.startsWith('data:image/')) {
      console.log('Image is already in data URL format');
      return imageData;
    }
    
    // Try to convert to proper format
    console.log('Converting image to proper format');
    return `data:image/jpeg;base64,${imageData}`;
  } catch (err) {
    console.error('Error preparing image data:', err);
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
      console.warn('Image too large for iOS, may encounter issues');
    }
    
    // Create and return blob 
    const blob = new Blob([ab], { type: mimeString });
    
    // Log blob size for debugging
    console.log(`Created blob of type ${mimeString}, size: ${blob.size} bytes`);
    
    return blob;
  } catch (error) {
    console.error('Failed to convert data URL to blob:', error);
    throw error;
  }
}

// Helper function to create form data - iOS friendly
async function createFormDataWithImage(jsonData, imageData, fileName) {
  const formData = new FormData();
  
  // Add JSON data
  formData.append('data', JSON.stringify(jsonData));
  
  // Add image if present
  if (imageData) {
    try {
      // For iOS, we'll use a different approach if blob creation fails
      let imageBlob;
      try {
        imageBlob = dataURLtoBlob(imageData);
      } catch (blobError) {
        console.error('Blob creation failed, using fallback for iOS', blobError);
        
        // iOS fallback - use fetch to convert data URL to blob
        const response = await fetch(imageData);
        imageBlob = await response.blob();
        console.log('Used fetch API to create blob instead');
      }
      
      // Add blob to form data
      formData.append('image', imageBlob, fileName);
      console.log(`Image added to form data, name: ${fileName}`);
    } catch (error) {
      console.error('Failed to add image to form data:', error);
      throw error;
    }
  }
  
  return formData;
}

export const clockIn = async (clockInData) => {
  try {
    console.log('API clockIn called with data:', {...clockInData, image: '(image data omitted)'});
    
    // Create a safe copy of the data 
    const safeData = {...clockInData};
    const imageData = safeData.image;
    delete safeData.image; // Remove image from JSON data
    
    // iOS often has issues with large payloads, so we'll always try to use FormData
    try {
      // Try to use FormData with Blob for all devices
      const formData = await createFormDataWithImage(safeData, imageData, 'clock-in.jpg');
      
      console.log('Using multipart form data for clock-in');
      const response = await fetch(`${API_URL}/clock-in-multipart`, {
        method: 'POST',
        body: formData
      });
      
      // Handle different response types
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log('API clockIn response:', data);
        
        if (!response.ok) {
          throw new Error(data.error || `Server error: ${response.status}`);
        }
        
        return data;
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned invalid format. Please try again.');
      }
    } catch (multipartError) {
      // If multipart fails, fall back to JSON
      console.error('Multipart request failed, falling back to JSON:', multipartError);
      
      // For fallback, we'll use base64 in JSON
      const fallbackData = {...safeData, image: imageData};
      
      const response = await fetch(`${API_URL}/clock-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackData)
      });
      
      const data = await response.json();
      console.log('API clockIn response (JSON fallback):', data);
      
      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }
      
      return data;
    }
  } catch (error) {
    console.error('Clock in API error:', error);
    throw error;
  }
};

export const clockOut = async (clockOutData) => {
  try {
    console.log('API clockOut called with data:', {...clockOutData, image: '(image data omitted)'});
    
    // Create a safe copy of the data
    const safeData = {...clockOutData};
    const imageData = safeData.image;
    delete safeData.image; // Remove image from JSON data
    
    // iOS often has issues with large payloads, so we'll always try to use FormData
    try {
      // Try to use FormData with Blob for all devices
      const formData = await createFormDataWithImage(safeData, imageData, 'clock-out.jpg');
      
      console.log('Using multipart form data for clock-out');
      const response = await fetch(`${API_URL}/clock-out-multipart`, {
        method: 'POST',
        body: formData
      });
      
      // Handle different response types
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        console.log('API clockOut response:', data);
        
        if (!response.ok) {
          throw new Error(data.error || `Server error: ${response.status}`);
        }
        
        return data;
      } else {
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error('Server returned invalid format. Please try again.');
      }
    } catch (multipartError) {
      // If multipart fails, fall back to JSON
      console.error('Multipart request failed, falling back to JSON:', multipartError);
      
      // For fallback, we'll use base64 in JSON
      const fallbackData = {...safeData, image: imageData};
      
      const response = await fetch(`${API_URL}/clock-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(fallbackData)
      });
      
      const data = await response.json();
      console.log('API clockOut response (JSON fallback):', data);
      
      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }
      
      return data;
    }
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
      console.log('Test image response (multipart):', data);
      
      return data;
    } catch (multipartError) {
      console.error('Multipart test failed, trying JSON:', multipartError);
      
      // Fall back to JSON if blob conversion fails
      const response = await fetch(`${API_URL}/test-image`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image: imageData }),
      });
      
      const data = await response.json();
      console.log('Test image response (JSON fallback):', data);
      
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