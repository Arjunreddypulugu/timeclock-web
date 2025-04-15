// Use environment variable if available, otherwise default to localhost
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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

export const clockIn = async (clockInData) => {
  try {
    console.log('API clockIn called with data:', {...clockInData, image: '(image data omitted)'});
    
    // Create a safe copy of the data
    const safeData = {...clockInData};
    delete safeData.image; // Remove image from the request data
    
    // Safely handle the image
    const formData = new FormData();
    
    // Add the JSON data
    formData.append('data', JSON.stringify(safeData));
    
    // Add the image as a separate part if it exists
    if (clockInData.image) {
      try {
        // Convert data URL to blob for more reliable transfer
        const imageBlob = dataURLtoBlob(clockInData.image);
        formData.append('image', imageBlob, 'clock-in.jpg');
        console.log('Added image to form data as blob');
      } catch (imgErr) {
        console.error('Failed to convert image to blob:', imgErr);
        // Fallback: Try to send as base64 in JSON
        safeData.image = clockInData.image;
      }
    }
    
    // Determine if we're using multipart or JSON based on whether the image conversion worked
    let response;
    if (formData.has('image')) {
      // Send as multipart form data (more reliable for binary data)
      response = await fetch(`${API_URL}/clock-in-multipart`, {
        method: 'POST',
        body: formData,
      });
    } else {
      // Fallback to JSON
      response = await fetch(`${API_URL}/clock-in`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(safeData),
      });
    }
    
    // Handle different response types
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('Non-JSON response:', text);
      throw new Error('Server returned invalid format. Please try again.');
    }
    
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
    
    // Create a safe copy of the data
    const safeData = {...clockOutData};
    delete safeData.image; // Remove image from the request data
    
    // Safely handle the image
    const formData = new FormData();
    
    // Add the JSON data
    formData.append('data', JSON.stringify(safeData));
    
    // Add the image as a separate part if it exists
    if (clockOutData.image) {
      try {
        // Convert data URL to blob for more reliable transfer
        const imageBlob = dataURLtoBlob(clockOutData.image);
        formData.append('image', imageBlob, 'clock-out.jpg');
        console.log('Added image to form data as blob');
      } catch (imgErr) {
        console.error('Failed to convert image to blob:', imgErr);
        // Fallback: Try to send as base64 in JSON
        safeData.image = clockOutData.image;
      }
    }
    
    // Determine if we're using multipart or JSON based on whether the image conversion worked
    let response;
    if (formData.has('image')) {
      // Send as multipart form data (more reliable for binary data)
      response = await fetch(`${API_URL}/clock-out-multipart`, {
        method: 'POST',
        body: formData,
      });
    } else {
      // Fallback to JSON
      response = await fetch(`${API_URL}/clock-out`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(safeData),
      });
    }
    
    // Handle different response types
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      console.error('Non-JSON response:', text);
      throw new Error('Server returned invalid format. Please try again.');
    }
    
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

// Helper function to convert Data URL to Blob
function dataURLtoBlob(dataURL) {
  // Convert base64 to raw binary data held in a string
  const byteString = atob(dataURL.split(',')[1]);
  
  // Get the MIME type
  const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
  
  // Create an array buffer
  const ab = new ArrayBuffer(byteString.length);
  
  // Create a view into the buffer
  const ia = new Uint8Array(ab);
  
  // Set the bytes to the buffer
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }
  
  // Create and return the blob
  return new Blob([ab], { type: mimeString });
}

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
    
    // Create a FormData object
    const formData = new FormData();
    
    try {
      // Convert data URL to blob
      const imageBlob = dataURLtoBlob(imageData);
      formData.append('image', imageBlob, 'test-image.jpg');
      
      const response = await fetch(`${API_URL}/test-image-multipart`, {
        method: 'POST',
        body: formData,
      });
      
      const data = await response.json();
      console.log('Test image response:', data);
      
      return data;
    } catch (blobErr) {
      console.error('Blob conversion failed, falling back to JSON:', blobErr);
      
      // Fallback to JSON if blob conversion fails
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