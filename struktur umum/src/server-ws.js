//TODO: documentation https://github.com/websockets/ws
//--------------------------------------
//import unique id generator
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
    //TODO: erase client id from payload
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
            //store client's active status
            clients[clientId] = {
                'name' : msg.name,
                'connection' : ws
            };

            roomId = msg.roomId;
            const room = rooms[roomId];
            room.clients.push({
                'clientId' : clientId
            });

            const payload = {
                'method' : 'join',
                'room' : room
            };

            //send room state through all clients
            Array.prototype.forEach.call(room.clients, element => {
                clients[element.clientId].connection.send(JSON.stringify(payload));
            });
        
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