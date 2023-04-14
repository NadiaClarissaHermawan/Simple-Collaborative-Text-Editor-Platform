import e from 'express';
import { WebSocketServer } from 'ws';
import mongoose from 'mongoose';
import RoomController from './controllers/roomController.js';
import ServerWsMsgController from './controllers/serverWsMsgController.js';

//socket event
const WS_EVENT_CONNECTION = 'connection';
const WS_EVENT_MESSAGE = 'message';
const WS_EVENT_CLOSE = 'close';

export default class ServerWs {
    constructor (portNumber) {
        this.clients = {};
        this.socket = new WebSocketServer({ port : portNumber });
        this.serverWsMsgHandler = null;
        this.roomController = new RoomController();
    }

    initialize () {
        if (this.socket !== null) {
            this.socket.on(WS_EVENT_CONNECTION, this.connectionEventHandler);
        }
    }

    //on client connected handler
    connectionEventHandler (ws) {
        let clientId = new mongoose.Types.ObjectId().toString();
        let roomId = null;
        this.clientConnected(ws, clientId);

        ws.on(WS_EVENT_MESSAGE, (data, isBinary) => {
            if (this.serverWsMsgHandler === null) {
                this.serverWsMsgHandler = new ServerWsMsgController(ws, this.clients);
            }

            this.serverWsMsgHandler.setClientId(clientId);
            this.serverWsMsgHandler.setRoomId(roomId);
            this.serverWsMsgHandler.handleMsg(data, isBinary);
        });

        ws.on(WS_EVENT_CLOSE, (ws) => {
            if (roomId !== null) {
                console.log('client ' + clientId + ' disconnected from room ' + roomId);
                // TODO: beresin clientDisconnected
                // this.clientDisconnected(clientId, roomId);
            }
        });
    }

    //connect response 
    clientConnected (ws, clientId) {
        this.clients[clientId] = {'connection' : ws};
        const payload = {
            'method' : 'connect',
            'clientId' : clientId
        };
        ws.send(JSON.stringify(payload));
    }

    //on close handler
    clientDisconnected (clientId, roomId) {
        console.log('someone dc');
        // roomController.removeClientData(clientId, roomId).then((roomData) => {
        //     if (Object.keys(roomData.clients).length === 0) {
        //         roomController.removeRoomFromRedis(roomId);
        //     } else {
        //         const payload = {
        //             'method' : 'disconnect',
        //             'clientId' : clientId,
        //             'room' : roomData
        //         };
        //         broadcast(payload, roomData.clients, true, clientId);   
        //     }
        //     //delete innactive client's connection
        //     delete clients[clientId];
        // });
    }
}