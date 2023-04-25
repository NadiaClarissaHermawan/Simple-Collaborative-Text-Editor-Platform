import mongoose from 'mongoose';
import Room from '../models/room.js';
import Redis from '../utils/db.js';

export default class RoomController {
    constructor () {}

    //create new room
    createRoom = async (roomId) => {
        const roomData = {
            _id : roomId,
            maxLine : 1,
            clients : {},
            lines : {}
        };
        try {
            await Room.create(roomData);
            return roomData;
        } catch (err) {
            console.log('Error', err);
        }
    }


    //join room  
    joinRoom = async (clientId, name, roomId) => {
        let roomData = await this.getRoomFromRedis(roomId);
        //blm ada di Redis --> ambil ke Mongo
        if (roomData === null) {
            roomData = await this.getRoomFromMongo(roomId);
            if (roomData === null) {
                return null;
            } else {
                return this.updateClientData(clientId, roomData, name);
            }
        //sdh ada di Redis
        } else {
            return this.updateClientData(clientId, JSON.parse(roomData), name);
        }
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


    //get existing room data from Redis
    getRoomFromRedis = (roomId) => {
        let roomData = Redis.get(roomId);
        return roomData;
    }


    //save data to redis by transaction
    transactionToRedis = (roomId, roomData) => {
        return Redis.multi()
            .set(roomId, JSON.stringify(roomData))
            .exec()
            .catch((err) => {
                console.log('err', err);
            })
            .then((reply) => {
                console.log('ERRRRRR', reply);
                if (reply == null) {
                    return null;
                } else {
                    return roomData;
                }
            })
    }


    //update client data
    updateClientData = async (clientId, roomData, name) => {
        roomData.clients[clientId] = {
            name : name,
            cursor : {
                line : 1,
                caret : 0,
                color : this.colorRandomizer(),
                status : 0
            }
        };
        //async
        this.updateMongo(roomData, 'clients');
        //sync
        await this.updateRedis(roomData);
        return roomData;
    }


    //color randomizer
    colorRandomizer = () => {
        return "#" + Math.floor(Math.random()*16777215).toString(16).padStart(6, '0').toUpperCase();
    }


    //remove client data
    removeClientData = async (clientId, roomId) => {
        const roomData = JSON.parse(await this.getRoomFromRedis(roomId));
        delete roomData.clients[clientId];
    
        //async
        this.updateMongo(roomData, 'clients');
        //sync
        await this.updateRedis(roomData);
        return roomData;
    }


    //updateCursor 
    updateCursorDataRedis = async (msg, roomId) => {
        let updatedData = null;
        const res = await Redis.watch(roomId).then((err) => {
            return this.getRoomFromRedis(roomId).then((roomData) => {
                updatedData = JSON.parse(roomData);
                let udClientCursor = updatedData.clients[msg.cursorId].cursor;
                udClientCursor['line'] = msg.line;
                udClientCursor['caret'] = msg.caret;
                udClientCursor['status'] = msg.status;
                return this.transactionToRedis(roomId, updatedData);
            });
        });
        return updatedData;
    }


    //updateText
    updateTextDataRedis = async (msg, roomId) => {
        let updatedData = null;
        const res = await Redis.watch(roomId).then((err) => {
            return this.getRoomFromRedis(roomId).then((roomData) => {
                updatedData = JSON.parse(roomData);
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
                
                return this.transactionToRedis(roomId, updatedData);
            });
        });
        return updatedData;
    }


    //update Room data at MongoDB
    updateMongo = (roomData, mark) => {
        roomData = Room.hydrate(roomData);
        roomData.markModified(mark);
        roomData.save();
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