import e from 'express';
import { WebSocketServer } from 'ws';
import mongoose from 'mongoose';

//import roomController & init 
import RoomController from './controllers/roomController.js';
const roomController = new RoomController();

//initialize websocket for server
const socket = new WebSocketServer({ port : 81 });
//hashmap of online client's connection (ws)
const clients = {};

//when client connect, do..
socket.on('connection', function connection(ws) {
    //generate unique clientId
    let clientId = new mongoose.Types.ObjectId().toString();
    let roomId = null;
    clientConnected(ws, clientId);

    //when server received message from client, do..
    ws.on('message', function message(data, isBinary) {
        const msg = isBinary ? data : JSON.parse(data.toString()); 
        
        if (msg.method === 'create') {
            roomId = msgCreateHandler(ws);

        } else if (msg.method === 'join') {
            roomId = msg.roomId;
            msgJoinHandler(ws, msg, clientId);
            
        } else if (msg.method === 'updateCursor') {
            msgUpdateCursorHandler(msg, roomId);

        } else if (msg.method === 'updateText') {
            msgUpdateTextHandler(msg, roomId, clientId);
        }
    });

    ws.on('close', function connection(ws) {
        if (roomId !== null) {
            console.log('client ' + clientId + ' disconnected from room ' + roomId);
            clientDisconnected(clientId, roomId);
        }
    });
});
export default socket;


//connect response 
function clientConnected (ws, clientId) {
    const payload = {
        'method' : 'connect',
        'clientId' : clientId
    };
    ws.send(JSON.stringify(payload));
}


//on message 'create' handler
function msgCreateHandler (ws) {
    let roomId = new mongoose.Types.ObjectId();
    roomController.createRoom(roomId).then(() => {
        const payload = {
            'method' : 'create',
            'roomId' : roomId.toString()
        };
        ws.send(JSON.stringify(payload));
    });
    return roomId.toString();
}


//on message 'join' handler
function msgJoinHandler (ws, msg, clientId) {
    let payload = null;
    roomController.joinRoom(clientId, msg.name, msg.roomId).then((roomData) => {
        if (roomData === null) {
            payload = {
                'method' : 'join',
                'client_status' : -1
            };
            ws.send(JSON.stringify(payload));

        } else {
            clients[clientId] = {'connection' : ws};
            payload = {
                'method' : 'join',
                'client_status' : 0,
                'room' : roomData,
                'newClient_Id' : clientId
            };
            ws.send(JSON.stringify(payload));
            
            payload['client_status'] = 1;
            broadcast(payload, roomData.clients, false, clientId);
        }
    });
}


//on message 'updateCursor' handler
function msgUpdateCursorHandler (msg, roomId) {
    roomController.updateCursorData(msg.line, msg.caret, msg.status, msg.cursorId, roomId).then((roomData) => {
        const payload = {
            'method' : 'updateCursor',
            'cursorId' : msg.cursorId,
            'clientCursor' : roomData.clients[msg.cursorId].cursor
        };
        broadcast(payload, roomData.clients, true, msg.cursorId);
    });
}


//on message 'updateText' handler
function msgUpdateTextHandler (msg, roomId, clientId) {
    roomController.updateTextData(msg, roomId).then((roomData) => {
        const payload = {
            'method' : 'updateText',
            'text' : msg.text,
            'curLine' : msg.curLine,
            'lastLine' : msg.lastLine,
            'caret' : msg.caret,
            'editorId' : clientId, 
            'maxLine' : roomData.maxLine
        };
        broadcast(payload, roomData.clients, true, clientId);
    });
}


//broadcast
function broadcast (payload, target, self, editorId) {
    for (const [key, value] of Object.entries(target)) {
        if (!self && key == editorId) {
            continue;
        } else if (clients[key] !== undefined) {
            clients[key].connection.send(JSON.stringify(payload));
        }
    }
}


//on close handler
function clientDisconnected (clientId, roomId) {
    roomController.removeClientData(clientId, roomId).then((roomData) => {
        if (Object.keys(roomData.clients).length === 0) {
            roomController.removeRoomFromRedis(roomId);
        } else {
            const payload = {
                'method' : 'disconnect',
                'clientId' : clientId,
                'room' : roomData
            };
            broadcast(payload, roomData.clients, true, clientId);   
        }
        //delete innactive client's connection
        delete clients[clientId];
    });
}