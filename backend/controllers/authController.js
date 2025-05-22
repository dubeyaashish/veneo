const db = require('../db');
const otpService = require('../otpService');
const emailService = require('../emailService');

// POST /api/auth/telegram
async function authenticateTelegram(req, res) {
  try {
    const telegramUser = req.body;

    if (!telegramUser.id || !telegramUser.first_name) {
      return res.status(400).json({ success: false, message: 'Invalid Telegram data' });
    }

    const [userRows] = await db.pool.query('SELECT * FROM users WHERE telegram_id = ?', [telegramUser.id]);

    let user;
    let isNewUser = false;

    if (userRows.length === 0) {
      const [result] = await db.pool.query(
        'INSERT INTO users (telegram_id, first_name, last_name, username, photo_url, auth_date, registration_complete) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [telegramUser.id, telegramUser.first_name, telegramUser.last_name || '', telegramUser.username || '', telegramUser.photo_url || '', telegramUser.auth_date || Math.floor(Date.now() / 1000), false]
      );
      const [newUser] = await db.pool.query('SELECT * FROM users WHERE id = ?', [result.insertId]);
      user = newUser[0];
      isNewUser = true;
    } else {
      user = userRows[0];
      await db.pool.query(
        'UPDATE users SET first_name = ?, last_name = ?, username = ?, photo_url = ?, auth_date = ? WHERE telegram_id = ?',
        [telegramUser.first_name, telegramUser.last_name || '', telegramUser.username || '', telegramUser.photo_url || '', telegramUser.auth_date || Math.floor(Date.now() / 1000), telegramUser.id]
      );
    }

    const [staffRows] = await db.pool.query('SELECT * FROM staff_telegram_mapping WHERE telegram_id = ?', [telegramUser.id]);

    const userResponse = {
      id: user.id,
      telegram_id: user.telegram_id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      photo_url: user.photo_url,
      email: user.email,
      employee_id: user.employee_id,
      staff_code: staffRows.length > 0 ? staffRows[0].staff_code : null,
      department: user.department,
      registration_complete: isNewUser ? false : user.registration_complete === 1
    };

    res.json({ success: true, user: userResponse });
  } catch (error) {
    console.error('Error in Telegram authentication:', error);
    res.status(500).json({ success: false, message: 'Authentication failed' });
  }
}

// POST /api/auth/complete-registration
async function completeRegistration(req, res) {
  try {
    const userData = req.body;

    if (!userData.telegram_id) {
      return res.status(400).json({ success: false, message: 'Invalid user data' });
    }

    if (!userData.email || !userData.employee_id || !userData.department) {
      return res.status(400).json({ success: false, message: 'Email, Employee ID, and Department are required' });
    }

    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(userData.email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }

    const [userRows] = await db.pool.query('SELECT * FROM users WHERE telegram_id = ?', [userData.telegram_id]);
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    await db.pool.query(
      'UPDATE users SET email = ?, employee_id = ?, department = ?, registration_complete = TRUE WHERE telegram_id = ?',
      [userData.email, userData.employee_id, userData.department, userData.telegram_id]
    );

    try {
      const [mappingRows] = await db.pool.query('SELECT * FROM staff_telegram_mapping WHERE telegram_id = ?', [userData.telegram_id]);
      if (mappingRows.length === 0) {
        await db.pool.query('INSERT INTO staff_telegram_mapping (telegram_id, staff_code) VALUES (?, ?)', [userData.telegram_id, userData.employee_id]);
      } else {
        await db.pool.query('UPDATE staff_telegram_mapping SET staff_code = ? WHERE telegram_id = ?', [userData.employee_id, userData.telegram_id]);
      }
    } catch (error) {
      console.error('Error creating staff mapping:', error);
    }

    const [updatedRows] = await db.pool.query(
      'SELECT u.*, stm.staff_code FROM users u LEFT JOIN staff_telegram_mapping stm ON u.telegram_id = stm.telegram_id WHERE u.telegram_id = ?',
      [userData.telegram_id]
    );

    if (updatedRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found after update' });
    }

    const user = updatedRows[0];
    const userResponse = {
      id: user.id,
      telegram_id: user.telegram_id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      photo_url: user.photo_url,
      email: user.email,
      employee_id: user.employee_id,
      department: user.department,
      staff_code: user.staff_code,
      registration_complete: user.registration_complete === 1
    };

    res.json({ success: true, user: userResponse });
  } catch (error) {
    console.error('Error in registration:', error);
    res.status(500).json({ success: false, message: 'Registration failed' });
  }
}

// POST /api/auth/send-otp
async function sendOTP(req, res) {
  try {
    const { telegram_id, email, employee_id, department } = req.body;
    if (!telegram_id || !email || !employee_id || !department) {
      return res.status(400).json({ success: false, message: 'Missing required information' });
    }
    const emailRegex = /\S+@\S+\.\S+/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: 'Invalid email format' });
    }
    const [userRows] = await db.pool.query('SELECT * FROM users WHERE telegram_id = ?', [telegram_id]);
    if (userRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    const otp = otpService.generateOTP();
    otpService.storeOTP(telegram_id, email, otp);
    const emailSent = await emailService.sendOTPEmail(email, otp);
    if (emailSent) {
      res.json({ success: true, message: 'OTP sent successfully', email: email.replace(/(.{2})(.*)(@.*)/, '$1****$3') });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send OTP email' });
    }
  } catch (error) {
    console.error('Error sending OTP:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// POST /api/auth/verify-otp
async function verifyOTP(req, res) {
  try {
    const { telegram_id, otp, email, employee_id, department } = req.body;
    if (!telegram_id || !otp || !email || !employee_id || !department) {
      return res.status(400).json({ success: false, message: 'Missing required information' });
    }
    const verification = otpService.verifyOTP(telegram_id, otp);
    if (!verification.valid) {
      return res.status(400).json({ success: false, message: verification.message });
    }
    if (verification.email !== email) {
      return res.status(400).json({ success: false, message: 'Email mismatch. Please request a new OTP.' });
    }
    await db.pool.query(
      'UPDATE users SET email = ?, employee_id = ?, department = ?, registration_complete = TRUE WHERE telegram_id = ?',
      [email, employee_id, department, telegram_id]
    );
    try {
      const [mappingRows] = await db.pool.query('SELECT * FROM staff_telegram_mapping WHERE telegram_id = ?', [telegram_id]);
      if (mappingRows.length === 0) {
        await db.pool.query('INSERT INTO staff_telegram_mapping (telegram_id, staff_code) VALUES (?, ?)', [telegram_id, employee_id]);
      } else {
        await db.pool.query('UPDATE staff_telegram_mapping SET staff_code = ? WHERE telegram_id = ?', [employee_id, telegram_id]);
      }
    } catch (error) {
      console.error('Error creating staff mapping:', error);
    }
    const [updatedRows] = await db.pool.query(
      'SELECT u.*, stm.staff_code FROM users u LEFT JOIN staff_telegram_mapping stm ON u.telegram_id = stm.telegram_id WHERE u.telegram_id = ?',
      [telegram_id]
    );
    if (updatedRows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found after update' });
    }
    const user = updatedRows[0];
    const userResponse = {
      id: user.id,
      telegram_id: user.telegram_id,
      first_name: user.first_name,
      last_name: user.last_name,
      username: user.username,
      photo_url: user.photo_url,
      email: user.email,
      employee_id: user.employee_id,
      department: user.department,
      staff_code: user.staff_code,
      registration_complete: user.registration_complete === 1
    };
    res.json({ success: true, user: userResponse });
  } catch (error) {
    console.error('Error verifying OTP:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

// POST /api/auth/resend-otp
async function resendOTP(req, res) {
  try {
    const { telegram_id, email } = req.body;
    if (!telegram_id || !email) {
      return res.status(400).json({ success: false, message: 'Missing telegram_id or email' });
    }
    const otp = otpService.generateOTP();
    otpService.storeOTP(telegram_id, email, otp);
    const emailSent = await emailService.sendOTPEmail(email, otp);
    if (emailSent) {
      res.json({ success: true, message: 'OTP resent successfully', email: email.replace(/(.{2})(.*)(@.*)/, '$1****$3') });
    } else {
      res.status(500).json({ success: false, message: 'Failed to resend OTP email' });
    }
  } catch (error) {
    console.error('Error resending OTP:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
}

module.exports = {
  authenticateTelegram,
  completeRegistration,
  sendOTP,
  verifyOTP,
  resendOTP
};
