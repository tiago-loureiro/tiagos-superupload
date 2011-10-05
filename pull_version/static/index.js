function genUUID() {
  	// Private array of chars to use
  	var chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz".split("");
  	var uuid = [];
  	// rfc4122, version 4 form
  	var r;
  	// rfc4122 requires these characters
  	uuid[8] = uuid[13] = uuid[18] = uuid[23] = "-";
  	uuid[14] = "4";

  	// Fill in random data.  At i==19 set the high bits of clock sequence as
  	// per rfc4122, sec. 4.1.5
  	for (i = 0; i < 36; i++) {
    	if (!uuid[i]) {
        	r = 0 | Math.random()*16;
        	uuid[i] = chars[(i == 19) ? (r & 0x3) | 0x8 : r];
      	}
  	}
  	return uuid.join("");
}

var uploadUUID = genUUID();
var percentDone = 0;

window.uploadStarted = function() {
	//Display both the progress and the description form
	$("#descriptionForm").show();
  	$("#progress").show();
  
  	function checkProgress() {
		var ts = new Date().getTime();
    	$.get("/progress", {upload_uuid:uploadUUID, NoCache: ts}, function(data) {
			var percent = parseFloat(data);
      		percentDone = percent;
			$("#percent").text("Status: " + percent + "%");
			if (percent == -1) {
				//This indicates an error message!
        		$("#percent").text("Error uploading your file! Too large file? Please, try again");	
			} else if (percent < 100) {
				setTimeout(checkProgress, 1000);
			} else {
        		uploadDone();
	  		}
		});
  	}
	checkProgress();
  	function uploadDone() {
		$.get('/progress', {upload_uuid:uploadUUID, show_name:true}, function(data) {
	  		$('#fileLocation').html("<a href=" + data + ">Uploaded to here!</a>");
    	});
  	}
}
