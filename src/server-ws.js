//TODO: documentation https://github.com/websockets/ws
//--------------------------------------
//import unique id generator
import e from 'express';
import { v4 as uuidv4 } from 'uuid';
//import ws 
import { WebSocketServer } from 'ws';
//import mongoose
import mongoose from 'mongoose';
//import Room.js (Mongoose Schema Model)
import Room from './models/room.js';

//initialize server & websocket for server
const socket = new WebSocketServer({ port : 81 });

//hashmap of clients connected & rooms available
const clients = {};

//when client connect, do..
socket.on('connection', function connection(ws) {
    //generate unique clientId
    let clientId = new mongoose.Types.ObjectId().toString();
    //TODO:roomID gaperlu disimpen terpisah lagi, bisa ambil dari si roomData
    let roomId = null;
    let roomData = null;

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
            createRoom().then((newRoom) => {
                roomData = newRoom;
                roomId = newRoom['_id'].toString();

                const payload = {
                    'method' : 'create',
                    'roomId' : roomId
                };
                ws.send(JSON.stringify(payload));
            });

        //join room request
        } else if (msg.method === 'join') {
            getRoom(msg.roomId).then((room) => {
                if (room === null) {
                    const payload = {
                        'method' : 'join',
                        'status' : -1
                    };
                    ws.send(JSON.stringify(payload));
                } else {
                    roomData = room;
                    roomId = room['_id'].toString();
                    clients[clientId] = {
                        'connection' : ws
                    };
                    joinRoom(clientId, msg.name, roomData);

                    const payload = {
                        'method' : 'join',
                        'status' : 0,
                        'room' : room,
                        'newClient_Id' : clientId
                    };
                    ws.send(JSON.stringify(payload));
                    
                    //broadcast
                    payload['status'] = 1;
                    broadcast(payload, roomData.clients, false, clientId);
                }
            });
        
        //disconnect/move from room without quitting request    
        //cuma kepake kalau di tampilan editor teksnya ada form join room & create room (skrg sih tdk digunakan)
        } else if (msg.method === 'move') {
            const room = rooms[roomId];
            delete room.clients[clientId];
            const payload = {
                'method' : 'disconnect',
                'room' : room 
            };
            //broadcast 
            broadcast(payload, roomData.clients, true, clientId);

        //notify other clients over a changed text  
        } else if (msg.method === 'updateText') {
            
            //TODO:save content to database
            //notify other clients on the same room about the changes 
            const room = rooms[roomId];
            if (msg.lastLine !== msg.curLine) {
                room.maxLine = msg.curLine;
            }
            const payload = {
                'method' : 'updateText',
                'text' : msg.text,
                'curLine' : msg.curLine,
                'lastLine' : msg.lastLine,
                'caret' : msg.caret,
                'editorId' : clientId, 
                'maxLine' : room.maxLine
            };
            //send room state through all clients

            for (const [key, value] of Object.entries(room.clients)) {
                clients[key].connection.send(JSON.stringify(payload));
            }

        //notify other clients over a changed cursor position
        } else if (msg.method === 'updateCursor') {
            console.log('Cursor position updated by clientId:', msg.cursorId);
            
            const room = rooms[roomId];
            const update = room.clients[msg.cursorId].clientCursor;
            update['line'] = msg.line;
            update['caret'] = msg.caret;
            update['status'] = msg.status;
            const payload = {
                'method' : 'updateCursor',
                'cursorId' : msg.cursorId,
                'clientCursor' : update
            };

            //send room state through all clients
            for (const [key, value] of Object.entries(room.clients)) {
                clients[key].connection.send(JSON.stringify(payload));

                //check & move editable affected cursors (from update text)
                if (msg.code === 1 && key !== msg.cursorId && value.clientCursor['line'] === update['line'] && value.clientCursor['status'] === 1
                && value.clientCursor['caret'] >= (update['caret'] - 1)) {
                    // //same line, a letter typed
                    // if () {

                    // //line differ by 1 (enter)     
                    // } else if () {

                    // // same line, backspace 
                    // } else if () {

                    // }
                    console.log('affected in server', 'lineEditor:', msg.line, 'lineOtherClient:', value.clientCursor['line']);
                    console.log('affected in server', 'affected client id:', key, 'caretEditor:', msg.caret, 'caretOtherClient:', value.clientCursor['caret']);
                    let up = room.clients[key].clientCursor;
                    up['caret'] += 1;
                    let payload2 = {
                        'method' : 'updateCursor',
                        'cursorId' : key,
                        'clientCursor' : up
                    };

                    for (const [key, value] of Object.entries(room.clients)) {
                        clients[key].connection.send(JSON.stringify(payload2));
                    }     
                } 
            }
        }
    });

    //when client disconnected, do..
    ws.on('close', function connection(ws) {
        //delete innactive client
        delete clients[clientId];
        
        if (roomId !== null) {
            console.log('client ' + clientId + ' disconnected from room ' + roomId);
            const room = rooms[roomId];
            delete room.clients[clientId];

            const payload = {
                'method' : 'disconnect',
                'clientId' : clientId,
                'room' : room
            };
            //send room state through all clients
            for (const [key, value] of Object.entries(room.clients)) {
                clients[key].connection.send(JSON.stringify(payload));
            }
        }
    });
});
//export websocker server
export default socket;


//create new room
async function createRoom () {
    const roomData = {
        _id : new mongoose.Types.ObjectId(),
        maxLine : 1,
        clients : {},
        lines : {}
    };
    try {
        await Room.create(roomData);
        return roomData;
    } catch (err) {
        console.log('Error', err);
    }
}


//get existing room data
async function getRoom (roomId) {
    if (mongoose.Types.ObjectId.isValid(roomId)) {
        try {
            const roomObjId = mongoose.Types.ObjectId.createFromHexString(roomId);
            return await Room.findById(roomObjId);
        } catch (err) {
            console.log('Error', err);
        }
    } else {
        return null;
    }
    
}


//join room
async function joinRoom (clientId, name, roomData) {
    //store client's initial state at current room to DB
    roomData.clients.set(clientId, {
        name : name,
        cursor : {
            'line' : 1,
            'caret' : 0,
            'color' : "0",
            'status' : 0
        }
    });
    roomData.save();
}


//broadcast
function broadcast (payload, target, self, editorId) {
    for (const [key, value] of target) {
        if (!self && key == editorId) {
            continue;
        } else {
            clients[key].connection.send(JSON.stringify(payload));
        }
    }
}