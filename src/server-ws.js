import e from 'express';
import { WebSocketServer } from 'ws';
import mongoose from 'mongoose';
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
    }

    //create server ws 
    initialize = () => {
        if (this.socket !== null) {
            this.socket.on(WS_EVENT_CONNECTION, this.connectionEventHandler);
        }
    };

    
    //on client connected handler
    connectionEventHandler = (ws) => {
        let roomId = null;
        let clientId = new mongoose.Types.ObjectId().toString();
        let msg = null;
        this.clientConnected(ws, clientId);

        ws.on(WS_EVENT_MESSAGE, (data, isBinary) => {
            if (this.serverWsMsgHandler === null) {
                this.serverWsMsgHandler = new ServerWsMsgController(this.clients);
            }

            msg = isBinary ? data : JSON.parse(data.toString());
            if (msg.method === 'join') {
                roomId = msg.roomId;
            }
            this.serverWsMsgHandler.setClientId(clientId);
            this.serverWsMsgHandler.handleMsg(msg);
        });

        ws.on(WS_EVENT_CLOSE, (ws) => {
            if (roomId !== null) {
                console.log('client ' + clientId + ' disconnected from room ' + roomId);
                this.clientDisconnected(clientId, roomId);
            }
        });
    }


    //client ws connected response 
    clientConnected = (ws, clientId) => {
        this.clients[clientId] = { 'connection' : ws };

        const payload = {
            'method' : 'connect',
            'clientId' : clientId
        };
        ws.send(JSON.stringify(payload));
    }


    //on close handler
    clientDisconnected = (clientId, roomId) => {
        this.serverWsMsgHandler.disconnect(clientId, roomId);
    }
}