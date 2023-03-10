const admin = require('firebase-admin');
const serviceAccount = require('../../ServiceAccountKey.json');

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();


// getQuote().then(result => {
//     console.log(result.body);
//     const obj = JSON.parse(result.body);
//     const quoteData = {
//         quote: obj.quote,
//         author: obj.author
//     }
//     // will create the doc if not exists
//     // replaces all data in the document with this new data
//     // To replace, update instead of set
//     return db.collection('sampleData').doc('inspiration')
//     .set(quoteData).then(() =>{
//         console.log('new quote written to databsae');
//     })
// })

// getQuote();


// ************* Write **************************
function getQuote() {
    const quoteData = {
    quote: "random",
    author: "String"
    };
    return db.collection("sampleData").doc("inspiration").set(quoteData).then(() => {
    console.log("new quote was written to the database");})
}
    
    // getQuote();

function saveRecord(data) {
    return db.collection(data.tableName).add(data.data).then(() => {
    console.log("new quote was written to the database");})
}

function testSaveRecord(){
    leadData={
        firstName: "Lebrun",
        lastName: "james"
    }
    data={
        tableName: "Leads",
        data: leadData
    }

    saveRecord(data);
}
    
testSaveRecord();


// ************** Read **************************

async function getMarker() {
    const citiesRef = db.collection('Leads');
    const snapshot = await citiesRef.get();
    snapshot.forEach(doc => {
      console.log(doc.id, '=>', doc.data());
    });
}

// getMarker();