// import ClientWsController from "./clientWsController.js";
// let clientWsController = null;
// if (clientWsController == null) {
//     clientWsController = new ClientWsController();
// }

//controller untuk berganti laman
//Home Page
export const Home = (req, res) => {
    res.render('main', {
        title : 'main'
    });
}

//Text editor Page
export const TextEditor = (req, res) => {
    res.render('texteditor', {
        title : 'editor'  
    });
}

//send create button request to client backend
// export const CreateRoom = (req, res) => {
//     clientWsController.setCurRoomId(req.body['roomId']);
//     const payload = {
//         'method' : 'join',
//         'name' : req.body['name'],
//         'roomId' : req.body['roomId']
//     };
//     res.json(payload);
// }