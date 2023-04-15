// const METHOD_POST = 'POST';
// const METHOD_GET = 'GET';

// class PageListener {
//     constructor () {
//         this.response = null;
//         this.setEventListener();
//     }


//     setEventListener = () => {
//         document.getElementById('btnCreate').addEventListener('click', this.btnCreateListener);
//         document.getElementById('btnJoin').addEventListener('click', this.btnJoinListener);
//     }


//     btnCreateListener = () => {
//         const name = document.getElementById('name').value;
//         if (this.nameCheck(name)) {
//             const payload = {
//                 'method' : 'create'
//             };
//             this.sendRequest('/createroom', METHOD_POST, payload);
//         }
//     }


//     btnJoinListener = () => {
        
//     }


//     //name checker
//     nameCheck = (name) => {
//         if (name !== '' && name.length >= 4) {
//             return true;
//         } else {
//             if (name.length < 4) {
//                 alert('Please use 4 character or more!');
//             } else {
//                 alert('Username is missing!');
//             }
//             return false;
//         }
//     };


//     //fetch API send request to routes
//     sendRequest = async (url, mtd, bdy) => {
//         try {
//             this.response = await fetch(url, {
//                 method : mtd,
//                 headers : {
//                     'Accept': 'application/json',
//                     'Content-Type': 'application/json'
//                 },
//                 body : JSON.stringify(bdy)
//             });

//             this.response.json().then((data) => {
//                 console.log('tester', JSON.stringify(data));
//             });
//         } catch (e) {
//             console.log('Fetch API error: ', e);
//         }
//     } 
// }

// const pageListener = new PageListener(); 