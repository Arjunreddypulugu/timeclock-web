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
    // If photo is too large, compress it further
    if (clockInData.photo && clockInData.photo.length > 1000000) {
      clockInData.photo = compressImage(clockInData.photo);
    }
    
    const response = await fetch(`${API_URL}/clock-in`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clockInData),
    });
    return await response.json();
  } catch (error) {
    console.error('Clock in error:', error);
    throw error;
  }
};

export const clockOut = async (clockOutData) => {
  try {
    // If photo is too large, compress it further
    if (clockOutData.photo && clockOutData.photo.length > 1000000) {
      clockOutData.photo = compressImage(clockOutData.photo);
    }
    
    const response = await fetch(`${API_URL}/clock-out`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(clockOutData),
    });
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

// Helper function to compress images further if needed
function compressImage(base64Image) {
  // Create a temporary canvas
  const canvas = document.createElement('canvas');
  const img = new Image();
  img.src = base64Image;
  
  // Reduce image dimensions
  const maxWidth = 800;
  const maxHeight = 600;
  let width = img.width;
  let height = img.height;
  
  if (width > height) {
    if (width > maxWidth) {
      height *= maxWidth / width;
      width = maxWidth;
    }
  } else {
    if (height > maxHeight) {
      width *= maxHeight / height;
      height = maxHeight;
    }
  }
  
  canvas.width = width;
  canvas.height = height;
  
  // Draw the image at the reduced size
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  
  // Return compressed image
  return canvas.toDataURL('image/jpeg', 0.5); // Reduce quality to 50%
} 