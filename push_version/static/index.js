var uploadUUID = '';
var percentDone = 0;

$(function() {
	$('#nojs').hide();
});

window.uploadStarted = function() {
	//Display both the progress and the description form
	$('#descriptionForm').show();
  	$('#progress').show();
	$('#percent').text('Status: 0%');
}

//Deals with all the events coming from the server
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

