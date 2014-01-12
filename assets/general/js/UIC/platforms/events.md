# Cross platform Events API

## Description

Small subset of cross platform code to support browser and DOM events
across targeted extension targets.

## API

## onBrowserReady
Takes a single argument, a callback function. This callback function will be
called whenever the browser has finished starting up.

This callback function is called with no arguments.


### onTabCreate
Takes a single argument, a callback function. This callback function will
be called whenever a new tab is created in the browser.

The callback function is called with the below to arguments:

 - **tabId**: A unique identifier in the current browser session for the
              created tab
 - **url**:   The url being loaded in the tab, if one exists (a newly created
              tab might not have a specified url)


### onTabClose
Takes a single argument, a callback function. This callback function will be
called whenever a tab is closed in the browser.

The callback function is called with a single argument:

 - **tabId**: The unique id of the tab being closed in the browser session


### onTabLoadStart
Takes a single argument, a callback function. This callback function will
be called whenever a tab begins loading a new page. This callback function
*will not* be called for sub-page events, like AJAX calls.

The callback function is called with the below to arguments:

 - **tabId**: A unique identifier in the current browser session for the
              created tab
 - **url**:   The url being loaded in the tab, if one exists (a newly created
              tab might not have a specified url)


### onTabLoadComplete

Takes a single argument, a callback function. This callback function will be
call when a tab finishes loading a new page (ie all initial page assets have
been fetched).  This callback function *will not* be called for sub-page events,
like AJAX calls.

The callback function is called with the below to arguments:

 - **tabId**: A unique identifier in the current browser session for the
              created tab
 - **url**:   The url being loaded in the tab, if one exists (a newly created
              tab might not have a specified url)


### onContentEvent

Called whenever a content / browser page calls an arbitrary event in the
extension. This is the client side of the page (content) -> extension two
way event communication system

Takes two arguments, described below:

 - **eventName**: The name, as a string, of the event to watch for being called
                  in the content page
 - **callback**:  A callback function, to be called when the content / page
                  triggers the relevant event.

The callback function will be called with two arguments:

 - **msg**:            An arbitrary object, passed from a content page to the
                       extension
 - **clientCallback**: A client provided callback function, to be called
                       whenever the extension has finished processing this
                       client event.

### sendContentEvent

Called by content pages to send information from the extension to the client
page. Takes three arguments:

 - **eventName**: The name, as a string, of the event to watch for being called
                  in the content page
 - **data**:      An arbitrary object, passed from a content page to the
                  extension.
 - **callback**:  A client provided callback function, to be called
                  whenever the extension has finished processing this
                  client event.
