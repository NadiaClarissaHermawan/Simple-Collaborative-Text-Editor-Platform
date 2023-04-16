const WS_EVENT_MESSAGE = 'message';
const WS_EVENT_OPEN = 'open';
const METHOD_GET = 'get';
const METHOD_POST = 'post';

class ClientWs {
    constructor (portNumber, pageListener) {
        this.ws = new WebSocket('ws://localhost:' + portNumber);
        this.curRoom = {
            'id' : null,
            'room' : null
        };
        this.pageListener = pageListener;
        this.initialize();
    }


    initialize = () => {
        this.ws.addEventListener(WS_EVENT_MESSAGE, this.handleMsg);
    }


    handleMsg = (data) => {
        const msg = JSON.parse(data.data);
        if (msg.method === 'connect') {
            this.connectRespHandler(msg);

        } else if (msg.method === 'create') {
            this.createRespHandler(msg);

        } else if (msg.method === 'join') {
            this.joinRespHandler(msg);

        } else if (msg.method === 'updateText') {

        } else if (msg.method === 'updateCursor') {

        } else if (msg.method === 'disconnect') {

        }
    }


    //save clientId to cookie obj
    connectRespHandler = (msg) => {
        const obj = {
            'clientId' : msg.clientId
        }
        document.cookie = JSON.stringify(obj);

        //retrieve cookie value example
        console.log('client id set successfully ' + JSON.parse(document.cookie)['clientId']);
    }


    createRespHandler = (msg) => {
        this.curRoom['id'] = msg.roomId;
        const payload = {
            'method' : 'join',
            'name' : msg.name,
            'roomId' : msg.roomId
        };
        this.sendPayload(payload);

        // contoh kirim fetch api
        // this.sendRequest('/createroom', METHOD_POST, msg, this.sendPayload);
    }


    joinRespHandler = (msg) => {
        //TODO:copy dari resp.method === 'join'
        this.pageListener.tester(msg);
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


    //fetch API send request to routes
    sendRequest = async (url, mtd, bdy, nextMove) => {
        try {
            this.response = await fetch(url, {
                method : mtd,
                headers : {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body : JSON.stringify(bdy)
            });

            this.response.json().then((data) => {
                nextMove(data);
            });
        } catch (e) {
            console.log('Fetch API error: ', e);
        }
    } 
}