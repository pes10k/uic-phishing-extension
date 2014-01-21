// ==UserScript==
// @name Content
// @include http://*
// @include https://*
// ==/UserScript==

__UIC(['pages', 'content'], function (global, ns) {

var found_forms = [],
    host = window.location.host,
    report_password_typed = function () {
        kango.dispatchMessage("password-entered", {url: window.location.href});
    },
    watch_form = function (form_node) {
        var password_input = form_node.querySelector("input[type='password']"),
            has_touched_password = false;

        if (password_input) {
            password_input.setAttribute('autocomplete', 'off');
            password_input.value = "";

            password_input.addEventListener('keyup', function () {
                if (!has_touched_password) {
                    has_touched_password = true;
                    report_password_typed();
                }
            }, false);
        }
    },
    insert_callback = function (records) {
        var record, node_index, node;
        for (record in records) {
            if (record.addedNodes) {
                for (node_index in record.addedNodes) {
                    node = record.addedNodes[node_index];
                    if (node.nodeName === "form" && !(node in found_forms)) {
                        found_forms.push(node);
                        watch_form(node);
                    }
                }
            }
        }
    },
    form_watcher = new MutationObserver(insert_callback),
    initial_forms;

initial_forms = document.body.querySelectorAll("form");

Array.prototype.forEach.call(initial_forms, function (a_form) {
    found_forms.push(a_form);
    watch_form(a_form);
});

form_watcher.observe(document.body, {
    childList: true,
    attributes: true,
    characterData: true
});

// Notify the backend that we'd like to know if we should force the user to
// reauthenticate on the current page.
kango.dispatchMessage("check-for-reauth");

// Watch for a response to our above request for information about whether
// we should force the user to reauth on the current page.  The response is
// either false, in which case the user should not be logged out, or its
// the title of the domain rule that has matched.
kango.addMessageListener("response-for-reauth", function (event) {

    var signoutForm;

    if (!event.data) {
        return;
    }

    switch (event.data) {

        case "Facebook":
            signoutForm = document.getElementById("logout_form");
            if (signoutForm) {
                signoutForm.submit();
            }
            break;

        case "Gmail":
            window.location.href = "https://mail.google.com/mail/u/0/?logout&hl=en&hlor";
            break;

        case "Tumblr":
            window.location.href = "http://www.tumblr.com/logout";
            break;

        case "Twitter":
            signoutForm = document.getElementById("signout-form");
            if (signoutForm) {
                signoutForm.submit();
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

});
