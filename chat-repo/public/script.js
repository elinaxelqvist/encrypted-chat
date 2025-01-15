ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    // Handle user list updates
    if (data.type === 'userList') {
        updateRecipientsList(data.users);
        updateRecipientDropdown(data.users);
        return;
    }
    
    // Handle messages
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    const username = data.username;
    const message = data.message;
    const color = data.color;
    
    messageDiv.innerHTML = `<span style="color: ${color}">${username}</span>: ${message}`;
    document.getElementById('messages').appendChild(messageDiv);
};

function updateRecipientDropdown(activeUsers) {
    const select = document.getElementById('recipientSelect');
    const selectedValue = select.value;
    
    // Keep the default option
    select.innerHTML = '<option value="">Select recipient (for encryption)</option>';
    
    activeUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.username;
        option.textContent = user.username;
        option.style.color = user.color;
        select.appendChild(option);
    });
    
    // Restore selection if possible
    if (selectedValue) {
        select.value = selectedValue;
    }
}

function updateRecipientsList(users) {
    const recipientsContainer = document.getElementById('recipients-container');
    recipientsContainer.innerHTML = '';
    
    users.forEach(user => {
        const label = document.createElement('label');
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = 'recipient';
        checkbox.value = user.username;
        
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(user.username));
        label.style.color = user.color;
        
        recipientsContainer.appendChild(label);
    });
}

// When user registers
document.getElementById('userForm').addEventListener('submit', async function(e) {
    e.preventDefault();
    const username = document.getElementById('userinputBox').value;
    
    // Send username to server
    ws.send(JSON.stringify({ username: username }));
    
    // Hide registration form and show chat
    document.getElementById('set_username').style.display = 'none';
    document.getElementById('chat').style.display = 'block';
    
    // Simulate checking the encrypt checkbox to trigger the recipient fetch
    const encryptCheckbox = document.getElementById('encryptMessage');
    const changeEvent = new Event('change');
    encryptCheckbox.checked = true;
    encryptCheckbox.dispatchEvent(changeEvent);
});

// Helper function to fetch public keys (extract the existing logic)
async function fetchPublicKeys() {
    console.log('Encryption enabled, fetching available recipients');
    const response = await fetch('http://localhost:8081/api/pubkeys');
    const keys = await response.json();
    console.log('Received keys from server:', keys);
    
    const myUsername = document.getElementById('userinputBox').value;
    console.log('Processing ' + keys.length + ' public keys, my username is: ' + myUsername);
    
    const publicKeys = {};
    let recipientCount = 0;
    
    keys.forEach(key => {
        if (key.username !== myUsername) {
            console.log('Adding key for ' + key.username + ':', key.publicKey);
            publicKeys[key.username] = key.publicKey;
            recipientCount++;
        }
    });
    
    console.log('Public keys stored:', publicKeys);
    console.log('Added ' + recipientCount + ' recipients to dropdown');
    
    return publicKeys;
} 