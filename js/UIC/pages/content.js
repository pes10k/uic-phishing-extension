__UIC(['pages', 'content'], function (global, ns) {

    var events = global.platforms.events.getInstance(),
        found_forms = [],
        host = window.location.host,
        report_password_typed = function () {
            events.sendClientEvent("password", null, function () {});
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

    // Check to see if we have an email address for the user.  If not,
    // insert an error message into all pages the user visits, asking them
    // to finish configuring the extension.
    (function () {
        events.sendClientEvent("get-config", null, function (response) {
            var top_bar;
            if (!response || !response.email) {
                top_bar = document.createElement("DIV");
                top_bar.style.position = "fixed";
                top_bar.style.top = 0;
                top_bar.style.width = "100%";
                top_bar.style.height = "16px";
                top_bar.style.borderBottom = "1px solid black";
                top_bar.style.backgroundColor = "#f77b7b";
                top_bar.style.color = "black";
                top_bar.style.textAlign = "center";
                top_bar.style.fontSize = "16px";
                top_bar.style.paddingTop = "1em";
                top_bar.style.paddingBottom = "1em";
                top_bar.style.zIndex = 100000;
                top_bar.style.overflow = "hidden";
                top_bar.innerHTML = "You have not yet configured the UIC Survey Extension. Please configure the extension now.";
                document.body.insertBefore(top_bar, document.body.firstChild);
            }
        });
        return false;
    }());
});
