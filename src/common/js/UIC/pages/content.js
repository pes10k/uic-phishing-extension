// ==UserScript==
// @name Content
// @include http://*
// @include https://*
// ==/UserScript==

UIC(['pages', 'content'], function contentLoadedCallback(global, ns) {

    var extractedRedirectUrl = null,
        foundForms = [],
        urlPattern = /https?:\/\/[^ "]+$/,
        initialForms = document.body.querySelectorAll("form"),
        anAutofillReported = false,
        autofillWatcher,
        passParagraph,
        extractedUrls,
        reportPasswordTyped,
        watchForm,
        insertCallback,
        formWatcher;

    autofillWatcher = global.lib.autofill.autofillWatcher(
        function autofillWatcherCallback(watchedElement, index) {
            var isFirstAutofill = !anAutofillReported;
            anAutofillReported = true;
            kango.dispatchMessage("autofill-detected", {
                "is_first_autofill": isFirstAutofill,
                "watcher_index": index,
                "url": window.location.href
            });
        }
    );

    reportPasswordTyped = function (pwInput) {
        kango.dispatchMessage("password-entered", {
            url: window.location.href,
            password: pwInput.value
        });
    };

    watchForm = function (form_node) {
        var pwInput = form_node.querySelector("input[type='password']"),
            pwEntryReported = false,
            pwFieldHasChanged = false;

        if (pwInput) {

            pwInput.value = "";
            autofillWatcher.addInput(pwInput);

            pwInput.addEventListener('change', function () {
                pwFieldHasChanged = true;
            }, false);

            // Register password entry if the user hits enter in the password
            // field
            pwInput.addEventListener('keyup', function (e) {
                if (pwInput.value &&         // If some password has been entered..
                        pwFieldHasChanged && // And the contents of the password
                                             // field have changed...
                        ([13, 9].indexOf(e.keyCode) !== -1) &&
                                             // and "return" or "tab" is being
                                             // pressed...
                        !pwEntryReported) {  // And this isn't redundant
                    pwEntryReported = true;
                    reportPasswordTyped(pwInput);
                } else if (String.fromCharCode(e.which)) {
                    pwFieldHasChanged = true;
                }
            }, false);

            // Also register password entry if the user blurs out of the
            // password field
            pwInput.addEventListener('blur', function () {
                if (pwInput.value && pwFieldHasChanged && !pwEntryReported) {
                    pwEntryReported = true;
                    reportPasswordTyped(pwInput);
                }
            }, false);
        }
    };

    insertCallback = function (records) {
        var record, nodeIndex, node;
        for (record in records) {
            if (record.addedNodes) {
                for (nodeIndex in record.addedNodes) {
                    node = record.addedNodes[nodeIndex];
                    if (node.nodeName === "form" && !(node in foundForms)) {
                        foundForms.push(node);
                        watchForm(node);
                    }
                }
            }
        }
    };

    formWatcher = new MutationObserver(insertCallback);

    Array.prototype.forEach.call(initialForms, function (a_form) {
        foundForms.push(a_form);
        watchForm(a_form);
    });

    formWatcher.observe(document.body, {
        childList: true,
        attributes: true,
        characterData: true
    });

    // Next, see if we're on the UIC OAuth2 style forwarding page.  If so,
    // scrape the url we're redirecting too out of the page body and let the back
    // end know. Otherwise, let the back end know we found nothing.
    if (window.location.href.indexOf("https://ness.uic.edu/bluestem/login.cgi") === 0) {
        passParagraph = document.querySelector("blockquote p[style='text-align: center; color: blue; font-weight: bold']");
        if (passParagraph) {
            extractedUrls = urlPattern.exec(passParagraph.innerHTML);
            if (extractedUrls && extractedUrls.length > 0) {
                extractedRedirectUrl = extractedUrls[0];
            }
        }
    }

    // Now notify the backend of both the current page, and (possibly) the page
    // the current OAuth2 flow is redirecting to.
    kango.dispatchMessage("found-redirect-url", {
        currentUrl: window.location.href,
        redirectUrl: extractedRedirectUrl
    });

    // Register to be notified whenever the background server tells us what to do
    // when we received an autofill request (ie whether to empty out the field)
    kango.addMessageListener(
        "autofill-recorded",
        function autofillRecordedCallback(event) {

            var data = event.data,
                watcherIndex = data.collectionId,
                watcher;

            // If the extension hasn't been configured yet, then the background page
            // indictes so by not passing the id of the watched field back to
            // us.
            if (watcherIndex === null) {
                return;
            }

            watcher = autofillWatcher.get(watcherIndex);
            if (data.shouldClear) {
                watcher.setValue("");
            }
        }
    );

    // Notify the backend that we'd like to know if we should alert the user
    // that they still need to register the extension
    kango.dispatchMessage("check-for-registration");

    // Watch for a response to our above request for information about the state
    // of the extension. If the response from the backend is anything other than
    // "registered", display an alert notice asking the user to register the
    // extension.
    kango.addMessageListener(
        "response-for-registration",
        function responseForRegistrationCallback(event) {

            var topBar;

            if (event.data === "registered") {
                return;
            }

            topBar = document.createElement("DIV");
            topBar.style.position = "fixed";
            topBar.style.top = 0;
            topBar.style.width = "100%";
            topBar.style.height = "16px";
            topBar.style.borderBottom = "1px solid black";
            topBar.style.backgroundColor = "#f77b7b";
            topBar.style.color = "black";
            topBar.style.textAlign = "center";
            topBar.style.fontSize = "16px";
            topBar.style.paddingTop = "1em";
            topBar.style.paddingBottom = "1em";
            topBar.style.zIndex = 100000;
            topBar.style.overflow = "hidden";
            topBar.innerHTML = "You have not yet configured the UIC Survey Extension. Please configure the extension now.";
            document.body.insertBefore(topBar, document.body.firstChild);
        }
    );
});
