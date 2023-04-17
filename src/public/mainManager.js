class MainManager {
    constructor () {
        this.clientWs = null;
        this.texteditorManager = null;
        this.setEventListener();
    }


    setEventListener = () => {
        document.getElementById('btnCreate').addEventListener('click', this.btnCreateListener);
        document.getElementById('btnJoin').addEventListener('click', this.btnJoinListener);
    }


    btnCreateListener = () => {
        const name = document.getElementById('name').value;
        if (this.nameCheck(name)) {
            this.wsCheck();
            const payload = {
                'method' : 'create',
                'name' : name
            };
            this.clientWs.sendPayload(payload);
        }
    }


    btnJoinListener = () => {
        const name = document.getElementById('name').value;
        const inputRoomId = document.getElementById('roomId').value;
        if (this.nameCheck(name) && inputRoomId !== '') {
            this.wsCheck();
            const payload = {
                'method' : 'join',
                'name' : name,
                'roomId' : inputRoomId
            }
            this.clientWs.sendPayload(payload);
        } else {
            alert('Room code is missing!');
        }
    }


    //name checker
    nameCheck = (name) => {
        if (name !== '' && name.length >= 4) {
            return true;
        } else {
            if (name.length < 4) {
                alert('Please use 4 character or more!');
            } else {
                alert('Username is missing!');
            }
            return false;
        }
    };


    //ws checker
    wsCheck = () => {
        if (this.clientWs == null) {
            this.clientWs = new ClientWs(81, this);
        } 
        return true;
    }


    joinPageUpdate = (msg) => {
        if (msg.client_status === -1) {
            alert('Wrong room code!');
        } else {
            //new client joins room
            if (msg.client_status === 0) {
                this.teManagerCheck(msg.newClient_Id, msg.room);
                this.clientWs.setTexteditorManager(this.texteditorManager);
            //existing client inside the room gets informational update
            } else {
                this.texteditorManager.setCurRoom(msg.room);
                this.texteditorManager.createNewCursor(msg.newClient_Id);
                document.getElementById('clientCounter').textContent = 'clients connected : ' + Object.keys(msg.room.clients).length + '';
            }
        } 
    }


    teManagerCheck = (clientId, roomData) => {
        if (this.texteditorManager == null) {
            this.texteditorManager = new TexteditorManager(this.clientWs, clientId, roomData);
        }
        return true;
    }
}

const mainManager = new MainManager(); 