//connect to server
let ws = new WebSocket('ws://localhost:81');

//declare attr
let clientId = null;
let roomId = {
    'id' : null,
    'creator' : -1, //-1 blm join & bukan creator, 0 join tp bukan creator, 1 creator room
    'room' : null
};
let clientCursor = {
    'line' : 1,
    'caret' : 0,
    'maxLine' : 1,
    'cursorX' : 0,
    'cursorY' : 0
};
let letterWidth = 0;


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
            moveToTextEditor();
        }
    
    // receive changes 
    } else if (resp.method === 'update') {
        document.getElementById(resp.line).children[0].textContent = resp.text;
        document.getElementById('textarea').value = resp.text;

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
function moveToTextEditor () {
    const xhttp = new XMLHttpRequest(); 
    xhttp.open('GET', '/texteditor', true);
    xhttp.onload = function () {
        document.getElementById('mainContainer').innerHTML = xhttp.responseText;
        document.getElementById('roomCode').textContent = 'Room id : ' + roomId.id;;
        document.getElementById('clientCounter').textContent = 'clients connected : ' + roomId.room.clients.length + '';
    };
    xhttp.send();
}


//getting click position (line, x and caret)
function getCaretPosition(event) {
    const container = document.getElementById('text-presentation');
    let textBounding, clickedElement;

    //container clicked
    if (event.target === container) {
        //move cursor to the last line & rightmost caret position in the line
        clickedElement = document.getElementById(clientCursor.maxLine).children[0];
        textBounding = clickedElement.getBoundingClientRect();
        clientCursor.line = clientCursor.maxLine;
        clientCursor.cursorX = textBounding.right;
        clientCursor.caret = clickedElement.textContent.length;
    
    //existing line clicked
    } else {
        clickedElement = event.target;
        textBounding = clickedElement.getBoundingClientRect();
        //text span 
        if (!clickedElement.classList.contains('line')) {
            clientCursor.line = clickedElement.parentNode.id;
            clientCursor.caret = window.getSelection().anchorOffset;
            clientCursor.cursorX = (textBounding.left + (((textBounding.right - textBounding.left) / clickedElement.textContent.length) * clientCursor.caret));
        //div (span wrapper)
        } else {
            clientCursor.line = clickedElement.id;
            clickedElement = clickedElement.children[0];
            clientCursor.cursorX = clickedElement.getBoundingClientRect().right;
            clientCursor.caret = clickedElement.textContent.length;
        }
    } 
    clientCursor.cursorY = textBounding.y;
    updateCursor();

    //move focus to textarea 
    const textarea = document.getElementById('textarea');
    textarea.value = clickedElement.textContent;
    textarea.setSelectionRange(clientCursor.caret, clientCursor.caret);
    textarea.focus();
};


//update cursor's x and y
function updateCursor () {
    const cursor = document.getElementById('cursor-wrapper');
    const c = document.getElementById('cursor');
    const wrapperBounding = document.getElementById('text-presentation-wrapper').getBoundingClientRect();

    //update cursor position
    c.style.left = clientCursor.cursorX + "px";
    c.style.top = (clientCursor.cursorY - wrapperBounding.y) + "px";
    cursor.classList.remove('none');
}


//accept input from clients
function receiveInput (event) {
    const textarea = document.getElementById('textarea');

    //adding new line div
    if (event.key === 'Enter') {
        clientCursor.maxLine += 1;
        const lastLineDiv = document.getElementById(clientCursor.line);
        const lineDiv = document.createElement('div');
        const lineSpan = document.createElement('span');
        lineDiv.id = clientCursor.maxLine;
        lineDiv.classList.add('line');

        //bukan di akhir line
        if ((textarea.value.length - 1) !== clientCursor.caret) {
            notifyUpdate(textarea.value.substring(0, clientCursor.caret));
            textarea.value = textarea.value.substring(clientCursor.caret + 1);
        //di akhir line
        } else {
            textarea.value = "";
        }
        lineSpan.textContent = textarea.value;
        lineDiv.appendChild(lineSpan);
        lastLineDiv.parentNode.insertBefore(lineDiv, lastLineDiv.nextSibling); 

        //move clicked position
        document.getElementById('text-presentation').click();
    
    } else {
        //TODO:ini ga efektif krn gabisa pake method getCaret yang ada
        //gabisa pake mthod tsb karena window selectionnya blm ketemu cara ngesetnya.
        const textElement = document.getElementById(clientCursor.line).children[0];
        const textBounding = textElement.getBoundingClientRect(); 
        clientCursor.caret += 1;
        clientCursor.cursorX = (textBounding.left + (((textBounding.right - textBounding.left) / textElement.textContent.length) * clientCursor.caret));
        clientCursor.cursorY = document.getElementById(clientCursor.line).children[0].getBoundingClientRect().y;

        updateCursor();
    }
    notifyUpdate(textarea.value);
};

//notify server & other clients over a change
function notifyUpdate (text) {
    const payload = {
        'method' : 'update',
        'text' : text,
        'clientCursor' : clientCursor
    };
    ws.send(JSON.stringify(payload));
}