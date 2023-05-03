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
            lines : { '1' : { text : '' } }
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
        try {
            return await Redis.executeIsolated(async isolatedClient => {
                await isolatedClient.watch(roomId);
                updatedData = JSON.parse(await isolatedClient.get(roomId));
                
                let claims = this.checkClaims(msg.oldtexts, updatedData.lines);
                console.log('msg',msg);
                console.log('updatedData',updatedData);
                if (!claims) {
                    console.log('claims salah');
                    updatedData = this.mergeData(msg, updatedData);
                } else {
                    console.log('claims benar');
                    updatedData.maxLine = msg.maxLine;
                    //kalau line id blm ada di urutan kemunculan baris
                    if (updatedData.lines_order[msg.line_order] !== msg.curLine) {
                        updatedData.lines_order.splice(msg.line_order, 0, msg.curLine);
                    }
                    for (const [key, value] of Object.entries(msg.texts)) {
                        updatedData.lines[key] = {
                            text : value.toString()
                        };
                    }
                }
                return this.transactionToRedis(roomId, updatedData, isolatedClient);
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


    //TODO:baru bisa merge 1 line request
    //merge data if race condition requests happen
    mergeData = (msg, roomData) => {
        const oldtexts = msg.oldtexts;
        const newtexts = msg.texts;

        //1 line modif
        if (Object.keys(oldtexts).length == 1) {
            let idx = msg.caret, idx2 = null;
            let servertext = Object.values(roomData)[0].text;
            let servertextlength = servertext.length;

            if (msg.caret > servertextlength) { idx = servertextlength; }

            //letter increment
            if (Object.values(oldtexts)[0].length < Object.values(newtexts)[0].length) {
                roomData.lines[msg.line].text = servertext.substring(0, idx) + Object.values(newtexts)[0].substring(msg.caret - 1, msg.caret);
                idx2 = idx;
            //letter decrement
            } else {
                roomData.lines[msg.line].text = servertext.substring(0, idx);
                idx2 = idx + 1;
            }

            //buntut string
            if (idx2 < servertextlength) { roomData.lines[msg.line].text += servertext.substring(idx2); }

        //2 line modif
        } else {
            console.log('belum bisa merge 2 line');
            // for (const [index, [key, value]] of Object.entries(Object.entries(oldtexts))) {
                
            // }
        } 
        return roomData;
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