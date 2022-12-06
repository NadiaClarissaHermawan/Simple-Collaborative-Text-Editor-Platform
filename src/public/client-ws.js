//connect to server
let ws = new WebSocket('ws://localhost:81');

//declare attr
let clientId = null;
let roomId = {
    'id' : null,
    'creator' : -1, //-1 blm join & bukan creator, 0 join tp bukan creator, 1 creator room
    'room' : null
};

//client ws message listener
ws.addEventListener('message', function message(data) {
    const resp = JSON.parse(data.data);

    //connect
    if (resp.method === 'connect') {
        document.cookie = "clientId=" + resp.clientId;
        clientId = resp.clientId;
        //retrieve cookie value example
        const test = document.cookie.substring(9);
        console.log('client id set successfully ' + test);

    //create
    } else if (resp.method === 'create') {
        roomId = {
            'id' : resp.roomId,
            'creator' : 1,
            'room':null
        };
        console.log('room successfully created with id ' + resp.roomId);
        
        btnJoin.click();

    //join
    } else if (resp.method === 'join') {
        if (resp.status === false) {
            alert('Wrong room code!');
        } else {
            console.log('Room ID : ' + roomId.id);
            roomId.room = resp.room; 
            updateEditorView();
        }
    
    // receive changes 
    } else if (resp.method === 'update') {
        console.log('client accepted a change'+resp.text);
        document.getElementById('editor').value = resp.text;

    // someone disconnected
    } else if (resp.method === 'quit') {
        clientCounter.textContent = 'clients connected : ' + resp.room.clients.length + '';
        console.log('client id ' + clientId + ' has disconnected.');
    }
});

//create room button
function createRoom (e) {
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
}

//join room button
function joinRoom (e) {
    const name = document.getElementById('name').value;
    const inputRoomId = document.getElementById('roomId');
    if (nameCheck(name)) {
        if (inputRoomId.value !== '' && roomId.creator !== 1) {
            if (roomId.creator !== -1) {
                const payLoad = {
                    'method': 'move'
                };
                ws.send(JSON.stringify(payLoad));
            }
            roomId = {
                'id' : inputRoomId.value.trim(),
                'creator' : 0,
                'room':null
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
}

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

//AJAX : changing mainPage content into text editor
function updateEditorView () {
    const xhttp = new XMLHttpRequest(); 
    xhttp.open('GET', '/texteditor', true);
    xhttp.onload = function () {
        document.getElementById('mainContainer').innerHTML = xhttp.responseText;
        document.getElementById('roomCode').textContent = 'Room id : ' + roomId.id;;
        document.getElementById('clientCounter').textContent = 'clients connected : ' + roomId.room.clients.length + '';
        roomCode.classList.remove('none');
        clientCounter.classList.remove('none');
    };
    xhttp.send();
}

//getting client's Carret position
function getCaretPosition(element) {
    const position = 0;
    const selection = document.getSelection();
    console.log(selection.anchorNode.nodeType);
    // if (selection.rangeCount !== 0) {
    //     const range = window.getSelection().getRangeAt(0);
    //     const preCaretRange = range.cloneRange();
    //     preCaretRange.selectNodeContents(element);
    //     preCaretRange.setEnd(range.endContainer, range.endOffset);
    //     position = preCaretRange.toString().length;
    // }
    // console.log(position);
};

//notify server on content changes
function updateContent () {
    console.log('client has made a change.') 
    const text = document.getElementById('editor').textContent;
    const payload = {
        'method' : 'update',
        'text' : text
    };
    ws.send(JSON.stringify(payload));
};

