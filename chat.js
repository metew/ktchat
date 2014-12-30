var express = require('express'),
app = express(),
server = require('http').createServer(app),
io = require('socket.io')(server);

var allowCrossDomain = function (req, res, next) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

    res.header('Cache-Control', 'no-cache, private, no-store, must-revalidate, max-stale=0, post-check=0, pre-check=0');
    next();
}

app.use(allowCrossDomain);
app.use(express.static(__dirname + "/"));

app.get('/', function(req, res){
res.sendFile(__dirname+'/index.html')
});

function ktSocket(socketid) { this.socketid = socketid; }
function ktSocketGroup() { this.countUsers = 0; this.countMessages = 0; this.countBroadcasts = 0; }
function ktMessage() { this.socketId = ''; this.group =''; this.data = ''; }

var arrGroups = { global: new ktSocketGroup() };

//function arrCleaner(group) {
//    for (var i = arrGroups.length; i >= 0; i--) {
//        if (arrGroups[i].countUsers < 0) {
//            arrGroups.splice(i, 1);
//        }
//    }
//}
function arrCleaner(group) {
    if (arrGroups[group].countUsers < 0) {
        delete arrGroups[group];
    }
}

io.on('connection', function (socket) {
    /*
    socket.broadcast.to('global') // all but you
    io.sockets.in('global') // everyone
    */

    //connection callback
    io.sockets.in(socket.id).emit('getSocket', new ktSocket(socket.id));

    //instructions
    var message = new ktMessage();
    message.socketId = 'SYSTEM:</br>';
    message.data = 'Private Message: @someone</br>Group Message: #groupname';
    io.sockets.in(socket.id).emit('broadcastMessage', message);

    //default connection
    socket.join('global'); arrGroups['global'].countUsers += 1; 
    socket.join(socket.id.substring(0,6));
    socket.broadcast.to('global').emit('hubJoinMessage', socket.id);  

    //default disconnect
    socket.on('disconnect', function () { arrGroups['global'].countUsers -= 1; io.sockets.in('global').emit('hubLeaveMessage', socket.id); });

    //group management
    socket.on('joinGroup', function (group) { socket.join(group); arrGroups[group] == null ? arrGroups[group] = new ktSocketGroup() : arrGroups[group].countUsers += 1; socket.emit('hubJoinMessage', group); });
    socket.on('leaveGroup', function (group) { socket.leave(group); arrGroups[group].countUsers -= 1; arrCleaner(group); socket.emit('hubLeaveMessage', group); });

    //broadcast global
    socket.on('send', function (data) {
        var message = new ktMessage();
        message.socketId = socket.id;
        message.data = data;
        io.sockets.in('global').emit('broadcastMessage', message);

        //counters
        arrGroups['global'].countMessages += 1;
        arrGroups['global'].countBroadcasts += arrGroups['global'].countUsers;
    });

    //broadcast group
    socket.on('sendGroup', function (group, data) {
        var message = new ktMessage();
        message.socketId = socket.id;
        message.group = group;
        message.data = data;
        io.sockets.in(group).emit('broadcastGroup', message);

        //counters
        arrGroups[group] == null ? arrGroups[group] = new ktSocketGroup() : arrGroups[group].countMessages += 1;
        arrGroups[group].countBroadcasts += arrGroups[group].countUsers;
    });

    //broadcast Auction
    socket.on('sendAuction', function (group, data) {
        var message = new ktMessage();
        message.socketId = socket.id;
        message.data = data;
        io.sockets.in(group).emit('broadcastAuction', message);

        //counters
        arrGroups[group] == null ? arrGroups[group] = new ktSocketGroup() : arrGroups[group].countMessages += 1;
        arrGroups[group].countBroadcasts += arrGroups[group].countUsers;
    });

    //broadcast group
    socket.on('sendPrivate', function (group, data) {
        var message = new ktMessage();
        message.socketId = socket.id;
        message.data = data;
        io.sockets.in(group).emit('broadcastPrivate', message);
        var message2 = message;
        message2.data = '@' + group + message2.data;
        socket.emit('broadcastPrivate', message2);
    });

    //utility
    socket.on('serverInfo', function (rqst) {
        var message = new ktMessage();
        message.socketId = 'SYSTEM:<br/>';
        if (rqst == 'all') { message.data = JSON.stringify(arrGroups); }
        else if (rqst == 'id') { message.data = JSON.stringify(socket.id); }
        else if (rqst.split('.')[1] == 'info') { message.data = JSON.stringify(arrGroups[rqst.split('.')[0]]); }
        else if (rqst.split('.')[1] == 'sockets') { message.data = JSON.stringify(io.sockets.adapter.rooms[rqst.split('.')[0]]); }
        else { message.data = 'Invalid Request' }
        socket.emit('broadcastMessage', message);
    });
});

//taskkill /im node.exe /f
//killall node
server.listen(3001);