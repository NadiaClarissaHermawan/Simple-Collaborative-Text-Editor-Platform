// Contoh class pada Javascript
class Room {
    constructor (name, year) {
        this.name = name;
        this.year = year;
    }

    printData () {
        console.log('room name :', this.name);
    }
}

// Contoh cara buat objeknya
const room1 = new Room('room 01', 2020);

// Contoh panggil method dalam class
room1.printData();