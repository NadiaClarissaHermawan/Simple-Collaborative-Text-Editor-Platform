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
            this.roomId = this.createHandler(msg);

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
    createHandler = (msg) => {
        this.roomId = new mongoose.Types.ObjectId();
        this.roomController.createRoom(this.roomId).then(() => {
            const payload = {
                'method' : 'create',
                'roomId' : this.roomId.toString(),
                'name' : msg.name
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
                this.clients[this.clientId].connection.send(JSON.stringify(payload));

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
    updateCursorHandler = async (msg) => {
        let roomData = null;
        while (roomData == null) {
            roomData = await this.roomController.updateCursorDataRedis(msg, this.roomId);
        }
        this.roomController.updateMongo(roomData, 'clients');
        const payload = {
            'method' : 'updateCursor',
            'cursorId' : msg.cursorId,
            'clientCursor' : roomData.clients[msg.cursorId].cursor,
            'moveAffected' : msg.moveAffected
        };
        this.broadcast(payload, roomData.clients, true, msg.cursorId);
    }


    //on message 'updateText' handler
    updateTextHandler = async (msg) => {
        //TODO:hapus ini nanti
        console.log('ServerWSController updateTextHandler');
        console.log('old texts: ', msg.oldtexts);
        console.log('new texts: ', msg.texts);
        console.log('all msg', JSON.stringify(msg));
        let result = null;
        while (result == null) {
            result = await this.roomController.updateTextDataRedis(msg, this.roomId);
        }
        this.roomController.updateMongo(result.roomData, 'lines');
        
        console.log('updated texts', result.updatedTexts);
        console.log('updated data', result.roomData);
        console.log('curline, lastline: ', result.curLine, result.lastLine);
        const payload = {
            'method' : 'updateText',
            'oldtexts' : msg.oldtexts,
            'texts' : result.updatedTexts,
            'curLine' : result.curLine,
            'lastLine' : result.lastLine,
            'caret' : msg.caret,
            'editorId' : this.clientId, 
            'maxLine' : result.roomData.maxLine
        };
        this.broadcast(payload, result.roomData.clients, true, this.clientId);
    }


    //on client disconnected handler
    disconnect = async (clientId, roomId) => {
        let roomData = null;
        while (roomData == null) {
            roomData = await this.roomController.removeClientData(clientId, roomId);
        }
        this.roomController.updateMongo(roomData, 'clients');
        
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