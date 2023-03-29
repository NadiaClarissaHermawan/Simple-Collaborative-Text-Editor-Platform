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

//TESTER MASUKIN DATA
// const room = new Room ({
//     _id : 1,
//     maxLine : 1,
//     clients : {
//         'sadasd-23342a-asasd-fasd' : {
//             name : 'Nadia',
//             cursor : {
//                 line : 1,
//                 caret : 0,
//                 color : 'aaa',
//                 status : 1
//             },
//         },
//         'sadasd-23342a-asasd-fasd222' : {
//             name : 'Clarissa',
//             cursor : {
//                 line : 1,
//                 caret : 2,
//                 color : 'bbb',
//                 status : 1
//             }
//         }
//     },
//     lines : {
//         '1' : {
//             text : 'hahaha'
//         }
//     }
// });