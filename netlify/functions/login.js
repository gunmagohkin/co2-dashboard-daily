// netlify/functions/login.js

const jwt = require('jsonwebtoken'); // Import the JWT library

// A map of user IDs to their corresponding environment variable keys.
const userPasswordKeys = {
  ivan_golosinda: 'USER_PASS_IVAN',
  greg_esperanzate: 'USER_PASS_GREG',
  mildred_negranza: 'USER_PASS_MILDRED'
};

exports.handler = async function (event, context) {
  // Only allow POST requests for security.
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const { userId, password } = JSON.parse(event.body);
    
    // Find the key for the user's password variable.
    const passwordKey = userPasswordKeys[userId];
    const correctPassword = process.env[passwordKey];

    // Check if the user exists and the password is correct.
    if (correctPassword && correctPassword === password) {
      // ✅ SUCCESS: Create a JWT.
      const token = jwt.sign(
        { userId: userId },      // Payload: Data inside the token
        process.env.JWT_SECRET,  // 🔑 Secret: Your secret key from .env
        { expiresIn: '8h' }      // Options: Token expires in 8 hours
      );

      // Return a success response including the new token
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true, token: token }),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      };
    } else {
      // FAILURE: Send back a generic error message.
      return {
        statusCode: 401, // Unauthorized
        body: JSON.stringify({ success: false, message: 'Invalid credentials' }),
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      };
    }
  } catch (error) {
    console.error("Login Error:", error); // Log the error for debugging
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    };
  }
};