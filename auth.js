// auth.js - The Gatekeeper

(function() {
    const token = localStorage.getItem('jwtToken');

    // Check if the token exists.
    if (!token) {
        // If no token is found, redirect to the login page immediately.
        // Replace '/' with the actual path to your login page if it's not the root.
        window.location.href = '/index.html'; 
    }

    // Optional: You could add a call to a server function here to verify
    // the token's signature and expiration, but for now, just checking
    // for its existence provides basic protection against direct URL access.
})();