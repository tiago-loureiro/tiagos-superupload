Requirements
============

Some of the requirements of this project were to have as little 
dependencies as possible while keeping the code short, simple and clean.
However, some parts are just time consuming to write (such as parsing a multipart
form) and would just make the codebase grow immensely. Therefore, some
of the dependencies are:

Nodejs
------
Used as the basis of the project, it serves as an HTTP server and is based 
on Google's V8 JavaScript engine. It must be downloaded separately.

multipart-js
------------
This is the library used for the multipart form parsing. It claims to be
a pre-pre-alpha module but it is sufficient for my purposes.
It must be installed as a separate module.

node-mime
---------
Support for mapping between file extensions and MIME types. Upon downloading
files, we need to do this mapping so this library serves very useful then.
It must be installed as a separate module.

jQuery
------
It simplifies HTML document traversing, event handling and deals with browser
incompatibilities and is therefore included as well. 
It is included in the project, no need for separate install.

socket.io
---------
This is what was used for pushing events from the server to the client. It aims
to make realtime apps possible in every browser and mobile device, blurring the
differences between the different transport mechanisms.
No need for separate install.


Architecture
============

Client side
-----------
The client side is very simple and includes only 3 html files: index.html,
description.html and upload.html.

index.html contains simply 2 iframes that correspond to the upload form
and the description form. They are hidden or shown when needed.

After submitting the file for upload the result of the request is then
displayed on the page as an answer to the request (file successfully
uploaded, etc.)
The same is done when submitting the description: the user can start
entering the text as soon as the upload starts but can only submit
this information after the file has finished uploading.

Upon page load, a connection to the server is established using socket.io
and a session.id is received. This is the id used throughout all the requests
done to the server in order to uniquely identify each client.
The client listens to events 'progress' which tell how much of the file
has been successfully upload and 'url' which contains the location of
the file just uploaded.
Upon receiving these events, the page is properly updated.

The user also sees a link (and also the full description) where he can 
download the file from. Pressing on the link will initiate a download
as with any other regular download service.

Server side
-----------

Nodejs serves as an HTTP server and signals incoming requests.

As soon as a user connects, the server will generate a unique ID used
for the whole duration of the session.

Upon receiving a request, it is routed properly based on the requested URL
and different handlers will deal with different tasks. The handlers are:

 * static files
 * upload
 * download
 * done

Whenever a user requests some static file (e.g.: index.html upon entering
the main url) the server simply checks for the file existence, opens the
file, sets the content for the reply and sends the file contents in the reply.

Upload is requested by using the sessionID and by parsing the multipart form
data. Several checks are done, a directory is created with some random unique
id and a file is created. The file is written to in chunks, using pause and
resume, so that the browser only sends more data whenever the buffer has been
written to disk. This prevents memory from growing and allows for a very fast
upload since the server is not overwhelmed with data in the socket while
still busy writing to disk.

Download is requested using a full URL which contains the folder in which
the file is located and the filename. Upon receiving a request, the URL is
parsed and file existence is checked: if this is successful, the file is
streamed back to the client with the appropriate MIME type set. It is also
important to know that the response is also throttled: failure in doing so
will cause a very slow download and the browser might even become unresponsive.
If the file does not exist, the user is informed of this.

Done is requested when submitting the file description. Again the sessionID
is sent along the POST request and stored in the server in a file named
'description.txt' in the same folder as the data file.
The URL for downloading the file and the text entered by the user is sent
back as a reply.

While uploading, the server loops through all the connected clients and 
emits an event 'progress' sent to each user with the completion percentage.
Upon completion, a final event is sent, event 'url' which contains the full
path for downloading the file.


Building and running
====================

In order to build and run the server, follow these steps:

Download source code

	wget https://github.com/tiago-loureiro/tiagos-superupload/tarball/master -O super_upload.tar.gz
	tar zxvf super_upload.tar.gz

Install nodejs

	wget http://nodejs.org/dist/v0.5.8/node-v0.5.8.tar.gz
	tar zxvf node-v0.5.8.tar.gz
	./configure
	./make install

Install needed modules

	wget https://github.com/isaacs/multipart-js/tarball/master -O multipart.tar.gz
	npm install multipart.tar.gz
	npm install socket.io
	npm install mime

Enter the super_upload dir

	cd tiago-loureiro-tiagos-superupload-XXXXXXX/push_version

Edit super_upload.js and modify the variables accordingly

	var serverAddress = '79.168.102.155';
	var serverPort = 8080;

	node super_upload

Should be up and running, logging is done to stdout!


Testing, limitations, comments
==============================
As per requirements, the system should work with IE>6, Firefox and Chrome.  
I have tested it with IE6 and IE8, Firefox 7 and Chrome 14 and all run fine.

During my testing I have found out the following issues:

Both IE and Firefox behave very badly when it comes to file uploading of 
sizes > 2GB. They report bad length and make several requests which
is not expected in the case of file uploading. More info regarding this
topic can be found at:
http://www.motobit.com/help/scptutl/pa98.htm
Whenever a big file is submitted, the server will get several submissions
and start ignoring the following requests... the browser will show a server
reset communication page on the upload frame.

Submitting text which is not ASCII will cause the text to be stored in a
wrong encoded format. There are some ways to support full UTF-8 but that
will be left for a future implementation.

If the filename includes ',' it is badly parsed by the multipart module
which returns an undefined object. In this case the file upload cannot
take place and the user is prompted with the message: 'Sorry we could 
not parse the filename, try again!'
