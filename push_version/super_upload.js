var http = require('http');
var querystring = require('querystring');
var multipart = require('multipart');
var url = require('url');
var path = require('path');
var mime = require('mime');
var fs = require('fs');
var util = require('util');
var io = require('socket.io');

/*
 * Simple UUID generator as per RFC4122. This generator actually does not require
 * a central authority (i.e., could be used on the client side). It is however
 * useful to have it on the server to easily generate unique id's used to create
 * unique folders in th'e filesystem
 */
//=============================================================================
function genUUID() {
  	var chars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'.split('');
  	var uuid = [];
  	// rfc4122, version 4 form
  	var r;
  	// rfc4122 requires these characters
  	uuid[8] = uuid[13] = uuid[18] = uuid[23] = '-';
  	uuid[14] = '4';

  	// Fill in random data.  At i==19 set the high bits of clock sequence as
  	// per rfc4122, sec. 4.1.5
  	for (i = 0; i < 36; i++) {
    	if (!uuid[i]) {
        	r = 0 | Math.random()*16;
        	uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
      	}
  	}
  	return uuid.join('');
}
//=============================================================================
/*
 * Simple wrapper for logging with timing information
 * httpReq is not needed actually, will be checked
 * if it's actually passed as an argument
 */
function Logger(str, httpReq) {
	var t;
	var formattedDate;
	function setup(str, httpReq) {
		t = new Date();
		formattedDate = t.getFullYear() + '/' + (t.getMonth() + 1) + '/' + t.getDate() + '/' + t.toLocaleTimeString() + ' (remote: ' + (httpReq ? httpReq.socket.remoteAddress : '') + '): ';
	}
	this.debug = function(str, httpReq) {
		setup(str, httpReq);
		console.log('[DEBUG]: ' + formattedDate + str);
	}
	this.warn = function(str, httpReq) {
		setup(str, httpReq);
		console.log('[WARN]: ' + formattedDate + str);
	}
	this.error = function(str, httpReq) {
		setup(str, httpReq);
		console.log('[ERROR]: ' + formattedDate + str);
	}
}
//===============================================================================
/*
 * Creates the HTTP server and routes the requests to the appropriate handles
 *
 */
var serverHTTP = http.createServer(function (req, res) {
	
	req.parsedUrl = url.parse(req.url);
  	req.parsedUrl.parsedQuery = querystring.parse(req.parsedUrl.query || '');

  	logger.debug('Request for url: ' + req.url, req);

  	switch (req.parsedUrl.pathname) {
		case '/done':
	  		handleDone(req, res);
	  		break;
		case '/download':
	  		handleDownload(req, res);
	  		break;
    	case '/upload': 
      		handleUpload(req, res);
	  		break;
    	default:
      		handleStaticFile(req, res);
  }
});

var serverAddress = '79.168.102.155';
//var serverAddress = 'localhost';
var serverPort = 8080;
var clientMap = {};
var logger = new Logger();
var socket = io.listen(serverHTTP);
serverHTTP.listen(serverPort, serverAddress);

//======================== SOCKET HANDLING =====================================
/*
 * Generates ID's to use as client-server communication. Since we store them in
 * an array for quick access, we want to keep this array as small as possible
 * and, to avoid resizing of the array, we simply reuse the id's as soon as they
 * are free, allowing for automatic cleanup
 */
function idGenerator() {
	var stack = new Array();
	var maxID = 0;
	this.getId = function() {
		var value = stack.pop(); 
	   	if (value == undefined) {
			//Queue is empty, new ID needed
			return maxID++;
		} else {
			return value;
		}
	}
	this.releaseId = function(id) {
		stack.push(id);
	}
}
var idGen = new idGenerator();

//==============================================================================
/*
 * Called upon client connection, it negotiates a unique id for the session
 * (we actually use only a very simple and short id in the client-server communication
 * as it is smaller and unique) and deals with the assignment of id's to the clients
 *
 */
socket.sockets.on('connection', function (client) {
	//Client connects, we create him a unique id
	//which is used in the session
	var uuid;
	var validUUID = false;
	//Make sure this is a valid id, i.e., path does not exist
	do {
		uuid = genUUID();
		validUUID = !path.existsSync(path.join(__dirname, 'uploads', uuid));
	} while(!validUUID);
	
	var sessId = idGen.getId();
	client.sessId = sessId;
	
	clientMap[sessId] = {
		percent: 0,
		url: '',
		id: uuid,
		state: 'none',
		error: 0
	}
	logger.debug('Client connected with sessId: ' + sessId + ' , clientId: ' + client.id + ' and folder: ' + uuid);
	client.emit('sessionID', sessId);
	
	client.on('disconnect', function() {
		//Remove from the client map
		logger.debug('Client disconnected: ' + client.sessId + ' and id: ' + client.id);
		idGen.releaseId(client.sessId);
	});
});

//==============================================================================
/*
 * Callback done every second. It loops through all the connected clients
 * 
 */
function sendMessages() {
	setTimeout(sendMessages,1000);
	for(var i=0; i<socket.sockets.clients().length; i++) {
		var sock = socket.sockets.clients()[i];
		if(sock) {
			var client = clientMap[sock.sessId];
			switch(client.state) {
				case 'none':
					break;
				case 'progress':
					logger.debug('Sending progress');
					sock.emit('progress',client.percent);
					break;
				case 'url':
					sock.emit('progress',100);
					sock.emit('url',client.url);
					client.state = 'wait-description'
					break;
				case 'wait-description':
					logger.debug('Waiting for description from: ' + sock.sessId);
					break;
				case 'done':
					break;
				default:
					logger.error('Unknown state!');
			}
		}
	}
}
sendMessages();

//==============================================================================
/*
 * Handler for server static files
 *
 */
function handleStaticFile(req, res) {
	var filePath = '.' + req.url;
  	if (filePath == './') {
    	filePath = './static/index.html';
  	}
	path.exists(filePath, function(fileExists) {
    	if (fileExists) {
    		fs.readFile(filePath, function(error, content) {
    			if (error) {
        			res.writeHead(500);
          			res.end();
        		} else {
          			var contentType = 'text/html';
          			if (filePath.substr(-3) == '.js')
            			contentType = 'application/javascript';
          			var encoding = 'utf-8';
          			res.writeHead(200, {'Content-Type': contentType});
          			res.end(content, encoding);
       			}
      		});
    	} else {
    		logger.error('Requested page not found: ' + filePath, req);
			res.writeHead(404);
			res.end()
    	}
	})
}

//==============================================================================
/*
 * Handler for the description submission. Creates a file description.txt
 * in the same folder as the file and answers back to the client a
 * pre-formatted html message with the description and filepath
 */
function handleDone(req, res) {
	
	res.writeHead(200, {'Content-Type': 'text/html'})
	
	var fullBody = '';
	req.on('data', function(chunk) {
		fullBody += chunk.toString();
	});
	
	req.on('end', function() {
		// parse the received body data
	    var decodedBody = querystring.parse(fullBody);
		// at this point the directory is already created
		var fullPathFileName = path.join(__dirname, 'uploads', clientMap[req.parsedUrl.parsedQuery.upload_uuid].id, 'description.txt');
		var fileStream = fs.createWriteStream(fullPathFileName);
	    fileStream.write(decodedBody.descriptionText,'utf-8');
		fileStream.end();
		
		// notify end state
		clientMap[req.parsedUrl.parsedQuery.upload_uuid].state = 'done';
	
	    // output the decoded data to the HTTP response          
	    res.write('<br><br>Thank you for using SuperUpload! Your file has been stored at: <br><br>');
		res.write(clientMap[req.parsedUrl.parsedQuery.upload_uuid].url);
	    res.write('<br><br>Along with the description:<br>"');
	    res.write(decodedBody.descriptionText + '"');
	    res.end();
	 });
}

//==============================================================================
/*
 * Handler for the file download. Upon requesting a file, the server
 * will look it up and start sending it to the client in chunks. 
 * If the file does not exist on our server, the client is informed 
 * of that
 */
function handleDownload(req, res) {

	var file = path.join('uploads',req.parsedUrl.parsedQuery.file);
	var filename = path.basename(file);
	var mimetype = mime.lookup(file);
	
	logger.debug('Downloading file: ' + file, req);
	
	path.exists(file, function(exists) {
		if(exists) {
			res.setHeader('Content-disposition', 'attachment; filename=' + filename);
			res.setHeader('Content-type', mimetype);

			var readStream = fs.createReadStream(file,{'flags': 'r', 'encoding': 
		                              				   'binary', 'mode': 0666});
		
			//Pump is a very useful function in utils that does throttling of
			//the reading (in readStream) to the response so that it does
			//not send out too much data at once!
			util.pump(readStream, res);
		} else {
			logger.error('Failed downloading file: ' + req.parsedUrl, req);
			res.writeHead(404);
			res.end('File not found, please check your download link!');
		}
	});
}

//==============================================================================
function parseMultipart(req, uploadUUID) {
	var parser = multipart.parser();

    // Make parser use parsed request headers
    parser.headers = req.headers;

    // Add listeners to request, transfering data to parser
	req.addListener('data', function(chunk) {
		//Since the data comes in async, perhaps
		//the stream was closed from another side
		//and we check that here
        if(clientMap[uploadUUID].error == 0) {
			parser.write(chunk);
		}
    });

    req.addListener('end', function() {
		logger.debug('DATA END');
    	parser.close();
    });

    return parser;
}

//==============================================================================
/*
 * Handler for the file uploading. Makes sure that the user has a valid uuid,
 * initializes the progress array, and starts receiving data if all the conditions
 * are met.
 * Upon completion sends back a simple HTTP response: Upload successful!
 * A lot of error conditions are checked here such as permission to create directory,
 * ability to write the file to disk, etc.
 */
function handleUpload(req, res) {
	var uploadUUID = req.parsedUrl.parsedQuery.upload_uuid;
 	if (!uploadUUID || !clientMap[uploadUUID] || clientMap[uploadUUID].state == 'done') {
		logger.error('No valid uploadUUID or multiple request?!?', req);
		res.writeHead(200, {'Content-Type': 'text/html'});   		
		res.end('No valid uploadUUID');
		return;
 	}

 	clientMap[uploadUUID].state = 'progress';
	res.writeHead(200, {'Content-Type': 'text/html'});
	
    // Request body is binary
    req.setEncoding('binary');

    // Handle request as multipart
    var stream = parseMultipart(req, uploadUUID);

	//Check all the prerequisites to find out if we can really store the file!

	// This is a sync call so it can actually block! For simplicity purposes in this case, we use
	// this call. This call should never fail because we checked before that the dir can be created
	// but one never knows...
	try {
		var dirName = path.join(__dirname, 'uploads', clientMap[uploadUUID].id);
		fs.mkdirSync(dirName, 0755);
	} catch(err) {
		logger.error('Could not create dir: ' + dirName);
		res.end('Sorry, your upload has failed. Could not create directory: ' + dirName);
		return;
	}
	
    var fileStream = null;
	var fileName = null;
    var totalSoFar = 0;
    var fileSize = 0;

	logger.debug('handling!!!');

	
    // Set handler for a request part received
    stream.onPartBegin = function(part) {

    	fileSize = part.parent.headers['content-length'];
  		fileNameUnparsed = stream.part.filename;
		//I have tested the parser and some filenames are not correctly
		//validated... for instance, if they contain ',' no filename
		//appers
		if(typeof stream.part.filename === 'undefined') {
			logger.debug('closing the stream');
			res.end('Sorry we could not parse the filename, try again!');
			clientMap[uploadUUID].error = 1;
			stream.close();
			return;
		}
		
		
		//While testing IE on a virtual machine, it does not seem to report the 
		//filename properly... reports full path (with unescaped // and \\)
		//so we use this to remove all these annoyances
		fileName = fileNameUnparsed.replace(/\\/g,'').replace(/\//g,'').replace(/\s/g, '');

		logger.debug('Trying to create file, name=' + part.name + ', size=' + fileSize + ' filename=' + fileNameUnparsed + ' dir=' + dirName + 'len=' + fileSize + ' parsed=' + fileName, req);
        
		var fullPathFileName = path.join(dirName,fileName);
		fileStream = fs.createWriteStream(fullPathFileName);
		
		fileStream.addListener('error', function(err) {
            logger.error('Got error while writing to file ' + fileName + ': ' + err, req);
			clientMap[uploadUUID].error = 1;
			res.end('Sorry, your upload has failed. Could not write to disk... full? Please refresh the page and try again!');
        });

        //' Add drain (all queued data written) handler to resume receiving request data
        fileStream.addListener('drain', function() {
			try {
				req.resume();			
			} catch(err) {
				clientMap[uploadUUID].error = 1;
				logger.error('Sorry, your upload has failed. File too big? ' + err, req);
				res.end('Sorry, your upload has failed. File too big? ' + err);
			}
        });
    };

	stream.onErr = function() {
		logger.error('Error receiving data, client closed the browser?!', req);
	}

    // Set handler for a request part body chunk received
    stream.onData = function(chunk) {
		req.pause();
		totalSoFar += chunk.length;
    	var percent = (totalSoFar/fileSize*100).toFixed(2);

        // Write chunk to file and update progress
        fileStream.write(chunk, 'binary');
		clientMap[uploadUUID].percent = percent;
    };

    // Set handler for request completed
    stream.onEnd = function(chunk) {
        // As this is after request completed, all writes should have been queued by now
        // So following callback will be executed after all the data is written out
 		if(fileStream) {
			fileStream.addListener('drain', function() {
				// Close file stream
        		fileStream.end();
        		// Handle request completion, as all chunks were already written
        		clientMap[uploadUUID].url = ('http://' + serverAddress + ':' + serverPort + '/download?file=' + clientMap[uploadUUID].id + '/' + fileName); 
				clientMap[uploadUUID].state = 'url';
				logger.debug('Done uploading file and made it available on: ' + clientMap[uploadUUID].url, req);
				res.write('Upload successful!');
				res.end();
			})
		}	
    };
}
