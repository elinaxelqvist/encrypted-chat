const http = require("http");
const sh = require("serve-handler");
const ws = require("ws");

let count = 0;
const server = http.createServer((req, res) => {
  return sh(req, res, { public: "public" });
});

const wss = new ws.WebSocketServer({ server });

// Function to get all connected users
function getConnectedUsers() {
  const users = [];
  wss.clients.forEach(client => {
    if (client.username) {
      users.push({
        username: client.username,
        color: client.color
      });
    }
  });
  return users;
}

// Function to broadcast user list
function broadcastUserList() {
  const userList = getConnectedUsers();
  const message = JSON.stringify({
    type: 'userList',
    users: userList
  });
  broadcast(message);
}

wss.on("connection", (client) => {
  console.log("Client connected!");
  client.on("message", (json) => {
    console.log("Server received raw message:", json.toString());
    let msg = JSON.parse(json);
    console.log("Server parsed message:", msg);
    
    if (msg.type === 'requestUserList') {
      // Send current user list to the requesting client
      const userList = JSON.stringify({
        type: 'userList',
        users: getConnectedUsers()
      });
      client.send(userList);
      return;
    }
    
    if (msg.hasOwnProperty("username")) {
      if (msg.username.trim().length == 0) {
        client.username = "user_" + ++count;
      } else {
        client.username = msg.username;
      }
      client.color = getDarkColor();
      broadcast(JSON.stringify({
        username: "Server",
        message: `${client.username} has entered the chat!`,
        color: "#000000"
      }));
      broadcastUserList();
    } else {
      if (!msg.message || msg.message.trim().length === 0) {
        return;
      }
      
      const messageToSend = {
        username: client.username,
        color: client.color,
        message: msg.message,
        encrypted: Boolean(msg.encrypted),
        recipient: msg.recipient
      };
      
      console.log("Server broadcasting message:", messageToSend);
      broadcast(JSON.stringify(messageToSend));
    }
  });

  client.on("close", () => {
    broadcast(JSON.stringify({
      username: "Server",
      message: `${client.username} has left the chat!`,
      color: "#000000"
    }));
    broadcastUserList();
  });
});

function broadcast(msg) {
  for (const client of wss.clients) {
    if (client.readyState === ws.OPEN) {
      client.send(msg);
    }
  }
}

function getDarkColor() {
  var color = '#';
  for (var i = 0; i < 6; i++) {
    color += Math.floor(Math.random() * 10);
  }
  return color;
}

server.listen(process.argv[2] || 8080, () => {
  console.log(
    `Server listening on port ${server._connectionKey.split("::::")[1]}...`
  );
});
