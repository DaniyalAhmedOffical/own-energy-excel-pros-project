require('dotenv').config()
const mysql = require('mysql');
const axios = require('axios');
var formidable = require('formidable');


const algoliasearch = require('algoliasearch')
const express = require('express');
const multer = require('multer');
const upload = multer();
const stream = require('stream');

const lodash = require('lodash');
const uuid = require('uuid').v4;
const bcrypt = require('bcrypt');
const { JsonWebTokenError } = require('jsonwebtoken');
const admin = require('firebase-admin');
const serviceAccount = require('./ServiceAccountKey.json');
const jwt = require("jsonwebtoken")
const cookieParser = require("cookie-parser");
const fs = require('fs');
const readline = require('readline');
const { google } = require('googleapis');
const { OAuth2 } = google.auth
const crypto = require('crypto')
const ejs = require("ejs");
const jwt_decode = require('jwt-decode');

const emailconfig = require('./emailConfig.js');
const Email = require('email-templates');

let nodemailer = require("nodemailer");

let transporter = nodemailer.createTransport({
    service: 'gmail',
    host: emailconfig.host,
    port: emailconfig.port,
    iSsecure: emailconfig.iSsecure,

    auth: {
        user: emailconfig.username,
        pass: emailconfig.password,
    }
});

const emailObj = new Email({
    views: { root: './templates', options: { extension: 'ejs' } },
    message: {
        from: emailconfig.from,
        subject: ""
    },
    preview: false,
    send: true,
    transport: transporter
});

const SCOPES = ['https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/gmail.send'
];

const TOKEN_PATH = 'token.json';
const TOKEN_ID = 'oNwAeAYYa7LXoL0KX6cl';

let oAuth2Client;

// gets new access token
// initializes oAuth2Client
// updates firestore
async function setupNewAccessToken() {
    oAuth2Client = new OAuth2('1079660110912-g6rsamm419cfgkhk5jmjr8oihalnb0v3.apps.googleusercontent.com', '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');
    let access_token;
    //console.log('Requesting New Access Token....', access_token)
    access_token = await getAccessToken((token) => {
        //console.log('New Access Token Granted', token)
        newToken = {
            access_token: token.access_token,
            refresh_token: '1//04mgutpOymGEACgYIARAAGAQSNwF-L9Irw3M6ZDnRDieM5JHpwqvlf9gQG9rrRjMgvpmMl6OmKDdUCVfU84EXYXH32kCIC2PJ4Vk',
            expires_at: new Date(Date.now() + (token.expires_in * 1000)), // token.data.expires_in is in seconds and we want milliseconds
        }
        oAuth2Client.setCredentials(newToken);
        console.log('New Access Token Deployed', token)
        // add to firestore
        db.collection("Tokens").doc(TOKEN_ID).update(newToken);
    });

}


async function Authorize() {
    const snapshot = await db.collection('Tokens').doc(TOKEN_ID).get();
    const tokenData = snapshot.data();

    var isExpired = isTokenExpired(new Date(), tokenData.expires_at.toDate());
    console.log("Is Token Expired: " + isExpired)

    if (isExpired) {
        setupNewAccessToken();
    } else {
        oAuth2Client = new OAuth2('1079660110912-g6rsamm419cfgkhk5jmjr8oihalnb0v3.apps.googleusercontent.com', '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');
        oAuth2Client.setCredentials(tokenData);
    }

}

async function getOAuth2Client() {
    const snapshot = await db.collection('Tokens').doc(TOKEN_ID).get();
    const tokenData = snapshot.data();

    // if discrepancy between local and firestore, use firestore
    if (!lodash.isEqual(oAuth2Client.credentials, tokenData)) {
        oAuth2Client.setCredentials(tokenData);
    }

    var isExpired = isTokenExpired(new Date(), tokenData.expires_at.toDate());
    if (isExpired) {
        setupNewAccessToken();
    }

    return oAuth2Client;
}


// returns true if token is expired
function isTokenExpired(curr_date, expires_at) {
    console.log("Minutes Till Expiry = " + (expires_at - curr_date) / 1000 / 60)
    const isExpired = ((expires_at - curr_date) / 1000 / 60) < 2;
    return isExpired;
}


async function getAccessToken(next) {
    await axios.post('https://oauth2.googleapis.com/token ', {
        client_id: "1079660110912-g6rsamm419cfgkhk5jmjr8oihalnb0v3.apps.googleusercontent.com",
        client_secret: "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",
        refresh_token: "1//04mgutpOymGEACgYIARAAGAQSNwF-L9Irw3M6ZDnRDieM5JHpwqvlf9gQG9rrRjMgvpmMl6OmKDdUCVfU84EXYXH32kCIC2PJ4Vk",
        grant_type: "refresh_token"
    })
        .then(function (response) {
            console.log(response)
            console.log(response.data.access_token);
            next(response.data);
        })
        .catch(function (error) {
            console.log(error);
        });
}

const path = require('path');
const MailComposer = require('nodemailer/lib/mail-composer');

const encodeMessage = (message) => {
    return Buffer.from(message).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const createMail = async (options) => {
    const mailComposer = new MailComposer(options);
    const message = await mailComposer.compile().build();
    return encodeMessage(message);
};
const sendMail = async (options) => {
    const gmail = google.gmail({ version: 'v1', auth: await getOAuth2Client() });
    const rawMessage = await createMail(options);
    const { data: { id } = {} } = await gmail.users.messages.send({
        userId: 'me',
        resource: {
            raw: rawMessage,
        },
    });
    return id;
};



const client = algoliasearch(process.env.ALGO_APP_ID, process.env.ALGO_API_KEY);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const auth = require('./routes/authentication');
const projectRoutes = require('./routes/projects.js');
const { json } = require('express');
const { Console } = require('console');
const { promisify } = require('util');
const { start } = require('repl');
const { get } = require('http');
const { gmail } = require('googleapis/build/src/apis/gmail');
const { oauth2 } = require('googleapis/build/src/apis/oauth2');
const MailMessage = require('nodemailer/lib/mailer/mail-message');
const { drive } = require('googleapis/build/src/apis/drive');

const db = admin.firestore();
const app = express()
const port = process.env.port || 8080;

app.set('view engine', 'ejs')
app.use(express.static(__dirname + '/views/pages'));
app.use(express.static(__dirname + '/views/assets'));
app.use(express.json());
app.use(express.urlencoded()); // to support URL-encoded bodies
app.use(cookieParser());

app.use(auth);
app.use(projectRoutes);
// app.use(upload());



//Non Authenticated
app.get('/login', async (req, res) => {
    res.render('pages/login');
});

app.post('/login', async (req, res) => {

    const Users = db.collection('Users');
    const allUsers = await Users.where('email', '==', req.body.email).get();
    if (allUsers.empty) {
        res.status(400).send('Login Failed');
        console.log('No matching documents.');
        return;
    }

    allUsers.forEach(async doc => {
        try {
            data = doc.data();
            if (await bcrypt.compare(req.body.password, data.password) && data.active) {

                const user = {
                    id: doc.id,
                    name: data.name,
                    email: data.email,
                    locationId: data.locationId,
                    accessLevelId: data.accessLevel,
                    calId: data.calId
                }
                const acccessToken = jwt.sign(user,
                    process.env.ACCESS_TOKEN_SECRET
                );
                if (!req.body.app) {
                    res.cookie("access_token", acccessToken, {
                        maxAge: 30 * 60 * 1000,
                        httpOnly: true,
                        secure: process.env.NODE_ENV === "production"
                    });
                }
                else{
                    res.cookie("access_token", acccessToken, {
                        httpOnly: true,
                        secure: process.env.NODE_ENV === "production"
                    });
                }

                res.redirect('/home');

            }
            else {
                res.send('Login Failed');
            }
        }
        catch {
            res.status(500).send();
        }
    });
});

app.post('/loginAsUser', async (req, res) => {

    const Users = db.collection('Users');
    const allUsers = await Users.where('email', '==', req.body.email).get();
    if (allUsers.size != 1) {
        res.status(400).send('Login Failed');
        console.log('No matching documents.');
        return;
    } else {
        allUsers.forEach(async doc => {
            try {
                data = doc.data();
                const user = {
                    id: doc.id,
                    name: data.name,
                    email: data.email,
                    locationId: data.locationId,
                    accessLevelId: data.accessLevel,
                    calId: data.calId
                }

                const acccessToken = jwt.sign(user,
                    process.env.ACCESS_TOKEN_SECRET
                );
                res.cookie("access_token", acccessToken, {
                    maxAge: 30 * 60 * 1000,
                    httpOnly: true,
                    secure: process.env.NODE_ENV === "production",
                });

                res.redirect('/');
            }
            catch {
                console.log('error')
                res.status(500).send();
            }
        })

    }


});



//Authenticated

app.get('/apiExpenses', async (req, res) => {
    try {

        const index = client.initIndex('Projects');

        // only query string
        index.search(req.query.userInput).then(({ hits }) => {
            return res.json(hits);
        });

        // return res.json(projects).status(200).send();
    }
    catch {
        res.status(500).send();
    }

});

app.get('/cast', async (req, res) => {
    try {

        const query = "SELECT * FROM breeds WHERE name = ?";
        pool.query(query, [req.params.breed], (error, results) => {

            console.log(req.params.breed)

            if (!results[0]) {
                res.json({ status: "Not Found!" })
            } else {
                res.json(results[0]);

            }

        })

        return res.json(data).status(200).send();
    }
    catch {
        res.status(500).send();
    }
});

app.get('/test', async (req, res) => {
    const index = client.initIndex('Leads');

    // only query string
    index.search('').then(({ hits }) => {
        res.json(hits);
    });
});

app.get('/payment', async (req, res) => {
    try {
        const snapshot = await db.collection('Payments').doc(req.query.paymentId).get();

        const data = snapshot.data();
        return res.json(data).status(200).send();
    }
    catch {
        res.status(500).send();
    }
});

app.post('/payment', async (req, res) => {
    if (req.body.method == 'delete') {
        db.collection("Payments").doc(req.body.paymentId).delete().then(async () => {
            req.body = req.body
            res.redirect('/payments');
            console.log("Payment Deleted!");
            return;
        });
    }
    else {
        const payment = {
            datePaid: req.body.datePaid,
            installCommission: req.body.installCommission,
            CAPPayment: req.body.CAPPayment,
            clawbackBONUS: req.body.clawbackBONUS,
            totalinPeriod: req.body.totalinPeriod,
            prevPaid: req.body.prevPaid,
            totalProjectCommission: req.body.totalProjectCommission,
            projectId: req.body.projectId
        }
        try {
            if (req.body.method == 'put') {
                db.collection("Payments").doc(req.body.paymentId).update(payment).then(async () => {
                    req.body = req.body
                    res.redirect('/payments');
                    console.log("Payment Updated!");
                    return;
                    //return res.status(202).send();
                });
            }
            else {
                db.collection("Payments").add(payment).then(async () => {
                    req.body = req.body
                    res.redirect('/payments')
                    console.log("New Payment Added!");
                    return;
                })
            }
        }
        catch {
            res.status(500).send();
        }
    }
});

app.get('/expense', async (req, res) => {
    try {
        let snapshot = await db.collection('Expenses').doc(req.query.expenseId).get();
        let data = snapshot.data();

        if (data.projectId) {
            snapshot = await db.collection('Projects').doc(data.projectId).get();
            data.project = await snapshot.data();
        }


        return res.json(data).status(200).send();
    }
    catch {
        res.status(500).send();
    }
});


app.post('/expense', async (req, res) => {

    if (req.body.method == 'delete') {

        db.collection("Expenses").doc(req.body.expenseId).delete().then(async () => {
            req.body = req.body
            res.redirect('/expenses');
            console.log("Expense Deleted!");
            return;
        });
    }
    else {
        const expense = {
            payDate: req.body.payDate,
            type: req.body.type,
            user: req.body.user,
            description: req.body.description,
            amount: req.body.amount,
            paidOut: req.body.paidOut,
            projectId: req.body.projectId
        }

        try {
            if (req.body.method == 'put') {
                console.log(req.body)

                db.collection("Expenses").doc(req.body.expenseId).update(expense).then(async () => {
                    req.body = req.body
                    res.redirect('/expenses');
                    console.log("Expense Updated!");
                    console.log(req.body.projectId);
                    return;
                    //return res.status(202).send();
                });

            }
            else {
                db.collection("Expenses").add(expense).then(async () => {
                    req.body = req.body
                    res.redirect('/expenses')
                    console.log("New Expense Added!");
                    return;
                })
            }
        }
        catch {
            res.status(500).send();
        }
    }
});

app.get('/project', async (req, res) => {
    try {
        const snapshot = await db.collection('Projects').doc(req.query.projectId).get();
        const data = snapshot.data();
        return res.json(data).status(200).send();
    }
    catch {
        res.status(500).send();
    }
});

app.post('/project', async (req, res) => {
    if (req.body.method == 'delete') {
        db.collection("Projects").doc(req.body.projectId).delete().then(async () => {
            req.body = req.body
            res.redirect('/projects');
            console.log("Project Deleted!");
            return;
        });
    }
    else {
        const project = {
            customerName: req.body.customerName,
            systemSize: req.body.systemSize,
            grossPPW: req.body.grossPPW,
            redline: req.body.redline,
            sOW: req.body.sOW,
            rep: req.body.rep,
            setter: req.body.setter,
            secondaryRep: req.body.secondaryRep,
            secondaryRepSplit: req.body.secondaryRepSplit,
            product: req.body.product,
            installPartner: req.body.installPartner,
            stateUtility: req.body.stateUtility,
            cancelDate: req.body.cancelDate,
            approvedDate: req.body.approvedDate,
            cAPDate: req.body.cAPDate,
            installDate: req.body.installDate,
            paidUpfrontDate: req.body.paidUpfrontDate,
            paidInstallDate: req.body.paidInstallDate,
            dealerFeePercent: req.body.dealerFeePercent,
            dealerFeeDollars: req.body.dealerFeeDollars,
            tsp: req.body.tsp
        }
        try {
            if (req.body.method == 'put') {
                db.collection("Projects").doc(req.body.projectId).update(project).then(async () => {
                    req.body = req.body
                    res.redirect('/projects');
                    console.log("Project Updated!");
                    return;
                    //return res.status(202).send();
                });
            }
            else {
                db.collection("Projects").add(project).then(async () => {
                    req.body = req.body
                    res.redirect('/projects')
                    console.log("New Project Added!");
                    return;
                })
            }
        }
        catch {
            res.status(500).send();
        }
    }
});


app.get('/payments', authenticateToken, async (req, res) => {
    const allPayments = await db.collection('Payments').get();
    let payments = [];
    allPayments.forEach(async doc => {
        data = doc.data();
        data.paymentId = doc.id;
        payments.push(data);
    })
    res.render('pages/payments', {
        payments
    })
})


app.post('/api/createAccessLevel', async (req, res) => {
    try {

        await db.collection("AccessLevels").add({
            Level: req.body.levelName,
        }).then((data) => {
            newAccessLevelId = data.id;
        });

        const subAccesses = await db.collection('SubAccess').get()
        subAccesses.forEach(async datum => {
            sId = datum.id
            AccessLevelAccess = {
                subAccessId: sId,
                accessLevelId: newAccessLevelId,
                accessVal: req.body.accessLevel
            }
            console.log(AccessLevelAccess)
            await db.collection('AccessLevelAccess').add(AccessLevelAccess)
        })

        res.redirect('/views/manageRoles');
    }
    catch {
        res.status(500).send();
    }

})

app.post('/api/appointmentOutcome', async (req, res) => {
    if (req.body.method == 'delete') {
        db.collection("AppointmentOutcomes").doc(req.body.apptOutcome).delete().then(async () => {
            req.body = req.body
            res.redirect('/api/appointmentOutcome');
            console.log("Status Deleted!");
            return;
        })
    }
    else{
        const Status = {
            name: req.body.statusName,
            isSit: !req.body.isSit ? false : true,
            reschedule: !req.body.reschedule ? false : true,
            notesRequired: !req.body.notesRequired ? false : true
        }
        try {
            if (req.body.method == 'put') {
                db.collection("AppointmentOutcomes").doc(req.body.apptOutcome).update(Status).then(async () => {
                    req.body = req.body
                    res.redirect('/api/appointmentOutcome');
                    console.log("Status Updated!");
                    return;
                    //return res.status(202).send();
                });
            }
            else {
                db.collection("AppointmentOutcomes").add(Status).then(async () => {
                    req.body = req.body
                    res.redirect('/api/appointmentOutcome')
                    console.log("New Status Added!");
                    return;
                })
            }
        }
        catch {
            res.status(500).send();
        }
    }
    


})

    // try {
    //     await db.collection("AppointmentOutcomes").add({
    //         name: req.body.statusName,
    //         isSit: !req.body.isSit ? false : true,
    //         reschedule: !req.body.reschedule ? false : true,
    //         notesRequired: !req.body.notesRequired ? false : true
    //     })

    //     res.redirect('/views/manageOutcomes');
    // }
    // catch {
    //     res.status(500).send();
    // }

// app.post('/project', async (req, res) => {
    // if (req.body.method == 'delete') {
    //     db.collection("Projects").doc(req.body.projectId).delete().then(async () => {
    //         req.body = req.body
    //         res.redirect('/projects');
    //         console.log("Project Deleted!");
    //         return;
    //     });
//     }
//     else {
//         const project = {
//             customerName: req.body.customerName,
//             systemSize: req.body.systemSize,
//             grossPPW: req.body.grossPPW,
//             redline: req.body.redline,
//             sOW: req.body.sOW,
//             rep: req.body.rep,
//             setter: req.body.setter,
//             secondaryRep: req.body.secondaryRep,
//             secondaryRepSplit: req.body.secondaryRepSplit,
//             product: req.body.product,
//             installPartner: req.body.installPartner,
//             stateUtility: req.body.stateUtility,
//             cancelDate: req.body.cancelDate,
//             approvedDate: req.body.approvedDate,
//             cAPDate: req.body.cAPDate,
//             installDate: req.body.installDate,
//             paidUpfrontDate: req.body.paidUpfrontDate,
//             paidInstallDate: req.body.paidInstallDate,
//             dealerFeePercent: req.body.dealerFeePercent,
//             dealerFeeDollars: req.body.dealerFeeDollars,
//             tsp: req.body.tsp
//         }
        // try {
        //     if (req.body.method == 'put') {
        //         db.collection("Projects").doc(req.body.projectId).update(project).then(async () => {
        //             req.body = req.body
        //             res.redirect('/projects');
        //             console.log("Project Updated!");
        //             return;
        //             //return res.status(202).send();
        //         });
        //     }
//             else {
//                 db.collection("Projects").add(project).then(async () => {
//                     req.body = req.body
//                     res.redirect('/projects')
//                     console.log("New Project Added!");
//                     return;
//                 })
//             }
//         }
//         catch {
//             res.status(500).send();
//         }
//     }
// });

app.post('/api/createAccess', async (req, res) => {
    const allAccess = await db.collection('Access').get();

    return await db.collection("Access").add({
        category: req.body.category,
        displayName: req.body.displayName,
        keyword: req.body.keyword
    });
})


app.post('/api/createSubAccess', async (req, res) => {

    await db.collection("SubAccess").add({
        accessId: req.body.accessId,
        displayName: req.body.displayName,
        featureName: req.body.featureName
    }).then((data) => {
        newSubAccessLevelId = data.id;
    });

    const accessLevels = await db.collection('AccessLevels').get()
    accessLevels.forEach(async datum => {
        aId = datum.id
        AccessLevelAccess = {
            subAccessId: newSubAccessLevelId,
            accessLevelId: aId,
            accessValues: req.body.accessLevel
        }
        console.log(AccessLevelAccess)
        await db.collection('AccessLevelAccess').add(AccessLevelAccess)
    })
})


app.get('/expenses', authenticateToken, async (req, res) => {
    const allExpenses = await db.collection('Expenses').get();
    let expenses = [];
    allExpenses.forEach(async doc => {
        data = doc.data();
        data.expenseId = doc.id;
        expenses.push(data);
    })
    res.render('pages/expenses', {
        expenses
    })
})

app.get('/projects', authenticateToken, async (req, res) => {
    const allProjs = await db.collection('Projects').get();
    let projects = [];
    allProjs.forEach(async doc => {
        data = doc.data();
        data.projectId = doc.id;
        projects.push(data);
    })
    res.render('pages/projects', {
        projects
    })
})


app.get('/', authenticateToken, (req, res) => {
    res.redirect('/home');
})


app.get('/home', authenticateToken, async (req, res) => {
    // createAccessLevel('Lowest')

    const Users = db.collection('Users');
    const usersSnap = await Users.where('email', '==', req.user.email).get()
    usersSnap.forEach(doc => {
        user = doc.data();
    });

    isAdminUser(user, () => {
        data = {
            admin: user.admin,
            manager: user.manager
        };
        res.render('pages/home', {
            data
        })
    })

    //hashes clean up
})

app.get('/views/reports', authenticateToken, async (req, res) => {
    // createAccessLevel('Lowest')

    const Users = db.collection('Users');
    const usersSnap = await Users.where('email', '==', req.user.email).get()
    usersSnap.forEach(doc => {
        user = doc.data();
    });

    isAdminUser(user, () => {
        data = {
            admin: user.admin,
            manager: user.manager
        };
        res.render('pages/reports', {
            data
        })
    })

})

app.get('/views/reports2', authenticateToken, async (req, res) => {
    // createAccessLevel('Lowest')

    const Users = db.collection('Users');
    const usersSnap = await Users.where('email', '==', req.user.email).get()
    usersSnap.forEach(doc => {
        user = doc.data();
    });

    isAdminUser(user, () => {
        data = {
            admin: user.admin,
            manager: user.manager
        };
        res.render('pages/reports2', {
            data
        })
    })

    //hashes clean up
})


app.get('/views/leaderboard', authenticateToken, async (req, res) => {
    // createAccessLevel('Lowest')

    leaderboardData = await getCloserLeaderboardData()
    const Users = db.collection('Users');
    const usersSnap = await Users.where('email', '==', req.user.email).get()
    usersSnap.forEach(doc => {
        user = doc.data();
    });

    isAdminUser(user, () => {
        data = {
            admin: user.admin,
            manager: user.manager
        };
        res.render('pages/leaderboard', {
            data, leaderboardData
        })
    })

})

app.get('/views/leaderboardSetters', authenticateToken, async (req, res) => {
    // createAccessLevel('Lowest')

    leaderboardData = await getSetterLeaderboardData()
    const Users = db.collection('Users');
    const usersSnap = await Users.where('email', '==', req.user.email).get()
    usersSnap.forEach(doc => {
        user = doc.data();
    });

    isAdminUser(user, () => {
        data = {
            admin: user.admin,
            manager: user.manager
        };
        res.render('pages/leaderboardSetters', {
            data, leaderboardData
        })
    })

})

app.get('/lead', async (req, res) => {
    try {
        const snapshot = await db.collection('Leads').doc(req.query.leadId).get();
        const data = await snapshot.data();
        data.rep = await getUser(data.rep);
        data.setter = await getUser(data.setter);

        return res.json(data).status(200).send();
    }
    catch {
        res.status(500).send();
    }
});



async function isAdminUser(user, next) {
    const snapshot = await db.collection('AccessLevels').doc(user.accessLevel).get();
    const AccessLevel = snapshot.data();
    if (AccessLevel.Level == "Superadmin") {
        user.admin = true;
        user.manager = true;
        user.superadmin = true;
    }
    else {
        user.superadmin = false;
        if (AccessLevel.Level == "Admin") {
            user.admin = true;
            user.manager = true;
        }
        else {
            user.admin = false;
            if (AccessLevel.Level == "Manager") {
                user.manager = true;
            }
            else {
                user.manager = false;
            }
        }
    }
    next();
}


app.get('/locationName', authenticateToken, async (req, res) => {
    try {
        const snapshot = await db.collection('Locations').doc(req.query.locationId).get();

        const data = snapshot.data();
        return res.json(data).status(200).send();
    }
    catch {
        res.status(500).send();
    }
});

app.get('/api/getUserActivity', authenticateToken, async (req, res) => {
    try {
        const snapshot = await db.collection('Users').doc(req.query.userId).get();

        const data = snapshot.data();
        return res.json(data).status(200).send();
    }
    catch {
        res.status(500).send();
    }
});


app.post('/api/updateUserActivity', async (req, res) => {
    try {
        let userId = req.body.userId
        // converts string to bool
        var isActive = req.body.isActive === 'true'

        await db.collection('Users').doc(userId).update({ active: isActive })

    }
    catch {
        res.status(500).send();
    }
})


app.get('/user', async (req, res) => {
    try {
        const snapshot = await db.collection('Users').doc(req.query.userId).get();

        const data = snapshot.data();
        
        return res.json(data).status(200).send();
    }
    catch {
        res.status(500).send();
    }
});

app.get('/users', authenticateToken, async (req, res) => {
    try {

        let locationsArray = [];
        const locations = await db.collection('Locations').get();

        locations.forEach(doc => {
            location = doc.data();
            location.id = doc.id;

            locationsArray.push(location)
        })

        const index = client.initIndex('Users');

        canView = await isAllowedToView3('viewUsers', req.user)
        console.log(canView)

        console.log(req.query.userInput + " " + canView.id)
        index.search(req.query.userInput + " " + canView.id).then(async ({ hits }) => {
            console.log(hits)
            for (let h = 0; h < hits.length; h++) {

                const locationName = locationsArray.filter(location => {
                    return location.id === hits[h].locationId;
                });
                // console.log(locationName)
                hits[h].locationName = locationName[0]

                console.log(hits[h])
            }
            return res.json(hits);
        })
            .catch((err) => {
                console.log(err);
            });

    }
    catch {
        res.status(500).send();
    }

});

app.get('/locations', authenticateToken, async (req, res) => {
    try {
        let locationsArray = [];
        const locations = await db.collection('Locations').get();

        locations.forEach(doc => {
            location = doc.data();
            location.id = doc.id;

            locationsArray.push(location)
        })
        return res.json(locationsArray);
    } catch {
        res.status(500).send();
    }

})

app.get('/allUsers', authenticateToken, async (req, res) => {
    const users = await db.collection('Users').get();
    let allUsers = [];

    users.forEach(doc => {
        data = doc.data();
        data.id = doc.id;
        allUsers.push(data)
    })

    return res.json(allUsers)
})

app.get('/dropdown', authenticateToken, async (req, res) => {
    res.render('pages/dropdown');
})


app.get('/userEmails', authenticateToken, async (req, res) => {

    try {
        const users = db.collection('Users');
        const snapshot = await users.get();
        let allEmails = []

        snapshot.forEach(doc => {
            data = doc.data();
            allEmails.push(data.email)
        });

        return res.json(allEmails).status(200).send();
    }
    catch {
        res.status(500).send();
    }
});

async function checkAllHashes() {


    const hashes = await db.collection('Hashes').get();

    hashes.forEach(async doc => {
        var isInTime = await isHashExpired(doc.id);

        if (!isInTime) {
            console.log(doc.id + " " + isInTime)
            deleteHash(doc.id)
        }

    });

}

// if there are multiple subAccesses for one Access, you need to specify a subAccessFeatureName
async function isAllowedToView3(functionName, user, subAccessFeatureName = "") {

    let allowLevel = {
        rank: 4,
        id: ""
    };

    const access = await db.collection('Access').where('keyword', '==', functionName).get();

    if (access.size == 1) {
        for (doc of access.docs) {

            accessData = doc.data();
            accessData.id = doc.id;

            var subAccess;
            if (subAccessFeatureName == "") {
                subAccess = await db.collection('SubAccess').where('accessId', '==', accessData.id).get();
            } else {
                subAccess = await db.collection('SubAccess').where('accessId', '==', accessData.id).where('featureName', '==', subAccessFeatureName).get();
            }

            for (doc2 of subAccess.docs) {
                subAccessData = doc2.data();
                subAccessData.id = doc2.id;


                const accessLevelAccess = await db.collection('AccessLevelAccess')
                    .where('accessLevelId', '==', user.accessLevelId)
                    .where('subAccessId', '==', subAccessData.id).get();

                if (accessLevelAccess.size == 1) {
                    for (doc3 of accessLevelAccess.docs) {
                        accessLevelAccessData = doc3.data();
                        accessLevelAccessData.id = doc3.id;

                        const accessValue = await db.collection('AccessValues').where('rank', '==', accessLevelAccessData.accessValues).get();
                        if (accessValue.size == 1) {
                            for (doc4 of accessValue.docs) {
                                accessValueData = doc4.data();
                                accessValueData.id = doc4.id;


                                if (accessValueData.rank < allowLevel.rank) {
                                    allowLevel.rank = accessValueData.rank;
                                    switch (accessValueData.rank) {
                                        case 1:
                                            allowLevel.id = ""
                                            return allowLevel;
                                            break;
                                        case 2:
                                            allowLevel.id = user.id
                                            break;
                                        case 3:
                                            allowLevel.id = user.locationId
                                            break;
                                        default:
                                            allowLevel.id = ""
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
    return allowLevel;
}
app.get('/views/users', authenticateToken, async (req, res) => {
    isAllowed = await isAllowedToView3('viewUsers', req.user);

    loginAsUserFunctionality = await isAllowedToView3('loginAsUser', req.user);
    var loginLevel = 4;
    var canLoginAsUser = parseInt(loginAsUserFunctionality.rank) == loginLevel ? true : false

    if (parseInt(isAllowed.rank) > 1) {

        checkAllHashes();

        const allUsers = await db.collection('Users').get();
        let users = [];
        allUsers.forEach(async doc => {
            data = doc.data();
            data.userId = doc.id;
            users.push(data);
        })

        const Users = db.collection('Users');
        const usersSnap = await Users.where('email', '==', req.user.email).get()
        usersSnap.forEach(doc => {
            user = doc.data();
        });

        await isAdminUser(user, () => {
            data = {
                superadmin: user.superadmin,
                admin: user.admin,
                manager: user.manager
            };
            console.log(data)
            // return res.json(data)
            res.render('pages/users', {
                data, canLoginAsUser
            })
        })
    }
})

app.get('/views/settings', authenticateToken, async (req, res) => {

    const Users = db.collection('Users');
    const usersSnap = await Users.where('email', '==', req.user.email).get()
    usersSnap.forEach(doc => {
        user = doc.data();
    });

    await isAdminUser(user, () => {
        data = {
            admin: user.admin,
            manager: user.manager
        };
        console.log(data)
        res.render('pages/settings', {
            data
        })
    })
})


app.get('/views/manageRoles', authenticateToken, async (req, res) => {

    const Users = db.collection('Users');
    const usersSnap = await Users.where('email', '==', req.user.email).get()
    usersSnap.forEach(doc => {
        user = doc.data();
    });

    let accessLevels = await getAllAccessLevels();
    console.log(data)

    await isAdminUser(user, () => {
        data = {
            admin: user.admin,
            manager: user.manager
        };
        
        res.render('pages/manageRoles', {
            data, accessLevels
        })
    })
})
async function getAllAccessLevels() {
    const allAccessLevels = await db.collection('AccessLevels').get();
    let accessLevels = [];
    allAccessLevels.forEach(async doc => {
        data = doc.data();
        data.id = doc.id;
        accessLevels.push(data);
    })
    return accessLevels;
}

app.get('/views/manageOutcomes', authenticateToken, async (req, res) => {

    const Users = db.collection('Users');
    const usersSnap = await Users.where('email', '==', req.user.email).get()
    usersSnap.forEach(doc => {
        user = doc.data();
    });

    let allApptOutcomes = await getAllAppointmentOutcomes();

    await isAdminUser(user, () => {
        data = {
            admin: user.admin,
            manager: user.manager
        };
        console.log(data)
        res.render('pages/manageOutcomes', {
            data, allApptOutcomes
        })
    })
})

async function getAllAppointmentOutcomes() {
    const appointmentOutcomes = await db.collection('AppointmentOutcomes').get();
    let allApptOutcomes = [];
    appointmentOutcomes.forEach(async doc => {
        apptOutcome = doc.data();
        apptOutcome.id = doc.id;
        allApptOutcomes.push(apptOutcome);
    })
    return allApptOutcomes;
}

app.get('/views/roleAccess', authenticateToken, async (req, res) => {

    const Users = db.collection('Users');
    const usersSnap = await Users.where('email', '==', req.user.email).get()
    usersSnap.forEach(doc => {
        user = doc.data();
    });

    const accessValues = await db.collection('AccessValues').get();
    let allAccessValues = [];
    accessValues.forEach(doc => {
        accessValue = doc.data();
        accessValue.id = doc.id;

        allAccessValues.push(accessValue);
    })



    const accessLevels = await db.collection('AccessLevels').doc(req.query.aId).get();
    thisAccessLevel = accessLevels.data();

    const accesses = await db.collection('Access').get();
    const subAccesses = await db.collection('SubAccess').get();
    const rules = await db.collection('AccessLevelAccess').where('accessLevelId', '==', req.query.aId).get();

    let categories = [];
    accesses.forEach(async doc => {
        access = doc.data();
        access.id = doc.id;
        category = access.category
        // category.accessArray = []

        if (categories.filter(e => e.category === category).length == 0) {
            categories.push({ category })
        }

        categories.filter(e => e.category === category)[0].accessArray = []
    });

    accesses.forEach(async doc => {
        access = doc.data();
        access.id = doc.id;

        let accessesSubAccesses = [];
        subAccesses.forEach(async doc2 => {
            subAccess = doc2.data();
            subAccess.id = doc2.id;


            if (subAccess.accessId == access.id) {
                accessesSubAccesses.push(subAccess)

                rules.forEach(async doc3 => {
                    rule = doc3.data();
                    rule.id = doc3.id;

                    if (rule.subAccessId == subAccess.id) {
                        subAccess.rule = rule;
                    }
                })
            }
        });

        access.subAccesses = accessesSubAccesses
        categories.filter(e => e.category === access.category)[0].accessArray.push(access)

    });



    await isAdminUser(user, () => {
        data = {
            admin: user.admin,
            manager: user.manager
        };

        res.render('pages/roleAccess', {
            data, allAccessValues, categories, thisAccessLevel
        })
    })
})


async function isAdminUser2(user, next) {

    const snapshot = await db.collection('AccessLevels').doc(user.accessLevel).get();
    const AccessLevel = snapshot.data();
    if (AccessLevel.Level == "Superadmin") {
        user.admin = true;
        user.manager = true;
        user.superadmin = true;
    }
    else {
        user.superadmin = false;
        if (AccessLevel.Level == "Admin") {
            user.admin = true;
            user.manager = true;
        }
        else {
            user.admin = false;
            if (AccessLevel.Level == "Manager") {
                user.manager = true;
            }
            else {
                user.manager = false;
            }
        }
    }
    next();

    data = {
        admin: user.admin,
        manager: user.manager
    };


    return data;
}


app.post('/roleAccess', authenticateToken, async (req, res) => {
    try {
        console.log('reached')
        allRequests = (req.body)

        const accessValues = await db.collection('AccessValues').get()

        for (const field in allRequests) {

            accessValues.forEach(async (doc) => {
                data = doc.data()
                if (allRequests[field] == data.value) {
                    await db.collection('AccessLevelAccess').doc(field).update({ accessValues: data.rank });
                }
            })

        }

        res.status(204).send();
    }
    catch {
        res.status(500).send();
    }

})

app.post('/changeLeadStatus', authenticateToken, async (req, res) => {
    try {
        console.log('reached changeLeadStatus')
        allRequests = (req.body)

        console.log(req.query)
        console.log(req.body)

        const newStatus = await db.collection('AppointmentOutcomes').doc(req.body.newStatus).get();
        const newStatusData = await newStatus.data();
        console.log(newStatusData.name)

        if (newStatusData.name == 'Sit') {
            db.collection('Leads').doc(req.query.lId).get()
                .then(async doc => {
                    if (doc.get('sitDate') == null && doc.get('sitPaid') == null) {
                        await db.collection("Leads").doc(req.query.lId).set({ sitDate: new Date(), sitPaid: false }, { merge: true })
                    }
                })
                .catch(err => {
                    console.log('Error getting document', err);
                });
        }

        //TODO 
        await db.collection("Leads").doc(req.query.lId).update({ status: req.body.newStatus })


        // res.status(204).send();
        res.redirect('views/lead?lId=' + req.query.lId);
    }
    catch {
        res.status(500).send();
    }

})


async function getAccessLevel(aID) {
    const snapshot = await db.collection('AccessLevels').doc(aID).get();
    const AccessLevel = await snapshot.data();
    return AccessLevel;
}




app.get('/views/addUser', authenticateToken, async (req, res) => {
    const loggedInAccessLevel = await getAccessLevel(req.user.accessLevelId);
    let DB_Data = await db.collection('AccessLevels').get();
    let accessLevels = [];
    await DB_Data.forEach(async (doc) => {
        data = doc.data();
        data.id = doc.id;
        // console.log(data.Level);
        accessLevels.push(data);
    });

    if (loggedInAccessLevel.Level == 'Manager') {
        for (let i = 0; i < accessLevels.length; i++) {
            if (accessLevels[i].Level == 'Admin' || accessLevels[i].Level == 'Manager') {
                // console.log(accessLevels[i].Level + 'Removed ');
                accessLevels.splice(i, 1);
                i = i - 1;
            }
        }
    }

    DB_Data = await db.collection('Locations').get();
    let locations = [];
    await DB_Data.forEach(async doc => {
        data = doc.data();
        data.id = doc.id;
        locations.push(data);
    });

    data = {
        accessLevels: accessLevels,
        locations: locations,
        currLocId: req.user.locationId

    };
    res.render('pages/addUser', data)
});

app.get('/views/user', authenticateToken, async (req, res) => {

    try {
        const snapshot = await db.collection('Users').doc(req.query.uId).get();
        const userDoc = snapshot.data();

        const accessLevel = await db.collection('AccessLevels').doc(userDoc.accessLevel).get();
        accessLevelData = accessLevel.data()
        userDoc.accessLevelName = accessLevelData.Level
        userDoc.id = req.query.uId
        locSnap = await db.collection('Locations').doc(userDoc.locationId).get();
        userDoc.location = locSnap.data();

        console.log(userDoc)

        let allAccessLevels = await getAllAccessLevels();

        const Users = db.collection('Users');
        const usersSnap = await Users.where('email', '==', req.user.email).get();

        editAccessLevel = await isAllowedToView3('editUser', req.user, 'EditAccessLevel');
        var editLevel = 4;
        var canEditAccessLevel = parseInt(editAccessLevel.rank) == editLevel ? true : false

        let locationsArray = [];
        const locations = await db.collection('Locations').get();

        locations.forEach(doc => {
            location = doc.data();
            location.id = doc.id;

            locationsArray.push(location)
        })



        usersSnap.forEach(async doc => {
            let user = doc.data();


            await isAdminUser(user, () => {
                const data = {
                    admin: user.admin,
                    manager: user.manager
                };
                res.render('pages/user', {
                    userDoc, data, allAccessLevels, canEditAccessLevel, locationsArray
                })
            })
        });

    }
    catch {
        res.status(500).send();
    }

})

app.post('/api/editUserLocation', async (req, res) => {
    try {
        const userId = req.body.userId;
        const user = await db.collection('Users').doc(userId);
        console.log(userId)
        await user.update({ locationId: req.body.locationId })
            .then(() => {
                res.redirect('/views/user?uId=' + userId);
            });
    }
    catch {
        res.status(500).send();
    }
})

app.get('/views/lead', authenticateToken, async (req, res) => {
    try {
        let snapshot = await db.collection('Leads').doc(req.query.lId).get();
        let lead = snapshot.data();
        lead.id = req.query.lId

        snapshot = await db.collection('Users').doc(lead.setter).get();
        const setter = snapshot.data();
        lead.setter = setter.name;

        snapshot = await db.collection('Users').doc(lead.rep).get();
        const rep = snapshot.data();
        lead.rep = rep.name;

        snapshot = await db.collection('Locations').doc(lead.locationId).get();
        const loc = snapshot.data();
        lead.location = loc.name;

        //CheckAction("Edit");

        let allApptOutcomes = [];
        var leadApptOutcomeName = "";
        const appointmentOutcomes = await db.collection("AppointmentOutcomes").get();

        console.log(req.user.accessLevelId)
        const userAccessLevel = await db.collection('AccessLevels').doc(req.user.accessLevelId).get();
        const userAccessLevelData = userAccessLevel.data();
        const isAdminOrSuper = (userAccessLevelData.Level == 'Admin') || (userAccessLevelData.Level == 'Superadmin')
        var isSit = false, isFollowUp = false;

        for (doc of appointmentOutcomes.docs) {
            apptOutcome = doc.data();
            apptOutcome.id = doc.id;

            if (apptOutcome.id == lead.status) {
                leadApptOutcomeName = apptOutcome.name
            }

            if ((apptOutcome.name == 'Sit') && (apptOutcome.id == lead.status)) {
                isSit = true;
            } else if ((apptOutcome.name == 'Follow up') && (apptOutcome.id == lead.status)) {
                isFollowUp = true;
            } else if ((apptOutcome.name == 'New') && (apptOutcome.id != lead.status)) {
                continue;
            } else if ((apptOutcome.name == 'Sold') && (!isAdminOrSuper)) {
                continue;
            }

            allApptOutcomes.push(apptOutcome)
        }

        if (isSit) {
            allApptOutcomes = allApptOutcomes.filter(function (obj) {
                return (obj.name !== 'Rescheduled') && (obj.name !== 'New') && (obj.name !== 'Cancelled at door') && (obj.name !== 'Cancelled') && (obj.name !== 'No Show');
            });
        } else if (isFollowUp) {
            allApptOutcomes = allApptOutcomes.filter(function (obj) {
                return (obj.name !== 'New') && (obj.name !== 'Cancelled at door');
            });
        }

        const Users = db.collection('Users');
        const usersSnap = await Users.where('email', '==', req.user.email).get()
        usersSnap.forEach(doc => {
            user = doc.data();
        });

        let locationsArray = [];
        const locations = await db.collection('Locations').get();

        locations.forEach(doc => {
            location = doc.data();
            location.id = doc.id;

            locationsArray.push(location)
        })

        editRep = await isAllowedToView3('editLead', req.user, 'EditRep');
        editSetter = await isAllowedToView3('editLead', req.user, 'EditSetter');
        editLocation = await isAllowedToView3('editLead', req.user, 'EditLocation');
        editStatus = await isAllowedToView3('editLead', req.user, 'EditStatus');

        var editLevel = 4;
        var canEditRep = parseInt(editRep.rank) == editLevel ? true : false
        var canEditSetter = parseInt(editSetter.rank) == editLevel ? true : false
        var canEditLocation = parseInt(editLocation.rank) == editLevel ? true : false
        var canEditStatus = parseInt(editStatus.rank) == editLevel ? true : false


        await isAdminUser(user, () => {
            data = {
                superadmin: user.superadmin,
                admin: user.admin,
                manager: user.manager
            };

            res.render('pages/lead', {
                lead, data, allApptOutcomes, locationsArray, canEditRep, canEditSetter, canEditLocation, canEditStatus, leadApptOutcomeName
            })
        })

    }
    catch {
        res.status(500).send();
    }
})

app.post('/api/deleteLead', async (req, res) => {
    try {
        console.log(req.query.leadId)

        // deletes lead from db
        await db.collection('Leads').doc(req.query.leadId).delete().then(
            async () => {
                res.redirect('/views/leads');
                console.log("Lead Deleted!");
            }
        );

        // res.redirect('/views/leads');
    }
    catch {
        res.status(500).send();
    }
})

app.post('/api/deleteUser', async (req, res) => {
    try {
        console.log('reached deleteUser')
        console.log(req.query.userId)

        // deletes lead from db
        await db.collection('Users').doc(req.query.userId).delete().then(
            async () => {
                res.redirect('/views/users');
                console.log("User Deleted!");
            }
        );

        // res.redirect('/views/users');
    }
    catch {
        res.status(500).send();
    }
})

app.post('/api/editAccessLevel', async (req, res) => {
    try {
        const userId = req.body.userId

        const user = await db.collection('Users').doc(userId)
        await user.update({ accessLevel: req.body.accessLevelId })
            .then(() => {
                res.redirect('/views/user?uId=' + userId);
            });

    }

    catch {
        res.status(500).send();
    }
})

app.post('/api/editRep', async (req, res) => {
    try {
        const leadId = req.body.leadId;
        const lead = await db.collection('Leads').doc(leadId);
        await lead.update({ rep: req.body.repId })
            .then(() => {
                res.redirect('/views/lead?lId=' + leadId);
            });
    }
    catch {
        res.status(500).send();
    }
})

app.post('/api/editSetter', async (req, res) => {
    try {
        const leadId = req.body.leadId;
        const lead = await db.collection('Leads').doc(leadId);
        await lead.update({ setter: req.body.setterId })
            .then(() => {
                res.redirect('/views/lead?lId=' + leadId);
            });
    }
    catch {
        res.status(500).send();
    }
})

app.post('/api/editLocation', async (req, res) => {
    try {
        const leadId = req.body.leadId;
        const lead = await db.collection('Leads').doc(leadId);
        await lead.update({ locationId: req.body.locationId })
            .then(() => {
                res.redirect('/views/lead?lId=' + leadId);
            });
    }
    catch {
        res.status(500).send();
    }
})

async function isHashExpired(hashId) {

    const hashData = await db.collection('Hashes').doc(hashId).get();
    const hashDataDoc = hashData.data();

    // document with no date field (should be deleted)
    try {
        const hashDate = await hashDataDoc.createdOn.toDate();

        const currDate = new Date();
        const secondsInDay = 60 * 60 * 24 // number of seconds in a day
        const isInTime = Math.abs((currDate - hashDate) / 1000) < secondsInDay * 2; // convert to seconds < 2 days

        return isInTime;

    } catch {
        return false;
    }

}

app.get('/views/passwordReset', async (req, res) => {
    try {
        var isInTime = await isHashExpired(req.query.hashesId);
        console.log("isontime: " + isInTime)

        if (isInTime) {
            console.log('youre on time')
            res.render('pages/passwordReset')
        } else {
            //await db.collection('Hashes').doc(req.query.hashesId).delete();
            deleteHash(req.query.hashesId)

            console.log('you late')
            res.redirect('/views/users')
        }

    }
    catch {
        res.status(500).send();
    }
})

async function deleteHash(hashId) {
    const hashToDelete = await db.collection('Hashes').doc(hashId).get();
    const hashToDeleteData = hashToDelete.data();
    // console.log('hashToDeleteData = ' + hashToDeleteData.userId)

    // document may not have a user(empty document to keep collection from deleting)
    try {
        const expiredUser = await db.collection('Users').doc(hashToDeleteData.userId).get();
        const expiredUsersData = expiredUser.data();
        console.log('expiredUsersData = ' + expiredUsersData)

        const requester = await db.collection('Users').doc(hashToDeleteData.requesterId).get();
        const requesterData = requester.data();
        console.log('requesterData = ' + requesterData)

        failPasswordRequestorChangeEmail({
            name: requesterData.name,
            email: requesterData.email,
            empName: expiredUsersData.name,
            empEmail: expiredUsersData.email
        })
    } catch {

    }
    finally {
        await db.collection('Hashes').doc(hashId).delete();
        isHashesEmpty();
    }
}

// creates a blank document in Hashes if it's empty
async function isHashesEmpty() {
    await db.collection('Hashes').get().then(async snap => {
        if (snap.size == 0) {
            await db.collection('Hashes').add({});
        }
    });
}

app.post('/passwordReset', async (req, res) => {

    try {
        const hashUser = await db.collection('Hashes').doc(req.body.hashesId).get();
        const hashUserData = hashUser.data();

        // get user's User document
        const userToUpdate = db.collection('Users').doc(hashUserData.userId);

        // deletes user's hashData from db
        await db.collection('Hashes').doc(req.body.hashesId).delete();

        const salt = await bcrypt.genSalt()
        const hashedPass = await bcrypt.hash(req.body.password, salt)

        // updates user's passwords
        await userToUpdate.update({ password: hashedPass });

        const user = await userToUpdate.get();
        const userData = user.data();
        // emails the user a password change success email
        successPasswordChangeEmail({
            name: userData.name,
            email: userData.email
        });


        if (hashUserData.requesterId !== undefined) {

            const hashRequester = await db.collection('Users').doc(hashUserData.requesterId).get()
            // emails the requester
            const requesterData = hashRequester.data()
            successPasswordRequestorChangeEmail({
                name: requesterData.name,
                email: requesterData.email,
                empName: userData.name
            });

        }

        res.redirect('/home');
    }
    catch {
        res.status(500).send();
    }


})

async function getAccessLevelId(user, levelName, next) {
    const AccessLevels = db.collection('AccessLevels');
    const AccessLevelsSnap = await AccessLevels.where('Level', '==', levelName).get();

    if (AccessLevelsSnap.empty) {
        console.log('getAccessLevelId Failed');
        return "";
    }

    AccessLevelsSnap.forEach(doc => {
        user.accessLevel = doc.id;
        next();
    });
}

async function getLocationId(user, locationName, next) {
    const Locations = db.collection('Locations');
    const LocationsSnap = await Locations.where('name', '==', locationName).get();

    if (LocationsSnap.empty) {
        console.log('getLocationId Failed');
        return "";
    }

    LocationsSnap.forEach(doc => {
        user.locationId = doc.id;
        next();
    });
}

async function getStatusId(statusName) {
    const ApptOutcomesSnap = await db.collection('AppointmentOutcomes').where('name', '==', statusName).get();

    if (ApptOutcomesSnap.size == 1) {
        for (doc of ApptOutcomesSnap.docs) {
            return doc.id
        }
    } else {
        console.log('getLocationId Failed');
        return "";
    }


}

function randomString(size = 21) {
    return crypto
        .randomBytes(size)
        .toString('base64')
        .slice(0, size)
}


async function getUserWithBody(body, next) {


    next(user);
}




app.post('/user', async (req, res) => {
    const request = req;

    if (req.body.method == 'delete') {
        db.collection("Users").doc(req.body.userId).delete().then(async () => {
            req.body = req.body
            // res.redirect('/users');
            console.log("User Deleted!");
            return;
        });
    }
    else {
        try {
            let available;

            var setter;
            if (req.query.type != 'reset') {
                setter = await isSetter(req.body.accessLevel);
            } else {
                setter = false
            }

            if (!req.body.available || setter) {
                available = false;
            } else {
                if (req.body.available == 'yes') {
                    available = true;
                } else {
                    available = false;
                }
            }

            const user = {
                email: req.body.email,
                available: available,
                name: req.body.name,
                calId: req.body.calId,
                hasCalId: req.body.calId != "",
                locationId: req.body.location,
                accessLevel: req.body.accessLevel,
                active: true
            }

            if (req.body.method != 'put') {
                const salt = await bcrypt.genSalt()
                var randomPassword = await randomString();
                const hashedPass = await bcrypt.hash(randomPassword, salt)

                user.password = hashedPass;
            }

            // await getUserWithBody(body, async (user) => {
            let data = {
                tableName: "Users",
                data: user
            }

            if (req.body.method == 'put') {
                db.collection(data.tableName).doc(req.body.userId).update(data.data).then(async () => {
                    req.body = req.body
                    // res.redirect('/users');
                    console.log("User Updated!");
                    return;
                });
            }
            else {

                if (req.query.type == 'reset') {
                    console.log('reached reset password')

                    await db.collection("Users").doc(req.query.userId).get().then(async (thisUser) => {


                        thisUserData = thisUser.data()
                        thisUserData.id = thisUser.id
                        var date = new Date();

                        hashes = await db.collection("Hashes").add({
                            userId: thisUserData.id,
                            password: thisUserData.password,
                            createdOn: date,
                        }).then(async (hashes) => {

                            let user = {
                                email: thisUserData.email,
                                name: thisUserData.name,
                                password: thisUserData.password,
                                hashesId: hashes.id,
                                createdOn: date
                            };
                            sendCreatedUserEmail(user, true);

                        });

                        return;
                    });
                    console.log(req.query.userId)
                } else {
                    await db.collection(data.tableName).add(data.data).then(async (newData) => {
                        console.log("New User added!");
                        var requester = await jwt_decode(req.cookies.access_token);
                        var date = new Date();


                        hashes = await db.collection("Hashes").add({
                            userId: newData.id,
                            password: data.data.password,
                            createdOn: date,
                            requesterId: requester.id
                        }).then(async (hashes) => {


                            let user = {
                                email: data.data.email,
                                name: data.data.name,
                                password: data.data.password,
                                hashesId: hashes.id,
                                createdOn: date
                            };
                            sendCreatedUserEmail(user);



                            // console.log(data.data.accessLevel);
                            const addedLevel = await getAccessLevel(data.data.accessLevel);
                            // console.log(addedLevel.Level);
                            sendCreatedUserAdminEmail(data = {
                                requesterName: requester.name,
                                addedEmail: data.data.email,
                                addedName: data.data.name,
                                addedLevel: addedLevel.Level,
                                createdOn: date
                            });

                        });
                    })
                }

            }
            res.redirect('/views/users');
        }
        catch {
            console.log('error in post user')
            res.status(500).send();
        }
    }

})



app.post('/transaction', async (req, res) => {
    try {
        const transact = {
            datePaid: req.body.datePaid,
            installCommission: req.body.installCommission,
            CAPPayment: req.body.CAPPayment,
            clawbackBonus: req.body.clawbackBonus,
            totalinPeriod: req.body.totalinPeriod,
            prevPaid: req.body.prevPaid,
            totalProjectCommission: req.body.totalProjectCommission,
            tsp: req.body.totalProjectCommission
        }
        data = {
            tableName: "Transactions",
            data: transact
        }
        db.collection(data.tableName).add(data.data).then(() => {
            console.log("New Transaction added");
        })
        res.status(201).send();
    }
    catch {
        res.status(500).send();
    }

})

app.post('/payment', async (req, res) => {
    try {

        const payment = {
            datePaid: req.body.datePaid,
            installCommission: req.body.installCommission,
            CAPPayment: req.body.CAPPayment,
            clawbackBONUS: req.body.clawbackBONUS,
            totalinPeriod: req.body.totalinPeriod,
            prevPaid: req.body.prevPaid,
            totalProjectCommission: req.body.totalProjectCommission,
            projectId: req.body.projectId
        }

        data = {
            tableName: "Payments",
            data: payment
        }

        db.collection(data.tableName).add(data.data).then(() => {
            console.log("New Payment added");
        })
        res.status(201).send();
    }
    catch {
        res.status(500).send();
    }

})



app.post('/Form', authenticateToken, upload.any(), async (req, res) => {
    console.log(req.body);

    // try {

    var file = req.files[0];
    let fileId;

    fileId = await uploadFile(file);
    console.log('File Uploaded! - ', fileId);

    const address = req.body.street + ' ' + req.body.city + ', ' + req.body.state + ' ' + req.body.zip;

    let initialStatus = ''
    const newStatus = await db.collection('AppointmentOutcomes').where('name', '==', 'New').get();
    if (newStatus.size == 1) {
        newStatus.forEach(doc => {
            initialStatus = doc.id;
        })
    }

    let date = req.body.apptDay + ' ';
    date += req.body.apptTime;

    let repId = await AssignAppt(date, req.body.first_name + ' ' + req.body.last_name, address, req.user, req.body.notes);

    const currDate = new Date((new Date()).getTime() - (4 * 60 * 60 * 1000));
    let lead = {
        firstName: req.body.first_name,
        lastName: req.body.last_name,
        email: req.body.email,
        phone: req.body.phone,
        notes: req.body.notes,
        street: req.body.street,
        city: req.body.city,
        state: req.body.state,
        zip: req.body.zip,
        utilPic: 'https://drive.google.com/open?id=' + fileId,
        dateCreated: currDate.toString(),
        locationId: req.user.locationId,
        rep: repId,
        setter: req.user.id,
        appointmentTime: date,
        status: initialStatus
    }



    await db.collection("Leads").add(lead).then(async () => {
        req.body = req.body
        res.redirect('/views/leads');
        console.log("New Lead Added!");
    })
        .catch((err) => {
            console.log(err);
        });


    lead.rep = await getUser(lead.rep);
    lead.setter = await getUser(lead.setter);
    lead.address = address;

    sendEmails(lead, () => {
        console.log('All Emails Sent.')
    });

})


app.post('/updateAllLeadsStatuses', async (req, res) => {
    try {
        const leads = await db.collection('Leads').get();

        let leadList = [];
        leads.forEach(async doc => {

            //let updateVal = {status: 'New'}
            let updateVal = { status: req.body.status }
            await db.collection("Leads").doc(doc.id).update(updateVal)
        })

        return res.json(leadList).status(200).send();
    }
    catch {
        res.status(500).send();
    }

})

app.post('/updateAllUsersActivity', async (req, res) => {
    try {
        const users = await db.collection('Users').get();

        let usersList = [];
        users.forEach(async doc => {

            //let updateVal = {status: 'New'}
            let updateVal = { active: req.body.active }
            await db.collection("Users").doc(doc.id).update(updateVal)
        })

        return res.json(usersList).status(200).send();
    }
    catch {
        res.status(500).send();
    }

})

async function getUser(uId) {
    const snapshot = await db.collection('Users').doc(uId).get();
    const data = await snapshot.data();
    return data;

}

async function AssignAppt(timeTxt, cxName, address, user, notes) {
    const calendar = google.calendar({ version: 'v3', auth: await getOAuth2Client() });
    const calId = await getCalId(user.locationId);
    let time = new Date(Date.parse(timeTxt));
    time = new Date(time.getTime() + (4 * 60 * 60 * 1000));
    const endTime = new Date(time.getTime() + (1.5 * 60 * 60 * 1000));
    let startOfDay = new Date(time.toString())
    startOfDay.setHours(0, 0, 0, 0);
    let nextDay = new Date();
    nextDay.setDate(startOfDay.getDate());
    nextDay.setHours(23, 59, 59, 59);
    let h;

    let events;
    let dayEvents;
    let availEmployees = [];
    let lowestRep;


    console.log('Location' + user.locationId);

    if (await isSetter(user.accessLevelId)) {
        const index = client.initIndex('Users');
        await index.search(user.locationId, {
            filters: 'available = 1 AND hasCalId = 1'
        }).then(async ({ hits }) => {
            for (h = 0; h < hits.length; h++) {
                console.log(time, endTime, hits[h].calId)
                events = await calendar.events.list({
                    calendarId: hits[h].calId,
                    timeMin: time.toISOString(),
                    timeMax: endTime.toISOString(),
                    singleEvents: true,
                    orderBy: 'startTime'
                });

                if (!events.data.items || events.data.items.length === 0) {
                    console.log(hits[h].calId, ' is Available')
                    eventsToday = 0
                    dayEvents = await calendar.events.list({
                        calendarId: hits[h].calId,
                        timeMin: startOfDay.toISOString(),
                        timeMax: nextDay.toISOString(),
                        singleEvents: true,
                        orderBy: 'startTime'
                    });

                    if (!dayEvents.data.items || dayEvents.data.items.length === 0) {
                        console.log(hits[h].calId, ' has ', eventsToday, "eventsToday")
                        hits[h].eventsToday = eventsToday
                        availEmployees.push(hits[h]);
                        continue;
                    }
                    console.log(hits[h].calId, '-', dayEvents.data.items.length, ' events on his calendar')
                    for (var e = 0; e < dayEvents.data.items.length; e++) {
                        if (dayEvents.data.items[e].summary) {
                            if (dayEvents.data.items[e].summary.substring(0, 22) == 'Sales Appointment with') {
                                eventsToday++;
                            }
                        }
                    }
                    console.log(hits[h].calId, ' is an available employee with ', eventsToday, 'appts today')
                    hits[h].eventsToday = eventsToday;
                    availEmployees.push(hits[h]);
                }
            }

        });



        console.log('Determining the lowestRep ... from ', availEmployees.length);
        if (availEmployees.length === 0) {
            console.log('SCHEDULING COLLISION NO ONE IS AVAILABLE AT ', timeTxt)
            return;
        }
        let lowest = 100
        for (var x = 0; x < availEmployees.length; x++) {
            if (availEmployees[x].eventsToday < lowest) {
                lowest = availEmployees[x].eventsToday;
                lowestRep = availEmployees[x];
            }
        }
        console.log(lowestRep.calId, 'is the lowestRep');
        repId = lowestRep.objectID;
    }
    else {
        lowestRep = user;
        repId = lowestRep.id;
    }


    var event = {
        'summary': 'Sales Appointment with ' + cxName,
        'description': address + '\n' + notes,
        'start': {
            'dateTime': time.toISOString()
        },
        'end': {
            'dateTime': endTime.toISOString()
        },
        'reminders': {
            'useDefault': false
        },
        'attendees': {
            'email': lowestRep.email
        }
    };

    console.log('Giving ', lowestRep.calId, 'the appt');

    var request = await calendar.events.insert({
        'calendarId': lowestRep.calId,
        'resource': event
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        // console.log(res);
    });

    return repId;
}

app.get('/sendEmail', authenticateToken, async (req, res) => {
    sendEmail();
});

async function sendEmails(appt, next) {
    if (appt.rep.email == appt.setter.email) {
        await sendEmail(appt, appt.setter, false);
    }
    else {
        await sendEmail(appt, appt.rep, true);
        await sendEmail(appt, appt.setter, false);
    }
    next();
};

async function sendEmail(appt, recep, includeSubmittedBy) {
    var date = new Date(appt.appointmentTime);
    var message = "";
    var encodedAddy = appt.address.replace(' ', '+');

    if (appt.setter == recep) {
        message = "A lead for " + appt.firstName + ' ' + appt.lastName + " was successfully submitted.";
    }
    else {
        message = "A new lead was submitted for you, " + appt.firstName + ' ' + appt.lastName + ".";
    }

    let locals = {
        cxName: appt.firstName + ' ' + appt.lastName,
        cxAddress: appt.address,
        address: encodedAddy,
        apptDate: date.toDateString(),
        apptTime: date.toLocaleTimeString([], { timeStyle: 'short' }),
        utilPic: appt.utilPic,
        recepName: recep.name,
        message: message,
        cxPhone: appt.phone,
        cxEmail: appt.email,
        notes: appt.notes,
        includeBy: includeSubmittedBy,
        submittedBy: appt.setter.name
    };


    const data = await ejs.renderFile("./templates/emailTemplates/html.ejs", locals);

    const options = {
        to: recep.email,
        subject: "New Lead Submitted: " + appt.firstName + ' ' + appt.lastName + ' by ' + appt.setter.name,
        html: data,
        textEncoding: 'base64'
    };
    const messageId = await sendMail(options);
    console.log('Lead From Sub Message sent successfully:', messageId)
}

async function sendCreatedUserAdminEmail(data) {
    const htmlData = await ejs.renderFile("./templates/emailTemplates/adminUserCreated.ejs", data);

    const subject = 'A New User was Added to the System'
    let options = {
        to: 'developer@ownourenergy.com',
        subject: subject,
        html: htmlData,
        textEncoding: 'base64'
    };
    let messageId = await sendMail(options);
    console.log('Account Created Message sent to Admin successfully:', messageId)

    options = {
        to: 'r.miller@ownourenergy.com',
        subject: subject,
        html: htmlData,
        textEncoding: 'base64'
    };
    messageId = await sendMail(options);
    console.log('Account Created Message sent to Admin successfully:', messageId)

}

async function sendCreatedUserEmail(user, passwordReset = false) {

    console.log('Account Created Message sending... ')

    var data;
    if (!passwordReset) {
        data = await ejs.renderFile("./templates/emailTemplates/userCreated.ejs",
            { userName: user.name, link: 'https://ownproduction.uc.r.appspot.com/views/passwordReset?hashesId=' + user.hashesId });
    } else {
        data = await ejs.renderFile("./templates/emailTemplates/passwordReset.ejs",
            { userName: user.name, link: 'https://ownproduction.uc.r.appspot.com/views/passwordReset?hashesId=' + user.hashesId });
    }

    const options = {
        to: user.email,
        subject: passwordReset ? 'Password Reset' : 'Continue Setting Up Your Account!',
        html: data,
        textEncoding: 'base64'
    };
    const messageId = await sendMail(options);
    console.log('Account Created Message sent successfully:', messageId)
}

async function successPasswordChangeEmail(user) {

    const data = await ejs.renderFile("./templates/emailTemplates/successPassword.ejs", { userName: user.name });

    const options = {
        to: user.email,
        subject: 'Password Change Successful',
        html: data,
        textEncoding: 'base64'
    };
    const messageId = await sendMail(options);
    console.log('Successful Password Created Message sent successfully:', messageId)
    // return res.send('Email Send');
}

async function successPasswordRequestorChangeEmail(requestor) {

    const data = await ejs.renderFile("./templates/emailTemplates/successPasswordRequestor.ejs", { requestorName: requestor.name, empName: requestor.empName });

    console.log(requestor.email)

    const options = {
        to: requestor.email,
        subject: 'Account Setup Successful',
        html: data,
        textEncoding: 'base64'
    };
    const messageId = await sendMail(options);
    console.log('Successful Password Created Message sent successfully:', messageId)
    // return res.send('Email Send');
}

async function failPasswordRequestorChangeEmail(requestor) {

    const data = await ejs.renderFile("./templates/emailTemplates/expiredPasswordRequestor.ejs",
        { requestorName: requestor.name, empName: requestor.empName, empEmail: requestor.empEmail });

    console.log(requestor.email)

    const options = {
        // to: requestor.email,
        to: 'irfan@excel-pros.com',
        subject: 'Account Setup Failed',
        html: data,
        textEncoding: 'base64'
    };
    const messageId = await sendMail(options);
    console.log('Expired Password Created Message sent successfully:', messageId)
    // return res.send('Email Send');
}

app.get("/Form", authenticateToken, (req, res) => {
    res.render("pages/Form");
    console.log(req.user);
    for (let i = 0; i < 7; i++) {
        FixCalendarAvailability(i, req.user);
    }
});


async function FixCalendarAvailability(dayOffset, user) {
    var startTime = new Date();
    var endTime = new Date();

    const calendar = google.calendar({ version: 'v3', auth: await getOAuth2Client() });


    startTime.setDate(startTime.getDate());
    endTime.setDate(endTime.getDate());

    startTime.setDate(startTime.getDate() + dayOffset);
    endTime.setDate(endTime.getDate() + dayOffset);

    console.log("dayOffset", dayOffset);

    startTime.setHours(9, 0, 0, 0);
    endTime.setHours(19, 0, 0, 0);

    const index = client.initIndex('Users');

    let freeRepFound = false;
    let repFound = "";
    let minEvents = 999;
    let calId = "";
    var h;

    await index.search(user.locationId, {
        filters: 'available = 1 AND hasCalId = 1'
    }).then(async ({ hits }) => {
        for (h = 0; h < hits.length; h++) {
            console.log("Checking ", hits[h].calId, " for ", startTime);
            const events = await calendar.events.list({
                calendarId: hits[h].calId,
                timeMin: startTime.toISOString(),
                timeMax: endTime.toISOString(),
                singleEvents: true,
                orderBy: 'startTime'

            });

            if (!events.data.items || events.data.items.length === 0) {
                console.log('On ', startTime, ' ', events.data.summary, ' is Totally Free1');
                repFound = events.data.summary;
                freeRepFound = true;
                ClearMasterCalendar(startTime, endTime, user);
                break;
            }
            else {
                if (events.data.items.length < minEvents) {
                    calId = events.data.summary;
                    minEvents = events.data.items.length;
                }
            }
        }
    })
        .catch((err) => {
            console.log(err);
        });

    if (!freeRepFound) {
        const blockEvents = await calendar.events.list({
            calendarId: calId,
            timeMin: startTime.toISOString(),
            timeMax: endTime.toISOString(),
            singleEvents: true,
            orderBy: 'startTime'
        });

        for (var e = 0; e < blockEvents.data.items.length; e++) {
            let blockStart = new Date(blockEvents.data.items[e].start.dateTime);
            let blockEnd = new Date(blockEvents.data.items[e].end.dateTime);
            // console.log('Clearing Block', blockStart, '-', blockEnd, 'for ', calId);

            blockCleared = false;
            await index.search(user.locationId, {
                filters: 'available = 1 AND hasCalId = 1'

            }).then(async ({ hits }) => {
                for (h = 0; h < hits.length; h++) {
                    let userEvents = await calendar.events.list({
                        calendarId: hits[h].calId,
                        timeMin: blockStart.toISOString(),
                        timeMax: blockEnd.toISOString(),
                        singleEvents: true,
                        orderBy: 'startTime'
                    });
                    if (!userEvents.data.items || userEvents.data.items.length === 0) {
                        console.log('Block', blockStart, '-', blockEnd, 'cleared by ', userEvents.data.summary);
                        blockCleared = true;
                        ClearMasterCalendar(blockStart, blockEnd, user);
                        break;
                    }
                }
            });

            if (!blockCleared) {
                await index.search(user.locationId, {
                    filters: 'available = 1 AND hasCalId = 1'

                }).then(async ({ hits }) => {
                    for (h = 0; h < hits.length; h++) {
                        let userEvents = await calendar.events.list({
                            calendarId: hits[h].calId,
                            timeMin: blockStart.toISOString(),
                            timeMax: blockEnd.toISOString(),
                            singleEvents: true,
                            orderBy: 'startTime'
                        });
                        if (!userEvents.data.items || userEvents.data.items.length === 0) {
                            break;
                        }
                        if (userEvents.data.items.length === 1) {

                            for (var e = 0; e < userEvents.data.items.length; e++) {
                                if (new Date(userEvents.data.items[e].start.dateTime) > blockStart) {
                                    blockStart = new Date(userEvents.data.items[e].start.dateTime);
                                }
                                if (new Date(userEvents.data.items[e].end.dateTime) < blockEnd) {
                                    blockEnd = new Date(userEvents.data.items[e].end.dateTime);
                                }
                            }
                        }
                    }
                });
                BlockMasterCalendar(blockStart, blockEnd, user);
            }
        }
    }
}


async function GetUserEvents(user, startTime, endTime) {
    const calendar = google.calendar({ version: 'v3', auth: await getOAuth2Client() });
    calendar.events.list({
        calendarId: user.calId,
        timeMin: startTime.toISOString(),
        timeMax: endTime.toISOString(),
        maxResults: 10,
        singleEvents: true,
        orderBy: 'startTime',
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
        const events = res.data.items;
        if (events.length) {
            console.log(events.length, " Events Found for the day:", hit.calId, startTime, endTime);
            return events;
        } else {
            console.log('No upcoming events found.');
            return [];
        }

    });
}



async function BlockMasterCalendar(blockStart, blockEnd, user) {
    const calendar = google.calendar({ version: 'v3', auth: await getOAuth2Client() });
    calId = await getCalId(user.locationId);

    const events = await calendar.events.list({
        calendarId: calId,
        timeMin: blockStart.toISOString(),
        timeMax: blockEnd.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 10
    });

    if (!events.data.items || events.data.items.length === 0) {
        var event = {
            'summary': 'NO SALES AGENTS AVAILABLE',
            'start': {
                'dateTime': blockStart.toISOString()
            },
            'end': {
                'dateTime': blockEnd.toISOString()
            },
            'reminders': {
                'useDefault': false
            }
        };

        var request = calendar.events.insert({
            'calendarId': calId,
            'resource': event
        }, (err, res) => {
            if (err) return console.log('The API returned an error: ' + err);
            // console.log(res);
        });
        return;
    }
    for (var e = 0; e < events.data.items.length; e++) {
        if (events.data.items[e].summary == 'NO SALES AGENTS AVAILABLE') {
            // console.log('Already Blocked');
            return;
        }
    }
    var event = {
        'summary': 'NO SALES AGENTS AVAILABLE',
        'start': {
            'dateTime': blockStart.toISOString()
        },
        'end': {
            'dateTime': blockEnd.toISOString()
        },
        'reminders': {
            'useDefault': false
        }
    };

    var request = calendar.events.insert({
        'calendarId': calId,
        'resource': event
    }, (err, res) => {
        if (err) return console.log('The API returned an error: ' + err);
    });
}

async function getCalId(locationId) {
    const snapshot = await db.collection('Locations').doc(locationId).get();
    const data = snapshot.data();
    return data.calId;
}

async function ClearMasterCalendar(start, end, user) {
    const calendar = google.calendar({ version: 'v3', auth: await getOAuth2Client() });
    console.log(start, end, user);
    calId = await getCalId(user.locationId)

    const events = await calendar.events.list({
        calendarId: calId,
        timeMin: start.toISOString(),
        timeMax: end.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 10
    });
    if (!events.data.items || events.data.items.length === 0) {
        // console.log(events.config.params.timeMin, 'No Events to Delete')
        return;
    }
    // console.log(events.config.params.timeMin, events.data.items.length, ' Event(s) to Delete');
    for (var e = 0; e < events.data.items.length; e++) {
        // console.log(calId, events.data.items[e].summary, events.data.items[e].id);
        if (events.data.items[e].summary == 'NO SALES AGENTS AVAILABLE') {
            // eID = events.data.items[e].htmlLink.slice(-76);
            eID = events.data.items[e].id;
            // console.log(events.data.items[e]);
            // console.log(eID);
            calendar.events.delete({
                calendarId: calId,
                eventId: eID
            }, (err, res) => {
                if (err) return console.log('The API returned an error: ' + err);
                // console.log(res);
            });
        }
    }
}

async function isSetter(aId) {
    const snapshot = await db.collection('AccessLevels').doc(aId).get();
    const data = snapshot.data();
    if (data.Level == "Setter") {
        return true;
    }
    return false;
}

app.get("/api/getApptTimes", authenticateToken, async (req, res) => {
    var startTimes = [];
    var start = new Date(Date.parse(req.query.selectedDate));
    start.setHours(9, 0, 0, 0);
    let calId;

    for (i = 0; i < 20; i++) {
        end = new Date(start.getTime() + 90 * 60000);
        if (start > new Date()) {
            if (await isSetter(req.user.accessLevelId)) {
                calId = await getCalId(req.user.locationId);
                console.log("Looking in Location's calId - ", calId)
            }
            else {
                calId = req.user.calId;
                console.log("Looking in User's calId - ", calId)
            }

            if (await approveNextTime(calId, start, end)) {
                timeAvailable = start.toLocaleString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true });
                startTimes.push(timeAvailable);
            }
        }
        start = new Date(start.getTime() + 30 * 60000);
    }
    req = req;
    return res.status(200).send(startTimes);
});


app.get("/api/getEmail", authenticateToken, async (req, res) => {

    const Users = db.collection('Users');
    const allUsers = await Users.where('email', '==', req.query.email).get();

    let allEmailUsers = []
    allUsers.forEach(async doc => {
        data = doc.data();
        allEmailUsers.push(data)
    })

    return res.json(allEmailUsers)

});

async function approveNextTime(calId, start, end) {
    const checkTimeStart = new Date(start.getTime() + (4 * 60 * 60 * 1000));
    const checkTimeEnd = new Date(end.getTime() + (4 * 60 * 60 * 1000));
    console.log("Checking ", checkTimeStart.toISOString(), checkTimeEnd.toISOString());
    const calendar = google.calendar({ version: 'v3', auth: await getOAuth2Client() });
    const events = await calendar.events.list({
        calendarId: calId,
        timeMin: checkTimeStart.toISOString(),
        timeMax: checkTimeEnd.toISOString(),
        singleEvents: true,
        orderBy: 'startTime',
        maxResults: 10
    });
    if (!events.data.items || events.data.items.length === 0) {
        return true;
    }
    return false;
}


function authenticateToken(req, res, next) {
    if (!req.cookies.access_token) {
        //res.render('../views/pages/login')
        res.redirect('/login')
        return;
    }
    const token = req.cookies.access_token; //Issue
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, user) => {
        if (err) {
            res.redirect('/login')
            return;
        };
        req.user = user;
        next();
    })
};


app.listen(port, _ => {
    console.log(`Server running at ${port}`);
    Authorize();
});




app.get('/views/leads', authenticateToken, async (req, res) => {

    isAllowed = await isAllowedToView3('viewLeads', req.user);
    if (parseInt(isAllowed.rank) > 1) {

        const Users = db.collection('Users');

        const usersSnap = await Users.where('email', '==', req.user.email).get()
        let user;
        usersSnap.forEach(doc => {
            user = doc.data();
        });

        const index = client.initIndex('Users');
        canViewUsers = await isAllowedToView3('viewUsers', req.user)
        console.log('canview' + canViewUsers.rank)
        let hits = []
        let users = []
        // index.search(" " + canViewUsers.id).then(async ({ hits }) => {
        index.browseObjects({
            query: canViewUsers.id,
            batch: batch => {
                hits = hits.concat(batch);
            }
        }).then(async () => {
            console.log("hits length= " + hits.length)

            if(canViewUsers.rank > 1){
                users = hits
            }

            users.sort(function (person1, person2) {
                return person1.name.localeCompare(person2.name);
            });

            let allApptOutcomes = [];
            const appointmentOutcomes = await db.collection("AppointmentOutcomes").get();
            appointmentOutcomes.forEach(doc => {
                apptOutcome = doc.data();
                apptOutcome.id = doc.id;
                allApptOutcomes.push(apptOutcome)
            })

            await isAdminUser(user, () => {

                data = {
                    admin: user.admin,
                    manager: user.manager
                };
                res.render('pages/leads', {
                    data, users, allApptOutcomes
                })
            })
        })
            .catch((err) => {
                console.log(err);
            });

    }
})

app.get('/leads', authenticateToken, async (req, res) => {
    try {
        // will be undefined in first call
        const Users = db.collection('Users');
        const usersSnap = await Users.where('email', '==', req.user.email).get();

        usersSnap.forEach(doc => {
            user = doc.data();
            user.id = doc.id;
        });

        let allApptOutcomes = [];
        const appointmentOutcomes = await db.collection("AppointmentOutcomes").get();
        appointmentOutcomes.forEach(doc => {
            apptOutcome = doc.data();
            apptOutcome.id = doc.id;
            allApptOutcomes.push(apptOutcome)
        })
        let reqId = req.query.reqId;

        console.log(req.query.statusFilters)
        console.log(req.query.userFilters)

        let filterStr = ''
        if (req.query.statusFilters != undefined) {
            filtersArr = req.query.statusFilters
            for (let i = 0; i < filtersArr.length; i++) {
                if (i == 0) {
                    filterStr += '(status:\"' + filtersArr[i] + '\"'
                } else {
                    filterStr += ' OR status:\"' + filtersArr[i] + '\"'
                }
                if (i == filtersArr.length - 1) {
                    filterStr += ')'
                }
            }
        }

        if (req.query.userFilters != undefined) {
            filtersArr = req.query.userFilters

            if (filterStr != '') {
                filterStr += ' AND '
            }

            for (let i = 0; i < filtersArr.length; i++) {
                if (i == 0) {
                    filterStr += '(rep:\"' + filtersArr[i] + '\" OR setter:\"' + filtersArr[i] + '\"'
                } else {
                    filterStr += ' OR rep:\"' + filtersArr[i] + '\" OR setter:\"' + filtersArr[i] + '\"'
                }
                if (i == filtersArr.length - 1) {
                    filterStr += ')'
                }
            }
        }

        const index = client.initIndex('Leads');
        canView = await isAllowedToView3('viewLeads', req.user)

        if (canView.rank == 2) {
            if (filterStr != '') {
                filterStr += ' AND '
            }
            filterStr += '(rep:\"' + req.user.id + '\" OR setter:\"' + req.user.id + '\")'
        }

        if (canView.rank == 3) {
            if (filterStr != '') {
                filterStr += ' AND '
            }
            filterStr += 'locationId: \"' + req.user.locationId + '\"'
        }
        console.log('filterStr = ' + filterStr)

        let hits = [];
        if (req.query.leadInput == '') {
            index.browseObjects({
                query: '',
                filters: filterStr,
                batch: batch => {
                    hits = hits.concat(batch);
                }
            })
                .then(async () => {
                    console.log('Query Returned', hits.length, 'Records - Browsing');
                    for (let h = 0; h < hits.length; h++) {
                        let setter = await getUser(hits[h].setter);
                        hits[h].setter = setter
                    }

                    console.log('Users Joined');

                    // sorts by date (newest to oldest)
                    hits.sort((a, b) => {
                        let da = new Date(a.dateCreated),
                            db = new Date(b.dateCreated);
                        return db - da;
                    });

                    console.log('Got data for ', reqId);
                    return res.json({
                        hits: hits,
                        allApptOutcomes: allApptOutcomes,
                        reqId: reqId
                    });
                })
                .catch((err) => {
                    console.log(err);
                });
        } else {
            index.search(req.query.leadInput, {
                filters: filterStr
            }).then(async ({ hits }) => {
                console.log('Query Returned', hits.length, 'Records - Searching');
                for (let h = 0; h < hits.length; h++) {
                    let setter = await getUser(hits[h].setter);
                    hits[h].setter = setter
                }

                // sorts by date (newest to oldest)
                hits.sort((a, b) => {
                    let da = new Date(a.dateCreated),
                        db = new Date(b.dateCreated);
                    return db - da;
                });

                console.log('Got data for ', reqId);
                return res.json({
                    hits: hits,
                    allApptOutcomes: allApptOutcomes,
                    reqId: reqId
                });
            })
                .catch((err) => {
                    console.log(err);
                });
        }
    }
    catch {
        res.status(500).send();
    }
});


app.get('/reportData', authenticateToken, async (req, res) => {
    try {

        canView = await isAllowedToView3('viewLeadsLeaderboard', req.user)
        console.log(canView.id)

        let allApptOutcomes = [];
        const appointmentOutcomes = await db.collection("AppointmentOutcomes").get();
        appointmentOutcomes.forEach(doc => {
            apptOutcome = doc.data();
            apptOutcome.id = doc.id;
            allApptOutcomes.push(apptOutcome)
        })

        const usersIndex = client.initIndex('Users');
        const leadsIndex = client.initIndex('Leads');

        let obj = {};
        obj.allApptOutcomes = allApptOutcomes;


        //req.query.leadInput + " " + canView.id
        completeObj = await usersIndex.search("" + canView.id).then(async ({ hits }) => {
            obj.usersAndLeads = hits
            for (let h = 0; h < obj.usersAndLeads.length; h++) {
                await leadsIndex.search('', {
                    filters: 'setter: ' + obj.usersAndLeads[h].objectID + ' OR rep: ' + obj.usersAndLeads[h].objectID
                }).then(async ({ hits }) => {
                    obj.usersAndLeads[h].leads = hits
                }).catch((err) => {
                    console.log(err);
                });
            }
        })
            .catch((err) => {
                console.log(err);
            });

        return res.json(obj)
    }
    catch {
        res.status(500).send();
    }
});

// app.get('/leaderboard', authenticateToken, async (req, res) => {
async function getCloserLeaderboardData() {
    let userLeaderBoard = []
    var setterDocId = "", soldId = "";

    const setterAccessLevel = await db.collection('AccessLevels').where('Level', '==', 'Setter').get();
    // outer loop runs once (necessary to get setter's doc id)
    for (doc of setterAccessLevel.docs) {
        setterDocId = doc.id;

        const sold = await db.collection('AppointmentOutcomes').where('name', '==', 'Sold').get();
        // outer loop runs once (necessary to get sold status doc id)
        for (doc of sold.docs) {
            soldId = doc.id;

            // all closers
            const closers = await db.collection('Users').where('accessLevel', '!=', setterDocId).get();

            for (doc of closers.docs) {
                closerData = doc.data()
                const closerSoldLeads = await db.collection('Leads').where('rep', '==', doc.id).where('status', '==', soldId).get();
                const locationName = await db.collection('Locations').doc(closerData.locationId).get();

                locationData = locationName.data()
                soldSize = closerSoldLeads.size

                if (soldSize != 0) {
                    userLeaderBoard.push({
                        name: closerData.name,
                        sold: soldSize,
                        location: locationData.name
                    })
                }

            }
        }
    }

    userLeaderBoard.sort((a, b) => {
        return b.sold - a.sold;
    });
    return userLeaderBoard
}

async function getSetterLeaderboardData() {
    let userLeaderBoard = []
    var setterDocId = "", soldId = "", sitId = "";

    const setterAccessLevel = await db.collection('AccessLevels').where('Level', '==', 'Setter').get();
    // outer loop runs once (necessary to get setter's doc id)
    for (doc of setterAccessLevel.docs) {
        setterDocId = doc.id;

        soldId = await getStatusId('Sold')
        sitId = await getStatusId('Sit')

        // all setters
        const setters = await db.collection('Users').where('accessLevel', '==', setterDocId).get();

        for (doc of setters.docs) {
            setterData = doc.data()
            const setterSitOrSoldLeads = await db.collection('Leads').where('setter', '==', doc.id).where('status', 'in', [soldId, sitId]).get();
            const locationName = await db.collection('Locations').doc(setterData.locationId).get();

            locationData = locationName.data()
            soldOrSitSize = setterSitOrSoldLeads.size

            if (soldOrSitSize != 0) {
                userLeaderBoard.push({
                    name: setterData.name,
                    soldOrSit: soldOrSitSize,
                    location: locationData.name
                })
            }

        }
    }

    userLeaderBoard.sort((a, b) => {
        return b.soldOrSit - a.soldOrSit;
    });

    return userLeaderBoard

}



async function uploadFile(fileObject) {
    const bufferStream = new stream.PassThrough();
    bufferStream.end(fileObject.buffer);
    const { data } = await google.drive({ version: 'v3', auth: await getOAuth2Client() }).files.create({
        media: {
            mimeType: fileObject.mimeType,
            body: bufferStream,
        },
        requestBody: {
            name: fileObject.originalname,
            // parents: ['1LUGuZD0AMTiChdxnVjbkXQ6ce2scMJuS'],
        },
        // fields: 'id,name',
    });
    makeFilePublic(data.id);
    return data.id;
};

async function makeFilePublic(fileId) {
    try {
        await google.drive({ version: 'v3', auth: await getOAuth2Client() }).permissions.create({
            fileId: fileId,
            requestBody: {
                role: 'reader',
                type: 'anyone'
            }
        })
        const result = await drive({ version: 'v3', auth: await getOAuth2Client() }).files.get({
            fileId: fileId,
            fields: 'webViewLink , webContentLink'
        })

        console.log(result.data)
    } catch (error) {
        console.log(error.message);
    }

}


