//connect to server
//TODO:kalo pas hosting, localhost ganti jadi ip address dari si hostnya
let ws = new WebSocket('ws://localhost:81');

//global attributes
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
let letterWidth = 0.0;

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
            'room': resp.room
        };
        console.log('room successfully created with id ' + resp.roomId);
        btnJoin.click();

    //join
    } else if (resp.method === 'join') {
        if (resp.status === -1) {
            alert('Wrong room code!');
        } else {
            roomId.room = resp.room;
            //new client joins room
            if (resp.status === 0) {
                moveToTextEditor();
            //existing client inside the room gets informational update
            } else {
                createNewCursor(resp.clientId);
                document.getElementById('clientCounter').textContent = 'clients connected : ' + Object.keys(resp.room.clients).length + '';
            }
        } 
    
    // receive text update 
    } else if (resp.method === 'updateText') {
        const lineDiv = document.getElementById(resp.curLine);

        //new line
        if (lineDiv === null) {
            createNewLine(resp.lastLine, resp.curLine, resp.text);
            clientCursor.maxLine = resp.curLine; 

        //receive changes on existing line & make it visible
        } else {
            const textElement = lineDiv.children[0];
            textElement.textContent = resp.text;
            document.getElementById('textarea').value = resp.text;
            const textBounding = textElement.getBoundingClientRect();

            //first character typed, measure letter width
            if (letterWidth === 0.0) {
                letterWidth = (textBounding.right - textBounding.left) / textElement.textContent.length;
                console.log('letter width', letterWidth);
            } else {
                //TODO:HAPUS ELSE INI TESTER AJA
                console.log('l width', ((textBounding.right - textBounding.left) / textElement.textContent.length));
            }

            //move ONLY client-editor's cursor position
            if (resp.editorId === document.cookie.substring(9)) {
                clientCursor.caret += 1;
                clientCursor.cursorX = textBounding.left + (letterWidth * clientCursor.caret);
                clientCursor.cursorY = textBounding.y;
                notifyCursorUpdate();
            }
        }
    
    // receive cursor position update
    } else if (resp.method === 'updateCursor') {
        roomId.room.clients[resp.clientId].clientCursor = resp.clientCursor;
        updateCursor(resp.clientId);
        updateTextareaCaret(document.getElementById(resp.clientCursor.line).children[0].textContent, resp.clientCursor.caret);

    // someone disconnected
    } else if (resp.method === 'disconnect') {
        clientCounter.textContent = 'clients connected : ' + resp.room.clients.length + '';
        console.log('client id ' + clientId + ' has disconnected.');
    }
});


//create room button
function createRoom (e) {
    if (roomId.creator !== -1) {
        const payLoad = {
            'method' : 'move'
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
                    'method' : 'move'
                };
                ws.send(JSON.stringify(payLoad));
            }
            roomId = {
                'id' : inputRoomId.value.trim(),
                'creator' : 0,
                'room' : null
            };
        } 

        inputRoomId.value = "";
        const payload = {
            'method': 'join',
            'name': 'name',
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
        document.getElementById('clientCounter').textContent = 'clients connected : ' + Object.keys(roomId.room.clients).length + '';

        //create new cursor for this new client
        createNewCursor(clientId);

        //generate existing client's cursor 
        for (const [key, value] of Object.entries(roomId.room.clients)) {
            if (key !== clientId) {
                createNewCursor(key);
                updateCursor(key);

                const text = document.getElementById(value.clientCursor['line']).children[0].textContent;
                updateTextareaCaret(text, value.clientCursor['caret']);
            }
        }
        //TODO:client yg baru join, gapunya cursor dari client" lain yg sdh ada di room tsb
        //TODO:loop seluruh clients yg sdh ada di room tsb untuk create & munculin cursornya
    };
    xhttp.send();
}


//insert new client cursor
function createNewCursor (cursorId) {
    const cursorWrapper = document.createElement('div');
    cursorWrapper.id = cursorId;
    cursorWrapper.classList.add('none', 'cursor-wrapper');
    const cursor = document.createElement('div');
    cursor.classList.add('cursor');
    cursor.innerHTML = '&nbsp';
    cursorWrapper.appendChild(cursor);

    const textareaWrapper = document.getElementById('textarea-wrapper');
    textareaWrapper.parentNode.insertBefore(cursorWrapper, textareaWrapper);
}


//getting actual click position (line, caret, x coordinate) 
function getClickPosition (event) {
    const container = document.getElementById('text-presentation');
    let textBounding, clickedElement;

    //container clicked
    if (event.target === container) {
        //move cursor to the last line & rightmost caret position in the line
        clickedElement = container.lastElementChild.children[0];
        textBounding = clickedElement.getBoundingClientRect();
        clientCursor.line = clickedElement.parentNode.id;
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
            // console.log('span clicked', clientCursor.caret);
            clientCursor.cursorX = textBounding.left + (letterWidth * clientCursor.caret);
        //div (span wrapper)
        } else {
            clientCursor.line = clickedElement.id;
            clickedElement = clickedElement.children[0];
            clientCursor.caret = clickedElement.textContent.length;
            clientCursor.cursorX = clickedElement.getBoundingClientRect().right;
        }
    } 
    clientCursor.cursorY = textBounding.y;
    
    notifyCursorUpdate();
}


//update textarea selection range (caret)
function updateTextareaCaret (text, caret) {
    //move focus to textarea 
    const textarea = document.getElementById('textarea');
    textarea.value = text;
    textarea.setSelectionRange(caret, caret);
    textarea.focus();
};


//update cursor's x and y
function updateCursor (cursorId) {
    const cursorWrapper = document.getElementById(cursorId);
    const cursor = cursorWrapper.children[0];
    const wrapperBounding = document.getElementById('text-presentation-wrapper').getBoundingClientRect();

    //update cursor position
    const cursorPosition = roomId.room.clients[cursorId];
    cursor.style.left = cursorPosition.clientCursor['cursorX'] + "px";
    cursor.style.top = (cursorPosition.clientCursor['cursorY'] - wrapperBounding.y) + "px";
    cursorWrapper.classList.remove('none');
}


//accept input from clients
function receiveInput (event) {
    const textarea = document.getElementById('textarea');
    const lastLine = clientCursor.line;

    //adding new line div
    if (event.key === 'Enter') {
        //bukan di akhir line
        if ((textarea.value.length - 1) !== clientCursor.caret) {
            notifyTextUpdate(textarea.value.substring(0, clientCursor.caret), lastLine);
            textarea.value = textarea.value.substring(clientCursor.caret + 1);
            clientCursor.caret = -2;
        //akhir line
        } else {
            textarea.value = "";
            clientCursor.caret = -1;
        }
        clientCursor.maxLine += 1;
        clientCursor.line = clientCursor.maxLine;
        createNewLine(lastLine, clientCursor.maxLine, textarea.value);
        notifyTextUpdate(textarea.value, lastLine);
    
    //delete character
    } else if (event.key === 'Backspace') {
        console.log('back');
    
    //uppercase 
    } else if (event.key === 'CapsLock'){
        console.log('capslock');
    
    //alphanumeric & symbol (a-z, A-Z, 0-9)
    } else {
        console.log('input:'+textarea.value+'batas akhir');
        notifyTextUpdate(textarea.value, lastLine);
    }
};


//create new line div
function createNewLine (lastLineId, curLineId, textValue) {
    const lastLineDiv = document.getElementById(lastLineId);
    const lineDiv = document.createElement('div');
    const lineSpan = document.createElement('span');
    lineDiv.id = curLineId;
    lineDiv.classList.add('line');
    lineSpan.textContent = textValue;
    lineDiv.appendChild(lineSpan);
    lastLineDiv.parentNode.insertBefore(lineDiv, lastLineDiv.nextSibling); 
}


//notify server over a changed text
function notifyTextUpdate (text, lastLine) {
    const payload = {
        'method' : 'updateText',
        'text' : text,
        'curLine' : clientCursor.line,
        'lastLine' : lastLine
    };
    ws.send(JSON.stringify(payload));
}


//notify server over a changed cursor position
function notifyCursorUpdate () {
    const payload = {
        'method' : 'updateCursor',
        'clientCursor' : clientCursor
    };
    ws.send(JSON.stringify(payload));
}