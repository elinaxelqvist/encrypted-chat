const http = require("http");
const sh = require("serve-handler");
const ws = require("ws");

let count = 0;
const server = http.createServer((req, res) => {
  return sh(req, res, { public: "public" });
});

const wss = new ws.WebSocketServer({ server });
wss.on("connection", (client) => {
  console.log("Client connected!");
  client.on("message", (json) => {
	console.log("Message: " + json);
    let msg = JSON.parse(json);
    if (msg.hasOwnProperty("username")) {
      if (msg.username.trim().length == 0) {
        client.username = "user_" + ++count;
      } else {
        client.username = msg.username;
      }
      client.color = getDarkColor();
      broadcast(
        `{"user": "Server", "message":"${client.username} has entered the chat!"}`
      );
    } else {
      // Kontrollera om meddelandet är tomt eller bara innehåller mellanslag
      if (!msg.message || msg.message.trim().length === 0) {
        return;
      }
      
      // Hantera chattmeddelanden
      const messageToSend = JSON.stringify({
        username: client.username,
        message: msg.message,
        color: client.color
      });
      broadcast(messageToSend);
    }
  });
  client.on("close", () => {
    broadcast(
      `{"user": "Server", "message":"${client.username} has left the chat!"}`
    );
    console.log(
      (Object.is(client.username, undefined) ? "Client" : client.username) +
        " disconnected."
    );
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
