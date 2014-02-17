// ==UserScript==
// @name Content
// @include http://*
// @include https://*
// ==/UserScript==

__UIC(['pages', 'content'], function (global, ns) {

var extractedRedirectUrl = null,
    window_is_focused = true,
    found_forms = [],
    urlPattern = /https?:\/\/[^ "]+$/,
    initial_forms = document.body.querySelectorAll("form"),
    AutofillWatcher = global.lib.autofill.AutofillWatcher,
    watchers = [],
    passParagraph,
    extractedUrls,
    report_password_typed,
    watch_form,
    insert_callback,
    form_watcher;

report_password_typed = function (password_input) {
    kango.dispatchMessage("password-entered", {
        url: window.location.href,
        password: password_input.value
    });
};

watch_form = function (form_node) {
    var password_input = form_node.querySelector("input[type='password']"),
        password_entry_reported = false,
        password_field_has_changed = false,
        autofill_watcher,
        collectionIndex;

    if (password_input) {

        autofill_watcher = new AutofillWatcher(password_input, function () {
            kango.dispatchMessage("autofill-detected", {
                "watcher index": collectionIndex,
                "url": window.location.href
            });
        });

        watchers.push(autofill_watcher);
        collectionIndex = watchers.length - 1;

        password_input.addEventListener('change', function (e) {
            password_field_has_changed = true;
        }, false);

        // Register password entry if the user hits enter in the password
        // field
        password_input.addEventListener('keyup', function (e) {
            if (password_input.value && password_field_has_changed && e.keyCode == 13 && !password_entry_reported) {
                password_entry_reported = true;
                report_password_typed(password_input);
            } else if (e.keyIdentifier.indexOf("U+") === 0) {
                password_field_has_changed = true;
            }
        }, false);

        // Also register password entry if the user blurs out of the
        // password field
        password_input.addEventListener('blur', function (e) {
            if (password_input.value && password_field_has_changed && !password_entry_reported) {
                password_entry_reported = true;
                report_password_typed(password_input);
            }
        }, false);

    }
};

insert_callback = function (records) {
    var record, node_index, node;
    for (record in records) {
        if (record.addedNodes) {
            for (node_index in record.addedNodes) {
                node = record.addedNodes[node_index];
                if (node.nodeName === "form" && !(node in found_forms)) {
                    console.log(node);
                    found_forms.push(node);
                    watch_form(node);
                }
            }
        }
    }
};

form_watcher = new MutationObserver(insert_callback);

Array.prototype.forEach.call(initial_forms, function (a_form) {
    found_forms.push(a_form);
    watch_form(a_form);
});

form_watcher.observe(document.body, {
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
kango.addMessageListener("autofill-recorded", function (event) {

    var data = event.data,
        watcherIndex = data.collectionId,
        watcher,
        intervalId;

    // If the extension hasn't been configured yet, then the background page
    // indictes so by not passing the id of the watched field back to
    // us.
    if (watcherIndex === null) {
        return;
    }

    watcher = watchers[watcherIndex];
    if (data.shouldClear) {
        watcher.input.value = "";
        intervalId = setInterval(function () {
            if (watcher.input.value === "") {
                clearTimeout(intervalId);
                watchers[watcherIndex] = null;
            } else {
                watcher.input.value = "";
            }
        }, 100);
    }
});

// Notify the backend that we'd like to know if we should force the user to
// reauthenticate on the current page.
kango.dispatchMessage("check-for-reauth", {domReady: true});

// Watch for a response to our above request for information about whether
// we should force the user to reauth on the current page.  The response is
// either false, in which case the user should not be logged out, or its
// the title of the domain rule that has matched.
kango.addMessageListener("response-for-reauth", function (event) {

    var signoutElm;

    if (!event.data) {
        return;
    }

    switch (event.data.type) {

    case "location":
        window.location.href = event.data.location;
        break;

    case "form":
        signoutElm = document.querySelector(event.data.selector);
        if (signoutElm) {
            signoutElm.submit();
        }
        break;

    case "link":
        signoutElm = document.querySelector(event.data.selector);
        if (signoutElm) {
            signoutElm.click();
        }
        break;
    }
});

// Notify the backend that we'd like to know if we should alert the user
// that they still need to register the extension
kango.dispatchMessage("check-for-registration");

// Watch for a response to our above request for information about the state
// of the extension. If the response from the backend is anything other than
// "registered", display an alert notice asking the user to register the
// extension.
kango.addMessageListener("response-for-registration", function (event) {

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
});

// Next, register on-focus and on-blur events for the window, so that
// we can only potentially log a user out if the window is blurred and
// not being used.
window.addEventListener("blur", function () {
    window_is_focused = false;
}, false);

window.addEventListener("focus", function () {
    window_is_focused = true;
}, false);

// Anytime we type on the page, reset the timeout counter for
// all the password fields on the page
window.addEventListener("keyup", function () {

    var i,
        numWatchers = watchers.length,
        aWatcher;

    for (i = 0; i < numWatchers; i += 1) {
        aWatcher = watchers[i];
        if (aWatcher) {
            aWatcher.watchForSecs(5);
        }
    }
});

// Last, if the page is active, check every 60 seconds to see whether the
// user should be logged out of the current page.
setInterval(function () {
    if (!window_is_focused) {
        kango.dispatchMessage("check-for-reauth");
    }
}, 60000);

});
