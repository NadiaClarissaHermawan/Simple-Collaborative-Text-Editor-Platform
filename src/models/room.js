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

//callback HELL
//tester save data 
// room.save().then(() => {
    //Tester cari data by Id
    // const curRoom = Room.findById(10).exec().then(async(cr) => {
    //     // console.log(cr);

    //     //TESTER update single string value
    //     const res = await Room.updateOne({ _id : 10 }, { maxLine : 3});
    //     //tester update map value
    //     const res2 = await Room.updateOne({ _id : 10 }, { 
    //         clients : {
    //             'sadasd-23342a-asasd-xxxxxxxxxxxx' : {
    //                 name : 'NadiaHH',
    //                 cursor : {
    //                     line : 2,
    //                     caret : 0,
    //                     color : 'aaab',
    //                     status : 1
    //                 },
    //             },
    //             'sadasd-23342a-asasd-xsdas' : {
    //                 name : 'Clarissahhhh',
    //                 cursor : {
    //                     line : 2,
    //                     caret : 3,
    //                     color : 'bbb',
    //                     status : 1
    //                 }
    //             }
    //         }
    //     });
    // })
// });