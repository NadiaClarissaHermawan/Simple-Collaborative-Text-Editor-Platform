import mongoose from 'mongoose';
import Room from '../models/room.js';
import Redis from '../utils/db.js';
import { WatchError } from 'redis';

export default class RoomController {
    constructor () {}

    //create new room
    createRoom = async (roomId) => {
        const roomData = {
            _id : roomId,
            maxLine : 1,
            clients : {},
            lines : { '1' : { text : '' } },
            lines_order : [1]
        };
        try {
            await Room.create(roomData);
            return roomData;
        } catch (err) {
            console.log('RoomController create error', err);
        }
    }


    //join room  
    joinRoom = async (clientId, name, roomId) => {
        let roomData = await Redis.get(roomId);
        //blm ada di Redis --> ambil ke Mongo
        if (roomData === null) {
            roomData = await this.getRoomFromMongo(roomId);
            if (roomData === null) {
                return null;
            } else {
                this.updateRedis(roomData);
            }
        }
        
        let updatedData = null;
        while (updatedData == null) {
            updatedData = await this.updateClientData(clientId, roomId, name);
        }
        this.updateMongo(updatedData, 'clients');
        return updatedData;
    }

    
    //get existing room data from MongoDB
    getRoomFromMongo = (roomId) => {
        if (mongoose.Types.ObjectId.isValid(roomId)) {
            try {
                const roomObjId = mongoose.Types.ObjectId.createFromHexString(roomId);
                return Room.findById(roomObjId).lean();
            } catch (err) {
                console.log('Error', err);
            }
        } else {
            return null;
        }
    }


    //get existing room data from Redis TODO: lakukan get dari isolatedClient
    getRoomFromRedis = (roomId) => {
        let roomData = Redis.get(roomId);
        return roomData;
    }


    //update client data
    updateClientData = async (clientId, roomId, name) => {
        let updatedData = null;
        try {
            return await Redis.executeIsolated(async isolatedClient => {
                await isolatedClient.watch(roomId);

                updatedData = JSON.parse(await isolatedClient.get(roomId));
                updatedData.clients[clientId] = {
                    name : name,
                    cursor : {
                        line : 1,
                        caret : 0,
                        color : this.colorRandomizer(),
                        status : 0
                    }
                };
                return this.transactionToRedis(roomId, updatedData, isolatedClient);
            });
        } catch (err) {
            //transaction aborted
            if (err instanceof WatchError) {
                return null;
            }
        }
    }


    //color randomizer
    colorRandomizer = () => {
        return "#" + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0').toUpperCase();
    }


    //remove client data
    removeClientData = async (clientId, roomId) => {
        let updatedData = null;
        try {
            return await Redis.executeIsolated(async isolatedClient => {
                await isolatedClient.watch(roomId);

                updatedData = JSON.parse(await isolatedClient.get(roomId));
                delete updatedData.clients[clientId];

                return this.transactionToRedis(roomId, updatedData, isolatedClient);
            })
        } catch (err) {
            //transaction aborted
            if (err instanceof WatchError) {
                return null;
            }
        }
    }


    //updateCursor 
    updateCursorDataRedis = async (msg, roomId) => {
        let updatedData = null;
        try {
            return await Redis.executeIsolated(async isolatedClient => {
                await isolatedClient.watch(roomId);

                updatedData = JSON.parse(await isolatedClient.get(roomId));
                let udClientCursor = updatedData.clients[msg.cursorId].cursor;
                udClientCursor['line'] = msg.line;
                udClientCursor['caret'] = msg.caret;
                udClientCursor['status'] = msg.status;
                return this.transactionToRedis(roomId, updatedData, isolatedClient);
            });
        } catch (err) {
            //transaction aborted
            if (err instanceof WatchError) {
                return null;
            }
        }
    }


    //updateText
    updateTextDataRedis = async (msg, roomId) => {
        let updatedData = null;
        let updatedTexts = {};
        let curLine = parseInt(msg.curLine), lastLine = parseInt(msg.lastLine);
        try {
            return await Redis.executeIsolated(async isolatedClient => {
                await isolatedClient.watch(roomId);
                updatedData = JSON.parse(await isolatedClient.get(roomId));
                
                let claims = this.checkClaims(msg.oldtexts, updatedData.lines);
                console.log('msg',msg);
                console.log('baseData',updatedData);
                if (!claims) {
                    console.log('\nCLAIMS SALAH---------------------------');
                    let mergeResult = this.mergeData(msg, updatedData);
                    updatedData = mergeResult.roomData;
                    updatedTexts = mergeResult.updatedTexts;

                    if (Object.keys(msg.oldtexts).length > 1) {
                        if (msg.where == 1) {
                            curLine = parseInt(Object.keys(updatedTexts)[0]);
                            let indexOrder = updatedData.lines_order.indexOf(curLine) - 1;
                            lastLine = parseInt(updatedData.lines_order[indexOrder]);
                        } else {
                            lastLine = parseInt(Object.keys(updatedTexts)[0]);
                        }
                    }

                } else {
                    console.log('\nCLAIMS BENAR---------------------------');
                    updatedData.maxLine = msg.maxLine;
                    let newLine = msg.curLine;
                    if (msg.where == 0) {
                        newLine = msg.lastLine;
                    }
                    //kalau line id blm ada di urutan kemunculan baris
                    if (!updatedData.lines_order.includes(parseInt(newLine))) {
                        updatedData.lines_order.splice(msg.line_order, 0, parseInt(newLine));
                    }
                    for (const [key, value] of Object.entries(msg.texts)) {
                        if (value == null) {
                            delete updatedData.lines[key];
                            updatedData.lines_order.splice(msg.line_order + 1, 1);
                        } else {
                            updatedData.lines[key] = {
                                text : value.toString()
                            };
                        }
                    }
                    updatedData.clients[msg.editorId].cursor['caret'] = msg.caret;
                    updatedData.clients[msg.editorId].cursor['line'] = curLine;
                    updatedTexts = msg.texts;
                }
                return { 
                    roomData : await this.transactionToRedis(roomId, updatedData, isolatedClient),
                    updatedTexts : updatedTexts,
                    curLine : curLine,
                    lastLine : lastLine
                };
            });
        } catch (err) {
            //transaction aborted
            if (err instanceof WatchError) {
                return null;
            }
        }
    }


    //check data claims
    checkClaims = (oldtexts, servertexts) => {
        let res = true;
        for (const [index, [key, value]] of Object.entries(Object.entries(oldtexts))) {
            if ((value == null && servertexts[key] != undefined) || 
            (Object.keys(servertexts).length > 0 && servertexts[key] != undefined && value != servertexts[key].text)) {
                res = false;
            }
        }
        return res;
    }


    //merge data if race condition requests happen
    mergeData = (msg, roomData) => {
        const oldtexts = msg.oldtexts;
        const newtexts = msg.texts;
        let updatedTexts = {};

        //same line
        if (Object.keys(oldtexts).length == 1) {
            let idx = msg.caret - 1, idx2 = null;
            let servertext = roomData.lines[Object.keys(oldtexts)[0]].text;
            let servertextlength = servertext.length;

            if (msg.caret > servertextlength) { idx = servertextlength; }
            //letter increment
            if (Object.values(oldtexts)[0].length < Object.values(newtexts)[0].length) {
                roomData.lines[msg.curLine].text = servertext.substring(0, idx) + Object.values(newtexts)[0].substring(msg.caret - 1, msg.caret);
                idx2 = idx;
            //letter decrement
            } else {
                roomData.lines[msg.curLine].text = servertext.substring(0, idx);
                idx2 = idx + 1;
            }
            roomData.clients[msg.editorId].cursor['caret'] = roomData.lines[msg.curLine].text.length;
            //buntut string
            if (idx2 < servertextlength) { roomData.lines[msg.curLine].text += servertext.substring(idx2); }
            updatedTexts[msg.curLine] = roomData.lines[msg.curLine].text;

        //new line
        } else {
            let newlineid = parseInt(msg.curLine);
            let lineorder = roomData.lines_order.indexOf(parseInt(msg.lastLine));
            if (msg.where == 0) { 
                newlineid = parseInt(msg.lastLine);
                lineorder = roomData.lines_order.indexOf(parseInt(msg.curLine));
            }
            if (lineorder < 0) { lineorder = 0 }

            //line id already exist
            if (roomData.lines[newlineid] != undefined) { 
                roomData.maxLine += 1;
                newlineid = roomData.maxLine;
            } 
            roomData.lines[newlineid] = { text : '' }

            //front line-space
            if (msg.where == 0) {
                console.log('FRONT LINE-SPACE', lineorder, 'id:', newlineid);
                roomData.lines_order.splice(lineorder, 0, parseInt(newlineid));
            //end/mid line-space
            } else {
                console.log('END/MID LINE-SPACE', lineorder, 'id:', newlineid);
                roomData.lines_order.splice(lineorder + 1, 0, parseInt(newlineid)); 
            } 
            //TODO:buat kondisi untuk mid line-space yg motong text dari idx 0 - length dari newtext baris pertama dan baris berikutnya berisi   
            updatedTexts[newlineid] = roomData.lines[newlineid].text;
        } 
        return {
            roomData : roomData,
            updatedTexts : updatedTexts
        };
    }


    //update Room data at MongoDB
    updateMongo = (roomData, mark) => {
        roomData = Room.hydrate(roomData);
        roomData.markModified(mark);
        roomData.save();
    }


    //save data to redis by transaction
    transactionToRedis = (roomId, roomData, isolatedClient) => {
        return isolatedClient.multi()
            .set(roomId, JSON.stringify(roomData))
            .exec()
            .catch((err) => {
                console.log('transaction err', err);
            })
            .then((reply) => {
                if (reply == null) {
                    return null;
                } else {
                    return roomData;
                }
            });
    }


    //update Room data at Redis
    updateRedis = (roomData) => {
        Redis.set(roomData._id.toString(), JSON.stringify(roomData));
    }


    //remove Room data from Redis 
    removeRoomFromRedis = (roomId) => {
        Redis.del(roomId);
    }
}