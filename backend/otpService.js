// Create otpService.js file in your project root

const otpStore = {};

// Function to generate a 6-digit OTP
function generateOTP() {
  // Generate a random 6-digit number
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Function to store an OTP with expiration time (10 minutes)
function storeOTP(telegramId, email, otp) {
  const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes from now
  
  otpStore[telegramId] = {
    otp,
    email,
    expiresAt
  };
  
  // Set up automatic cleanup after expiration
  setTimeout(() => {
    if (otpStore[telegramId] && otpStore[telegramId].otp === otp) {
      delete otpStore[telegramId];
    }
  }, 10 * 60 * 1000);
  
  return otp;
}

// Function to verify an OTP
function verifyOTP(telegramId, enteredOTP) {
  const record = otpStore[telegramId];
  
  if (!record) {
    return { valid: false, message: 'OTP not found. Please request a new one.' };
  }
  
  if (Date.now() > record.expiresAt) {
    delete otpStore[telegramId];
    return { valid: false, message: 'OTP expired. Please request a new one.' };
  }
  
  if (record.otp !== enteredOTP) {
    return { valid: false, message: 'Invalid OTP. Please try again.' };
  }
  
  // OTP is valid, delete it so it can't be reused
  const email = record.email;
  delete otpStore[telegramId];
  
  return { valid: true, email };
}

// Function to check if a Telegram ID has an active OTP
function hasActiveOTP(telegramId) {
  return !!otpStore[telegramId] && otpStore[telegramId].expiresAt > Date.now();
}

// Function to get the email associated with an active OTP
function getEmailForOTP(telegramId) {
  if (hasActiveOTP(telegramId)) {
    return otpStore[telegramId].email;
  }
  return null;
}

module.exports = {
  generateOTP,
  storeOTP,
  verifyOTP,
  hasActiveOTP,
  getEmailForOTP
};