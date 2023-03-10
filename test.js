



function AddNewAccessLevel(){
    await db.collection('AccessLevels').add({AccessLevelAccess})
    .then((data) => {
        newAccessLevelId = data.id 
    });
    await db.collection('SubAccesses').get()
    .then((data) => {
        data.foreach(datum => {
            sId = datum.id
            AccessLevelAccess = {
                subAccessId: sId,
                accessLevelId: newAccessLevelId,
                accessVal: req.params.accessVal
            }
            await db.collection('AccessLevelAccess').add({AccessLevelAccess})
        })
    });
}


