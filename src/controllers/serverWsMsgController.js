export default class ServerWsMsgController {
    constructor (ws, clients) {
        this.ws = ws;
        this.clients = clients;
        this.clientId = null;
        this.roomId = null;
    }


    setClientId (clientId) {
        this.clientId = clientId;
    }


    setRoomId (roomId) {
        this.roomId = roomId;
    }


    handleMsg (data, isBinary) {
        const msg = isBinary ? data : JSON.parse(data.toString());
        console.log('clients:', this.clients); 
        // if (msg.method === 'create') {
        //     this.roomId = this.msgCreateHandler(this.ws);

        // } else if (msg.method === 'join') {
        //     this.roomId = msg.roomId;
        //     this.msgJoinHandler(this.ws, msg, this.clientId);
            
        // } else if (msg.method === 'updateCursor') {
        //     this.msgUpdateCursorHandler(msg, roomId);

        // } else if (msg.method === 'updateText') {
        //     msgUpdateTextHandler(msg, roomId, clientId);
        // }
    }


    //on message 'create' handler
    msgCreateHandler (ws) {
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
    msgJoinHandler (ws, msg, clientId) {
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
    msgUpdateCursorHandler (msg, roomId) {
        roomController.updateCursorData(msg, roomId).then((roomData) => {
            const payload = {
                'method' : 'updateCursor',
                'cursorId' : msg.cursorId,
                'clientCursor' : roomData.clients[msg.cursorId].cursor
            };
            broadcast(payload, roomData.clients, true, msg.cursorId);
        });
    }


    //on message 'updateText' handler
    msgUpdateTextHandler (msg, roomId, clientId) {
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
    broadcast (payload, target, self, editorId) {
        for (const [key, value] of Object.entries(target)) {
            if (!self && key == editorId) {
                continue;
            } else if (clients[key] !== undefined) {
                clients[key].connection.send(JSON.stringify(payload));
            }
        }
    }
}