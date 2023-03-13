import "../utils/db.js";

//import mongoose
import mongoose, { Schema } from "mongoose";

const clientSchema = new Schema({ 
    name : String
});
// const Client = mongoose.model('Client', clientSchema);

//TODO: subdocument (no SQL) vs populated document (mirip SQL strukturnya), alasan pilih populated document
const roomSchema = new Schema({
    clients: [clientSchema] 
});
const Room = mongoose.model('Room', roomSchema);


//ASINKRONUS
const room = new Room ({
    clients : [
        {name : 'nadiaaa'},
        {name : 'claa'}
    ]
});
room.save().then((test) => {
    console.log(test);
});

//SINKRONUS
// async function addRoom () {
//     await Room.create({
//         clients : [
//             { name : 'Nadia'},
//             { name : 'clarissa' }
//         ]
//     });
// }
// addRoom();