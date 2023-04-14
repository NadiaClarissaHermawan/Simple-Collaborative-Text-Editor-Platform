import mongoose from 'mongoose';
import Room from '../models/room.js';
import Redis from '../utils/db.js';

export default class RoomController {
    constructor () {}

    //create new room
    async createRoom (roomId) {
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
    async joinRoom (clientId, name, roomId) {
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
    getRoomFromMongo (roomId) {
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
    getRoomFromRedis (roomId) {
        let roomData = Redis.get(roomId);
        return roomData;
    }


    //update client data
    async updateClientData (clientId, roomData, name) {
        roomData.clients[clientId] = {
            name : name,
            cursor : {
                line : 1,
                caret : 0,
                color : "0",
                status : 0
            }
        };
        //async
        this.updateMongo(roomData);
        //sync
        await this.updateRedis(roomData);
        return roomData;
    }


    //remove client data
    async removeClientData (clientId, roomId) {
        const roomData = JSON.parse(await this.getRoomFromRedis(roomId));
        delete roomData.clients[clientId];
    
        //async
        this.updateMongo(roomData);
        //sync
        await this.updateRedis(roomData);
        return roomData;
    }


    //updateCursor 
    async updateCursorData (msg, roomId) {
        const roomData = JSON.parse(await this.getRoomFromRedis(roomId)); 
        roomData.clients[msg.cursorId].cursor = {
            line : msg.line,
            caret : msg.caret,
            color : 'color',
            status : msg.status
        };
        //async 
        this.updateMongo(roomData);
        //sync
        await this.updateRedis(roomData);
        return roomData;
    }


    //updateText
    async updateTextData (msg, roomId) {
        const roomData = JSON.parse(await this.getRoomFromRedis(roomId));
        roomData.maxLine = msg.maxLine;
    
        //kalau line id blm ada di urutan kemunculan baris
        if (roomData.lines_order[msg.line_order] !== msg.curLine) {
            roomData.lines_order.splice(msg.line_order, 0, msg.curLine);
        }
    
        roomData.lines[msg.curLine.toString()] = {
            text : msg.text
        };
    
        //async
        this.updateMongo(roomData);
        //sync
        await this.updateRedis(roomData);
        return roomData;
    }


    //update Room data at MongoDB
    updateMongo (roomData) {
        roomData = Room.hydrate(roomData);
        roomData.markModified('clients');
        roomData.save();
    }


    //update Room data at Redis
    updateRedis (roomData) {
        Redis.set(roomData._id.toString(), JSON.stringify(roomData));
    }


    //remove Room data from Redis 
    removeRoomFromRedis (roomId) {
        Redis.del(roomId);
    }
}