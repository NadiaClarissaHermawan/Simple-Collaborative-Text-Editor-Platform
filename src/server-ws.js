//import unique id generator
import e from 'express';
//import ws 
import { WebSocketServer } from 'ws';
//import mongoose
import mongoose from 'mongoose';
//import Room.js (Mongoose Schema Model)
import Room from './models/room.js';

//initialize server & websocket for server
const socket = new WebSocketServer({ port : 81 });

//hashmap of client's connection (ws)
const clients = {};
//hashmap of loaded rooms (non-persistent)
const rooms = {};

//when client connect, do..
socket.on('connection', function connection(ws) {
    //generate unique clientId
    let clientId = new mongoose.Types.ObjectId().toString();
    let roomId = null;
    clientConnected(ws, clientId);

    //when server received message from client, do..
    ws.on('message', function message(data, isBinary) {
        const msg = isBinary ? data : JSON.parse(data.toString()); 
        
        //create room request
        if (msg.method === 'create') {
            createRoom().then((newRoom) => {
                roomId = newRoom['_id'].toString();
                rooms[roomId] = newRoom;

                const payload = {
                    'method' : 'create',
                    'roomId' : roomId
                };
                ws.send(JSON.stringify(payload));
            });

        //join room request
        } else if (msg.method === 'join') {
            let payload = null;
            joinRoom(clientId, msg.name, msg.roomId).then((roomData) => {
                if (roomData === null) {
                    payload = {
                        'method' : 'join',
                        'client_status' : -1
                    };
                    ws.send(JSON.stringify(payload));

                } else {
                    roomId = msg.roomId;
                    rooms[roomId] = roomData;
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

        //notify other clients over a changed text  
        } else if (msg.method === 'updateText') {
            //TODO: roomData.clients isinya gaada si orang" yg udah join
            // console.log('test lagi', roomData);
            // updateText(msg.lastLine, msg.curLine, msg.maxLine, msg.caret, msg.text, msg.line_order, roomData).then(() => {
            //     const payload = {
            //         'method' : 'updateText',
            //         'text' : msg.text,
            //         'curLine' : msg.curLine,
            //         'lastLine' : msg.lastLine,
            //         'caret' : msg.caret,
            //         'editorId' : clientId, 
            //         'maxLine' : roomData.maxLine
            //     };
            //     broadcast(payload, roomData.clients, true, clientId);
            // });
            if (msg.lastLine !== msg.curLine) {
                roomData.maxLine = msg.curLine;
            }
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

        //notify other clients over a changed cursor position
        } else if (msg.method === 'updateCursor') {
            console.log('Cursor position updated by clientId:', msg.cursorId);
            updateCursor(msg.line, msg.caret, msg.status, msg.cursorId, roomId).then((roomData) => {
                const payload = {
                    'method' : 'updateCursor',
                    'cursorId' : msg.cursorId,
                    'clientCursor' : roomData.clients.get(msg.cursorId).cursor
                };
                broadcast(payload, roomData.clients, true, msg.cursorId);
            });
        }
    });

    //when client disconnected, do..
    ws.on('close', function connection(ws) {
        if (roomId !== null) {
            console.log('client ' + clientId + ' disconnected from room ' + roomId);
            removeClient(clientId, roomId).then((roomData) => {
                const payload = {
                    'method' : 'disconnect',
                    'clientId' : clientId,
                    'room' : roomData
                };
                broadcast(payload, roomData.clients, true, clientId);   
                //delete innactive client
                delete clients[clientId];
            });
        }
    });
});
//export websocker server
export default socket;


//connect response 
function clientConnected (ws, clientId) {
    const payload = {
        'method' : 'connect',
        'clientId' : clientId
    };
    ws.send(JSON.stringify(payload));
}


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
async function joinRoom (clientId, name, roomId) {
    const roomData = await getRoom(roomId);
    if (roomData === null) {
        return null;
    } else {
        roomData.clients.set(clientId, {
            name : name,
            cursor : {
                line : 1,
                caret : 0,
                color : "0",
                status : 0
            }
        });
        try {
            return await roomData.save();
        } catch (err) {
            console.log('Error', err);
        }
    }
}


//updateText TODO:ganti jadi redis/smth non-persistent
async function updateText (lastLine, line, maxLine, caret, text, line_order, roomData) {
    roomData.maxLine = maxLine;
    if (roomData.lines_order[line_order] !== line) {
        roomData.lines_order.splice(line_order, 0, line);
    }
    roomData.lines.set(line.toString(), {
        text : text
    });

    await roomData.save();
}


//updateCursor
async function updateCursor (line, caret, status, clientId, roomId) {
    const roomData = rooms[roomId];
    roomData.clients.get(clientId).cursor = {
        line : line,
        caret : caret,
        color : 'asdf',
        status : status
    }
    try {
        return await roomData.save();
    } catch (err) {
        console.log('Error', err);
    }
    
}


//remove client
async function removeClient (clientId, roomId) {
    const roomData = rooms[roomId];
    roomData.clients.delete(clientId);
    try {
        return await roomData.save();
    } catch (err) {
        console.log('Error', err);
    }
}


//broadcast
function broadcast (payload, target, self, editorId) {
    for (const [key, value] of target) {
        if (!self && key == editorId) {
            continue;
        } else if (clients[key] !== undefined) {
            clients[key].connection.send(JSON.stringify(payload));
        }
    }
}