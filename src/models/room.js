//import mongoose
import mongoose from "mongoose";
import Client from "./client.js";
import Line from "./line.js";

//schema model
const Room = mongoose.model('Room', {
    _id : mongoose.ObjectId,
    maxLine : Number,
    clients : {
        type: Map,
        of : Client
    },
    lines : {
        type: Map,
        of : Line
    },
    lines_order : []
});
export default Room;