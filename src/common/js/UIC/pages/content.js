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
        formWatcher,
        constants = global.constants,
        forEach = Array.prototype.forEach;

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
            pwFieldHasChanged = false,
            bindEventListeners,
            keyUpEventListener,
            blurEventListener,
            changeEventListener;

        keyUpEventListener = function (e) {
            if (pwInput.value &&         // If some password has been entered..
                    pwFieldHasChanged && // And the contents of the password
                                         // field have changed...
                    13 === e.keyCode &&  // and "return"  is being
                                         // pressed...
                    !pwEntryReported) {  // And this isn't redundant
                pwEntryReported = true;
                reportPasswordTyped(pwInput);
            } else if (String.fromCharCode(e.which)) {
                pwFieldHasChanged = true;
            }
        };

        changeEventListener = function () {
            pwFieldHasChanged = true;
        };

        blurEventListener = function () {
            if (pwInput.value &&
                    pwFieldHasChanged &&
                    !pwEntryReported) {
                pwEntryReported = true;
                reportPasswordTyped(pwInput);
            }
        };

        bindEventListeners = function () {
            // Mark fields as dirty once they've changed once.  Otherwise,
            // if this hasn't fired, then we can disregard the other events.
            pwInput.addEventListener('change', changeEventListener, false);

            // Register password entry if the user hits enter in the password
            // field
            pwInput.addEventListener('keyup', keyUpEventListener, false);

            // Also register password entry if the user blurs out of the
            // password field
            pwInput.addEventListener('blur', blurEventListener, false);
        };

        if (pwInput) {
            pwInput.value = "";
            autofillWatcher.addInput(pwInput);

            bindEventListeners();
            // Spam event bindings for password fields, to try and combat
            // pages that want to unbind us.
            [500, 1000, 2000].forEach(function (milSecs) {
                window.setTimeout(bindEventListeners, milSecs);
            });
        }
    };

    insertCallback = function (records) {
        records.forEach(function (mutation) {
            if (mutation.type !== "childList") {
                return;
            }

            if (!mutation.addedNodes) {
                return;
            }

            forEach.call(
                mutation.addedNodes,
                function (anAddedNode) {
                    var localForms = [];

                    // If we don't have something that looks like a Node element
                    // (such as text or white space), we can safely disregard
                    if (!anAddedNode.querySelectorAll) {
                        return;
                    }

                    if (anAddedNode.nodeName === "form" && !(anAddedNode in foundForms)) {
                        localForms.push(anAddedNode);
                    }

                    forEach.call(
                        anAddedNode.querySelectorAll("form"),
                        function (aForm) {
                            if (!(aForm in localForms)) {
                                localForms.push(aForm);
                            }
                        }
                    );

                    localForms.forEach(function (aNewForm) {
                        foundForms.push(anAddedNode);
                        watchForm(anAddedNode);
                    });
                }
            );
        });
    };

    formWatcher = new MutationObserver(insertCallback);

    forEach.call(initialForms, function (a_form) {
        foundForms.push(a_form);
        watchForm(a_form);
    });

    formWatcher.observe(document.body, {
        childList: true,
        attributes: true,
        characterData: true,
        subtree: true
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

    // Notify the backend that we'd like to know if we should force the user to
    // reauthenticate on the current page.
    kango.dispatchMessage("page-loaded", {domReady: true});

    // Watch for a response to our above request for information about the state
    // of the extension. If the response from the backend is anything other than
    // "registered", display an alert notice asking the user to register the
    // extension.
    kango.addMessageListener(
        "response-for-registration",
        function responseForRegistrationCallback(event) {

            var topBar,
                descriptionP = document.createElement("P"),
                optionsP = document.createElement("P"),
                dismissPressed,
                preferencesPressed;

            if (event.data === "registered" || event.data === "dismissed") {
                return;
            }

            dismissPressed = function (e) {
                topBar.parentNode.removeChild(topBar);
                kango.dispatchMessage("top-bar-dismissed");
                e.preventDefault();
            };

            preferencesPressed = function (e) {
                kango.dispatchMessage("top-bar-preferences");
                topBar.parentNode.removeChild(topBar);
                e.preventDefault();
            };

            topBar = document.createElement("DIV");
            topBar.style.boxSizing = "content-box";
            topBar.style.position = "fixed";
            topBar.style.top = 0;
            topBar.style.width = "100%";
            topBar.style.height = "2em";
            topBar.style.borderBottom = "1px solid black";
            topBar.style.backgroundColor = "#f77b7b";
            topBar.style.color = "black";
            topBar.style.textAlign = "center";
            topBar.style.fontSize = "16px";
            topBar.style.paddingTop = "1em";
            topBar.style.paddingBottom = "1em";
            topBar.style.zIndex = 100000;
            topBar.style.overflow = "hidden";
            topBar.style.fontWeight = "normal";
            topBar.style.fontFamily = "Sans-Serif";

            descriptionP.innerHTML = "If this is your primary web browsing device, please configure the UIC Security Study extension now. If not, it is okay to dismiss this dialog.";
            descriptionP.style.padding = 0;
            descriptionP.style.margin = 0;
            topBar.appendChild(descriptionP);

            optionsP.innerHTML = "<a id='uic-preferences-link' href='#'>Configure</a> - <a id='uic-dismiss-link' href='#'>Dismiss</a>";
            optionsP.style.padding = 0;
            optionsP.style.margin = 0;

            topBar.appendChild(optionsP);
            document.body.insertBefore(topBar, document.body.firstChild);

            document.getElementById('uic-dismiss-link').addEventListener(
                "click",
                dismissPressed,
                false
            );

            document.getElementById('uic-preferences-link').addEventListener(
                'click',
                preferencesPressed,
                false
            );
        }
    );

    // Notify the backend that we'd like to know if we should alert the user
    // that they still need to register the extension
    kango.dispatchMessage("check-for-registration");
});
