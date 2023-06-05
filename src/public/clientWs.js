const WS_EVENT_MESSAGE = 'message';
const WS_EVENT_OPEN = 'open';

class ClientWs {
    constructor (portNumber, pageManager, texteditorManager) {
        //TODO:kalo pas hosting, localhost ganti jadi ip address dari si hostnya (tp ws:// hrs ttep ada)
        this.ws = new WebSocket('ws://192.168.100.8:' + portNumber);
        this.pageManager = pageManager;
        this.texteditorManager = null;
        this.initialize();
    }


    initialize = () => {
        this.ws.addEventListener(WS_EVENT_MESSAGE, this.handleMsg);
    }


    setTexteditorManager = (texteditorManager) => {
        this.texteditorManager = texteditorManager;
    }


    handleMsg = (data) => {
        const msg = JSON.parse(data.data);
        if (msg.method === 'connect') {
            this.connectRespHandler(msg);

        } else if (msg.method === 'create') {
            this.createRespHandler(msg);

        } else if (msg.method === 'join') {
            this.pageManager.joinPageUpdate(msg);

        } else if (msg.method === 'updateText') {
            this.texteditorManager.textPageUpdate(msg);

        } else if (msg.method === 'updateCursor') {
            this.texteditorManager.cursorPageUpdate(msg);

        } else if (msg.method === 'disconnect') {
            this.texteditorManager.disconnectPageUpdate(msg);
        }
    }


    //save clientId to cookie obj
    connectRespHandler = (msg) => {
        const obj = {
            'clientId' : msg.clientId
        }
        document.cookie = JSON.stringify(obj);
    }


    createRespHandler = (msg) => {
        const payload = {
            'method' : 'join',
            'name' : msg.name,
            'roomId' : msg.roomId
        };
        this.sendPayload(payload);

        // contoh kirim fetch api
        // this.sendRequest('/createroom', METHOD_POST, msg, this.sendPayload);
    }


    sendPayload = (payload) => {
        //wait until client ws connected to server ws
        if (this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(payload));
        } else if (this.ws.readyState === WebSocket.CONNECTING) {
            this.ws.addEventListener(WS_EVENT_OPEN, () => { 
                this.sendPayload(payload); 
            });
        } 
    }
}