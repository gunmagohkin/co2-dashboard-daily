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
      // SUCCESS: Send back a success message.
      return {
        statusCode: 200,
        body: JSON.stringify({ success: true }),
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
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, message: 'Internal server error' }),
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    };
  }
};
