export default class ClientEventController {
    constructor () { 
        this.curRoom = {
            'id' : null,
            'room' : null
        };
        this.letterWidth = 0.0;
        this.parent = null;
        this.setEventListener();
    }

    
    setEventListener = () => {
        document.getElementById('btnCreate').setEventListener('onclick', this.createRoom);
        document.getElementById('btnJoin').setEventListener('onclick', this.joinRoom);
    }


    //create room button
    createRoom = (e) => {
        //TODO:if clicked create web socket
        const name = document.getElementById('name').value;
        if (this.nameCheck(name)) {
            const payLoad = {
                'method' : 'create'
            };
            ws.send(JSON.stringify(payLoad));
        }
    }


    //join room button
    joinRoom = (e) => {
        //TODO: if clicked && websocket null -> create
        const name = document.getElementById('name').value;
        const inputRoomId = document.getElementById('roomId');
        if (this.nameCheck(name)) {
            if (inputRoomId.value !== '') {
                this.curRoom = {
                    'id' : inputRoomId.value.trim(),
                    'room' : null
                };
            } 

            inputRoomId.value = "";
            const payload = {
                'method' : 'join',
                'name' : name,
                'roomId' : this.curRoom.id
            };
            ws.send(JSON.stringify(payload));
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
    }
}

const clientEventController = new ClientEventController();