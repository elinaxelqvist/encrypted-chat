const ws = new WebSocket(`ws://${window.document.location.host}`);
const KEY_SERVER = 'http://localhost:8888'; // Adjust this to match your key server port
let crypt = new JSEncrypt();
let privateKey = null;
let publicKeys = {};

console.log("Chat application starting...");
console.log("Connecting to key server at:", KEY_SERVER);

// Function to register public key with the key server
async function registerPublicKey(username, publicKey) {
    try {
        console.log("Registering public key for user:", username);
        const response = await fetch(`${KEY_SERVER}/api/pubkeys`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                user: username,
                pubkey: publicKey
            })
        });
        
        if (!response.ok) {
            throw new Error('Failed to register public key');
        }
        
        console.log("Successfully registered public key for:", username);
        document.getElementById('keyStatus').textContent = 'Public key registered successfully';
        document.getElementById('keyStatus').className = 'status-message success';
    } catch (error) {
        console.error('Error registering public key:', error);
        document.getElementById('keyStatus').textContent = 'Failed to register public key with server';
        document.getElementById('keyStatus').className = 'status-message error';
    }
}

// Function to fetch public keys from the key server
async function fetchPublicKeys() {
    try {
        const url = `${KEY_SERVER}/api/pubkeys`;
        console.log("Fetching public keys from:", url);
        const response = await fetch(url);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Server response not OK:', response.status, errorText);
            throw new Error(`Failed to fetch public keys: ${response.status} ${errorText}`);
        }
        
        const keys = await response.json();
        console.log("Received keys from server:", keys);
        
        const select = document.getElementById('recipientSelect');
        if (!select) {
            console.error("Could not find recipientSelect element");
            return;
        }
        
        select.innerHTML = '<option value="">Select recipient (for encryption)</option>';
        
        if (keys && Array.isArray(keys)) {
            console.log(`Processing ${keys.length} public keys, my username is: ${myUsername}`);
            let addedCount = 0;
            
            keys.forEach(key => {
                if (key.username !== myUsername) {
                    console.log(`Adding key for ${key.username}:`, key.pubkey);
                    publicKeys[key.username] = key.pubkey;
                    const option = document.createElement('option');
                    option.value = key.username;
                    option.textContent = key.username;
                    select.appendChild(option);
                    addedCount++;
                }
            });
            
            console.log("Public keys stored:", publicKeys);
            console.log(`Added ${addedCount} recipients to dropdown`);
            document.getElementById('keyFetchStatus').textContent = 
                `Recipients loaded (${addedCount} available)`;
            document.getElementById('keyFetchStatus').className = 'status-message success';
        } else {
            console.error("Unexpected response format from key server:", keys);
            throw new Error('Invalid response format from key server');
        }
    } catch (error) {
        console.error('Error fetching public keys:', error);
        document.getElementById('keyFetchStatus').textContent = 'Failed to load recipients: ' + error.message;
        document.getElementById('keyFetchStatus').className = 'status-message error';
        throw error;
    }
}

// Function to normalize key format
function normalizeKey(key) {
    return key
        .replace(/\r\n/g, '\n')  // Normalize line endings
        .replace(/----$/, '-----')  // Fix header/footer with 4 dashes
        .trim();
}

ws.onopen = function () {
    console.log("WebSocket connection opened");
};

ws.onclose = function () {
    console.log("WebSocket connection closed");
};

ws.onmessage = function (message) {
    console.log("Received WebSocket message:", message.data);
    
    const msgDiv = document.createElement("div");
    msgDiv.classList.add("msgCtn");

    var json = JSON.parse(message.data);
    console.log("Parsed message:", json);

    // Try to decrypt if message is encrypted (either by flag or content pattern) and we have a private key
    let displayMessage = json.message;
    const looksEncrypted = json.encrypted || (json.message && json.message.match(/^[A-Za-z0-9+/=]+$/));
    
    if (looksEncrypted && privateKey) {
        console.log("Message appears to be encrypted, attempting to decrypt");
        try {
            // Create new instance for decryption
            const decryptor = new JSEncrypt();
            decryptor.setPrivateKey(privateKey);
            console.log("Private key set, attempting decryption");
            
            const decrypted = decryptor.decrypt(json.message);
            console.log("Decryption result:", decrypted ? "success" : "failed");
            
            if (decrypted) {
                console.log("Message decryption successful:", decrypted);
                displayMessage = decrypted + ' 🔓';
            } else {
                console.log("Message decryption failed - message not for us");
                displayMessage = '[Encrypted message - not for you]';
            }
        } catch (error) {
            console.error("Message decryption error:", error);
            displayMessage = '[Encrypted message - decryption failed]';
        }
    } else if (looksEncrypted) {
        console.log("Encrypted message received but no private key available");
        displayMessage = '[Encrypted message - no private key]';
    }

    msgDiv.textContent = `${json.username}: ${displayMessage}`;
    
    if (json.color) {
        msgDiv.style.backgroundColor = json.color;
    }

    document.getElementById("messages").appendChild(msgDiv);
    chat_div.scrollTop = chat_div.scrollHeight;
};

const user_div = document.getElementById("set_username");
const chat_div = document.getElementById("chat");
const userform = document.getElementById("userForm");
const msgform = document.getElementById("msgForm");

// Store our own username when we join
let myUsername = '';

userform.addEventListener('submit', async (event) => {
    event.preventDefault();
    const username = userform.querySelector("#userinputBox").value;
    console.log("Registering user:", username);
    myUsername = username;
    const keyInput = document.getElementById('privateKeyInput').value;

    if (keyInput.trim()) {
        console.log("Private key provided, normalizing and storing");
        privateKey = normalizeKey(keyInput);
        console.log("Private key stored, length:", privateKey.length);
        console.log("Private key header:", privateKey.split('\n')[0]);
    } else {
        console.log("No private key provided");
    }

    let user = { username };
    console.log("Sending registration to chat server:", user);
    ws.send(JSON.stringify(user));
    
    // Hide registration form and show chat
    user_div.style.display = "none";
    chat_div.style.display = "flex";
    
    // Initialize encryption controls
    const encryptionControls = document.getElementById('encryption-controls');
    const recipientSelect = document.getElementById('recipientSelect');
    const encryptCheckbox = document.getElementById('encryptMessage');
    
    if (privateKey) {
        console.log("Private key available, enabling encryption controls");
        encryptionControls.style.display = "flex";
        recipientSelect.disabled = false;  // Always enable recipient selection
        encryptCheckbox.disabled = false;
    } else {
        console.log("No private key, hiding encryption controls");
        encryptionControls.style.display = "none";
        encryptCheckbox.disabled = true;
    }
});

// Add event listener for the encrypt checkbox
document.getElementById('encryptMessage').addEventListener('change', async (event) => {
    const recipientSelect = document.getElementById('recipientSelect');
    console.log("Encryption checkbox changed, checked:", event.target.checked);
    
    if (event.target.checked) {
        console.log("Encryption enabled, fetching available recipients");
        try {
            await fetchPublicKeys();
            console.log("Public keys fetch completed");
        } catch (error) {
            console.error("Error during public key fetch:", error);
        }
    }
});

// Add event listener for recipient selection
document.getElementById('recipientSelect').addEventListener('change', async (event) => {
    const recipient = event.target.value;
    if (recipient) {
        console.log("Recipient selected:", recipient);
        if (!publicKeys[recipient]) {
            console.log("Fetching public key for recipient:", recipient);
            await fetchPublicKeys();
        }
    }
});

msgform.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = document.getElementById("messageinputBox").value;
    const shouldEncrypt = document.getElementById("encryptMessage").checked;
    const recipient = document.getElementById("recipientSelect").value;
    
    console.log("Preparing to send message, encryption:", shouldEncrypt, "recipient:", recipient);
    
    if (message.trim().length === 0) return;
    
    let msg = { 
        message,
        encrypted: false
    };
    
    if (shouldEncrypt && recipient && publicKeys[recipient]) {
        console.log("Encrypting message for recipient:", recipient);
        console.log("Recipient's public key:", publicKeys[recipient]);
        
        try {
            // Create new instance for encryption
            const encryptor = new JSEncrypt();
            encryptor.setPublicKey(publicKeys[recipient]);
            
            // Verify the public key was set correctly
            const pubKey = encryptor.getPublicKey();
            if (!pubKey) {
                throw new Error("Failed to set public key for encryption");
            }
            console.log("Verified public key was set:", pubKey);
            
            const encrypted = encryptor.encrypt(message);
            if (encrypted) {
                console.log("Message encryption successful");
                console.log("Original message:", message);
                console.log("Encrypted message:", encrypted);
                msg.message = encrypted;
                msg.encrypted = true;
                msg.recipient = recipient;
                console.log("Final message object:", msg);
            } else {
                console.error("Message encryption failed");
                document.getElementById('keyFetchStatus').textContent = 'Encryption failed';
                document.getElementById('keyFetchStatus').className = 'status-message error';
                return;
            }
        } catch (error) {
            console.error("Message encryption error:", error);
            document.getElementById('keyFetchStatus').textContent = 'Encryption failed: ' + error.message;
            document.getElementById('keyFetchStatus').className = 'status-message error';
            return;
        }
    }
    
    console.log("Sending message:", msg);
    ws.send(JSON.stringify(msg));
    document.getElementById("messageinputBox").value = "";
});

msgform.addEventListener("reset", (event) => {
    console.log("User leaving chat");
    ws.close();
});
