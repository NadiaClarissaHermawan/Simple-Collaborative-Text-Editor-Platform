//import unique id generator
import e from 'express';
//import ws 
import { WebSocketServer } from 'ws';
//import mongoose
import mongoose from 'mongoose';
//import Room.js (Mongoose Schema Model)
import Room from './models/room.js';
//import Redis 
import Redis from './utils/db.js';

//initialize server & websocket for server
const socket = new WebSocketServer({ port : 81 });
//hashmap of online client's connection (ws)
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
        
        //notify other clients over a changed cursor position
        } else if (msg.method === 'updateCursor') {
            console.log('Cursor position updated by clientId:', msg.cursorId);
            updateCursor(msg.line, msg.caret, msg.status, msg.cursorId, roomId).then(() => {
                const payload = {
                    'method' : 'updateCursor',
                    'cursorId' : msg.cursorId,
                    'clientCursor' : rooms[roomId].clients[msg.cursorId].cursor
                };
                broadcast(payload, rooms[roomId].clients, true, msg.cursorId);
            });

        //notify other clients over a changed text  
        } else if (msg.method === 'updateText') {
            updateText(msg, roomId).then(() => {
                const payload = {
                    'method' : 'updateText',
                    'text' : msg.text,
                    'curLine' : msg.curLine,
                    'lastLine' : msg.lastLine,
                    'caret' : msg.caret,
                    'editorId' : clientId, 
                    'maxLine' : rooms[roomId].maxLine
                };
                broadcast(payload, rooms[roomId].clients, true, clientId);
            });
        }
    });

    //when client disconnected, do..
    ws.on('close', function connection(ws) {
        if (roomId !== null) {
            console.log('client ' + clientId + ' disconnected from room ' + roomId);
            removeClient(clientId, roomId).then((roomData) => {
                if (Object.keys(roomData.clients).length === 0) {
                    Redis.del(roomId);
                } else {
                    const payload = {
                        'method' : 'disconnect',
                        'clientId' : clientId,
                        'room' : rooms[roomId]
                    };
                    broadcast(payload, rooms[roomId].clients, true, clientId);   
                }
                //delete innactive client's connection
                delete clients[clientId];
            });
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


//get existing room data from MongoDB
function getRoomFromMongo (roomId) {
    if (mongoose.Types.ObjectId.isValid(roomId)) {
        try {
            const roomObjId = mongoose.Types.ObjectId.createFromHexString(roomId);
            return Room.findById(roomObjId).lean();
        } catch (err) {
            console.log('Error', err);
        }
    } else {
        return null;
    }
}


//join room  
async function joinRoom (clientId, name, roomId) {
    let roomData = await Redis.get(roomId);
    //blm ada di Redis --> ambil ke Mongo
    if (roomData === null) {
        roomData = await getRoomFromMongo(roomId);
        if (roomData === null) {
            return null;
        } else {
            return updateClientData(clientId, roomData, name);
        }
    //sdh ada di Redis
    } else {
        return updateClientData(clientId, JSON.parse(roomData), name);
    }
}


//call updateClientMongo async & updateClientRedis sync
async function updateClientData (clientId, roomData, name) {
    roomData.clients[clientId] = {
        name : name,
        cursor : {
            line : 1,
            caret : 0,
            color : "0",
            status : 0
        }
    };
    //async
    updateClientMongo(roomData);
    //sync
    await updateClientRedis(roomData);
    return roomData;
}


//update client list at MongoDB (async)
function updateClientMongo (roomData) {
    roomData = Room.hydrate(roomData);
    roomData.markModified('clients');
    roomData.save();
}


//update client list at Redis (sync)
function updateClientRedis (roomData) {
    Redis.set(roomData._id.toString(), JSON.stringify(roomData));
}


//updateCursor 
async function updateCursor (line, caret, status, clientId, roomId) {
    const roomData = rooms[roomId];
    roomData.clients[clientId].cursor = {
        line : line,
        caret : caret,
        color : 'asdf',
        status : status
    };
    //async 
    updateCursorMongo(roomData);
    //sync
    await updateCursorRedis(roomData);
}


//update Cursor at MongoDB (async)
function updateCursorMongo (roomData) {
    roomData = Room.hydrate(roomData);
    roomData.markModified('clients');
    roomData.save();
}


//update Cursor at Redis (sync)
function updateCursorRedis (roomData) {
    Redis.set(roomData._id.toString(), JSON.stringify(roomData));
}


//updateText
async function updateText (update, roomId) {
    const roomData = rooms[roomId];
    roomData.maxLine = update.maxLine;

    //kalau line id blm ada di urutan kemunculan baris
    if (roomData.lines_order[update.line_order] !== update.curLine) {
        roomData.lines_order.splice(update.line_order, 0, update.curLine);
    }

    roomData.lines[update.curLine.toString()] = {
        text : update.text
    };
    console.log(roomData.lines);

    //async
    updateTextMongo(roomData);
    //sync
    await updateTextRedis(roomData);
}


//update text on MongoDB
function updateTextMongo (roomData) {
    roomData = Room.hydrate(roomData);
    roomData.markModified('lines');
    roomData.save();
}


//update text on Redis
function updateTextRedis (roomData) {
    Redis.set(roomData._id.toString(), JSON.stringify(roomData));
}


//remove client
async function removeClient (clientId, roomId) {
    const roomData = rooms[roomId];
    delete roomData.clients[clientId];

    //async
    removeClientMongo(roomData);
    //sync
    await removeClientRedis(roomData);
    return roomData;
}


//remove client from MongoDB
function removeClientMongo (roomData) {
    roomData = Room.hydrate(roomData);
    roomData.markModified('clients');
    roomData.save();
}


//remove client from Redis
function removeClientRedis (roomData) {
    Redis.set(roomData._id.toString(), JSON.stringify(roomData));
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