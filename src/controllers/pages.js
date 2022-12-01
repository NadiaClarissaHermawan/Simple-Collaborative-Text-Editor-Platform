//controller untuk berganti laman

//Home Page
export const Home = (req, res) => {
    res.render('index', {
        title : 'main'
    });
}

//Text editor Page
export const TextEditor = (req, res) => {
    res.render('texteditor', {
        title : 'editor'  
    });
}