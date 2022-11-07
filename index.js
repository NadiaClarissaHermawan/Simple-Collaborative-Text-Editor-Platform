//Nadia Clarissa Hermawan / 6181901013

//use express
const express = require('express');
const app = express();
const PORT = 8080

//express app listen on port
app.listen(PORT, () => {
    console.log('Express app server running at http://localhost:' + PORT)
});

//use ejs view engine 
app.set('view engine', 'ejs');

//use ejs-express-layout
const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);

//set static folder (access to public folder for media etc)
app.use(express.static('public'));

//use separated routes file
const router = require('./routes/route');
app.use(router);

//---------------------------------------------------------
//create http server
const http = require('http');
const { connect } = require('http2');
const httpServer = http.createServer();
const WSPORT = 8081;

//http server listen on port
httpServer.listen(WSPORT, function() {
    console.log('Http Server is listening on port ' + WSPORT);
});

//create websocket server with the http server
const websocketServer = require('websocket').server;
const wsServer = new websocketServer({
    'httpServer': httpServer
});

//use unique id generator
const { v4 : uuidv4 } = require('uuid');
const { client } = require('websocket');

//hashmap of clients connected
const clients = {};

//client request to connect
wsServer.on('request', request => {
    const connection = request.accept(null, request.origin);
    //when connected do..
    connection.on('open', () => console.log('connection opened!'));
    //when disconnected do..
    connection.on('close', () => console.log('connection closed!'));
    //when server received message from client, do..
    connection.on('message', (message) => {
        const resp = JSON.parse(message.utf8Data);
        console.log(resp);
    });

    //generate unique client id & store the connection
    const cuid = uuidv4();
    clients[cuid] = {
        'connection' : connection
    };

    //send connect response back to client
    const payload = {
        'method' : 'connect',
        'clientId' : cuid
    };
    connection.send(JSON.stringify(payload));
});