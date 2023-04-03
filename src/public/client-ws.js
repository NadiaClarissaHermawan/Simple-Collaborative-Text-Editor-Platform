//connect to server
//TODO:kalo pas hosting, localhost ganti jadi ip address dari si hostnya (tp ws:// hrs ttep ada)
let ws = new WebSocket('ws://localhost:81');

//global attributes
let curRoom = {
    'id' : null,
    'room' : null
};
let letterWidth = 0.0;
let parent = null;

//client ws message listener
ws.addEventListener('message', function message(data) {
    const resp = JSON.parse(data.data);

    //connect
    if (resp.method === 'connect') {
        //simpan cookie object
        const obj = {
            'clientId' : resp.clientId
        };
        document.cookie = JSON.stringify(obj);
        
        //retrieve cookie value example
        console.log('client id set successfully ' + JSON.parse(document.cookie)['clientId']);

    //create
    } else if (resp.method === 'create') {
        curRoom = {
            'id' : resp.roomId,
            'room': null
        };
        console.log('room successfully created with id ' + resp.roomId);
        btnJoin.click();

    //join
    } else if (resp.method === 'join') {
        if (resp.client_status === -1) {
            alert('Wrong room code!');
        } else {
            curRoom.room = resp.room;
            //new client joins room
            if (resp.client_status === 0) {
                moveToTextEditor();
            //existing client inside the room gets informational update
            } else {
                createNewCursor(resp.newClient_Id);
                document.getElementById('clientCounter').textContent = 'clients connected : ' + Object.keys(resp.room.clients).length + '';
            }
        } 
    
    // receive text update 
    } else if (resp.method === 'updateText') {
        const lineDiv = document.getElementById(resp.curLine);
        const roomData = curRoom.room;
        roomData.maxLine = resp.maxLine;

        //new line
        if (lineDiv === null) {
            createNewLine(resp.lastLine, resp.curLine, resp.text);
        //receive changes on existing line & make it visible
        } else {
            const textElement = lineDiv.children[0];
            textElement.textContent = resp.text;
            document.getElementById('textarea').value = resp.text;

            //first character typed, measure letter width
            if (letterWidth === 0.0) { countLetterWidth(textElement); }

            //move ONLY client-editor's cursor position
            if (resp.editorId === JSON.parse(document.cookie)['clientId']) {
                const cCursor = roomData.clients[resp.editorId].cursor;
                const oldCaret = cCursor['caret']; 
                cCursor['line'] = resp.curLine;
                cCursor['caret'] = resp.caret;
                notifyCursorUpdate(resp.editorId, cCursor['line'], cCursor['caret'], 1)

                //check & move affected cursors
                const container = document.getElementById('text-presentation');
                for (const [key, value] of Object.entries(roomData.clients)) {
                    if (key != resp.editorId && value.cursor['status'] == 1) {
                        const clientElement = document.getElementById(value.cursor['line']);
                        const clientElementIdx = Array.prototype.indexOf.call(container.children, clientElement);
                        const editorElementIdx = Array.prototype.indexOf.call(container.children, lineDiv);
                        console.log(clientElementIdx, editorElementIdx);
                        if (clientElementIdx > editorElementIdx) {
                            notifyCursorUpdate(key, value.cursor['line'], value.cursor['caret'], 1);
                        }
                    } else if (key != resp.editorId && value.cursor['status'] == 1 && value.cursor['caret'] >= oldCaret) {
                        if (value.cursor['line'] == cCursor['line']) {
                            notifyCursorUpdate(key, value.cursor['line'], value.cursor['caret']+1, 1);
                        } else if (value.cursor['line'] == resp.lastLine && resp.lastLine != resp.curLine) {
                            notifyCursorUpdate(key, resp.curLine, (value.cursor['caret'] - oldCaret), 1);
                        } 
                    } 
                }
            }
        }
    
    // receive cursor position update
    } else if (resp.method === 'updateCursor') {
        curRoom.room.clients[resp.cursorId].cursor = resp.clientCursor;
        updateCursor(resp.cursorId);
        if (JSON.parse(document.cookie)['clientId'] === resp.cursorId) {
            updateTextareaCaret(document.getElementById(resp.clientCursor['line']).children[0].textContent, resp.clientCursor['caret']);
        }
        
    // someone disconnected
    } else if (resp.method === 'disconnect') {
        clientCounter.textContent = 'clients connected : ' + Object.keys(resp.room.clients).length + '';
        console.log('client id ' + JSON.parse(document.cookie)['clientId'] + ' has disconnected.');
    }
});


//create room button
function createRoom (e) {
    const name = document.getElementById('name').value;
    if (nameCheck(name)) {
        const payLoad = {
            'method' : 'create'
        };
        ws.send(JSON.stringify(payLoad));
    }
}


//join room button
function joinRoom (e) {
    const name = document.getElementById('name').value;
    const inputRoomId = document.getElementById('roomId');
    if (nameCheck(name)) {
        if (inputRoomId.value !== '') {
            curRoom = {
                'id' : inputRoomId.value.trim(),
                'room' : null
            };
        } 

        inputRoomId.value = "";
        const payload = {
            'method': 'join',
            'name': name,
            'roomId' : curRoom.id
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
        document.getElementById('roomCode').textContent = 'Room id : ' + curRoom.id;;
        document.getElementById('clientCounter').textContent = 'clients connected : ' + Object.keys(curRoom.room.clients).length + '';
        
        //generate existing room's text
        loadAllContent();

        // create new cursor for this new client
        createNewCursor(JSON.parse(document.cookie)['clientId']);

        parent = document.getElementById('text-presentation');
    };
    xhttp.send();
}


//load existing text
function loadAllContent () {
    //generate existing texts
    let text = "";
    for (let [index, value] of curRoom.room.lines_order.entries()) {
        text = curRoom.room.lines[value].text;
        createNewLine(curRoom.room.lines_order[index-1], value, text);

        //textwidth 
        if (letterWidth === 0.0 && text.length > 0) { 
            countLetterWidth(document.getElementById(value).children[0]); 
        }
    }

    //generate existing client cursors 
    for (const [key, value] of Object.entries(curRoom.room.clients)) {
        if (key !== JSON.parse(document.cookie)['clientId']) {
            createNewCursor(key);
            updateCursor(key);
            const text = document.getElementById(value.cursor['line']).children[0].textContent;
            updateTextareaCaret(text, value.cursor['caret']);
        }
    }    
}


//letter width counter
function countLetterWidth (textElement) {
    const textBounding = textElement.getBoundingClientRect();
    letterWidth = (textBounding.right - textBounding.left) / textElement.textContent.length;
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
    let line, caret;
    let clickedElement;

    //container clicked
    if (event.target === container) {
        //move cursor to the last line & rightmost caret position in the line
        clickedElement = container.lastElementChild.children[0];
        line = clickedElement.parentNode.id;
        caret = clickedElement.textContent.length;
    
    //existing line clicked
    } else {
        clickedElement = event.target;
        //text pre
        if (!clickedElement.classList.contains('line')) {
            line = clickedElement.parentNode.id;
            caret = window.getSelection().anchorOffset;
        //div (pre wrapper)
        } else {
            line = clickedElement.id;
            clickedElement = clickedElement.children[0];
            caret = clickedElement.textContent.length;
        }
    } 
    notifyCursorUpdate(JSON.parse(document.cookie)['clientId'], line, caret, 1);
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
    if (curRoom.room.clients[cursorId].cursor['status'] === 1) {
        const cursorWrapper = document.getElementById(cursorId);
        const cursor = cursorWrapper.children[0];
        const wrapperBounding = document.getElementById('text-presentation-wrapper').getBoundingClientRect();
    
        //update cursor position
        const cursorPosition = curRoom.room.clients[cursorId].cursor;
        const elementBounding = document.getElementById(cursorPosition['line']).children[0].getBoundingClientRect();
        cursor.style.left = (elementBounding.left + (letterWidth * cursorPosition['caret'])) + "px";
        cursor.style.top = (elementBounding.y - wrapperBounding.y) + "px";

        if (cursorWrapper.classList.contains('none')) {
            cursorWrapper.classList.remove('none');
        }
    }
}


//accept input from clients
function receiveInput (event) {
    const textarea = document.getElementById('textarea');
    const cCursor = curRoom.room.clients[JSON.parse(document.cookie)['clientId']].cursor;
    const editedLine = cCursor['line'];

    //adding new line div
    if (event.key === 'Enter') {
        enterKeyHandler(textarea.value, cCursor, editedLine, curRoom.room.maxLine).then((text) => {
            curRoom.room.maxLine += 1;
            createNewLine(editedLine, curRoom.room.maxLine, text);
            notifyTextUpdate(text, editedLine, curRoom.room.maxLine, curRoom.room.maxLine, 0);
        });
        
    //uppercase 
    } else if (event.key === 'CapsLock' || event.key === 'Shift'){
        event.preventDefault();

    //left
    } else if (event.key === 'ArrowLeft') {
        if (cCursor['caret'] > 0) {
            notifyCursorUpdate(JSON.parse(document.cookie)['clientId'], cCursor['line'], cCursor['caret']-1, 1);
        }
    
    //right
    } else if (event.key === 'ArrowRight') {
        const len = document.getElementById(cCursor['line']).children[0].textContent.length;
        if (cCursor['caret'] < len) {
            notifyCursorUpdate(JSON.parse(document.cookie)['clientId'], cCursor['line'], cCursor['caret']+1, 1);
        }

    //up
    } else if (event.key === 'ArrowUp') {
        const topDivId = document.getElementById('text-presentation').children[0].id;
        if (cCursor['line'] !== topDivId) {
            const prevDivId = document.getElementById(cCursor['line']).previousSibling.id;
            notifyCursorUpdate(JSON.parse(document.cookie)['clientId'], prevDivId, cCursor['caret'], 1);
        }
        
    //down
    } else if (event.key === 'ArrowDown') {
        const bottomDivElement = document.getElementById('text-presentation').lastElementChild;
        if (cCursor['line'] !== bottomDivElement.id) {
            const nextDivId = document.getElementById(cCursor['line']).nextSibling.id;
            notifyCursorUpdate(JSON.parse(document.cookie)['clientId'], nextDivId, cCursor['caret'], 1)
        }

    //alphanumeric & symbol (a-z, A-Z, 0-9)
    } else {
        if (event.key === 'Backspace') { 
            if (textarea.value.length >= 0 && cCursor['caret'] > 0) { 
                cCursor['caret'] -= 1; 
            }
        } else { 
            cCursor['caret'] += 1; 
        }
        notifyTextUpdate(textarea.value, editedLine, editedLine, curRoom.room.maxLine, cCursor['caret']);
    }
};


// Enter key handler
async function enterKeyHandler (text, cCursor, line, maxLine) {
    //bukan di akhir line
    if ((text.length - 1) !== cCursor['caret']) {
        notifyTextUpdate(text.substring(0, cCursor['caret']), line, line, maxLine, cCursor['caret']);
        text = text.substring(cCursor['caret'] + 1);
    //akhir line
    } else {
        text = "";
    }
    return text;
}


//create new line div
function createNewLine (lastLineId, curLineId, textValue) {
    if (lastLineId === undefined) {
        document.getElementById(curLineId).children[0].textContent = textValue;
    } else {
        const lastLineDiv = document.getElementById(lastLineId);
        const lineDiv = document.createElement('div');
        const linePre = document.createElement('pre');
        linePre.textContent = textValue;
        lineDiv.id = curLineId;
        lineDiv.classList.add('line');
        lineDiv.appendChild(linePre);
        lastLineDiv.parentNode.insertBefore(lineDiv, lastLineDiv.nextSibling); 
    }
}


//notify server over a changed text
function notifyTextUpdate (text, lastLine, curLine, maxLine, caret) {
    const child = document.getElementById(curLine);
    const payload = {
        'method' : 'updateText',
        'text' : text,
        'curLine' : curLine,
        'lastLine' : lastLine,
        'maxLine' : maxLine,
        'caret' : caret,
        'line_order' : Array.prototype.indexOf.call(parent.children, child)
    };
    ws.send(JSON.stringify(payload));
}


//notify server over a changed cursor position
function notifyCursorUpdate (cursorId, line, caret, status) {
    const payload = {
        'method' : 'updateCursor',
        'cursorId' : cursorId,
        'line' : line,
        'caret' : caret,
        'status' : status
    };
    ws.send(JSON.stringify(payload));
}