//connect to server
//TODO:kalo pas hosting, localhost ganti jadi ip address dari si hostnya (tp ws:// hrs ttep ada)
let ws = new WebSocket('ws://localhost:81');

//global attributes
let curRoom = {
    'id' : null,
    'creator' : -1, //-1 blm join & bukan creator, 0 join tp bukan creator, 1 creator room
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
            'creator' : 1,
            'room': null
        };
        console.log('room successfully created with id ' + resp.roomId);
        btnJoin.click();

    //join
    } else if (resp.method === 'join') {
        if (resp.status === -1) {
            alert('Wrong room code!');
        } else {
            curRoom.room = resp.room;
            //new client joins room
            if (resp.status === 0) {
                moveToTextEditor();
            //existing client inside the room gets informational update
            } else {
                createNewCursor(resp.newClient_Id);
                document.getElementById('clientCounter').textContent = 'clients connected : ' + Object.keys(resp.room.clients).length + '';
            }
        } 
    
    // receive text update 
    } else if (resp.method === 'updateText') {
        console.log('receive update text',resp.text);
        const lineDiv = document.getElementById(resp.curLine);
        curRoom.room.maxLine = resp.maxLine;

        //new line
        if (lineDiv === null) {
            createNewLine(resp.lastLine, resp.curLine, resp.text);
        //receive changes on existing line & make it visible
        } else {
            const textElement = lineDiv.children[0];
            textElement.textContent = resp.text;
            document.getElementById('textarea').value = resp.text;

            //first character typed, measure letter width
            if (letterWidth === 0.0) {
                const textBounding = textElement.getBoundingClientRect();
                letterWidth = (textBounding.right - textBounding.left) / textElement.textContent.length;
            }
            //move ONLY client-editor's cursor position
            if (resp.editorId === JSON.parse(document.cookie)['clientId']) {
                const cCursor = curRoom.room.clients[resp.editorId].cursor;
                cCursor['caret'] += 1;
                cCursor['line'] = resp.curLine;
                notifyCursorUpdate(resp.editorId, cCursor['line'], cCursor['caret'], 1, 1);
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
    if (curRoom.creator !== -1) {
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
        if (inputRoomId.value !== '' && curRoom.creator !== 1) {
            if (curRoom.creator !== -1) {
                const payLoad = {
                    'method' : 'move'
                };
                ws.send(JSON.stringify(payLoad));
            }
            curRoom = {
                'id' : inputRoomId.value.trim(),
                'creator' : 0,
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
        loadAllText();
        
        // create new cursor for this new client
        createNewCursor(JSON.parse(document.cookie)['clientId']);

        //generate existing client's cursor 
        for (const [key, value] of Object.entries(curRoom.room.clients)) {
            if (key !== JSON.parse(document.cookie)['clientId']) {
                createNewCursor(key);
                updateCursor(key);
                const text = document.getElementById(value.cursor['line']).children[0].textContent;
                updateTextareaCaret(text, value.cursor['caret']);
            }
        }    

        parent = document.getElementById('text-presentation');
    };
    xhttp.send();
}


//load existing text
function loadAllText () {
    for (let [index, value] of curRoom.room.lines_order.entries()) {
        const text = curRoom.room.lines[value].text;
        createNewLine(curRoom.room.lines_order[index-1], value, text);
    }
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
    notifyCursorUpdate(JSON.parse(document.cookie)['clientId'], line, caret, 1, 0);
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
        console.log('tester cursor', cursorPosition);
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
        //bukan di akhir line
        if ((textarea.value.length - 1) !== cCursor['caret']) {
            notifyTextUpdate(textarea.value.substring(0, cCursor['caret']), editedLine, editedLine, curRoom.room.maxLine, cCursor['caret']);
            textarea.value = textarea.value.substring(cCursor['caret'] + 1);
            cCursor['caret'] = -2;
        //akhir line
        } else {
            textarea.value = "";
            cCursor['caret'] = -1;
        }
        cCursor['line'] = curRoom.room.maxLine + 1;
        createNewLine(editedLine, cCursor['line'], textarea.value);
        notifyTextUpdate(textarea.value, editedLine, cCursor['line'], curRoom.room.maxLine + 1, cCursor['caret']);
    
    //delete character
    //TODO:IMPLEMENT
    } else if (event.key === 'Backspace') {
        console.log('back');
    
    //uppercase 
    } else if (event.key === 'CapsLock' || event.key === 'Shift'){
        event.preventDefault();

    //left
    } else if (event.key === 'ArrowLeft') {

    //right
    } else if (event.key === 'ArrowRight') {

    //up
    } else if (event.key === 'ArrowUp') {

    //down
    } else if (event.key === 'ArrowDown') {
    
    //alphanumeric & symbol (a-z, A-Z, 0-9)
    } else {
        notifyTextUpdate(textarea.value, editedLine, editedLine, curRoom.room.maxLine, cCursor['caret']);
    }
};


//create new line div
function createNewLine (lastLineId, curLineId, textValue) {
    if (lastLineId === undefined) {
        document.getElementById(curLineId).textContent = textValue;
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
    console.log('edited Line:', curLine, text);
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
function notifyCursorUpdate (cursorId, line, caret, status, code) {
    const payload = {
        'method' : 'updateCursor',
        'cursorId' : cursorId,
        'line' : line,
        'caret' : caret,
        'status' : status,
        'code' : code //nunjukin cursor diupdate karena apa, 0 = klik event, 1 = pergeseran krn ada yg ngetik
    };
    ws.send(JSON.stringify(payload));
}