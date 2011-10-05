window.setId = function() {
    $('form').attr('action', '/upload?upload_uuid='+window.parent.uploadUUID);
}