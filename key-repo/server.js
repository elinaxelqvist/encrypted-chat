const express = require('express');
const app = express();
const cors = require('cors');
const bodyParser = require('body-parser');
const morgan = require('morgan');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

console.log("Starting key repository server...");

app.use(cors({
    origin: '*'
}));
app.use(express.static('static'));
app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json());                        
app.use(morgan('dev'));                            

const dbPath = path.join(__dirname, 'repo.db');
console.log("Database path:", dbPath);

let db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
  if (err) {
    console.log("Database connection error:", err);
    exit(1);
  }
  console.log("Successfully connected to database");
});

var port = process.argv[2] || 8081;

app.listen(port, function () {
  console.log('Key repository server listening on port ' + port + '!')
});

app.get('/', function (request, response) {
  response.sendFile(__dirname + '/index.html');
});


db.run(`CREATE TABLE IF NOT EXISTS pubkeys (
  username TEXT PRIMARY KEY,
  pubkey TEXT NOT NULL
)`, (err) => {
  if (err) {
      console.log("Error creating table:", err);
      exit(1);
  } else {
      console.log("Database table 'pubkeys' is ready");
  }
});

app.get('/api/pubkeys', function (request, response) {
    console.log("GET /api/pubkeys - Fetching all public keys");
    db.all('SELECT * FROM pubkeys', [], (err, rows) => {
        if (err) {
            console.log("Database error in GET /api/pubkeys:", err);
            return response.status(500).json({ error: "Databasfel" });
        }
        console.log("Successfully retrieved", rows.length, "public keys");
        response.json(rows);
    });
});

app.get('/api/pubkeys/:name', function (request, response) {
  const name = request.params.name;
  console.log("GET /api/pubkeys/:name - Fetching public key for user:", name);
  
  db.get('SELECT * FROM pubkeys WHERE username = ?', [name], (err, row) => {
      if (err) {
          console.log("Database error in GET /api/pubkeys/:name:", err);
          return response.status(500).json({ error: "Databasfel" });
      }
      if (!row) {
          console.log("No public key found for user:", name);
          return response.status(404).json({ error: "Användaren hittades inte" });
      }
      console.log("Successfully retrieved public key for user:", name);
      response.json(row);
  });
});

app.post('/api/pubkeys', function (request, response) {
    console.log("POST /api/pubkeys - Received request body:", request.body);
    const { user, pubkey } = request.body;
    
    if (!user || !pubkey) {
        console.log("Missing required fields. User:", user, "Pubkey provided:", !!pubkey);
        return response.status(400).json({ error: "Användarnamn och publik nyckel krävs" });
    }

    console.log("Attempting to save public key for user:", user);
    db.run('INSERT INTO pubkeys (username, pubkey) VALUES (?, ?)', 
        [user, pubkey], 
        function(err) {
            if (err) {
                console.log("Database error in POST /api/pubkeys:", err);
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return response.status(409).json({ error: "Användarnamnet finns redan" });
                }
                return response.status(500).json({ error: "Databasfel" });
            }
            console.log("Successfully saved public key for user:", user);
            response.status(201).json({ message: "Sparad!" });
    });
});

app.delete('/api/pubkeys/:name', function (request, response) {
    const name = request.params.name;
    console.log("DELETE /api/pubkeys/:name - Attempting to delete user:", name);
    
    db.run('DELETE FROM pubkeys WHERE username = ?', [name], function(err) {
        if (err) {
            console.log("Database error in DELETE /api/pubkeys/:name:", err);
            return response.status(500).json({ error: "Databasfel" });
        }
        if (this.changes === 0) {
            console.log("No user found to delete:", name);
            return response.status(404).json({ error: "Användaren hittades inte" });
        }
        console.log("Successfully deleted user:", name);
        response.status(200).json({ message: "Användaren borttagen" });
    });
});