On Extension install and/or Chrome start
===

Check For Email Address
1) Check to see if we have an email address stored for the user
    1.1) If not prompt, the user for an email address
    1.2) Report the email address to the server


Check Registration
2)  Check to see if we have an installation ID, group assignment and
    security token
    2.1) If not, register the extension's installation with this browser
         with the recording server and receive an installation ID and a
         group assignment (ie whether this will be in the test or experiment
         group).  Also receive a security token back from the server, which
         will just be SHA256(install_id + group_assignment + server secret)
         used to detect tampering.
    2.2) Persistently save these values in the extension, both in long term
         storage and in the extensions process (js variable)

Check System State / Cookie Rules
3) Check and see if we've checked the state of the system in the last 24 hours
    3.1) If not, fetch new system state information, which is a json description
         of a list of domains (as a list) and a single state description,
         either "waiting" (if the experiment has not started yet), "active"
         (if the experiment is underway) or "complete" (if the experiment
         has finished)
    3.2) Store these values persistently in the extension (in long term storage
         and in program state, along with timestamp of when the information was
         saved.

While Running
===
1) If user starts to type in password field
    1.1) Record that user typed in password

2) If user's session is ended
    2.1) Report to the end server that we're doing so



Server needs
    - Record email address
    - Register
    - Update Rules
    - Record password entry
    - Record session ended

1) Register
    Send:
        - extension version
        - browser

