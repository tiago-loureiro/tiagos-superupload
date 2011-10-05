var http = require('http');
var querystring = require('querystring');
var multipart = require("multipart");
var url = require('url');
var path = require('path');
var mime = require('mime');
var fs = require('fs');
var utils = require('util');

var serverAddress = "79.168.69.129";
//var serverAddress = "localhost";
var serverPort = 8080;
var progressArray = {};


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
		formattedDate = t.getFullYear() + "/" + (t.getMonth() + 1) + "/" + t.getDate() + "/" + t.toLocaleTimeString() + " (remote: " + (httpReq ? httpReq.socket.remoteAddress : "") + "): ";
	}
	this.debug = function(str, httpReq) {
		setup(str, httpReq);
		console.log("[DEBUG]: " + formattedDate + str);
	}
	this.warn = function(str, httpReq) {
		setup(str, httpReq);
		console.log("[WARN]: " + formattedDate + str);
	}
	this.error = function(str, httpReq) {
		setup(str, httpReq);
		console.log("[ERROR]: " + formattedDate + str);
	}
}
var logger = new Logger();

/*
 * Creates the HTTP server and routes the requests to the appropriate handles
 *
 */
var serverHTTP = http.createServer(function (req, res) {
	
	req.parsedUrl = url.parse(req.url);
  	req.parsedUrl.parsedQuery = querystring.parse(req.parsedUrl.query || '');

  	logger.debug("Request for url: " + req.url, req);

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
    	case '/progress': 
      		handleProgress(req, res);
      		break;
    	default:
      		handleStaticFile(req, res);
  }
}).listen(serverPort, serverAddress);

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
    		logger.error("Requested page not found: " + filePath, req);
			res.writeHead(404);
			res.end()
    	}
	})
}

/*
 * Handler for the description submission. Creates a file description.txt
 * in the same folder as the file and answers back to the client a
 * pre-formatted html message with the description and filepath
 */
function handleDone(req, res) {
	
	res.writeHead(200, "OK", {'Content-Type': 'text/html'})
	
	var fullBody = '';
	req.on('data', function(chunk) {
		fullBody += chunk.toString();
	});
	
	req.on('end', function() {
		// parse the received body data
	    var decodedBody = querystring.parse(fullBody);
		// at this point the directory is already created
		var fullPathFileName = path.join(__dirname, "uploads", req.parsedUrl.parsedQuery.upload_uuid, "description.txt");
		var fileStream = fs.createWriteStream(fullPathFileName);
	    fileStream.write(decodedBody.descriptionText,"utf-8");
		fileStream.end();
	
	    // output the decoded data to the HTTP response          
	    res.write("<br><br>Thank you for using SuperUpload! Your file has been stored at: <br><br>");
		res.write(progressArray[req.parsedUrl.parsedQuery.upload_uuid].url);
	    res.write("<br><br>Along with the description:<br>'");
	    res.write(decodedBody.descriptionText + "'");
	    res.end();
	 });
}

/*
 * Handler for the file download. Upon requesting a file, the server
 * will look it up and start sending it to the client in chunks. 
 * If the file does not exist on our server, the client is informed 
 * of that
 */
function handleDownload(req, res) {

	var file = path.join("uploads",req.parsedUrl.parsedQuery.file);
	var filename = path.basename(file);
	var mimetype = mime.lookup(file);
	
	logger.debug("Downloading file: " + file, req);
	
	path.exists(file, function(exists) {
		if(exists) {
			res.setHeader('Content-disposition', 'attachment; filename=' + filename);
			res.setHeader('Content-type', mimetype);

			fs.createReadStream(file,{'flags': 'r', 'encoding': 
		                              'binary', 'mode': 0666})

			.addListener("data", function(chunk){
		        res.write(chunk, 'binary');
		   	})
		   	.addListener("close",function() {
		     	res.end();
		   	})
		} else {
			logger.error("Failed downloading file: " + req.parsedUrl, req);
			res.writeHead(404);
			res.end("File not found, please check your download link!");
		}
	});
}

/*
 * Handler for the progress requested by the webrowser. It looks up our
 * progress in the progressArray lookup table and sends that value back
 * to the client.
 * Upon completion, the client will request the url (show_name=true)
 * and this is instead sent back to the client
 */
function handleProgress(req, res) {
	if (req.parsedUrl.parsedQuery.show_name) {
   		//Upload is done, report back the URL
		var progress = progressArray[req.parsedUrl.parsedQuery.upload_uuid];
   		res.writeHead(200, {'Content-Type': 'text/plain'})
     	res.end(progress.url);
   		return;
 	}
 	var uploadUUID = req.parsedUrl.parsedQuery.upload_uuid;
 	var progress = progressArray[uploadUUID] ? progressArray[uploadUUID].percent : 0;
 	res.writeHead(200, {'Content-Type': 'text/plain'});
 	res.write(""+progress);
 	res.end();
}

function parseMultipart(req) {
	var parser = multipart.parser();

    // Make parser use parsed request headers
    parser.headers = req.headers;

    // Add listeners to request, transfering data to parser
	req.addListener("data", function(chunk) {
        parser.write(chunk);
    });

    req.addListener("end", function() {
    	parser.close();
    });

    return parser;
}

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
 	if (!uploadUUID || progressArray[uploadUUID] != null) {
		logger.error('No valid uploadUUID or multiple request?!?', req)
   		progressArray[uploadUUID].percent = -1;
   		return;
 	}
 	progressArray[uploadUUID] = {
   		percent: 0,
   		url: "",
 	}
	//We must enforce no-cache otherwise IE will cache our requests
	//and progress requests will not be sent out
	//res.writeHead(200, {'Content-Type': 'text/html',
	//	'Cache-Control': 'no-cache, no-store, max-age=0, must-revalidate'})
	res.writeHead(200, {'Content-Type': 'text/html'});
	logger.debug('Inited UUID: ' + uploadUUID, req);
	
    // Request body is binary
    req.setEncoding("binary");

    // Handle request as multipart
    var stream = parseMultipart(req);

    var fileStream = null;
	var fileName = null;
    var totalSoFar = 0;
    var fileSize = 0;
	
    // Set handler for a request part received
    stream.onPartBegin = function(part) {

    	fileSize = part.parent.headers['content-length'];
  		fileNameUnparsed = stream.part.filename;

		//While testing IE on a virtual machine, it does not seem to report the 
		//filename properly... reports full path (with unescaped // and \\)
		//so we use this to remove all these annoyances
		fileName = fileNameUnparsed.replace(/\\/g,'').replace(/\//g,'').replace(/\s/g, "");

		
		var dirName = path.join(__dirname, "uploads", uploadUUID);
		logger.debug("Trying to create file, name=" + part.name + ", filename=" + fileNameUnparsed + " dir=" + dirName + "len=" + fileSize + " parsed=" + fileName, req);
		// This is a sync call so it can actually block! For simplicity purposes in this case, we use
		// this call. If the call fails, then it's likely due to already existing UUID and we cancel
		// the upload
		try {
			fs.mkdirSync(dirName, 0755);
		} catch(err) {
			logger.error('Could not create dir: ' + dirName);
			res.writeHead(500);
			res.end('Sorry, your upload has failed. Duplicate UUID! Please refresh the page and try again!');
		}

        
		var fullPathFileName = path.join(dirName,fileName);
		fileStream = fs.createWriteStream(fullPathFileName);
		
		fileStream.addListener("error", function(err) {
			progressArray[uploadUUID].percent = -1;
            logger.error("Got error while writing to file '" + fileName + "': ", err);
			//res.writeHead(500);
			res.end('Sorry, your upload has failed. Could not write to disk... full? Please refresh the page and try again!');
        });

        // Add drain (all queued data written) handler to resume receiving request data
        fileStream.addListener("drain", function() {
			try {
				req.resume();			
			} catch(err) {
				progressArray[uploadUUID].percent = -1;
				logger.error("Sorry, your upload has failed. File too big? " + err, req);
				//res.writeHead(200);
				res.end("Sorry, your upload has failed. File too big? " + err);
				return;
			}
        });
    };

	stream.onErr = function() {
		logger.error("Error receiving data, client closed the browser?!", req);
	}

    // Set handler for a request part body chunk received
    stream.onData = function(chunk) {
        req.pause();
		totalSoFar += chunk.length;
    	var percent = (totalSoFar/fileSize*100).toFixed(2);

        // Write chunk to file and update progress
        fileStream.write(chunk, "binary");
		progressArray[uploadUUID].percent = percent;
    };

    // Set handler for request completed
    stream.onEnd = function(chunk) {
        // As this is after request completed, all writes should have been queued by now
        // So following callback will be executed after all the data is written out
        fileStream.addListener("drain", function() {
			// Close file stream
        	fileStream.end();
        	// Handle request completion, as all chunks were already written
        	// Make sure there was no error uploading
			if(progressArray[uploadUUID].percent != -1) {
				progressArray[uploadUUID].percent = 100;
				progressArray[uploadUUID].url = ("http://" + serverAddress + ":" + serverPort + "/download?file=" + uploadUUID + "/" + fileName); 
				logger.debug("Done uploading file and made it available on: " + progressArray[uploadUUID].url, req);
				res.write("Upload successful!");
			}
			res.end();
		});	
    };
}

