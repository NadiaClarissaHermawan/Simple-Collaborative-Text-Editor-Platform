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

//hashmap of clients connected (ws)
const clients = {};

//when client connect, do..
socket.on('connection', function connection(ws) {
    //generate unique clientId
    let clientId = new mongoose.Types.ObjectId().toString();
    //TODO:roomID gaperlu disimpen terpisah lagi, bisa ambil dari si roomData
    let roomId = null;
    let roomData = null;
    clientConnected(ws, clientId);

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

                    joinRoom(clientId, msg.name, roomData).then(() => {
                        const payload = {
                            'method' : 'join',
                            'status' : 0,
                            'room' : roomData,
                            'newClient_Id' : clientId
                        };
                        ws.send(JSON.stringify(payload));
                        
                        //broadcast
                        payload['status'] = 1;
                        broadcast(payload, roomData.clients, false, clientId);
                    });
                }
            });
        
        //disconnect/move from room without quitting request    
        //cuma kepake kalau di tampilan editor teksnya ada form join room & create room (skrg sih tdk digunakan)
        } else if (msg.method === 'move') {
            console.log('MOVE TRIGGERED');
            removeClient(clientId, roomData).then(() => {
                const payload = {
                    'method' : 'disconnect',
                    'room' : roomData
                };
                broadcast(payload, roomData.clients, true, clientId);
            });

        //notify other clients over a changed text  
        } else if (msg.method === 'updateText') {
            //TODO: roomData.clients isinya gaada si orang" yg udah join
            // console.log('test lagi', roomData);
            updateText(msg.lastLine, msg.curLine, msg.maxLine, msg.caret, msg.text, msg.line_order, roomData).then(() => {
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

        //notify other clients over a changed cursor position
        } else if (msg.method === 'updateCursor') {
            console.log('Cursor position updated by clientId:', msg.cursorId);
            updateCursor(msg.line, msg.caret, msg.status, msg.cursorId, roomData);
            
            const payload = {
                'method' : 'updateCursor',
                'cursorId' : msg.cursorId,
                'clientCursor' : roomData.clients.get(msg.cursorId).cursor
            };

            //send room state through all clients
            for (const [key, value] of roomData.clients) {
                clients[key].connection.send(JSON.stringify(payload));

                //check & move editable affected cursors (from update text)
                const c = roomData.clients.get(key).cursor;
                if (msg.code === 1 && key !== msg.cursorId && value.cursor['line'] === c['line'] && value.cursor['status'] === 1
                && value.cursor['caret'] >= (c['caret'] - 1)) {
                    // //same line, a letter typed
                    // if () {

                    // //line differ by 1 (enter)     
                    // } else if () {

                    // // same line, backspace 
                    // } else if () {

                    // }
                    
                    updateCursor(c['line'], c['caret']+1, c['status'], key, roomData);
                    let payload2 = {
                        'method' : 'updateCursor',
                        'cursorId' : key,
                        'clientCursor' : c
                    };
                    broadcast(payload2, roomData.clients, true, key);
                } 
            }
        }
    });

    //when client disconnected, do..
    ws.on('close', function connection(ws) {
        if (roomId !== null) {
            console.log('client ' + clientId + ' disconnected from room ' + roomId);
            removeClient(clientId, roomData).then(() => {
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
async function joinRoom (clientId, name, roomData) {
    //store client's initial state at current room to DB
    roomData.clients.set(clientId, {
        name : name,
        cursor : {
            line : 1,
            caret : 0,
            color : "0",
            status : 0
        }
    });
    await roomData.save();
}


//updateText TODO:ganti jadi redis
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


//updateCursor TODO:ganti jadi redis
async function updateCursor (line, caret, status, clientId, roomData) {
    console.log(roomData);
    roomData.clients.get(clientId).cursor = {
        line : line,
        caret : caret,
        color : 'asdf',
        status : status
    }
    await roomData.save();
}


//remove client
async function removeClient (clientId, roomData) {
    roomData.clients.delete(clientId);
    await roomData.save();
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