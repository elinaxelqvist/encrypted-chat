const ws = new WebSocket(`ws://${window.document.location.host}`);
const KEY_SERVER = 'http://localhost:8081';
let crypt = new JSEncrypt();
let privateKey = null;
let publicKeys = {};

console.log("Chat application starting...");
console.log("Connecting to key server at:", KEY_SERVER);

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

async function fetchPublicKeys() {
    try {
        const url = `${KEY_SERVER}/api/pubkeys`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch public keys: ${response.status}`);
        }
        
        const keys = await response.json();
        const select = document.getElementById('recipientSelect');
        const selectedValue = select.value;
        
        select.innerHTML = '<option value="">Select recipient (for encryption)</option>';
        
        if (keys && Array.isArray(keys)) {
            keys.forEach(key => {
                if (key.username !== myUsername) {
                    publicKeys[key.username] = key.pubkey;
                    const option = document.createElement('option');
                    option.value = key.username;
                    option.textContent = key.username;
                    select.appendChild(option);
                }
            });
            
            if (selectedValue && publicKeys[selectedValue]) {
                select.value = selectedValue;
            }
        }
    } catch (error) {
        console.error('Error fetching public keys:', error);
        showError('Could not connect to key server. Encrypted messages will not work.');
        document.getElementById('encryptMessage').disabled = true;
        throw error;
    }
}

function normalizeKey(key) {
    return key
        .replace(/\r\n/g, '\n')
        .replace(/----$/, '-----')
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
    
    const json = JSON.parse(message.data);
    console.log("Parsed message:", json);

    if (json.type === 'userList') {
        console.log("Received updated user list:", json.users);
        
        fetchPublicKeys().then(() => {
            console.log("Public keys updated after user list change");
        }).catch(error => {
            console.error("Error updating public keys:", error);
        });
        return;
    }

    let displayMessage = json.message;
    const isEncrypted = json.encrypted === true;
    
    if (isEncrypted && privateKey) {
        console.log("Message is marked as encrypted, attempting to decrypt");
        try {
            const decryptor = new JSEncrypt();
            decryptor.setPrivateKey(privateKey);
            console.log("Private key set, attempting decryption");
            
            const decrypted = decryptor.decrypt(json.message);
            console.log("Decryption result:", decrypted ? "success" : "failed");
            
            if (decrypted) {
                console.log("Message decryption successful:", decrypted);
                displayMessage = decrypted;
            } else {
                console.log("Message decryption failed - message not for us");
                displayMessage = '[Encrypted message]';
            }
        } catch (error) {
            console.error("Message decryption error:", error);
            displayMessage = '[Encrypted message]';
        }
    } else if (isEncrypted) {
        console.log("Encrypted message received but no private key available");
        displayMessage = '[Encrypted message]';
    } else {
        console.log("Regular unencrypted message received");
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

let myUsername = '';

userform.addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('userinputBox').value;
    myUsername = username;
    
    const keyInput = document.getElementById('privateKeyInput').value;
    if (keyInput.trim()) {
        console.log("Private key provided, normalizing and storing");
        privateKey = normalizeKey(keyInput);
        console.log("Private key stored, length:", privateKey.length);
    } else {
        console.log("No private key provided");
        privateKey = null;
    }
    
    ws.send(JSON.stringify({ username: username }));
    
    document.getElementById('set_username').style.display = 'none';
    document.getElementById('chat').style.display = 'block';
    
    try {
        console.log("Fetching public keys after registration");
        const url = `${KEY_SERVER}/api/pubkeys`;
        const response = await fetch(url);
        const keys = await response.json();
        
        if (keys && Array.isArray(keys)) {
            console.log(`Processing ${keys.length} public keys, my username is: ${username}`);
            keys.forEach(key => {
                if (key.username !== username) {
                    console.log('Adding key for ' + key.username + ':', key.publicKey);
                    publicKeys[key.username] = key.publicKey;
                }
            });
        }
        
        const select = document.getElementById('recipientSelect');
        select.innerHTML = '<option value="">Select recipient (for encryption)</option>';
        Object.keys(publicKeys).forEach(username => {
            const option = document.createElement('option');
            option.value = username;
            option.textContent = username;
            select.appendChild(option);
        });
        
    } catch (error) {
        console.error('Error fetching public keys:', error);
    }
});

document.getElementById('encryptMessage').addEventListener('change', async (event) => {
    const recipientSelect = document.getElementById('recipientSelect');
    const selectedRecipient = recipientSelect.value;
    console.log("Encryption checkbox changed, checked:", event.target.checked);
    
    if (event.target.checked) {
        console.log("Encryption enabled, fetching available recipients");
        recipientSelect.required = true;
        try {
            await fetchPublicKeys();
            
            if (selectedRecipient) {
                recipientSelect.value = selectedRecipient;
            }
        } catch (error) {
            console.error("Error during public key fetch:", error);
        }
    } else {
        recipientSelect.required = false;
    }
});

document.getElementById('recipientSelect').addEventListener('change', async (event) => {
    const recipient = event.target.value;
    if (recipient) {
        console.log("Recipient selected:", recipient);
    }
});

msgform.addEventListener("submit", (event) => {
    event.preventDefault();
    
    if (ws.readyState !== WebSocket.OPEN) {
        console.error('WebSocket is not connected. State:', ws.readyState);
        showError('Cannot send message: Connection to server lost. Please refresh the page.');
        return;
    }

    const message = document.getElementById("messageinputBox").value;
    const shouldEncrypt = document.getElementById("encryptMessage").checked;
    const recipient = document.getElementById("recipientSelect").value;
    
    console.log("Preparing to send message, encryption:", shouldEncrypt, "recipient:", recipient);
    
    if (message.trim().length === 0) return;
    
    if (shouldEncrypt && !recipient) {
        console.error("Encryption enabled but no recipient selected");
        document.getElementById('keyFetchStatus').textContent = 'Please select a recipient for encryption';
        document.getElementById('keyFetchStatus').className = 'status-message error';
        return;
    }
    
    let messageObject = {
        message: message,
        encrypted: false
    };
    
    if (shouldEncrypt && publicKeys[recipient]) {
        console.log("Encrypting message for recipient:", recipient);
        try {
            const encryptor = new JSEncrypt();
            encryptor.setPublicKey(publicKeys[recipient]);
            
            const encrypted = encryptor.encrypt(message);
            if (encrypted) {
                console.log("Message encryption successful");
                messageObject = {
                    message: encrypted,
                    encrypted: true,
                    recipient: recipient
                };
                console.log("Sending encrypted message object:", messageObject);
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
    
    console.log("Final message object being sent:", messageObject);
    ws.send(JSON.stringify(messageObject));
    document.getElementById("messageinputBox").value = "";
});

msgform.addEventListener("reset", (event) => {
    console.log("User leaving chat");
    ws.close();
});

ws.onerror = function(error) {
    console.error('WebSocket error:', error);
    showError('Connection error occurred. Please refresh the page.');
};

function showError(message) {
    let errorDiv = document.getElementById('error-message');
    if (!errorDiv) {
        errorDiv = document.createElement('div');
        errorDiv.id = 'error-message';
        document.querySelector('.container').insertBefore(errorDiv, document.querySelector('#chat'));
    }
    
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    
    setTimeout(() => {
        errorDiv.style.display = 'none';
    }, 5000);
}
