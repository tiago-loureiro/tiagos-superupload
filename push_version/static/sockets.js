var socket = io.connect(window.location.href);
socket.on('connect', function () {
	
	socket.on('sessionID', function (data) {
		window.uploadUUID = data;
	});

	socket.on('progress', function(data) {
		window.percentDone = parseFloat(data);
		$('#percent').text('Status: ' + data + '%');
	});
	
	socket.on('url', function(data) {
		$('#fileLocation').html('<a href=' + data + '>Uploaded to here!</a>');
	});
});
