import mongoose from 'mongoose';
import RoomController from './roomController.js';

export default class ServerWsController {
    constructor (clients) {
        this.clients = clients;
        this.clientId = null;
        this.roomId = null;
        this.roomController = new RoomController();
    }


    setClientId = (clientId) => {
        this.clientId = clientId;
    }


    setRoomId = (roomId) => {
        this.roomId = roomId;
    }


    handleMsg = (msg) => {
        if (msg.method === 'create') {
            this.roomId = this.createHandler();

        } else if (msg.method === 'join') {
            this.roomId = msg.roomId;
            this.joinHandler(msg);
            
        } else if (msg.method === 'updateCursor') {
            this.updateCursorHandler(msg);

        } else if (msg.method === 'updateText') {
            this.updateTextHandler(msg);
        }
    }


    //on message 'create' handler
    createHandler = () => {
        this.roomId = new mongoose.Types.ObjectId();
        this.roomController.createRoom(this.roomId).then(() => {
            const payload = {
                'method' : 'create',
                'roomId' : this.roomId.toString()
            };
            this.clients[this.clientId].connection.send(JSON.stringify(payload));
        });
        return this.roomId.toString();
    }


    //on message 'join' handler
    joinHandler = (msg) => {
        let payload = null;
        this.roomController.joinRoom(this.clientId, msg.name, msg.roomId).then((roomData) => {
            if (roomData === null) {
                payload = {
                    'method' : 'join',
                    'client_status' : -1
                };
                this.clients['0'][this.clientId].connection.send(JSON.stringify(payload));

            } else {
                payload = {
                    'method' : 'join',
                    'client_status' : 0,
                    'room' : roomData,
                    'newClient_Id' : this.clientId
                };
                this.clients[this.clientId].connection.send(JSON.stringify(payload));
                
                payload['client_status'] = 1;
                this.broadcast(payload, roomData.clients, false, this.clientId);
            }
        });
    }


    //on message 'updateCursor' handler
    updateCursorHandler = (msg) => {
        this.roomController.updateCursorData(msg, this.roomId).then((roomData) => {
            const payload = {
                'method' : 'updateCursor',
                'cursorId' : msg.cursorId,
                'clientCursor' : roomData.clients[msg.cursorId].cursor
            };
            this.broadcast(payload, roomData.clients, true, msg.cursorId);
        });
    }


    //on message 'updateText' handler
    updateTextHandler = (msg) => {
        this.roomController.updateTextData(msg, this.roomId).then((roomData) => {
            const payload = {
                'method' : 'updateText',
                'text' : msg.text,
                'curLine' : msg.curLine,
                'lastLine' : msg.lastLine,
                'caret' : msg.caret,
                'editorId' : this.clientId, 
                'maxLine' : roomData.maxLine
            };
            this.broadcast(payload, roomData.clients, true, this.clientId);
        });
    }


    //on client disconnected handler
    disconnect = (clientId, roomId) => {
        this.roomController.removeClientData(clientId, roomId).then((roomData) => {
            if (Object.keys(roomData.clients).length === 0) {
                this.roomController.removeRoomFromRedis(roomId);
            } else {
                const payload = {
                    'method' : 'disconnect',
                    'clientId' : clientId,
                    'room' : roomData
                };
                this.broadcast(payload, roomData.clients, true, clientId);   
            }
            //delete innactive client's connection
            delete this.clients[clientId];
        });
    }


    //broadcast
    broadcast = (payload, target, self, editorId) => {
        for (const [key, value] of Object.entries(target)) {
            if (!self && key == editorId) {
                continue;
            } else if (this.clients[key] !== undefined) {
                this.clients[key].connection.send(JSON.stringify(payload));
            }
        }
    }
}