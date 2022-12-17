//TODO: documentation https://github.com/websockets/ws
//--------------------------------------
//import unique id generator
import e from 'express';
import { v4 as uuidv4 } from 'uuid';
//import ws 
import { WebSocketServer } from 'ws';

//initialize server & websocket for server
const socket = new WebSocketServer({ port : 81 });

//hashmap of clients connected & rooms available
const clients = {};
const rooms = {};

//when client connect, do..
socket.on('connection', function connection(ws) {
    //generate unique clientId
    let clientId = uuidv4();
    let roomId = null;

    //send connect response back to client
    //TODO: erase client id from payload -> change cookies
    const payload = {
        'method' : 'connect',
        'clientId' : clientId
    };
    ws.send(JSON.stringify(payload));

    //when server received message from client, do..
    ws.on('message', function message(data, isBinary) {
        const msg = isBinary ? data : JSON.parse(data.toString()); 
        
        //create room request
        if (msg.method === 'create') {
            roomId = uuidv4();
            //TODO:note room's text editor first state -> database
            rooms[roomId] = {
                'clients' : []
            };

            const payload = {
                'method' : 'create',
                'roomId' : roomId,
                'room' : rooms[roomId]
            };
            ws.send(JSON.stringify(payload));
        
        //join room request
        } else if (msg.method === 'join') {
            roomId = msg.roomId;
            const room = rooms[roomId];
            let payload;
            if (room === undefined) {
                payload = {
                    'method' : 'join',
                    'status' : false
                };
                ws.send(JSON.stringify(payload));
            } else {
                //store client's active status
                clients[clientId] = {
                    'name' : msg.name,
                    'connection' : ws
                };
                //store client's last state at current room
                room.clients.push({
                    'clientId' : clientId
                });
                payload = {
                    'method' : 'join',
                    'status' : true,
                    'room' : room
                };
                //send room state through all clients
                Array.prototype.forEach.call(room.clients, element => {
                    clients[element.clientId].connection.send(JSON.stringify(payload));
                });
            }    
        
        //disconnect/move from room without quitting request    
        } else if (msg.method === 'move') {
            const room = rooms[roomId];
            room.clients = room.clients.filter(o => o.clientId !== clientId);
            const payload = {
                'method' : 'disconnect',
                'room' : room 
            };
            //send room state through all clients
            Array.prototype.forEach.call(room.clients, element => {
                clients[element.clientId].connection.send(JSON.stringify(payload));
            });

        //notify other clients over a change    
        } else if (msg.method === 'update') {
            console.log('a client has made a change at line :' + msg.clientCursor['line']);
            //notify other clients on the same room about the changes 
            const room = rooms[roomId];
            const payload = {
                'method' : 'update',
                'text' : msg.text,
                'line' : msg.clientCursor['line']
            };
            Array.prototype.forEach.call(room.clients, element => {
                console.log(element.clientId);
                clients[element.clientId].connection.send(JSON.stringify(payload));
            });
        }
    });

    //when client disconnected, do..
    ws.on('close', function connection(ws) {
        //delete innactive client
        delete clients[clientId];
        
        if (roomId !== null) {
            console.log('client ' + clientId + ' disconnected from room ' + roomId);
            const room = rooms[roomId];
            room.clients = room.clients.filter(o => o.clientId !== clientId);

            const payload = {
                'method' : 'quit',
                'clientId' : clientId,
                'room' : room
            };
            //send room state through all clients
            Array.prototype.forEach.call(room.clients, element => {
                clients[element.clientId].connection.send(JSON.stringify(payload));
            });
        }
    });
});

//export websocker server
export default socket;