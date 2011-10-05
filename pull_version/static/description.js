$(function() {
  $("form").attr("action", "/done?upload_uuid="+window.parent.uploadUUID);
});

function checkText() {
  	var str = $('#descriptionText').val();
	//Javacript trim() does not work well with IE
	if(str == null || jQuery.trim(str).length == 0) {
		alert("Please enter some text first!");
		return false;
	}
	if(window.parent.percentDone < 100) {
		alert("Wait until upload is finished to save your description");
		return false;
	}
	return true;
}