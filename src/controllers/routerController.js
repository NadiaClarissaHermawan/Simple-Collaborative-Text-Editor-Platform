// import PageController from "./pageController.js";
// let pageController = null;
// if (pageController == null) {
//     pageController = new PageController();
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

//send button create request to client backend
// export const CreateBtn = (req, res) => {
//     pageController.reqCreateRoom(JSON.stringify(req.body));
//     res.json(clientEventController.tester());
// }