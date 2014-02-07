__UIC(["pages", "config"], function (global, ns) {

KangoAPI.onReady(function () {

var $status_section = $("#status").hide(),
    last_msg = null,
    display_status_msg = function (msg) {
        $status_section.text(msg);
        $status_section.fadeIn();
        last_msg = msg;
        window.setTimeout(function () {
            // Don't hide the feedback message if we've set a new feedback
            // message since this timeout function was registered.
            if (last_msg === msg) {
                $status_section.fadeOut();
            }
        }, 5000);
    },
    $email_field = $("#email"),
    $identifier_field = $("#secret-identifier"),
    $entrollment_date_field = $("#entrollment-date"),
    $check_in_date_field = $("#check-in-date"),
    $form_fields = $identifier_field
        .add($entrollment_date_field)
            .add($check_in_date_field),
    $submit_button = $("#submit"),
    $reset_button = $("#reset"),
    save_email,
    update_fields;

update_fields = function () {
    kango.dispatchMessage("request-for-config");
    return false;
};

kango.addMessageListener("response-for-config", function (event) {

    var config = event.data,
        start_date = config.registrationTime,
        check_in_date = config.checkInTime;

    if (config.email) {

        $email_field
            .val(config.email)
            .attr("readonly", "readonly");
        $submit_button.attr("disabled", "disabled");

    } else {

        $email_field
            .val("")
            .removeAttr("readonly");
        $submit_button.removeAttr("disabled");
    }

    if (config.installId) {
        $identifier_field.val(config.installId);
    }

    if (start_date) {
        $entrollment_date_field.val(global.utils.timestampToString(start_date));
    }

    if (check_in_date) {
        $check_in_date_field.val(global.utils.timestampToString(check_in_date));
    }
});

save_email = function () {
    display_status_msg("Registering extension with the recording server...");
    $submit_button.attr("disabled", "disabled");
    kango.dispatchMessage("request-set-email", $email_field.val());
    return false;
};

kango.addMessageListener("response-set-email", function (wasSuccess) {
    if (!wasSuccess.data) {
        display_status_msg("There was an error registering your extension with the recording server.  Please try again later or contact psnyde2@uic.edu.");
    } else {
        display_status_msg("Successfully registered extension with the recording server.")
    }
    update_fields();
});

$submit_button
    .click(save_email)
    .attr("disabled", "disabled");

$email_field.on("keydown", function () {
    $submit_button.removeAttr("disabled");
});

$reset_button.click(function () {
    kango.dispatchMessage("request-reset-config");
    return false;
});

kango.addMessageListener("response-reset-config", function (event) {
    $email_field
        .val("")
        .removeAttr("readonly");
    $form_fields.val("");
});

update_fields();

});

});
