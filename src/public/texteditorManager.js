class TexteditorManager {
    constructor (clientWs, clientId, curRoom) {
        this.clientWs = clientWs;
        this.clientId = clientId;
        this.curRoom = {
            id : curRoom._id,
            room : curRoom
        }
        this.letterWidth = 0.0;
        this.parent = null;
        this.interval = null;
        this.initialize();
    }


    //get texteditor html
    initialize = () => {
        this.sendGetRequest('/texteditor', this.moveToTexteditor);
    }


    setCurRoom = (roomData) => {
        this.curRoom.room = roomData;
    }


    //AJAX : changing mainPage content into text editor
    moveToTexteditor = (data) => {
        document.getElementById('mainContainer').innerHTML = data;
        document.getElementById('roomCode').textContent = 'Room id : ' + this.curRoom.id;
        document.getElementById('clientCounter').textContent = 'clients connected : ' + Object.keys(this.curRoom.room.clients).length + '';
        this.parent = document.getElementById('text-presentation');
        this.setEventListener();
        this.loadAllContent();
    }


    setEventListener = () => {
        document.getElementById('text-presentation').addEventListener('click', this.getClickPosition);
        document.getElementById('textarea').addEventListener('input', this.receiveInputText);
        document.getElementById('textarea').addEventListener('keyup', this.receiveInputKey);
        window.addEventListener('resize', this.generateExistingCursors);
        this.parent.addEventListener('scroll', this.generateExistingCursors);
    }


    loadAllContent = () => {
        this.generateExistingTexts();
        this.generateExistingCursors();  
    }


    //generate existing texts
    generateExistingTexts = () => {
        let text = "";
        for (let [index, value] of this.curRoom.room.lines_order.entries()) {
            text = this.curRoom.room.lines[value].text;
            this.createNewLine(this.curRoom.room.lines_order[index-1], value, text);

            //textwidth 
            if (this.letterWidth === 0.0 && text.length > 0) { 
                this.countLetterWidth(document.getElementById(value).children[0]); 
            }
        }
    }


    //create new line div
    createNewLine = (lastLineId, curLineId, textValue) => {
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


    //letter width counter
    countLetterWidth = (textElement) => {
        const textBounding = textElement.getBoundingClientRect();
        this.letterWidth = (textBounding.right - textBounding.left) / textElement.textContent.length;
    }


    generateExistingCursors = () => {
        let cursor = null;
        //generate existing client cursors 
        for (const [key, value] of Object.entries(this.curRoom.room.clients)) {
            cursor = document.getElementById(key);
            if (cursor == null) {
                this.createNewCursor(key);
            }
            this.updateCursor(key);
        }  
    }


    //insert new client cursor
    createNewCursor = (cursorId) => {
        const client = this.curRoom.room.clients[cursorId];
        const cursorWrapper = document.createElement('div');
        cursorWrapper.id = cursorId;
        cursorWrapper.classList.add('none', 'cursor-wrapper', 'init');

        const cursor = document.createElement('div');
        cursor.classList.add('cursor');
        cursor.innerHTML = '&nbsp';
        cursor.style.borderLeftColor = client.cursor['color'];

        const span = document.createElement('span');
        span.textContent = client.name;
        span.style.backgroundColor = client.cursor['color'];
        span.classList.add('cursor-name');
        cursor.appendChild(span);

        cursorWrapper.appendChild(cursor);
        const textareaWrapper = document.getElementById('textarea-wrapper');
        textareaWrapper.parentNode.insertBefore(cursorWrapper, textareaWrapper);
    }


    cursorPageUpdate = (msg) => {
        this.curRoom.room.clients[msg.cursorId].cursor = msg.clientCursor;
        this.updateCursor(msg.cursorId);
        if (JSON.parse(document.cookie)['clientId'] === msg.cursorId) {
            this.updateTextareaCaret(document.getElementById(msg.clientCursor['line']).children[0].textContent, msg.clientCursor['caret']);
        }
    }


    //getting actual click position (line, caret, x coordinate) 
    getClickPosition = (event) => {
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
        this.notifyCursorUpdate(JSON.parse(document.cookie)['clientId'], line, caret, 1);
    }


    //update cursor's x and y
    updateCursor = (cursorId) => {
        if (this.curRoom.room.clients[cursorId].cursor['status'] === 1) {
            const cursorWrapper = document.getElementById(cursorId);
            const cursor = cursorWrapper.children[0];
            const wrapperBounding = document.getElementById('text-presentation-wrapper').getBoundingClientRect();
        
            const cursorPosition = this.curRoom.room.clients[cursorId].cursor;
            const elementBounding = document.getElementById(cursorPosition['line']).children[0].getBoundingClientRect();
            const parentBounding = this.parent.getBoundingClientRect();
            
            // count new cursor position
            let left = (elementBounding.left + (this.letterWidth * cursorPosition['caret']));
            let top = (elementBounding.y - wrapperBounding.y);
            let visible = true;

            // cek posisi mentok cursor & update cursor position
            if (left < parentBounding.right && left >= parentBounding.left) { cursor.style.left = left + "px"; } 
            else { visible = false; }
            if (top < this.parent.offsetHeight && top > this.parent.offsetTop) { cursor.style.top = top + "px"; } 
            else { visible = false; }

            if (cursorId == JSON.parse(document.cookie)['clientId']) {
                //kedap kedip cursor
                if (this.interval == null && visible) {
                    this.interval = setInterval(this.cursorInterval, 500);
                } else if (this.interval != null && !visible) {
                    clearInterval(this.interval);
                    this.interval = null;
                    cursorWrapper.classList.add('none');
                }
            } else {
                if (visible) { cursorWrapper.classList.remove('none'); } 
                else { cursorWrapper.classList.add('none'); }
            }
        }
    }


    //change cursor visibility every 1 seconds
    cursorInterval = () => {
        const cursorWrapper = document.getElementById(JSON.parse(document.cookie)['clientId']);
        if (cursorWrapper.classList.contains('none')) {
            cursorWrapper.classList.remove('none');
        } else {
            cursorWrapper.classList.add('none');
        }
    };


    //update textarea selection range (caret)
    updateTextareaCaret = (text, caret) => {
        //move focus to textarea 
        const textarea = document.getElementById('textarea');
        textarea.value = text;
        textarea.setSelectionRange(caret, caret);
        textarea.focus();
    }


    //remove disconnected client's cursor
    removeCursor = (cursorId) => {
        const cursor = document.getElementById(cursorId);
        cursor.remove();
    }


    textPageUpdate = (msg) => {
        let text = "";
        let lineDiv = null;
        const roomData = this.curRoom.room;
        roomData.maxLine = msg.maxLine;

        for (const [key, value] of Object.entries(msg.texts)) {
            lineDiv = document.getElementById(key);
            text = value;

            //new line
            if (lineDiv === null) {
                this.createNewLine(msg.lastLine, msg.curLine, text);
            //receive changes on existing line & make it visible
            } else {
                let textElement = lineDiv.children[0];
                textElement.textContent = text; 
                document.getElementById('textarea').value = text;

                //first character typed, measure letter width
                if ( this.letterWidth === 0.0 && textElement.textContent != '') { 
                    this.countLetterWidth(textElement); 
                }
            }
        }

        //move ONLY client-editor's cursor position
        if (msg.editorId === JSON.parse(document.cookie)['clientId']) {
            const cCursor = roomData.clients[msg.editorId].cursor;
            const oldCaret = cCursor['caret']; 
            cCursor['line'] = msg.curLine;
            cCursor['caret'] = msg.caret;
            this.notifyCursorUpdate(msg.editorId, cCursor['line'], cCursor['caret'], 1);
            this.moveAffectedCursors(roomData, msg, oldCaret, cCursor, lineDiv);
        }
    }


    //move affected cursors
    moveAffectedCursors = (roomData, msg, oldCaret, cCursor, lineDiv) => {
        //check & move affected cursors
        const container = document.getElementById('text-presentation');
        for (const [key, value] of Object.entries(roomData.clients)) {
            if (key != msg.editorId && value.cursor['status'] == 1) {
                //same line after 'enter' OR common same line 
                if (value.cursor['line'] == cCursor['line'] && 
                (value.cursor['caret'] >= oldCaret || value.cursor['caret'] >= cCursor['caret'])) {
                    //backspace
                    if (cCursor['caret'] < oldCaret) {
                        this.notifyCursorUpdate(key, value.cursor['line'], value.cursor['caret']-1, 1);
                    //letter increment
                    } else {
                        this.notifyCursorUpdate(key, value.cursor['line'], value.cursor['caret']+1, 1);
                    }

                //new line
                } else if (value.cursor['line'] == msg.lastLine && 
                msg.lastLine != msg.curLine && value.cursor['caret'] >= oldCaret) {
                    this.notifyCursorUpdate(key, msg.curLine, (value.cursor['caret'] - oldCaret), 1);

                //affected line below
                } else {
                    const clientElement = document.getElementById(value.cursor['line']);
                    const clientElementIdx = Array.prototype.indexOf.call(container.children, clientElement);
                    const editorElementIdx = Array.prototype.indexOf.call(container.children, lineDiv);
                    if (clientElementIdx > editorElementIdx) {
                        this.notifyCursorUpdate(key, value.cursor['line'], value.cursor['caret'], 1);
                    }
                }
            } 
        }
    }


    // Oninput : update textarea content 
    // note : kenapa gapake onkeyup? kalo keynya dipress dia garealtime jatohnya 
    receiveInputText = (event) => {
        let texts = {}, oldtexts = {};
        const textarea = event.target;
        //no line enter
        if (textarea.value.match(/\n/g) === null) {
            const cCursor = this.curRoom.room.clients[JSON.parse(document.cookie)['clientId']].cursor;
            const lineText = document.getElementById(cCursor['line']).children[0].textContent;
            let newCaret = cCursor['caret'];
            if (textarea.value.length > lineText.length) {
                newCaret += 1;
            } else {
                newCaret -= 1;
            }
            texts[cCursor['line']] = textarea.value;
            oldtexts[cCursor['line']] = lineText;
            this.notifyTextUpdate(oldtexts, texts, cCursor['line'], cCursor['line'], this.curRoom.room.maxLine, newCaret);
        }
    }


    //accept input from clients
    receiveInputKey = (event) => {
        const textarea = document.getElementById('textarea');
        const cCursor = this.curRoom.room.clients[JSON.parse(document.cookie)['clientId']].cursor;
        const editedLine = cCursor['line'];

        //adding new line div
        if (event.key === 'Enter') {
            let texts = {}, oldtexts = {};
            oldtexts[editedLine] = document.getElementById(cCursor['line']).children[0].textContent;

            //bukan di akhir line
            if ((textarea.value.length - 1) !== cCursor['caret']) {
                texts[editedLine] = textarea.value.substring(0, cCursor['caret']);
                textarea.value = textarea.value.substring(cCursor['caret'] + 1);
            //akhir line
            } else {
                texts[editedLine] = oldtexts[editedLine];
                textarea.value = "";
            }
            this.curRoom.room.maxLine += 1;
            this.createNewLine(editedLine, this.curRoom.room.maxLine, textarea.value);
            texts[this.curRoom.room.maxLine] = textarea.value;
            oldtexts[this.curRoom.room.maxLine] = null;
            this.notifyTextUpdate(oldtexts, texts, editedLine, this.curRoom.room.maxLine, this.curRoom.room.maxLine, 0);
            
        //uppercase /symbols
        } else if (event.key === 'CapsLock' || event.key === 'Shift'){
            event.preventDefault();

        //left
        } else if (event.key === 'ArrowLeft') {
            if (cCursor['caret'] > 0) {
                this.notifyCursorUpdate(JSON.parse(document.cookie)['clientId'], cCursor['line'], cCursor['caret']-1, 1);
            }
        
        //right
        } else if (event.key === 'ArrowRight') {
            const len = document.getElementById(cCursor['line']).children[0].textContent.length;
            if (cCursor['caret'] < len) {
                this.notifyCursorUpdate(JSON.parse(document.cookie)['clientId'], cCursor['line'], cCursor['caret']+1, 1);
            }

        //up
        } else if (event.key === 'ArrowUp') {
            const topDivId = document.getElementById('text-presentation').children[0].id;
            if (cCursor['line'] !== topDivId) {
                const prevDiv = document.getElementById(cCursor['line']).previousSibling;
                const prevLen = prevDiv.children[0].textContent.length;
                if (cCursor['caret'] > prevLen) { 
                    this.notifyCursorUpdate(JSON.parse(document.cookie)['clientId'], prevDiv.id, prevLen, 1);
                } else {
                    this.notifyCursorUpdate(JSON.parse(document.cookie)['clientId'], prevDiv.id, cCursor['caret'], 1);
                }
            }
            
        //down
        } else if (event.key === 'ArrowDown') {
            const bottomDivElement = document.getElementById('text-presentation').lastElementChild;
            if (cCursor['line'] !== bottomDivElement.id) {
                const nextDiv = document.getElementById(cCursor['line']).nextSibling;
                const nextLen = nextDiv.children[0].textContent.length;
                if (cCursor['caret'] > nextLen) { 
                    this.notifyCursorUpdate(JSON.parse(document.cookie)['clientId'], nextDiv.id, nextLen, 1);
                } else {
                    this.notifyCursorUpdate(JSON.parse(document.cookie)['clientId'], nextDiv.id, cCursor['caret'], 1);
                }
            }
        } 
    }


    //notify server over a changed text
    notifyTextUpdate = (oldtexts, texts, lastLine, curLine, maxLine, caret) => {
        const child = document.getElementById(curLine);
        const payload = {
            'method' : 'updateText',
            'oldtexts' : oldtexts,
            'texts' : texts,
            'curLine' : curLine,
            'lastLine' : lastLine,
            'maxLine' : maxLine,
            'caret' : caret,
            'line_order' : Array.prototype.indexOf.call(this.parent.children, child)
        };
        this.clientWs.sendPayload(payload);
    }


    //notify server over a changed cursor position
    notifyCursorUpdate = (cursorId, line, caret, status) => {
        const payload = {
            'method' : 'updateCursor',
            'cursorId' : cursorId,
            'line' : line,
            'caret' : caret,
            'status' : status
        };
        this.clientWs.sendPayload(payload);
    }


    disconnectPageUpdate = (msg) => {
        this.removeCursor(msg.clientId);
        document.getElementById('clientCounter').textContent = 'clients connected : ' + Object.keys(msg.room.clients).length + '';
        console.log('client id ' + JSON.parse(document.cookie)['clientId'] + ' has disconnected.');
    }


    //fetch API send request to routes, GET method
    sendGetRequest = async (url, nextMove) => {
        try {
            this.response = await fetch(url);
            this.response.text().then((data) => {
                nextMove(data);
            });
        } catch (e) {
            console.log('Fetch API error: ', e);
        }
    } 
}