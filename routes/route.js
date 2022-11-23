const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    //tanpa ejs
    // res.sendFile('./index.html', { root: __dirname });
    
    //pemanggilan view bernama index pada folder views dengan ejs
    res.render('index', {
        layout : 'layouts/main',
        title : 'main page'
    });
});

router.get('/texteditor', (req, res) => {
    res.render('texteditor', {
       layout : 'layouts/main',
       title : 'text editor'  
    });
});

router.get('/contact/:id', (req, res) => {
    // res.send('Íni adalah halaman contact dari id ' + req.params.id 
    // + '<br> id category : ' + req.params.idCat
    // + '<br>' + req.query.hobby);

    //pemanggilan view pada folder views dengan ejs
    res.render('contacts', {
        layout: 'layouts/main',
        id: req.params.id
    });
});

// handler x url
router.use('/', (req, res) => {
    res.status(404).send('<h1>Salah URL, cek lagi coba.</h1>');
});

//export agar bisa digunakan di tempat lain
module.exports = router;