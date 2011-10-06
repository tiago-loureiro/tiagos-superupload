Introduction
============
This project is the solution to a test task given to me to build a system that 
will accept a multipart form upload while displaying a percentage progress.

Challenges
----------
The main challenges regarding this task are:

 * Processing a multipart form
 * Deal with file upload/download
 * Handle file upload with a progress value (implies continuous info sent back and forth) 
 * Support for simultaneous users
 * Robust, scalable and cross-browser

Choice of programming language
------------------------------
I was given full liberty to choose whichever programming language I felt was more 
appropriate or that I was most comfortable with. I come from a strong C++/Java
background but I preferred going for a bit of a different approach.
Given the suggestions, one that immediately stood out was Javascript with Node.js.
I had never heard of Node.js before and decided to have a look at it - some of
the keywords that have lead me to believe this could be a great solution:

 * Easy way to build scalable network programs
 * Low memory footprint
 * Event driven, no locking from I/O
 * Well developed HTTP stack
 * High performance for concurrent users!

I decided to give it a go using Node.js!

Solution
--------
The way I see this project, there are 2 main ways of solving the upload progress issue:
1. Polling for data every n seconds
2. Pushing info from the server every n seconds

The first approach is probably the most common way of doing such things but I believe
the web is evolving towards bi-directional, full-duplex communications channels, over a 
single Transmission Control Protocol (TCP) socket - WebSockets. I believe this is the
best solution for this problem as it keeps the bandwidth lower (only needed data is
sent over the wire, no need for HTTP headers overhead, etc.) and information is sent out
from the server whenever necessary. Unfortunately Internet Explorer still does not 
support WebSockets but socket.io is a very nice module for node.js which attempts to
simulate WebSockets with the advantage that it also works with IE.
I also have a version of the project with poll (poll_version) but the one I would
use in a production environment would be the push one (push_version) and this is
the one I will describe in more detail in the push_version README.md

Author
------
Tiago Loureiro