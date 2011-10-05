var uploadUUID = "";
var percentDone = 0;

window.uploadStarted = function() {
	//Display both the progress and the description form
	$('#descriptionForm').show();
  	$('#progress').show();
	$('#percent').text('Status: 0%');
}
