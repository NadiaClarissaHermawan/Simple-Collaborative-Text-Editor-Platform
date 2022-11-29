//html elements
const inputName = document.getElementById('name');
const btnCreate = document.getElementById('btnCreate');
const btnJoin = document.getElementById('btnJoin');
const inputRoomId = document.getElementById('roomId');
const roomCode = document.getElementById('roomCode');
const clientCounter = document.getElementById('clientCounter');

//connect to server
let ws = new WebSocket('ws://localhost:81');

//declare attr
let clientId = null;
let roomId = {
    'id' : null,
    'creator' : -1 //-1 blm join & bukan creator, 0 join tp bukan creator, 1 creator room
};

//client ws message listener
ws.addEventListener('message', function message(data) {
    const resp = JSON.parse(data.data);

    //connect
    if (resp.method === 'connect') {
        clientId = resp.clientId;
        console.log('client id set successfully ' + clientId);
    //create
    } else if (resp.method === 'create') {
        roomId = {
            'id' : resp.roomId,
            'creator' : 1
        };
        console.log('room successfully created with id ' + resp.roomId);
        btnJoin.click();
    //join
    } else if (resp.method === 'join') {
        console.log('client joined successfully');
        roomCode.textContent = 'Room id : ' + roomId.id;
        clientCounter.textContent = 'clients connected : ' + resp.room.clients.length + '';
        roomCode.classList.remove('none');
        clientCounter.classList.remove('none');
    //someone disconnected
    } else if (resp.method === 'quit') {
        clientCounter.textContent = 'clients connected : ' + resp.room.clients.length + '';
        console.log('client id ' + clientId + ' has disconnected.');
    }
});

//create room button listeners
btnCreate.addEventListener('click', e => {
    if (roomId.creator !== -1) {
        const payLoad = {
            'method': 'move'
        };
        ws.send(JSON.stringify(payLoad));
    }
    
    const payLoad = {
        'method' : 'create'
    };
    ws.send(JSON.stringify(payLoad));
});

//join room button listeners
btnJoin.addEventListener('click', e => {
    const name = inputName.value;
    if (nameCheck(name)) {
        if (inputRoomId.value !== '') {
            if (roomId.creator !== -1) {
                const payLoad = {
                    'method': 'move'
                };
                ws.send(JSON.stringify(payLoad));
            }
            roomId = {
                'id' : inputRoomId.value.trim(),
                'creator' : 0
            };
        } 
        inputRoomId.value = "";
        const payload = {
            'method': 'join',
            'name': 'tester',
            'roomId' : roomId.id
        };
        ws.send(JSON.stringify(payload));
    }
});

//name checker
function nameCheck (name) {
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