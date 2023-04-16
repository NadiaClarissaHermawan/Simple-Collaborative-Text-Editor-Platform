class PageListener {
    constructor () {
        this.response = null;
        this.clientWs = null;
        this.letterWidth = 0.0;
        this.parent = null;
        
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


    tester = (msg) => {
        console.log('tessss',msg);
    }
}

const pageListener = new PageListener(); 